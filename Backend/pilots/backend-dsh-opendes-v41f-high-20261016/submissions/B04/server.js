#!/usr/bin/env node
'use strict';

/**
 * 本地短链接与访问统计台
 *
 * 仅使用 Node.js 24 原生模块，无第三方依赖。
 *
 *   node server.js --port <端口> --data <数据目录>
 *
 * 路由：
 *   GET  /health         -> {"ok":true}
 *   GET  /               -> 服务端渲染的操作界面（表单 + 链接表格）
 *   POST /api/links      -> {url, slug?} 创建短链接（JSON）
 *   POST /create         -> 同上，但接收 application/x-www-form-urlencoded，完成后跳回 /
 *   GET  /api/links      -> {"links":[{slug,url,visits}]}，按 slug 字典序
 *   GET  /s/<slug>       -> 302 跳转并把 visits 加 1
 *   HEAD /s/<slug>       -> 302 跳转但不计数
 *   GET  /demo           -> 本地接收页（演示用跳转目标，不访问外部站点）
 */

const http = require('node:http');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const SLUG_RE = /^[A-Za-z0-9_-]{3,24}$/;
const MAX_BODY_BYTES = 64 * 1024;
const AUTO_SLUG_LENGTH = 10;
const AUTO_SLUG_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/* ------------------------------------------------------------------ */
/* 命令行参数                                                          */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const opts = { port: 0, data: path.resolve(process.cwd(), 'data') };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    let key = null;
    let value = null;
    if (arg === '--port' || arg === '-p') key = 'port';
    else if (arg === '--data' || arg === '-d') key = 'data';
    else if (arg.startsWith('--port=')) {
      key = 'port';
      value = arg.slice('--port='.length);
    } else if (arg.startsWith('--data=')) {
      key = 'data';
      value = arg.slice('--data='.length);
    } else if (arg === '--help' || arg === '-h') {
      return { help: true, port: 0, data: opts.data };
    } else {
      throw new Error(`未知参数：${arg}`);
    }
    if (value === null) {
      i += 1;
      value = argv[i];
      if (value === undefined) throw new Error(`参数 ${arg} 缺少取值`);
    }
    if (key === 'port') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 65535) {
        throw new Error(`端口非法：${value}`);
      }
      opts.port = n;
    } else {
      opts.data = path.resolve(value);
    }
  }
  return opts;
}

const USAGE = [
  '用法：node server.js --port <端口> --data <数据目录>',
  '  --port, -p   监听端口（仅绑定 127.0.0.1），0 表示由系统分配',
  '  --data, -d   数据目录，不存在时自动创建，重启后复用',
  '  --help, -h   显示本帮助',
].join('\n');

/* ------------------------------------------------------------------ */
/* 存储：内存 Map + 原子写盘的 JSON 文件                                */
/* ------------------------------------------------------------------ */

function cloneLink(link) {
  return { slug: link.slug, url: link.url, visits: link.visits };
}

class LinkStore {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'links.json');
    this.links = new Map();
    // 变更队列：保证“查重 + 写入”是原子的，且并发计数不丢失。
    this.mutations = Promise.resolve();
    // 写盘队列：保证落盘顺序与变更顺序一致。
    this.writes = Promise.resolve();
    this.writeSeq = 0;
  }

  /** 读取已有数据文件；目录不存在则创建。 */
  async init() {
    await fsp.mkdir(this.dir, { recursive: true });
    let raw;
    try {
      raw = await fsp.readFile(this.file, 'utf8');
    } catch (err) {
      if (err && err.code === 'ENOENT') return this;
      throw err;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`数据文件损坏，无法解析 JSON：${this.file}`);
    }
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed && parsed.links)
        ? parsed.links
        : [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const { slug, url } = item;
      if (typeof slug !== 'string' || !SLUG_RE.test(slug)) continue;
      if (typeof url !== 'string' || url.length === 0) continue;
      const visits =
        Number.isInteger(item.visits) && item.visits >= 0 ? item.visits : 0;
      this.links.set(slug, { slug, url, visits });
    }
    return this;
  }

  /** 按 slug 字典序返回快照列表。 */
  list() {
    return [...this.links.values()]
      .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
      .map(cloneLink);
  }

  snapshot() {
    return `${JSON.stringify({ version: 1, links: this.list() }, null, 2)}\n`;
  }

  /** 以“写临时文件 + 原子改名”的方式落盘。 */
  persist() {
    this.writeSeq += 1;
    const tmp = `${this.file}.${process.pid}.${this.writeSeq}.tmp`;
    const task = this.writes.then(async () => {
      await fsp.writeFile(tmp, this.snapshot(), 'utf8');
      await fsp.rename(tmp, this.file);
    });
    this.writes = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  /**
   * 串行执行一次状态变更回调；回调中读到的状态不会被其他请求打断。
   * 回调内的 await（例如落盘）仍然占用队列，因此变更与落盘严格有序。
   */
  mutate(fn) {
    const task = this.mutations.then(fn);
    this.mutations = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }
}

