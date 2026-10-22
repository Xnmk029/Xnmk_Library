#!/usr/bin/env node
/**
 * Antigravity Model Body-Text TPS Benchmark Tool (tps-bench.mjs)
 *
 * Measures the generation speed (Tokens Per Second, TPS) of the active model,
 * specifically isolating body text (正文 `content`) and excluding chain-of-thought (`thinking`).
 *
 * Modes:
 *   1. start-watch : Records start marker & spawns a detached 2ms watcher on transcript_full.jsonl
 *   2. report      : Captures end marker, analyzes 2ms trace + transcript_full.jsonl, outputs TPS report
 *   3. analyze     : Analyzes all historical steps in transcript_full.jsonl
 */

const CLI_ENTRY_WALL_MS = Date.now();

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_TRACE_PATH = path.join(__dirname, 'last-trace.json');
const DEFAULT_MARKER_PATH = path.join(__dirname, 'last-marker.json');
const DEFAULT_RESULT_PATH = path.join(__dirname, 'last-result.json');
const HISTORY_TRACE_PATH = path.join(__dirname, 'watch-history.json');

/**
 * Calibrated token estimator for Gemini SentencePiece tokenizer across CJK, ASCII words, digits, and punctuation.
 */
export function estimateTextTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  let cjkCount = 0;
  let digitRuns = 0;
  let asciiWords = 0;
  let punctCount = 0;

  const cjkMatches = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  if (cjkMatches) cjkCount = cjkMatches.length;

  const wordMatches = text.match(/[a-zA-Z]+/g);
  if (wordMatches) {
    for (const w of wordMatches) {
      asciiWords += Math.max(1, Math.ceil(w.length / 4.5));
    }
  }

  const numMatches = text.match(/[0-9]+/g);
  if (numMatches) {
    for (const n of numMatches) {
      digitRuns += Math.max(1, Math.ceil(n.length / 2.5));
    }
  }

  const punctMatches = text.match(/[^\w\s\u4e00-\u9fff\u3400-\u4dbf]/g);
  if (punctMatches) punctCount = punctMatches.length;

  return Math.max(
    1,
    Math.round(cjkCount * 0.82 + asciiWords * 1.05 + digitRuns * 1.1 + punctCount * 0.65)
  );
}

/**
 * Partition a PLANNER_RESPONSE step's tokens into thinking, body (content), and tool_calls.
 * Strictly isolates body text (`content`) tokens from `thinking` and `tool_calls`.
 */
export function decomposeStepTokens(step) {
  const apiOutputTokens = step.output_tokens ?? 0;
  const thinkingText = step.thinking ?? '';
  const contentText = step.content ?? '';
  const toolCallsText = step.tool_calls ? JSON.stringify(step.tool_calls) : '';

  const rawThinkingEst = thinkingText ? estimateTextTokens(thinkingText) : 0;
  const rawContentEst = contentText ? estimateTextTokens(contentText) : 0;
  const rawToolsEst = toolCallsText ? estimateTextTokens(toolCallsText) : 0;

  // Detect un-summarized short thinking ONLY when content is empty and apiOutputTokens >> tool_tokens
  const visibleEstTotal = rawContentEst + rawToolsEst;
  const excessTokens = Math.max(0, apiOutputTokens - visibleEstTotal);
  const hasHiddenThinking =
    !thinkingText &&
    contentText.length === 0 &&
    excessTokens > 35 &&
    excessTokens > visibleEstTotal * 0.35;

  const hasThinking = Boolean(thinkingText) || hasHiddenThinking;

  if (!hasThinking) {
    // Zero-thinking turn: all apiOutputTokens belong to visible content + tool_calls
    const bodyTokens =
      visibleEstTotal > 0 && apiOutputTokens > 0
        ? Math.round(apiOutputTokens * (rawContentEst / visibleEstTotal))
        : rawContentEst;
    const toolTokens = Math.max(0, apiOutputTokens - bodyTokens);
    return {
      api_output_tokens: apiOutputTokens,
      body_tokens: bodyTokens,
      thinking_tokens: 0,
      tool_tokens: toolTokens,
      raw_body_est: rawContentEst,
      raw_thinking_est: 0,
      raw_tool_est: rawToolsEst,
      is_pure_body: !step.tool_calls && contentText.length > 0,
      has_thinking: false,
    };
  }

  // Turn with thinking:
  const visibleBodyTokens = Math.min(apiOutputTokens, rawContentEst);
  const visibleToolTokens = Math.min(
    Math.max(0, apiOutputTokens - visibleBodyTokens),
    rawToolsEst
  );
  const internalThinkingTokens = Math.max(
    rawThinkingEst,
    apiOutputTokens - visibleBodyTokens - visibleToolTokens
  );

  return {
    api_output_tokens: apiOutputTokens,
    body_tokens: visibleBodyTokens,
    thinking_tokens: internalThinkingTokens,
    tool_tokens: visibleToolTokens,
    raw_body_est: rawContentEst,
    raw_thinking_est: rawThinkingEst,
    raw_tool_est: rawToolsEst,
    is_pure_body: false,
    has_thinking: true,
  };
}

