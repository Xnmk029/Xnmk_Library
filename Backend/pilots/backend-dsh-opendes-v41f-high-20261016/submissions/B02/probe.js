#!/usr/bin/env node
'use strict';

/**
 * HTTP 健康探针（Node.js 24，仅使用原生模块）。
 *
 * 用法：
 *   node probe.js --config <JSON路径> --out <HTML路径> --timeout-ms 150 --concurrency 2
 *
 * 行为：
 *   - 读取配置 JSON（根结构 [{id:string,url:string}, ...]），校验每个目标；
 *   - 对每个目标发起独立超时的 HTTP GET（不跟随重定向，3xx 视为失败）；
 *   - 同一时刻在途请求数不超过 concurrency；
 *   - 输出结果 JSON（与 --out 同路径、扩展名为 .json）和可直接打开的 HTML 报告；
 *   - 退出码：0 全部健康 / 1 存在失败 / 2 输入非法（此时不改动已有输出文件）。
 */

const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');

const EXIT_HEALTHY = 0;
const EXIT_UNHEALTHY = 1;
const EXIT_INVALID = 2;

const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_CONCURRENCY = 4;
const ALLOWED_PROTOCOL = 'http:';
const ALLOWED_HOSTNAME = '127.0.0.1';

const USAGE = [
  '用法: node probe.js --config <JSON路径> --out <HTML路径> [--timeout-ms <毫秒>] [--concurrency <数量>]',
  '',
  '  --config, -c     目标配置 JSON 文件，根结构 [{ "id": "字符串", "url": "字符串" }, ...]',
  '  --out, -o        HTML 报告输出路径；同目录同名 .json 结果文件会一并生成',
  '  --timeout-ms     单个目标的超时毫秒数，正整数（默认 ' + DEFAULT_TIMEOUT_MS + '）',
  '  --concurrency    最大在途请求数，正整数（默认 ' + DEFAULT_CONCURRENCY + '）',
  '  --help, -h       显示本帮助',
  '',
  '退出码: 0 = 全部健康, 1 = 存在失败, 2 = 输入非法（不写出任何文件）',
].join('\n');

class InvalidInputError extends Error {}

function invalid(message) {
  throw new InvalidInputError(message);
}

/* ------------------------------------------------------------------ 参数解析 */

function readOptionValue(argv, index, inlineValue, flag) {
  if (inlineValue !== null) {
    if (inlineValue === '') invalid(`参数 ${flag} 缺少取值`);
    return { value: inlineValue, nextIndex: index };
  }
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    invalid(`参数 ${flag} 缺少取值`);
  }
  return { value, nextIndex: index + 1 };
}