function randomSlug(length = AUTO_SLUG_LENGTH) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += AUTO_SLUG_ALPHABET[crypto.randomInt(AUTO_SLUG_ALPHABET.length)];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 校验                                                                */
/* ------------------------------------------------------------------ */

// 目标 URL 只允许字面上的 127.0.0.1 主机；localhost、[::1] 等一律视为“其他主机”拒绝。
const ALLOWED_HOST = '127.0.0.1';

/**
 * 目标 URL 只允许指向本机回环的 http://127.0.0.1:<端口>/... ，且不得携带用户名/密码。
 * 通过校验后按 new URL(url).href 规范化保存。
 */
function normalizeTargetUrl(raw) {
  if (typeof raw !== 'string') {
    return { error: 'url 必须是字符串' };
  }
  const text = raw.trim();
  if (text === '') return { error: 'url 不能为空' };

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return { error: 'url 无法解析' };
  }
  if (parsed.protocol !== 'http:') {
    return { error: '仅允许 http:// 协议' };
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return { error: 'url 不能包含用户名或密码' };
  }
  if (parsed.hostname !== ALLOWED_HOST) {
    return { error: '仅允许 http://127.0.0.1:<端口>/... 形式的本机地址' };
  }
  return { href: parsed.href };
}

function normalizeSlug(raw) {
  if (typeof raw !== 'string') {
    return { error: 'slug 必须是字符串' };
  }
  if (!SLUG_RE.test(raw)) {
    return { error: 'slug 必须匹配 [A-Za-z0-9_-]{3,24}' };
  }
  return { slug: raw };
}

/* ------------------------------------------------------------------ */
/* 业务逻辑                                                            */
/* ------------------------------------------------------------------ */

/**
 * 创建短链接。返回 {status, body}。
 * 201 新建 / 200 slug+url 均相同 / 409 同 slug 不同 url / 422 入参非法。
 */
async function createLink(store, rawUrl, rawSlug) {
  const urlResult = normalizeTargetUrl(rawUrl);
  if (urlResult.error) return { status: 422, body: { error: urlResult.error } };

  let slug = null;
  if (rawSlug !== undefined && rawSlug !== null) {
    const slugResult = normalizeSlug(rawSlug);
    if (slugResult.error) return { status: 422, body: { error: slugResult.error } };
    slug = slugResult.slug;
  }

  const url = urlResult.href;

  if (slug !== null) {
    return store.mutate(async () => {
      const existing = store.links.get(slug);
      if (existing) {
        if (existing.url === url) {
          return { status: 200, body: cloneLink(existing) };
        }
        return {
          status: 409,
          body: { error: `slug 已被其他 URL 占用：${existing.url}` },
        };
      }
      const record = { slug, url, visits: 0 };
      store.links.set(slug, record);
      await store.persist();
      return { status: 201, body: cloneLink(record) };
    });
  }

  // 未提供 slug：生成独立且唯一的 slug（在变更锁内确认未占用后落盘）。
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const candidate = randomSlug();
    const created = await store.mutate(async () => {
      if (store.links.has(candidate)) return null;
      const record = { slug: candidate, url, visits: 0 };
      store.links.set(candidate, record);
      await store.persist();
      return { status: 201, body: cloneLink(record) };
    });
    if (created) return created;
  }
  return { status: 500, body: { error: '无法生成唯一 slug' } };
}