function parseJsonlSafe(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const steps = [];
  for (const line of lines) {
    try {
      steps.push(JSON.parse(line));
    } catch {
      // ignore partial line during concurrent write
    }
  }
  return steps;
}

/**
 * Persist high-res step timings across multiple watcher invocations so multi-point
 * differential benchmarks retain 2ms timestamps for all probed steps.
 */
function loadSavedStepTimings() {
  if (!fs.existsSync(HISTORY_TRACE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(HISTORY_TRACE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveStepTimings(mapObj) {
  try {
    fs.writeFileSync(HISTORY_TRACE_PATH, JSON.stringify(mapObj, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

/**
 * Background worker loop that polls transcript_full.jsonl every 2ms.
 */
async function runWatchWorker(transcriptPath, tracePath, durationSec) {
  const startWallMs = Date.now();
  const startPerfMs = performance.now();
  const endWallMs = startWallMs + durationSec * 1000;

  let lastSize = -1;
  let lastMtimeMs = -1;
  let lastRawSnapshot = '';

  const events = [];

  const captureSnapshot = (reason) => {
    try {
      const stat = fs.statSync(transcriptPath);
      const nowWall = Date.now();
      const nowPerf = Number((performance.now() - startPerfMs).toFixed(3));

      if (
        reason === 'poll' &&
        stat.size === lastSize &&
        stat.mtimeMs === lastMtimeMs
      ) {
        return;
      }

      const raw = fs.readFileSync(transcriptPath, 'utf8');
      if (reason === 'poll' && raw === lastRawSnapshot) {
        lastSize = stat.size;
        lastMtimeMs = stat.mtimeMs;
        return;
      }

      lastSize = stat.size;
      lastMtimeMs = stat.mtimeMs;
      lastRawSnapshot = raw;

      const steps = parseJsonlSafe(raw);
      const tailSteps = steps.slice(-4).map((s) => ({
        step_index: s.step_index,
        type: s.type,
        source: s.source,
        status: s.status,
        created_at: s.created_at,
        output_tokens: s.output_tokens ?? null,
        input_tokens: s.input_tokens ?? null,
        cache_read_tokens: s.cache_read_tokens ?? null,
        thinking_len: (s.thinking ?? '').length,
        content_len: (s.content ?? '').length,
        tool_calls_count: Array.isArray(s.tool_calls) ? s.tool_calls.length : 0,
      }));

      events.push({
        reason,
        wall_ms: nowWall,
        wall_iso: new Date(nowWall).toISOString(),
        rel_ms: nowPerf,
        file_mtime_ms: stat.mtimeMs,
        file_size: stat.size,
        total_steps: steps.length,
        tail_steps: tailSteps,
      });

      fs.writeFileSync(
        tracePath,
        JSON.stringify(
          {
            transcript_path: transcriptPath,
            watch_started_ms: startWallMs,
            watch_started_iso: new Date(startWallMs).toISOString(),
            last_updated_ms: nowWall,
            duration_sec: durationSec,
            events,
          },
          null,
          2
        ),
        'utf8'
      );
    } catch {
      // Ignore transient read errors
    }
  };

  captureSnapshot('init');

  const timer = setInterval(() => {
    if (Date.now() >= endWallMs) {
      clearInterval(timer);
      captureSnapshot('final');
      process.exit(0);
    }
    captureSnapshot('poll');
  }, 2);
}

/**
 * Analyze trace + marker + transcript_full.jsonl and compute pure body TPS.
 */
function generateReport(transcriptPath, tracePath, markerPath) {
  if (!fs.existsSync(transcriptPath)) {
    throw new Error(`Transcript file not found: ${transcriptPath}`);
  }
  const rawTranscript = fs.readFileSync(transcriptPath, 'utf8');
  const steps = parseJsonlSafe(rawTranscript);

  let trace = null;
  if (tracePath && fs.existsSync(tracePath)) {
    try {
      trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
    } catch {
      trace = null;
    }
  }

  let marker = null;
  if (markerPath && fs.existsSync(markerPath)) {
    try {
      marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    } catch {
      marker = null;
    }
  }

  const savedTimings = loadSavedStepTimings();
  const highResStepTimes = new Map();
  for (const [k, v] of Object.entries(savedTimings)) {
    highResStepTimes.set(Number(k), v);
  }

  if (trace && Array.isArray(trace.events)) {
    for (const ev of trace.events) {
      if (ev.reason === 'init') continue;
      for (const ts of ev.tail_steps || []) {
        const idx = ts.step_index;
        if (!highResStepTimes.has(idx)) {
          highResStepTimes.set(idx, {
            first_seen_ms: ev.wall_ms,
            first_seen_mtime_ms: ev.file_mtime_ms,
            first_thinking_ms: ts.thinking_len > 0 ? ev.wall_ms : null,
            last_thinking_change_ms: ts.thinking_len > 0 ? ev.wall_ms : null,
            last_thinking_len: ts.thinking_len,
            first_content_ms: ts.content_len > 0 ? ev.wall_ms : null,
            done_ms: ts.status === 'DONE' ? ev.wall_ms : null,
            done_mtime_ms: ts.status === 'DONE' ? ev.file_mtime_ms : null,
          });
        } else {
          const rec = highResStepTimes.get(idx);
          if (ts.thinking_len > 0 && !rec.first_thinking_ms) {
            rec.first_thinking_ms = ev.wall_ms;
          }
          if (ts.thinking_len !== rec.last_thinking_len) {
            rec.last_thinking_len = ts.thinking_len;
            rec.last_thinking_change_ms = ev.wall_ms;
          }
          if (ts.content_len > 0 && !rec.first_content_ms) {
            rec.first_content_ms = ev.wall_ms;
          }
          if (ts.status === 'DONE' && !rec.done_ms) {
            rec.done_ms = ev.wall_ms;
            rec.done_mtime_ms = ev.file_mtime_ms;
          }
        }
      }
    }
  }

  const toSave = {};
  for (const [k, v] of highResStepTimes.entries()) {
    toSave[k] = v;
  }
  saveStepTimings(toSave);

  const plannerMetrics = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.type !== 'PLANNER_RESPONSE') continue;

    const prevStep = i > 0 ? steps[i - 1] : null;
    const nextStep = i + 1 < steps.length ? steps[i + 1] : null;
    const tokenInfo = decomposeStepTokens(step);

    const hrCurr = highResStepTimes.get(step.step_index);
    const hrPrev = prevStep ? highResStepTimes.get(prevStep.step_index) : null;

    let stepStartMs = Date.parse(step.created_at);
    let stepEndMs = nextStep ? Date.parse(nextStep.created_at) : null;
    let timingSource = 'transcript_iso_1s';

    const isLatestPlannerStep =
      i === steps.length - 1 ||
      (i === steps.length - 2 && steps[steps.length - 1].type === 'GENERIC');

    if (hrCurr && hrCurr.done_ms) {
      stepEndMs = hrCurr.done_mtime_ms || hrCurr.done_ms;
      if (hrPrev && hrPrev.done_ms) {
        stepStartMs = hrPrev.done_mtime_ms || hrPrev.done_ms;
        timingSource = 'high_res_watcher_2ms';
      } else if (marker && isLatestPlannerStep && marker.watch_exit_wall_ms < stepEndMs) {
        stepStartMs = marker.watch_exit_wall_ms;
        timingSource = 'marker_to_watcher_2ms';
      }
    } else if (marker && isLatestPlannerStep && CLI_ENTRY_WALL_MS > marker.watch_exit_wall_ms) {
      stepStartMs = marker.watch_exit_wall_ms;
      stepEndMs = CLI_ENTRY_WALL_MS;
      timingSource = 'marker_to_cli_entry_ms';
    }

    const totalDurationSec =
      stepStartMs && stepEndMs && stepEndMs > stepStartMs
        ? (stepEndMs - stepStartMs) / 1000
        : null;

    let bodyDurationSec = null;
    let bodyTimingMethod = 'none';

    if (totalDurationSec !== null && totalDurationSec > 0 && tokenInfo.body_tokens > 0) {
      if (
        hrCurr &&
        hrCurr.first_content_ms &&
        hrCurr.done_ms &&
        hrCurr.done_ms > hrCurr.first_content_ms
      ) {
        bodyDurationSec = (hrCurr.done_ms - hrCurr.first_content_ms) / 1000;
        bodyTimingMethod = 'stream_content_window_2ms';
      } else if (tokenInfo.api_output_tokens > 0) {
        bodyDurationSec =
          totalDurationSec * (tokenInfo.body_tokens / tokenInfo.api_output_tokens);
        bodyTimingMethod = tokenInfo.has_thinking
          ? 'thinking_excluded_by_token_share'
          : 'zero_thinking_direct';
      }
    }

    const bodyTps =
      bodyDurationSec && bodyDurationSec > 0 && tokenInfo.body_tokens > 0
        ? Number((tokenInfo.body_tokens / bodyDurationSec).toFixed(2))
        : null;

    const totalTps =
      totalDurationSec && totalDurationSec > 0 && tokenInfo.api_output_tokens > 0
        ? Number((tokenInfo.api_output_tokens / totalDurationSec).toFixed(2))
        : null;

    plannerMetrics.push({
      step_index: step.step_index,
      created_at: step.created_at,
      timing_source: timingSource,
      body_timing_method: bodyTimingMethod,
      total_duration_s: totalDurationSec !== null ? Number(totalDurationSec.toFixed(3)) : null,
      body_duration_s: bodyDurationSec !== null ? Number(bodyDurationSec.toFixed(3)) : null,
      ...tokenInfo,
      body_chars: (step.content ?? '').length,
      thinking_chars: (step.thinking ?? '').length,
      body_tps: bodyTps,
      total_tps_with_thinking: totalTps,
    });
  }

  const zeroThinkingProbes = plannerMetrics.filter(
    (m) => !m.has_thinking && m.body_tokens > 0 && m.total_duration_s !== null
  );

  // Compute Differential Streaming Body TPS (excluding TTFT / prefill overhead)
  // if we have both a long zero-thinking probe and a short zero-thinking baseline probe.
  let differentialAnalysis = null;
  if (zeroThinkingProbes.length >= 2) {
    const sorted = [...zeroThinkingProbes].sort(
      (a, b) => b.api_output_tokens - a.api_output_tokens
    );
    const longProbe = sorted[0];
    const shortProbe = sorted[sorted.length - 1];
    const deltaTokens = longProbe.api_output_tokens - shortProbe.api_output_tokens;
    const deltaBodyTokens = longProbe.body_tokens - shortProbe.body_tokens;
    const deltaTimeSec = longProbe.total_duration_s - shortProbe.total_duration_s;

    if (deltaTokens > 100 && deltaTimeSec > 0) {
      const netStreamingTps = Number((deltaTokens / deltaTimeSec).toFixed(2));
      const estTtftSec = Number(
        Math.max(
          0,
          shortProbe.total_duration_s - shortProbe.api_output_tokens / netStreamingTps
        ).toFixed(3)
      );
      const netBodyDurationLongSec = Number(
        Math.max(0.1, longProbe.body_duration_s - estTtftSec).toFixed(3)
      );
      const netBodyOnlyTps = Number((longProbe.body_tokens / netBodyDurationLongSec).toFixed(2));

      differentialAnalysis = {
        long_probe_step: longProbe.step_index,
        short_probe_step: shortProbe.step_index,
        long_probe_body_tokens: longProbe.body_tokens,
        short_probe_body_tokens: shortProbe.body_tokens,
        delta_output_tokens: deltaTokens,
        delta_body_tokens: deltaBodyTokens,
        delta_duration_s: Number(deltaTimeSec.toFixed(3)),
        estimated_ttft_prefill_s: estTtftSec,
        gross_body_tps_with_ttft: longProbe.body_tps,
        net_streaming_tps_no_ttft: netStreamingTps,
        net_body_only_tps_no_ttft: netBodyOnlyTps,
      };
    }
  }

  const benchmarkSteps = plannerMetrics.filter((m) => m.body_tokens > 0);
  const latestBodyStep =
    benchmarkSteps.length > 0 ? benchmarkSteps[benchmarkSteps.length - 1] : null;

  return {
    transcript_path: transcriptPath,
    trace_events_count: trace?.events?.length ?? 0,
    steps_analyzed: plannerMetrics.length,
    zero_thinking_probes: zeroThinkingProbes,
    differential_analysis: differentialAnalysis,
    latest_body_step: latestBodyStep,
    metrics: plannerMetrics,
  };
}

// CLI Entrypoint
const args = process.argv.slice(2);
const command = args[0] || 'report';

function getArg(flag, defaultVal) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return defaultVal;
}

const defaultTranscript =
  'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\64facfae-8756-4a50-966d-5d23df7e20ac\\.system_generated\\logs\\transcript_full.jsonl';

if (command === 'watch-worker') {
  const transcriptPath = getArg('--transcript', defaultTranscript);
  const tracePath = getArg('--trace', DEFAULT_TRACE_PATH);
  const durationSec = Number(getArg('--duration', '30'));
  runWatchWorker(transcriptPath, tracePath, durationSec);
} else if (command === 'start-watch') {
  const transcriptPath = getArg('--transcript', defaultTranscript);
  const tracePath = getArg('--trace', DEFAULT_TRACE_PATH);
  const durationSec = getArg('--duration', '30');

  // Preserve step timings from any prior trace before starting a new trace
  if (fs.existsSync(transcriptPath) && fs.existsSync(tracePath)) {
    try {
      generateReport(transcriptPath, tracePath, DEFAULT_MARKER_PATH);
    } catch {
      // ignore
    }
  }

  const child = spawn(
    process.execPath,
    [
      __filename,
      'watch-worker',
      '--transcript',
      transcriptPath,
      '--trace',
      tracePath,
      '--duration',
      String(durationSec),
    ],
    {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }
  );
  child.unref();

  const exitWallMs = Date.now();
  const markerPayload = {
    status: 'watcher_started',
    pid: child.pid,
    transcript: transcriptPath,
    trace: tracePath,
    duration_sec: Number(durationSec),
    watch_exit_wall_ms: exitWallMs,
    watch_exit_iso: new Date(exitWallMs).toISOString(),
  };
  fs.writeFileSync(DEFAULT_MARKER_PATH, JSON.stringify(markerPayload, null, 2), 'utf8');
  console.log(JSON.stringify(markerPayload));
} else if (command === 'report' || command === 'analyze') {
  const transcriptPath = getArg('--transcript', defaultTranscript);
  const tracePath = getArg('--trace', DEFAULT_TRACE_PATH);
  await new Promise((r) => setTimeout(r, 120));
  const report = generateReport(transcriptPath, tracePath, DEFAULT_MARKER_PATH);
  fs.writeFileSync(DEFAULT_RESULT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(
    JSON.stringify(
      {
        transcript_path: report.transcript_path,
        steps_analyzed: report.steps_analyzed,
        zero_thinking_probes: report.zero_thinking_probes,
        differential_analysis: report.differential_analysis,
        latest_body_step: report.latest_body_step,
      },
      null,
      2
    )
  );
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
