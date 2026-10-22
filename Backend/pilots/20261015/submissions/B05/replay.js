#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { TextDecoder } = require('node:util');

const MAX_BYTES = 1024 * 1024;
const MAX_LINES = 10000;
const STATUSES = ['ABSENT', 'PENDING', 'PAID', 'CANCELLED', 'REFUNDED'];
const TYPES = ['CREATE', 'PAY', 'CANCEL', 'REFUND'];

function fail(message) { throw new Error(message); }
function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key));
}
function positiveInteger(value) { return Number.isSafeInteger(value) && value > 0; }

function validateEvent(event, line) {
  const bad = detail => fail(`第 ${line} 行：${detail}`);
  if (!exactKeys(event, ['eventId', 'orderId', 'version', 'type', 'payload'])) bad('事件字段不符合要求');
  for (const key of ['eventId', 'orderId']) {
    if (typeof event[key] !== 'string' || event[key].length === 0) bad(`${key} 必须为非空字符串`);
  }
  if (!positiveInteger(event.version)) bad('version 必须为正的安全整数');
  if (!TYPES.includes(event.type)) bad('未知事件类型');
  if (event.type === 'CREATE') {
    if (!exactKeys(event.payload, ['amount']) || !positiveInteger(event.payload.amount)) {
      bad('CREATE 的 payload 必须仅含正的安全整数 amount');
    }
  } else if (!exactKeys(event.payload, [])) bad('非 CREATE 的 payload 必须为 {}');
}

function parseBatch(buffer) {
  if (buffer.length > MAX_BYTES) fail('输入超过 1 MiB');
  let source;
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch { fail('输入不是合法 UTF-8'); }
  const lines = source.split('\n');
  // A final newline terminates the preceding line; it is not an extra line.
  if (lines.at(-1) === '') lines.pop();
  if (lines.length > MAX_LINES) fail('输入超过 10,000 行（包括空行）');
  const byId = new Map();
  const byOrder = new Map();
  let duplicates = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    let event;
    try { event = JSON.parse(lines[i]); }
    catch { fail(`第 ${i + 1} 行：JSON 语法错误`); }
    validateEvent(event, i + 1);
    const signature = JSON.stringify([
      event.eventId, event.orderId, event.version, event.type,
      event.type === 'CREATE' ? event.payload.amount : null,
    ]);
    if (byId.has(event.eventId)) {
      if (byId.get(event.eventId) !== signature) fail(`第 ${i + 1} 行：eventId 内容冲突`);
      duplicates++;
      continue;
    }
    let versions = byOrder.get(event.orderId);
    if (!versions) { versions = new Map(); byOrder.set(event.orderId, versions); }
    if (versions.has(event.version)) fail(`第 ${i + 1} 行：同一订单的 version 冲突`);
    byId.set(event.eventId, signature);
    versions.set(event.version, event);
  }
  return { byOrder, duplicates };
}

// JS's default sort uses UTF-16 code units, not Unicode code points.
function compareCodePoints(a, b) {
  const aa = Array.from(a, c => c.codePointAt(0));
  const bb = Array.from(b, c => c.codePointAt(0));
  for (let i = 0; i < Math.min(aa.length, bb.length); i++) {
    if (aa[i] !== bb[i]) return aa[i] - bb[i];
  }
  return aa.length - bb.length;
}

function replay({ byOrder, duplicates }) {
  const orders = [];
  const receipts = [];
  const summary = {
    orders: byOrder.size,
    statusCounts: Object.fromEntries(STATUSES.map(status => [status, 0])),
    paidAmount: 0n, refundedAmount: 0n,
    applied: 0, rejected: 0, pending: 0, duplicates,
  };
  for (const orderId of [...byOrder.keys()].sort(compareCodePoints)) {
    const order = { orderId, status: 'ABSENT', amount: 0, lastVersion: 0 };
    const events = [...byOrder.get(orderId).values()].sort((a, b) => a.version - b.version);
    for (const event of events) {
      let result;
      if (event.version !== order.lastVersion + 1) {
        result = 'PENDING_GAP';
        summary.pending++;
      } else {
        let nextStatus;
        if (event.type === 'CREATE' && event.version === 1 && order.status === 'ABSENT') {
          nextStatus = 'PENDING';
          order.amount = event.payload.amount;
        } else if (event.type === 'PAY' && order.status === 'PENDING') nextStatus = 'PAID';
        else if (event.type === 'CANCEL' && order.status === 'PENDING') nextStatus = 'CANCELLED';
        else if (event.type === 'REFUND' && order.status === 'PAID') nextStatus = 'REFUNDED';
        if (nextStatus) {
          order.status = nextStatus;
          result = 'APPLIED';
          summary.applied++;
        } else {
          result = 'REJECTED_TRANSITION';
          summary.rejected++;
        }
        order.lastVersion = event.version;
      }
      receipts.push({ eventId: event.eventId, orderId, version: event.version, result });
    }
    orders.push(order);
    summary.statusCounts[order.status]++;
    if (order.status === 'PAID') summary.paidAmount += BigInt(order.amount);
    if (order.status === 'REFUNDED') summary.refundedAmount += BigInt(order.amount);
  }
  return { orders, receipts, summary };
}