function parsePositiveInteger(raw, flag) {
  if (!/^[0-9]+$/.test(raw)) invalid(`参数 ${flag} 必须是正整数，收到 ${JSON.stringify(raw)}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    invalid(`参数 ${flag} 必须是大于 0 的整数，收到 ${JSON.stringify(raw)}`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    config: null,
    out: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    concurrency: DEFAULT_CONCURRENCY,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    let flag = argv[i];
    let inlineValue = null;
    const eq = flag.indexOf('=');
    if (flag.startsWith('--') && eq !== -1) {
      inlineValue = flag.slice(eq + 1);
      flag = flag.slice(0, eq);
    }

    switch (flag) {
      case '--config':
      case '-c': {
        const taken = readOptionValue(argv, i, inlineValue, flag);
        i = taken.nextIndex;
        options.config = taken.value;
        break;
      }
      case '--out':
      case '-o': {
        const taken = readOptionValue(argv, i, inlineValue, flag);
        i = taken.nextIndex;
        options.out = taken.value;
        break;
      }
      case '--timeout-ms': {
        const taken = readOptionValue(argv, i, inlineValue, flag);
        i = taken.nextIndex;
        options.timeoutMs = parsePositiveInteger(taken.value, '--timeout-ms');
        break;
      }
      case '--concurrency': {
        const taken = readOptionValue(argv, i, inlineValue, flag);
        i = taken.nextIndex;
        options.concurrency = parsePositiveInteger(taken.value, '--concurrency');
        break;
      }
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        invalid(`未知参数 ${JSON.stringify(argv[i])}`);
    }
  }

  if (options.help) return options;
  if (options.config === null || options.config === '') invalid('缺少必填参数 --config');
  if (options.out === null || options.out === '') invalid('缺少必填参数 --out');
  return options;
}

/* -------------------------------------------------------------- 配置读取校验 */

function validateTarget(raw, index) {
  const position = `配置第 ${index + 1} 项`;

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    invalid(`${position}必须是对象 { id, url }`);
  }

  const id = raw.id;
  if (typeof id !== 'string' || id.length === 0) {
    invalid(`${position}的 id 必须是非空字符串`);
  }

  const url = raw.url;
  if (typeof url !== 'string' || url.length === 0) {
    invalid(`${position}的 url 必须是非空字符串`);
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    invalid(`${position}的 url 不是合法 URL: ${JSON.stringify(url)}`);
  }

  if (parsed.protocol !== ALLOWED_PROTOCOL) {
    invalid(`${position}的 url 协议必须是 http://，收到 ${JSON.stringify(parsed.protocol)}`);
  }
  if (parsed.username !== '' || parsed.password !== '') {
    invalid(`${position}的 url 不允许包含用户名或密码`);
  }
  if (parsed.hostname !== ALLOWED_HOSTNAME) {
    invalid(`${position}的 url 主机必须是 ${ALLOWED_HOSTNAME}，收到 ${JSON.stringify(parsed.hostname)}`);
  }
  if (parsed.port === '') {
    invalid(`${position}的 url 必须显式指定端口，形如 http://${ALLOWED_HOSTNAME}:<端口>/...`);
  }
  const port = Number(parsed.port);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    invalid(`${position}的 url 端口必须在 1-65535 之间`);
  }

  return { id, url, parsed };
}

async function loadTargets(configPath) {
  let text;
  try {
    text = await fs.readFile(configPath, 'utf8');
  } catch (err) {
    invalid(`无法读取配置文件 ${configPath}: ${err && err.message ? err.message : String(err)}`);
  }

  let data;
  try {
    // 容忍 Windows 编辑器写入的 UTF-8 BOM。
    data = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch (err) {
    invalid(`配置文件不是合法 JSON: ${err && err.message ? err.message : String(err)}`);
  }

  if (!Array.isArray(data)) {
    invalid('配置根结构必须是数组 [{ id, url }, ...]');
  }

  return data.map((item, index) => validateTarget(item, index));
}

/* ------------------------------------------------------------------ 探针执行 */

function describeError(err) {
  const code = err && err.code ? String(err.code) : 'ERROR';
  const message = err && err.message ? String(err.message) : String(err);
  return `连接失败 (${code}): ${message}`;
}

/** 探测单个目标；永不 reject，任何异常都映射为 { ok:false, status:null, error }。 */
function probeTarget(target, timeoutMs) {
  return new Promise((resolve) => {
    const base = { id: target.id, url: target.url };
    let settled = false;
    let timer = null;
    let request = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      resolve(result);
    };

    try {
      request = http.request(
        {
          protocol: 'http:',
          hostname: target.parsed.hostname,
          port: Number(target.parsed.port),
          path: `${target.parsed.pathname}${target.parsed.search}` || '/',
          method: 'GET',
          agent: false,
          headers: {
            host: target.parsed.host,
            accept: '*/*',
            'user-agent': 'http-health-probe/1.0',
            connection: 'close',
          },
        },
        (response) => {
          const status = typeof response.statusCode === 'number' ? response.statusCode : null;
          const ok = status !== null && status >= 200 && status < 300;
          // chunked / 无 Content-Length 的响应不会被读取或等待：这里只取状态码，
          // 随即销毁响应流，因此「永不结束」的 chunked body 也不会拖慢探针。
          // 销毁后仍可能收到迟到的流错误（如服务端 RST），装一个空处理器避免其
          // 升级为未捕获异常而让整个探针崩溃。
          response.on('error', () => {});
          response.destroy();
          finish({
            ...base,
            status,
            ok,
            error: ok ? null : `HTTP ${status === null ? '未知状态' : status}`,
          });
        },
      );
    } catch (err) {
      finish({ ...base, status: null, ok: false, error: describeError(err) });
      return;
    }

    // 每个目标独立超时：到时立刻判失败并销毁请求。
    timer = setTimeout(() => {
      if (request !== null) request.destroy();
      finish({
        ...base,
        status: null,
        ok: false,
        error: `请求超时 (timeout after ${timeoutMs} ms)`,
      });
    }, timeoutMs);

    request.on('error', (err) => {
      finish({ ...base, status: null, ok: false, error: describeError(err) });
    });

    request.end();
  });
}

