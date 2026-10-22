#!/usr/bin/env node
'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function parseArgs(args) {
  const options = { '--timeout-ms': '150', '--concurrency': '2' };
  const allowed = new Set(['--config', '--out', '--timeout-ms', '--concurrency']);
  const seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (!allowed.has(key) || seen.has(key) || !value || value.startsWith('--')) {
      throw new Error(`无效或重复的命令行参数：${key}`);
    }
    seen.add(key);
    options[key] = value;
  }
  if (!options['--config'] || !options['--out']) {
    throw new Error('用法：node probe.js --config <JSON路径> --out <HTML路径> [--timeout-ms 150] [--concurrency 2]');
  }
  for (const key of ['--timeout-ms', '--concurrency']) {
    const number = Number(options[key]);
    if (!/^[0-9]+$/.test(options[key]) || !Number.isSafeInteger(number) || number < 1 || number > 2147483647) {
      throw new Error(`${key} 必须是 1 到 2147483647 之间的整数`);
    }
    options[key] = number;
  }
  const htmlPath = path.resolve(options['--out']);
  const ext = path.extname(htmlPath);
  const jsonPath = (ext ? htmlPath.slice(0, -ext.length) : htmlPath) + '.json';
  if (htmlPath.toLowerCase() === jsonPath.toLowerCase()) {
    throw new Error('--out 不能使用 .json 扩展名，HTML 和 JSON 需要不同的路径');
  }
  return { configPath: options['--config'], htmlPath, jsonPath,
    timeoutMs: options['--timeout-ms'], concurrency: options['--concurrency'] };
}

function validateConfig(config) {
  if (!Array.isArray(config)) throw new Error('配置根结构必须是数组');
  return config.map((item, index) => {
    const fail = (message) => { throw new Error(`配置第 ${index + 1} 项：${message}`); };
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail('必须是对象');
    if (typeof item.id !== 'string' || !item.id.trim()) fail('id 必须是非空字符串');
    if (typeof item.url !== 'string') fail('url 必须是字符串');
    // Validate the literal authority before URL parsing, which normalizes alternate
    // IPv4 spellings, whitespace and backslashes into otherwise valid URLs.
    const match = /^http:\/\/127\.0\.0\.1:([0-9]+)(?=[/?#]|$)/.exec(item.url);
    if (!match || /[\s\\\u0000-\u001f\u007f]/u.test(item.url)) {
      fail('URL 仅允许 http://127.0.0.1:<端口>/...，且不能含用户名或密码');
    }
    const port = Number(match[1]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) fail('端口必须在 1 到 65535 之间');
    let parsed;
    try { parsed = new URL(item.url); } catch { fail('URL 不合法'); }
    if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || parsed.username || parsed.password) {
      fail('URL 的协议、主机或认证信息不被允许');
    }
    return { id: item.id, url: item.url };
  });
}

function probe(target, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    let request;
    let response;
    let timer;
    const finish = (status, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      response?.destroy();
      request?.destroy();
      resolve({ ...target, status, ok: error === null, error });
    };
    // An absolute deadline includes headers and the complete response body;
    // receiving occasional bytes does not reset this target's timeout.
    timer = setTimeout(() => finish(null, `请求超时（${timeoutMs} ms）`), timeoutMs);
    try {
      request = http.get(target.url, { agent: false }, (res) => {
        response = res;
        res.on('error', (error) => finish(null, error.message || '响应读取失败'));
        res.on('aborted', () => finish(null, '响应连接提前中断'));
        res.on('end', () => {
          const status = res.statusCode;
          finish(status, status >= 200 && status < 300 ? null : `HTTP ${status}`);
        });
        // Drain without buffering, keeping memory bounded for large responses.
        res.resume();
      });
      request.on('error', (error) => finish(null, error.message || '连接失败'));
    } catch (error) {
      finish(null, error.message || '请求失败');
    }
  });
}

async function runProbes(targets, timeoutMs, concurrency) {
  const results = new Array(targets.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < targets.length) {
      const index = nextIndex++;
      results[index] = await probe(targets[index], timeoutMs);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  const healthy = results.filter((result) => result.ok).length;
  return { results, summary: { total: results.length, healthy, failed: results.length - healthy } };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function renderHtml(report) {
  const rows = report.results.map((result) => `    <tr>
      <td>${escapeHtml(result.id)}</td>
      <td class="url">${escapeHtml(result.url)}</td>
      <td class="${result.ok ? 'healthy' : 'failed'}">${result.ok ? '健康' : '失败'}</td>
      <td>${result.status === null ? '—' : escapeHtml(result.status)}</td>
      <td><details><summary>${result.ok ? '检查详情' : '错误详情'}</summary><pre>${escapeHtml(result.error === null ? '无错误' : result.error)}</pre></details></td>
    </tr>`).join('\n');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>HTTP 健康探针报告</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #222; }
    .table-wrap { overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: .65rem; text-align: left; vertical-align: top; }
    th { background: #f4f4f4; }
    .healthy { color: #146c2e; background: #edf9ef; font-weight: bold; }
    .failed { color: #a01818; background: #fff0f0; font-weight: bold; }
    .url, pre, td { overflow-wrap: anywhere; }
    pre { white-space: pre-wrap; font-family: inherit; }
    summary { cursor: pointer; }
  </style>
</head>
<body>
  <h1>HTTP 健康探针报告</h1>
  <p>总数：${report.summary.total} · 健康：${report.summary.healthy} · 失败：${report.summary.failed}</p>
  <div class="table-wrap"><table>
    <thead><tr><th scope="col">ID</th><th scope="col">URL</th><th scope="col">结果</th><th scope="col">HTTP 状态</th><th scope="col">详情</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table></div>
</body>
</html>
`;
}

async function writeReports(options, report) {
  const suffix = `.${randomUUID()}.tmp`;
  const htmlTemp = options.htmlPath + suffix;
  const jsonTemp = options.jsonPath + suffix;
  try {
    await fs.writeFile(htmlTemp, renderHtml(report), { encoding: 'utf8', flag: 'wx' });
    await fs.writeFile(jsonTemp, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    await fs.rename(jsonTemp, options.jsonPath);
    await fs.rename(htmlTemp, options.htmlPath);
  } finally {
    await Promise.all([htmlTemp, jsonTemp].map((file) => fs.rm(file, { force: true }).catch(() => {})));
  }
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    // Complete validation before any requests or writes to report files.
    const targets = validateConfig(JSON.parse(await fs.readFile(options.configPath, 'utf8')));
    const report = await runProbes(targets, options.timeoutMs, options.concurrency);
    await writeReports(options, report);
    console.log(`检查完成：${report.summary.healthy}/${report.summary.total} 健康\nHTML: ${options.htmlPath}\nJSON: ${options.jsonPath}`);
    process.exitCode = report.summary.failed ? 1 : 0;
  } catch (error) {
    console.error(`错误：${error.message}`);
    process.exitCode = 2;
  }
}

main();