/** 原子地把 visits 加 1，返回更新后的记录；未知 slug 返回 null。 */
function recordVisit(store, slug) {
  return store.mutate(async () => {
    const record = store.links.get(slug);
    if (!record) return null;
    record.visits += 1;
    await store.persist();
    return cloneLink(record);
  });
}

/* ------------------------------------------------------------------ */
/* HTTP 工具                                                           */
/* ------------------------------------------------------------------ */

function sendJson(req, res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function sendHtml(req, res, status, html) {
  const body = Buffer.from(html, 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function sendText(req, res, status, text) {
  const body = Buffer.from(text, 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendRedirect(req, res, location) {
  const body = Buffer.from('302 Found', 'utf8');
  res.writeHead(302, {
    Location: location,
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        const err = new Error('请求体过大');
        err.status = 413;
        req.destroy();
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/* ------------------------------------------------------------------ */
/* 页面（服务端渲染）                                                   */
/* ------------------------------------------------------------------ */

const PAGE_STYLE = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, "Segoe UI", "Microsoft YaHei", sans-serif;
         margin: 0 auto; padding: 1.5rem; max-width: 62rem; line-height: 1.55; }
  h1 { font-size: 1.5rem; margin: 0 0 .35rem; }
  h2 { font-size: 1.1rem; margin: 0 0 .6rem; }
  section { border: 1px solid #8884; border-radius: .5rem; padding: 1rem; margin: 0 0 1rem; }
  .meta { color: #777; font-size: .875rem; margin: 0 0 1rem; }
  .meta code, code { font-family: ui-monospace, Consolas, monospace; }
  form.create { display: flex; flex-wrap: wrap; gap: .75rem 1rem; align-items: flex-end; }
  form.create label { display: flex; flex-direction: column; gap: .25rem; font-size: .875rem; }
  input[type=text], input[name=url], input[name=slug] {
    font: inherit; padding: .4rem .5rem; min-width: 20rem; border: 1px solid #9996;
    border-radius: .3rem; background: transparent; color: inherit; }
  button { font: inherit; padding: .45rem 1rem; border: 1px solid #9996; border-radius: .3rem;
           background: #3b82f6; color: #fff; cursor: pointer; }
  button:hover { filter: brightness(1.08); }
  table { border-collapse: collapse; width: 100%; font-size: .9rem; }
  th, td { border-bottom: 1px solid #8884; padding: .4rem .5rem; text-align: left;
           vertical-align: top; word-break: break-all; }
  th { font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .flash { padding: .5rem .75rem; border-radius: .3rem; margin: 0 0 1rem; font-size: .9rem; }
  .flash.error { background: #ef444422; border: 1px solid #ef444488; }
  .flash.ok { background: #22c55e22; border: 1px solid #22c55e88; }
  .hint { color: #777; font-size: .8rem; margin: .6rem 0 0; }
  .empty { color: #777; padding: .5rem 0; }
  footer { color: #777; font-size: .8rem; }
`;

function renderRows(links) {
  if (links.length === 0) {
    return '<tr><td colspan="4" class="empty">暂无短链接，使用上方表单创建。</td></tr>';
  }
  return links
    .map((link) => {
      const slug = escapeHtml(link.slug);
      return [
        '<tr>',
        `<td><code>${slug}</code></td>`,
        `<td><a href="/s/${encodeURIComponent(link.slug)}">/s/${slug}</a></td>`,
        `<td><code>${escapeHtml(link.url)}</code></td>`,
        `<td class="num">${link.visits}</td>`,
        '</tr>',
      ].join('');
    })
    .join('\n');
}

function renderPage({ port, dataDir, links, flash, demoUrl }) {
  const flashHtml = flash
    ? `<p class="flash ${flash.ok ? 'ok' : 'error'}">${escapeHtml(flash.text)}</p>`
    : '';
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>本地短链接与访问统计台</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<h1>本地短链接与访问统计台</h1>
<p class="meta">服务运行中 · 监听 <code>127.0.0.1:${port}</code> · 数据目录 <code>${escapeHtml(dataDir)}</code> · 页面每次请求都由服务端按当前数据重新生成</p>
${flashHtml}
<section>
  <h2>创建短链接</h2>
  <form class="create" method="post" action="/create">
    <label>目标 URL
      <input type="text" name="url" required size="52" placeholder="${escapeHtml(demoUrl)}">
    </label>
    <label>自定义 slug（可选）
      <input type="text" name="slug" size="18" pattern="[A-Za-z0-9_-]{3,24}" placeholder="my-link">
    </label>
    <button type="submit">创建短链接</button>
  </form>
  <p class="hint">仅接受 <code>http://127.0.0.1:&lt;端口&gt;/...</code> 形式的本机地址（http 协议、主机必须是 127.0.0.1、不含用户名密码），保存时按 <code>new URL(url).href</code> 规范化；其他主机或协议一律拒绝。slug 需匹配 <code>[A-Za-z0-9_-]{3,24}</code> 且区分大小写，留空则自动生成。</p>
</section>
<section>
  <h2>链接列表（共 ${links.length} 条，按 slug 字典序）</h2>
  <table>
    <thead><tr><th>slug</th><th>短链接</th><th>目标 URL</th><th class="num">访问次数</th></tr></thead>
    <tbody>
${renderRows(links)}
    </tbody>
  </table>
</section>
<section>
  <h2>本地接收页</h2>
  <p>本服务自带一个演示用跳转目标，不会请求任何外部站点：<a href="/demo">${escapeHtml(demoUrl)}</a></p>
  <p class="hint">把上面这个地址填进表单，即可完整体验“创建 → 跳转 → 计数 → 刷新查看”。</p>
</section>
<footer>
  API：<code>POST /api/links</code> · <code>GET /api/links</code> · <code>GET|HEAD /s/&lt;slug&gt;</code> · <code>GET /health</code>
</footer>
</body>
</html>
`;
}

function renderDemoPage({ port, method, target }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>本地接收页</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<h1>本地接收页</h1>
<section>
  <p>已到达本服务内置的跳转目标，说明短链接 302 跳转成功。</p>
  <table>
    <tbody>
      <tr><th>请求方法</th><td><code>${escapeHtml(method)}</code></td></tr>
      <tr><th>请求路径</th><td><code>${escapeHtml(target)}</code></td></tr>
      <tr><th>监听地址</th><td><code>127.0.0.1:${port}</code></td></tr>
    </tbody>
  </table>
</section>
<footer><a href="/">返回短链接台</a></footer>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ */
/* 服务器                                                              */
/* ------------------------------------------------------------------ */

function createServer({ store, dataDir }) {
  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      const status = err && err.status ? err.status : 500;
      const message = err && err.status ? err.message : '服务器内部错误';
      if (!res.headersSent) {
        sendJson(req, res, status, { error: message });
      } else {
        res.destroy();
      }
      if (!err || !err.status) console.error('[server] 未处理的错误:', err);
    });
  });

  async function handle(req, res) {
    const method = req.method || 'GET';
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = url.pathname;
    const port = server.address() ? server.address().port : 0;

    // 健康检查
    if (pathname === '/health') {
      if (method !== 'GET' && method !== 'HEAD') {
        return sendJson(req, res, 405, { error: '仅支持 GET/HEAD' });
      }
      return sendJson(req, res, 200, { ok: true });
    }

    if (pathname === '/favicon.ico') {
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      return res.end();
    }

    // 根页面
    if (pathname === '/') {
      if (method !== 'GET' && method !== 'HEAD') {
        return sendJson(req, res, 405, { error: '仅支持 GET/HEAD' });
      }
      let flash = null;
      const errorText = url.searchParams.get('error');
      const noticeText = url.searchParams.get('notice');
      if (errorText) flash = { ok: false, text: errorText };
      else if (noticeText) flash = { ok: true, text: noticeText };
      const html = renderPage({
        port,
        dataDir,
        links: store.list(),
        flash,
        demoUrl: `http://127.0.0.1:${port}/demo`,
      });
      return sendHtml(req, res, 200, html);
    }

    // 内置接收页（演示跳转目标，纯本地）
    if (pathname === '/demo') {
      if (method !== 'GET' && method !== 'HEAD') {
        return sendJson(req, res, 405, { error: '仅支持 GET/HEAD' });
      }
      const target = `${pathname}${url.search}`;
      return sendHtml(req, res, 200, renderDemoPage({ port, method, target }));
    }

    // API：列表与创建
    if (pathname === '/api/links') {
      if (method === 'GET' || method === 'HEAD') {
        return sendJson(req, res, 200, { links: store.list() });
      }
      if (method !== 'POST') {
        return sendJson(req, res, 405, { error: '仅支持 GET/POST' });
      }
      const raw = await readBody(req);
      let payload;
      if (raw.trim() === '') {
        payload = {};
      } else {
        try {
          payload = JSON.parse(raw);
        } catch {
          return sendJson(req, res, 400, { error: '请求体不是合法 JSON' });
        }
      }
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        return sendJson(req, res, 422, { error: '请求体必须是 JSON 对象' });
      }
      const result = await createLink(store, payload.url, payload.slug);
      return sendJson(req, res, result.status, result.body);
    }

    // 表单创建：失败/成功都跳回根页面并带上提示
    if (pathname === '/create') {
      if (method !== 'POST') {
        return sendJson(req, res, 405, { error: '仅支持 POST' });
      }
      const raw = await readBody(req);
      const form = new URLSearchParams(raw);
      const slugRaw = form.get('slug');
      const slug = slugRaw === null || slugRaw.trim() === '' ? undefined : slugRaw;
      const result = await createLink(store, form.get('url') ?? undefined, slug);
      if (result.status === 201 || result.status === 200) {
        const action = result.status === 201 ? '已创建' : '已存在';
        const notice = `${action}短链接 /s/${result.body.slug} → ${result.body.url}`;
        return sendRedirect(
          req,
          res,
          `/?notice=${encodeURIComponent(notice)}`,
        );
      }
      return sendRedirect(
        req,
        res,
        `/?error=${encodeURIComponent(result.body.error || '创建失败')}`,
      );
    }

    // 短链接跳转
    if (pathname === '/s/' || pathname.startsWith('/s/')) {
      if (method !== 'GET' && method !== 'HEAD') {
        return sendJson(req, res, 405, { error: '仅支持 GET/HEAD' });
      }
      let slug;
      try {
        slug = decodeURIComponent(pathname.slice('/s/'.length));
      } catch {
        return sendJson(req, res, 404, { error: '未知的短链接' });
      }
      if (!SLUG_RE.test(slug)) {
        return sendJson(req, res, 404, { error: '未知的短链接' });
      }
      const record = store.links.get(slug);
      if (!record) {
        return sendJson(req, res, 404, { error: '未知的短链接' });
      }
      // 跳转始终使用当前保存的 URL；HEAD 只返回跳转头，不计访问。
      const location = record.url;
      if (method === 'GET') {
        await recordVisit(store, slug);
      }
      return sendRedirect(req, res, location);
    }

    return sendJson(req, res, 404, { error: '未找到该路径' });
  }

  return server;
}

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`参数错误：${err.message}\n\n${USAGE}`);
    process.exitCode = 1;
    return;
  }
  if (opts.help) {
    console.log(USAGE);
    return;
  }

  const dataDir = opts.data;
  const store = new LinkStore(dataDir);
  try {
    await store.init();
  } catch (err) {
    console.error(`无法初始化数据目录 ${dataDir}：${err.message}`);
    process.exitCode = 1;
    return;
  }

  const server = createServer({ store, dataDir });

  server.on('error', (err) => {
    console.error(`服务启动失败：${err.message}`);
    process.exitCode = 1;
  });

  await new Promise((resolve) => {
    server.listen(opts.port, '127.0.0.1', () => {
      const { port } = server.address();
      console.log(`短链接服务已启动：http://127.0.0.1:${port}`);
      console.log(`数据目录：${dataDir}`);
      console.log(`已载入 ${store.links.size} 条短链接`);
      resolve();
    });
  });

  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    console.log(`收到 ${signal}，正在关闭服务…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