/** 固定 concurrency 个 worker，按索引回填，保证结果顺序与输入一致。 */
async function probeAll(targets, timeoutMs, concurrency) {
  const results = new Array(targets.length);
  if (targets.length === 0) return results;

  let cursor = 0;
  const workerCount = Math.min(concurrency, targets.length);
  const workers = [];
  for (let w = 0; w < workerCount; w += 1) {
    workers.push(
      (async () => {
        for (;;) {
          const index = cursor;
          cursor += 1;
          if (index >= targets.length) return;
          results[index] = await probeTarget(targets[index], timeoutMs);
        }
      })(),
    );
  }
  await Promise.all(workers);
  return results;
}

/* ------------------------------------------------------------------ 产物输出 */

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function renderHtml(payload, meta) {
  const { results, summary } = payload;

  const rows = results
    .map((item) => {
      const badge = item.ok
        ? '<span class="badge ok">健康</span>'
        : '<span class="badge fail">失败</span>';
      const errorCell = item.error
        ? `<details><summary>查看错误</summary><pre class="error">${escapeHtml(item.error)}</pre></details>`
        : '<span class="muted">—</span>';
      return [
        '      <tr>',
        `        <td>${badge}</td>`,
        `        <td class="id">${escapeHtml(item.id)}</td>`,
        `        <td class="url">${escapeHtml(item.url)}</td>`,
        `        <td class="status">${item.status === null ? '<span class="muted">—</span>' : escapeHtml(item.status)}</td>`,
        `        <td class="error-cell">${errorCell}</td>`,
        '      </tr>',
      ].join('\n');
    })
    .join('\n');

  const rawJson = JSON.stringify(payload, null, 2);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HTTP 健康探针报告</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0 auto; max-width: 1100px; padding: 24px 20px 48px;
         font-family: -apple-system, "Segoe UI", "Microsoft YaHei", Roboto, Helvetica, Arial, sans-serif;
         color: #1f2328; background: #fff; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  .meta { color: #656d76; font-size: 13px; margin: 0 0 16px; }
  .summary { list-style: none; display: flex; flex-wrap: wrap; gap: 10px; padding: 0; margin: 0 0 20px; }
  .summary li { border: 1px solid #d0d7de; border-radius: 6px; padding: 6px 12px; font-size: 14px; background: #f6f8fa; }
  .summary li.ok { border-color: #1a7f37; background: #dafbe1; color: #0f5323; }
  .summary li.fail { border-color: #cf222e; background: #ffebe9; color: #a40e26; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { border: 1px solid #d0d7de; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f6f8fa; font-weight: 600; white-space: nowrap; }
  tbody tr:nth-child(even) { background: #fcfcfd; }
  td.id, td.url { word-break: break-all; }
  td.status { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .badge { display: inline-block; border-radius: 999px; padding: 1px 10px; font-size: 13px; white-space: nowrap; }
  .badge.ok { background: #dafbe1; color: #0f5323; border: 1px solid #1a7f37; }
  .badge.fail { background: #ffebe9; color: #a40e26; border: 1px solid #cf222e; }
  .muted { color: #8c959f; }
  details { margin: 0; }
  summary { cursor: pointer; color: #0969da; }
  pre { margin: 6px 0 0; padding: 8px; background: #f6f8fa; border: 1px solid #d0d7de;
        border-radius: 6px; white-space: pre-wrap; word-break: break-all; font-size: 13px; }
  pre.error { background: #fff5f5; border-color: #ffc9c9; color: #a40e26; }
  details.raw { margin-top: 24px; }
  details.raw pre { background: #f6f8fa; color: #1f2328; }
  footer { margin-top: 24px; color: #656d76; font-size: 12px; }
</style>
</head>
<body>
<h1>HTTP 健康探针报告</h1>
<p class="meta">生成时间：${escapeHtml(meta.generatedAt)} · 配置文件：${escapeHtml(meta.configPath)} · 单目标超时：${escapeHtml(meta.timeoutMs)} ms · 并发上限：${escapeHtml(meta.concurrency)}</p>
<ul class="summary">
  <li>总计：<strong>${escapeHtml(summary.total)}</strong></li>
  <li class="ok">健康：<strong>${escapeHtml(summary.healthy)}</strong></li>
  <li class="fail">失败：<strong>${escapeHtml(summary.failed)}</strong></li>
</ul>
<table>
  <thead>
    <tr><th>状态</th><th>ID</th><th>URL</th><th>HTTP 状态</th><th>错误</th></tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table>
<details class="raw">
  <summary>原始 JSON 结果</summary>
  <pre>${escapeHtml(rawJson)}</pre>
</details>
<footer>本报告由 probe.js 运行时生成，所有输入内容均以纯文本转义展示。</footer>
</body>
</html>
`;
}

function jsonPathFor(outPath) {
  const ext = path.extname(outPath);
  if (ext === '') return `${outPath}.json`;
  return `${outPath.slice(0, outPath.length - ext.length)}.json`;
}

/* ---------------------------------------------------------------------- 主流程 */

async function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return EXIT_HEALTHY;
  }

  // 先把配置完整校验通过，再做任何网络请求与文件写入；
  // 因此输入非法时绝不会改动已有输出文件。
  const targets = await loadTargets(options.config);

  const results = await probeAll(targets, options.timeoutMs, options.concurrency);
  const healthy = results.reduce((count, item) => (item.ok ? count + 1 : count), 0);
  const payload = {
    results,
    summary: {
      total: results.length,
      healthy,
      failed: results.length - healthy,
    },
  };

  const jsonPath = jsonPathFor(options.out);
  const html = renderHtml(payload, {
    generatedAt: new Date().toISOString(),
    configPath: options.config,
    timeoutMs: options.timeoutMs,
    concurrency: options.concurrency,
  });

  try {
    await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    await fs.writeFile(options.out, html, 'utf8');
  } catch (err) {
    invalid(`写入输出文件失败: ${err && err.message ? err.message : String(err)}`);
  }

  process.stdout.write(
    `probe: ${payload.summary.total} 个目标，健康 ${payload.summary.healthy}，失败 ${payload.summary.failed}\n` +
      `probe: JSON -> ${jsonPath}\n` +
      `probe: HTML -> ${options.out}\n`,
  );

  return payload.summary.failed === 0 ? EXIT_HEALTHY : EXIT_UNHEALTHY;
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    if (err instanceof InvalidInputError) {
      process.stderr.write(`probe: ${err.message}\n`);
    } else {
      process.stderr.write(`probe: 意外错误: ${err && err.stack ? err.stack : String(err)}\n`);
    }
    process.exitCode = EXIT_INVALID;
  });
