'use strict';

/*
 * Front-end for the read-only duplicate file inspector.
 * Every value shown here comes from a real API response; nothing is faked or
 * cached in the browser as a substitute for server state.
 */

const els = {
  scanButton: document.getElementById('scan-button'),
  scanState: document.getElementById('scan-state'),
  scanElapsed: document.getElementById('scan-elapsed'),
  progressBar: document.getElementById('progress-bar'),
  progressStats: document.getElementById('progress-stats'),
  scanMessage: document.getElementById('scan-message'),
  groupCount: document.getElementById('group-count'),
  groups: document.getElementById('groups'),
  summary: document.getElementById('summary'),
  errors: document.getElementById('errors'),
};

let progressTimer = null;
let busy = false;

// --------------------------------------------------------------------------
// Small helpers
// --------------------------------------------------------------------------

async function api(path, options) {
  const res = await fetch(path, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
    ...options,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const reason = data && data.error ? data.error : `HTTP ${res.status}`;
    throw new Error(reason);
  }
  return data;
}

function formatBytes(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`;
}

function formatDuration(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function shortHash(hash) {
  return typeof hash === 'string' && hash.length === 64 ? `${hash.slice(0, 12)}…` : String(hash);
}

function statRow(term, value) {
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  if (value instanceof Node) dd.appendChild(value);
  else dd.textContent = value;
  return [dt, dd];
}

function renderStats(target, rows) {
  target.replaceChildren();
  for (const [term, value] of rows) {
    target.append(...statRow(term, value));
  }
}

function setState(state) {
  els.scanState.textContent = state === 'running' ? '扫描中' : '空闲';
  els.scanState.className = `badge ${state === 'running' ? 'running' : 'idle'}`;
}

// --------------------------------------------------------------------------
// Progress
// --------------------------------------------------------------------------

function renderProgress(progress) {
  const seen = progress.seen || 0;
  const done = progress.done || 0;
  const pct = seen > 0 ? Math.min(100, Math.round((done / seen) * 100)) : 0;
  els.progressBar.style.width = `${pct}%`;
  els.progressBar.dataset.done = done >= seen && seen > 0 ? 'yes' : 'no';
  els.scanElapsed.textContent = progress.elapsedMs
    ? `已用 ${formatDuration(progress.elapsedMs)}`
    : '';
  renderStats(els.progressStats, [
    ['已发现文件', String(seen)],
    ['已处理', `${done} (${pct}%)`],
    ['已读取', String(progress.scanned || 0)],
    ['已跳过', String(progress.skipped || 0)],
    ['超限文件', String(progress.oversize || 0)],
    ['读取失败', String(progress.unreadable || 0)],
  ]);
}

function stopProgressPolling() {
  if (progressTimer !== null) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function startProgressPolling() {
  stopProgressPolling();
  const tick = async () => {
    try {
      const data = await api('/api/progress');
      renderProgress(data.progress || {});
    } catch {
      /* transient errors during polling are not fatal */
    }
  };
  tick();
  progressTimer = setInterval(tick, 400);
}

// --------------------------------------------------------------------------
// Result rendering
// --------------------------------------------------------------------------

function renderResult(result) {
  const groups = Array.isArray(result.groups) ? result.groups : [];
  els.groupCount.textContent = `（${groups.length} 组）`;
  els.groups.replaceChildren();

  if (result.truncated) {
    const notice = document.createElement('p');
    notice.className = 'warning';
    notice.textContent = `重复分组过多，页面仅展示前 ${groups.length} 组。`;
    els.groups.appendChild(notice);
  }

  if (groups.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = '本次扫描没有发现重复文件。';
    els.groups.appendChild(empty);
  }

  groups.forEach((group, index) => {
    const details = document.createElement('details');
    details.className = 'group';

    const summary = document.createElement('summary');
    const title = document.createElement('span');
    title.className = 'group-title';
    title.textContent = `#${index + 1} · ${group.paths.length} 份副本 · ${formatBytes(group.size)}`;
    const hash = document.createElement('code');
    hash.className = 'hash';
    hash.textContent = shortHash(group.sha256);
    hash.title = group.sha256;
    summary.append(title, hash);

    const meta = document.createElement('p');
    meta.className = 'muted mono';
    meta.textContent = `SHA-256 ${group.sha256}`;

    const list = document.createElement('ul');
    list.className = 'paths';
    for (const relative of group.paths) {
      const item = document.createElement('li');
      const code = document.createElement('code');
      code.textContent = relative;
      const preview = document.createElement('button');
      preview.type = 'button';
      preview.className = 'link';
      preview.textContent = '预览';
      const slot = document.createElement('pre');
      slot.className = 'preview';
      slot.hidden = true;
      preview.addEventListener('click', async () => {
        slot.hidden = false;
        slot.textContent = '读取中…';
        try {
          const file = await api(`/api/files?path=${encodeURIComponent(relative)}`);
          slot.textContent =
            file.encoding === 'utf8'
              ? file.content
              : `[二进制内容，base64]\n${file.content}`;
        } catch (err) {
          slot.textContent = `读取失败：${err.message}`;
        }
      });
      item.append(code, preview, slot);
      list.appendChild(item);
    }

    details.append(summary, meta, list);
    els.groups.appendChild(details);
  });

  const reasons = result.skippedReasons || {};
  renderStats(els.summary, [
    ['扫描根目录', result.root || '—'],
    ['完成时间', result.generatedAt || '—'],
    ['用时', result.durationMs === undefined ? '—' : formatDuration(result.durationMs)],
    ['成功读取文件数 (scanned)', String(result.scanned ?? 0)],
    ['跳过文件数 (skipped)', String(result.skipped ?? 0)],
    ['重复分组数', String(result.groupCount ?? groups.length)],
    ['涉及文件数', String(result.duplicateFileCount ?? '—')],
    ['超限跳过', String(reasons.oversize ?? 0)],
    ['不可读跳过', String(reasons.unreadable ?? 0)],
  ]);

  els.errors.replaceChildren();
  const errors = Array.isArray(result.errors) ? result.errors : [];
  if (errors.length === 0) {
    const none = document.createElement('li');
    none.className = 'muted';
    none.textContent = '没有跳过明细。';
    els.errors.appendChild(none);
  } else {
    for (const entry of errors) {
      const item = document.createElement('li');
      item.textContent = `${entry.path} — ${entry.reason}`;
      els.errors.appendChild(item);
    }
  }
}