// Keep aggregate cents exact even when several safe amounts sum above 2^53-1.
function stringify(value, space) {
  return JSON.stringify(value, (_, item) => typeof item === 'bigint'
    ? JSON.rawJSON(item.toString()) : item, space);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}
function table(headers, rows) {
  return `<table><thead><tr>${headers.map(h => `<th scope="col">${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
function row(values, className = '') {
  return `<tr${className ? ` class="${className}"` : ''}>${values.map(v => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`;
}
function renderHtml({ orders, receipts, summary }) {
  const labels = {
    APPLIED: 'APPLIED（已应用）',
    REJECTED_TRANSITION: 'REJECTED_TRANSITION（状态转移被拒绝，版本已消费）',
    PENDING_GAP: 'PENDING_GAP（等待缺失版本，未应用）',
  };
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>订单事件回放与对账报告</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#222}table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border:1px solid #aaa;padding:8px;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#eee}.REJECTED_TRANSITION{background:#ffe0e0}.PENDING_GAP{background:#fff1c7}pre{white-space:pre-wrap}</style>
</head><body><h1>订单事件回放与对账报告</h1>
<p>金额单位：分。红色表示状态转移被拒绝；黄色表示版本缺口，等待补齐后完整重放。</p>
<h2>汇总</h2><pre>${escapeHtml(stringify(summary, 2))}</pre>
<h2>订单状态</h2>
${table(['orderId', 'status', 'amount（分）', 'lastVersion'], orders.map(o => row([o.orderId, o.status, o.amount, o.lastVersion])))}
<h2>事件回执</h2>
${table(['eventId', 'orderId', 'version', 'result'], receipts.map(r => row([r.eventId, r.orderId, r.version, labels[r.result]], r.result)))}
</body></html>
`;
}

function readInput(filename) {
  // Read at most one byte over the limit, even if a file grows during reading.
  const fd = fs.openSync(filename, 'r');
  try {
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (count === 0) break;
      length += count;
    }
    return buffer.subarray(0, length);
  } finally { fs.closeSync(fd); }
}

function main(args) {
  if (args.length !== 4) fail('用法：node replay.js --input <JSONL文件> --out <HTML文件>');
  const options = new Map();
  for (let i = 0; i < args.length; i += 2) {
    if (!['--input', '--out'].includes(args[i]) || options.has(args[i]) || !args[i + 1]) fail('命令行参数无效');
    options.set(args[i], args[i + 1]);
  }
  const htmlPath = path.resolve(options.get('--out'));
  const parts = path.parse(htmlPath);
  const jsonPath = path.join(parts.dir, `${parts.name}.json`);
  if (htmlPath.toLowerCase() === jsonPath.toLowerCase()) fail('HTML 与 JSON 输出路径不能相同');
  const report = replay(parseBatch(readInput(options.get('--input'))));
  const html = renderHtml(report);
  const json = stringify(report, 2) + '\n';
  // No filesystem mutations occur until the entire batch is validated/rendered.
  const staged = [];
  try {
    for (const [target, content] of [[htmlPath, html], [jsonPath, json]]) {
      const temporary = `${target}.${randomUUID()}.tmp`;
      staged.push([temporary, target]);
      fs.writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx' });
    }
    for (const [temporary, target] of staged) fs.renameSync(temporary, target);
  } finally {
    for (const [temporary] of staged) fs.rmSync(temporary, { force: true });
  }
  process.stdout.write(stringify(report.summary) + '\n');
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write(`错误：${error.message}\n`);
    process.exitCode = 2;
  }
}
module.exports = { parseBatch, replay, stringify, renderHtml, compareCodePoints };
