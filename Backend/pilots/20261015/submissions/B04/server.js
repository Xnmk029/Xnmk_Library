'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

// An absolute end assertion also rejects trailing newlines (unlike JavaScript's $).
const SLUG = /^[A-Za-z0-9_-]{3,24}(?![\s\S])/;
const MAX_BODY = 16 * 1024;
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function normalizeUrl(value) {
  if (typeof value !== 'string' || !/^http:\/\/127\.0\.0\.1:\d+(?:[/?#]|$)/i.test(value)) {
    throw new HttpError(422, 'url 必须为 http://127.0.0.1:<端口>/...');
  }
  let url;
  try { url = new URL(value); } catch { throw new HttpError(422, 'URL 无效'); }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password) {
    throw new HttpError(422, 'URL 不允许凭据、其他主机或协议');
  }
  return url.href;
}

function options(args) {
  let port = 3000;
  let data = path.resolve('data');
  for (let i = 0; i < args.length; i += 2) {
    const value = args[i + 1];
    if (!value) throw new Error('用法：node server.js --port <端口> --data <数据目录>');
    if (args[i] === '--port' && /^\d+$/.test(value)) port = Number(value);
    else if (args[i] === '--data') data = path.resolve(value);
    else throw new Error(`未知或无效参数：${args[i]}`);
  }
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('监听端口须在 0–65535 之间');
  return { port, data };
}

async function openStore(directory) {
  await fs.mkdir(directory, { recursive: true });
  const filename = path.join(directory, 'links.json');
  let records = new Map();
  try {
    const saved = JSON.parse(await fs.readFile(filename, 'utf8'));
    if (saved.version !== 1 || !Array.isArray(saved.links)) throw new Error('数据文件格式无效');
    for (const record of saved.links) {
      if (!record || typeof record.slug !== 'string' || !SLUG.test(record.slug) ||
          typeof record.url !== 'string' || !Number.isSafeInteger(record.visits) || record.visits < 0 ||
          records.has(record.slug)) throw new Error('数据文件中存在无效或重复记录');
      // A normalized URL with explicit port 80 no longer contains a port.
      const parsed = new URL(record.url);
      if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || parsed.username ||
          parsed.password || parsed.href !== record.url) throw new Error('数据文件中的 URL 无效');
      records.set(record.slug, { slug: record.slug, url: record.url, visits: record.visits });
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let pending = Promise.resolve();
  function serialize(operation) {
    const result = pending.then(operation);
    pending = result.catch(() => {});
    return result;
  }
  async function commit(next) {
    const temporary = path.join(directory, `.links-${process.pid}-${randomBytes(8).toString('hex')}.tmp`);
    try {
      const file = await fs.open(temporary, 'wx', 0o600);
      try {
        await file.writeFile(JSON.stringify({ version: 1, links: [...next.values()] }) + '\n');
        await file.sync();
      } finally { await file.close(); }
      await fs.rename(temporary, filename);
      records = next;
    } finally { await fs.rm(temporary, { force: true }); }
  }
  return {
    list() {
      return [...records.values()].sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
    },
    create(input) {
      return serialize(async () => {
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(422, '请求必须为对象');
        const url = normalizeUrl(input.url);
        let slug = input.slug;
        if (Object.hasOwn(input, 'slug')) {
          if (typeof slug !== 'string' || !SLUG.test(slug)) throw new HttpError(422, 'slug 须为 3–24 位字母、数字、下划线或连字符');
        } else {
          do { slug = randomBytes(9).toString('base64url'); } while (records.has(slug));
        }
        const existing = records.get(slug);
        if (existing) {
          if (existing.url !== url) throw new HttpError(409, '该 slug 已指向其他 URL');
          return { status: 200, record: existing };
        }
        const record = { slug, url, visits: 0 };
        const next = new Map(records);
        next.set(slug, record);
        await commit(next);
        return { status: 201, record };
      });
    },
    redirect(slug, count) {
      return serialize(async () => {
        const record = records.get(slug);
        if (!record) throw new HttpError(404, '短链接不存在');
        if (!count) return record;
        if (record.visits === Number.MAX_SAFE_INTEGER) throw new HttpError(503, '访问计数已达上限');
        const updated = { ...record, visits: record.visits + 1 };
        const next = new Map(records);
        next.set(slug, updated);
        await commit(next);
        return updated;
      });
    },
    drain() { return pending; },
  };
}

function send(res, status, data, headers = {}) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(body);
}
function html(res, body) {
  send(res, 200, body, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  });
}
function escape(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}
function page(store, port, created) {
  const rows = store.list().map(record => `<tr><td><a href="/s/${record.slug}">${escape(record.slug)}</a></td><td class="url">${escape(record.url)}</td><td>${record.visits}</td></tr>`).join('');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>本地短链接</title>
<style>body{font:16px system-ui,sans-serif;max-width:1000px;margin:40px auto;padding:0 20px;color:#17212e}label{display:block;margin:16px 0}input{font:inherit;padding:9px;box-sizing:border-box;width:100%}button{font:inherit;padding:9px 18px;cursor:pointer}table{border-collapse:collapse;width:100%;margin:20px 0}th,td{text-align:left;border-bottom:1px solid #ccd2d9;padding:12px}.url{overflow-wrap:anywhere}a{color:#075cb6}.status{padding:12px;background:#eaf6ea}</style>
<h1>本地短链接与访问统计</h1><p>创建短链接后，点击列表中的 slug 跳转；返回并刷新即可查看访问次数。</p>
${created ? `<p class="status">已保存：${escape(created)}</p>` : ''}
<form action="/create" method="post"><label>目标 URL（仅允许 127.0.0.1，必须填写端口）<input name="url" type="url" required value="http://127.0.0.1:${port}/demo?message=hello"></label>
<label>自定义 slug（可选，区分大小写）<input name="slug" pattern="[A-Za-z0-9_\\-]{3,24}" minlength="3" maxlength="24" placeholder="留空自动生成"></label><button type="submit">创建短链接</button></form>
<h2>链接列表</h2><p><a href="/">刷新访问次数</a> · <a href="/api/links">查看 JSON API</a> · <a href="/demo">本地测试接收页</a></p>
<table><thead><tr><th>短链接 slug</th><th>目标 URL</th><th>访问次数</th></tr></thead><tbody>${rows || '<tr><td colspan="3">暂无链接，请先创建。</td></tr>'}</tbody></table></html>`;
}
async function readBody(req, type) {
  if ((req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== type) {
    throw new HttpError(415, `Content-Type 须为 ${type}`);
  }
  const chunks = [];
  let size = 0;
  // Do not destroy the request stream when rejecting a large body: allow a JSON error response.
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > MAX_BODY) { req.resume(); throw new HttpError(413, '请求体不能超过 16 KiB'); }
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  if (type === 'application/json') {
    try { return JSON.parse(body); } catch { throw new HttpError(400, 'JSON 格式无效'); }
  }
  const form = new URLSearchParams(body);
  return { url: form.get('url'), ...(form.get('slug') ? { slug: form.get('slug') } : {}) };
}

async function main() {
  const config = options(process.argv.slice(2));
  const store = await openStore(config.data);
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const route = url.pathname;
      if (route === '/health' && req.method === 'GET') return send(res, 200, { ok: true });
      if (route === '/' && req.method === 'GET') return html(res, page(store, server.address().port, url.searchParams.get('created')));
      if (route === '/api/links' && req.method === 'GET') return send(res, 200, { links: store.list() });
      if (route === '/api/links' && req.method === 'POST') {
        const result = await store.create(await readBody(req, 'application/json'));
        return send(res, result.status, result.record);
      }
      if (route === '/create' && req.method === 'POST') {
        const result = await store.create(await readBody(req, 'application/x-www-form-urlencoded'));
        return send(res, 303, '', { Location: `/?created=${encodeURIComponent(result.record.slug)}` });
      }
      if (route.startsWith('/s/') && (req.method === 'GET' || req.method === 'HEAD')) {
        let slug;
        try { slug = decodeURIComponent(route.slice(3)); } catch { throw new HttpError(404, '短链接不存在'); }
        const record = await store.redirect(slug, req.method === 'GET');
        return send(res, 302, '', { Location: record.url });
      }
      if (route === '/demo' && req.method === 'GET') {
        return html(res, `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>本地测试接收页</title><h1>已到达本地测试接收页</h1><p>请求路径：${escape(req.url)}</p><p><a href="/">返回列表并查看访问次数</a></p></html>`);
      }
      if (['/health', '/', '/api/links', '/create', '/demo'].includes(route) || route.startsWith('/s/')) throw new HttpError(405, '不支持此请求方法');
      throw new HttpError(404, '页面不存在');
    } catch (error) {
      if (!error.status) console.error(error);
      if (!res.headersSent && !res.destroyed) send(res, error.status || 500, { error: error.status ? error.message : '服务器存储或处理失败' });
    }
  });
  server.requestTimeout = 15000;
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(config.port, '127.0.0.1', () => {
    console.log(`Listening on http://127.0.0.1:${server.address().port}`);
    console.log(`Data: ${config.data}`);
  });
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    server.close(async () => { await store.drain(); });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