// --------------------------------------------------------------------------
// Actions
// --------------------------------------------------------------------------

async function loadResult(options = {}) {
  try {
    const result = await api('/api/result');
    renderResult(result);
    if (!options.silent) {
      setState('idle');
      els.scanMessage.textContent = `显示上次完整扫描结果（${result.generatedAt}）。`;
      els.progressBar.dataset.done = 'yes';
    }
    return result;
  } catch (err) {
    if (!options.silent) {
      els.scanMessage.textContent = `暂无可用结果：${err.message}`;
    }
    return null;
  }
}

async function runScan() {
  if (busy) return;
  busy = true;
  els.scanButton.disabled = true;
  els.scanMessage.textContent = '扫描进行中，请稍候…';
  setState('running');
  startProgressPolling();
  try {
    const result = await api('/api/scan', { method: 'POST' });
    await loadResult({ silent: true });
    els.scanMessage.textContent =
      `扫描完成：读取 ${result.scanned} 个文件，跳过 ${result.skipped} 个，` +
      `发现 ${result.groups.length} 组重复。`;
  } catch (err) {
    els.scanMessage.textContent = `扫描失败：${err.message}`;
    await loadResult({ silent: true });
  } finally {
    stopProgressPolling();
    try {
      const finalProgress = await api('/api/progress');
      renderProgress(finalProgress.progress || {});
    } catch {
      /* ignore */
    }
    setState('idle');
    els.scanButton.disabled = false;
    busy = false;
  }
}

els.scanButton.addEventListener('click', runScan);
setState('idle');
loadResult();
