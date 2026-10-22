'use strict';

/**
 * 目录重复文件检测器 —— 只读扫描器（Node.js 24 原生模块，无第三方依赖）
 *
 *   node server.js [--port 8000] [--data ./data] [--root ./demo]
 *
 * 接口：
 *   GET  /health       -> {"ok":true}
 *   GET  /             -> 操作界面（index.html）
 *   POST /api/scan     -> 启动扫描并等待完成；并发请求合并到同一运行，或 409
 *   GET  /api/scan     -> 当前状态与进度（轮询 / 恢复界面状态）
 *   GET  /api/result   -> 最近一次完整扫描结果（服务重启后保留）
 */

const http = require('node:http');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 单文件上限 8 MiB
const MAX_DEPTH = 64;                  // 目录递归深度上限（防御性）
const HASH_CONCURRENCY = 4;

// ---------------------------------------------------------------- 参数解析

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    let key = arg.slice(2);
    let value = null;
    const eq = key.indexOf('=');
    if (eq !== -1) {
      value = key.slice(eq + 1);
      key = key.slice(0, eq);
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      value = argv[++i];
    }
    out[key] = value;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

function positiveInt(value, fallback, { allowZero = false } = {}) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < (allowZero ? 0 : 1) || n > 65535) {
    throw new Error(`无效的数值参数：${value}`);
  }
  return n;
}

let PORT;
let DATA_DIR;
let ROOT_DIR;
try {
  PORT = positiveInt(args.port, 8000);
  DATA_DIR = path.resolve(args.data === undefined || args.data === null || args.data === ''
    ? path.join(process.cwd(), 'data')
    : args.data);
  ROOT_DIR = path.resolve(args.root === undefined || args.root === null || args.root === ''
    ? path.join(process.cwd(), 'demo')
    : args.root);
} catch (err) {
  console.error(`[duplicate-inspector] ${err.message}`);
  process.exit(1);
}

const STATE_FILE = path.join(DATA_DIR, 'last-result.json');
const TMP_DIR = path.join(DATA_DIR, 'tmp');

// ------------------------------------------------------------------ 小工具

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** 统一错误响应：非 2xx + {"error":"原因"} */
function sendError(res, status, reason) {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  const body = JSON.stringify({ error: reason });
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// ------------------------------------------------------------------ 扫描器

function nowIso() {
  return new Date().toISOString();
}

const state = {
  running: false,
  phase: 'idle',     // idle | walking | hashing
  files: 0,          // 已发现的普通文件数
  hashed: 0,         // 已读取并计算哈希的文件数
  total: 0,          // 需要读取的文件数（已排除超限与不可读）
  sizeGroups: 0,     // 出现多次的文件大小数量（诊断用）
  startedAt: null,
  finishedAt: null,
  scanned: 0,
  skipped: 0,
  unreadable: 0,     // 无法读取 / 遍历失败的条目
  oversize: 0,       // 超过单文件上限
  uniqueSize: 0,     // 大小独一份，不可能有字节完全相同的第二份
  uniqueHash: 0,     // 读过但摘要独一份
  duplicateFiles: 0, // 出现在重复组中的文件数
  groups: [],
  error: null,
  lastScanSeq: 0,
};

let inFlight = null;      // 进行中扫描的 Promise（resolve 为完整结果）

function publicStatus() {
  return {
    running: state.running,
    phase: state.phase,
    root: ROOT_DIR,
    files: state.files,
    processed: state.phase === 'walking' ? state.files : state.hashed,
    hashed: state.hashed,
    total: state.total,
    sizeGroups: state.sizeGroups,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    scanned: state.scanned,
    skipped: state.skipped,
    unreadable: state.unreadable,
    oversize: state.oversize,
    uniqueSize: state.uniqueSize,
    uniqueHash: state.uniqueHash,
    duplicateFiles: state.duplicateFiles,
    groupCount: state.groups.length,
    error: state.error,
    lastScanSeq: state.lastScanSeq,
  };
}

function resetForWalk() {
  state.phase = 'walking';
  state.files = 0;
  state.hashed = 0;
  state.total = 0;
  state.sizeGroups = 0;
  state.startedAt = nowIso();
  state.finishedAt = null;
  state.scanned = 0;
  state.skipped = 0;
  state.unreadable = 0;
  state.oversize = 0;
  state.uniqueSize = 0;
  state.uniqueHash = 0;
  state.duplicateFiles = 0;
  state.groups = [];
  state.error = null;
}

/**
 * skipped 严格按任务口径统计：无法读取（含遍历失败）与超过单文件上限的文件。
 * 大小或摘要独一份、因而不可能成组的文件不计入 skipped（它们已被成功读取），
 * 但单独记录数量，便于界面展示与排查。
 */
function bumpSkipped(kind) {
  if (kind === 'unreadable') {
    state.skipped += 1;
    state.unreadable += 1;
  } else if (kind === 'oversize') {
    state.skipped += 1;
    state.oversize += 1;
  } else if (kind === 'uniqueSize') {
    state.uniqueSize += 1;
  } else if (kind === 'uniqueHash') {
    state.uniqueHash += 1;
  }
}

/** 遍历根目录内所有普通文件；不跟随符号链接与 junction，不越出根目录 */
async function collectFiles() {
  const files = [];
  const seenDirs = new Set();
  const queue = [{ dir: ROOT_DIR, depth: 0 }];

  while (queue.length > 0) {
    const { dir, depth } = queue.shift();
    let realDir;
    try {
      realDir = await fsp.realpath(dir);
    } catch {
      bumpSkipped('unreadable');
      continue;
    }
    if (!seenDirs.has(realDir)) seenDirs.add(realDir);

    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      bumpSkipped('unreadable');
      continue;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;   // 符号链接：不跟随
      if (entry.isDirectory()) {
        if (depth >= MAX_DEPTH) continue;
        // 双重校验：真实路径仍在根内，且未重复访问同一真实目录（防御 junction）
        let real;
        try {
          real = await fsp.realpath(full);
        } catch {
          continue;
        }
        if (real !== ROOT_DIR && !isInside(ROOT_DIR, real)) continue;
        if (seenDirs.has(real)) continue;
        seenDirs.add(real);
        queue.push({ dir: full, depth: depth + 1 });
        continue;
      }
      if (!entry.isFile()) continue;          // 只看普通文件
      files.push({ path: full, rel: path.relative(ROOT_DIR, full), size: -1 });
    }
    state.files = files.length;
  }

  for (const f of files) {
    try {
      const st = await fsp.lstat(f.path);
      if (!st.isFile()) {
        f.size = -2;
        continue;
      }
      f.size = st.size;
    } catch {
      f.size = -2;
    }
  }
  return files;
}

async function hashFile(file) {
  const buf = await fsp.readFile(file.path);
  if (buf.length > MAX_FILE_SIZE) throw new Error('超过单文件上限');
  return sha256Hex(buf);
}

async function hashWithConcurrency(files, worker, limit) {
  const queue = files.slice();
  const runners = [];
  const n = Math.min(limit, queue.length) || 1;
  for (let i = 0; i < n; i++) {
    runners.push((async () => {
      for (;;) {
        const item = queue.shift();
        if (!item) return;
        await worker(item);
      }
    })());
  }
  await Promise.all(runners);
}

async function runScan() {
  resetForWalk();

  const files = await collectFiles();

  // 先剔除无法读取与超过单文件上限的文件：它们计入 skipped
  const readable = [];
  for (const f of files) {
    if (f.size < 0) bumpSkipped('unreadable');
    else if (f.size > MAX_FILE_SIZE) bumpSkipped('oversize');
    else readable.push(f);
  }

  // 诊断信息：哪些大小只出现一次（这些文件不可能有第二份完全相同的副本）
  const sizeCount = new Map();
  for (const f of readable) sizeCount.set(f.size, (sizeCount.get(f.size) || 0) + 1);
  for (const count of sizeCount.values()) {
    if (count >= 2) state.sizeGroups += 1;
    else state.uniqueSize += 1;
  }

  // 每个可读文件都真实读取并计算 SHA-256：
  // 既保证 scanned 等于「成功读取的文件数」，也避免仅凭文件大小或文件名判重复。
  state.total = readable.length;
  state.phase = 'hashing';

  const byHash = new Map();
  await hashWithConcurrency(readable, async (file) => {
    try {
      const hash = await hashFile(file);
      let list = byHash.get(hash);
      if (!list) byHash.set(hash, (list = []));
      list.push(file);
      state.scanned += 1;
    } catch {
      bumpSkipped('unreadable');
    } finally {
      state.hashed += 1;
    }
  }, HASH_CONCURRENCY);

  // 只有字节完全相同（摘要一致）且至少两份才成组
  const groups = [];
  for (const [sha256, list] of byHash) {
    if (list.length < 2) {
      state.uniqueHash += 1;
      continue;
    }
    const paths = list.map((f) => f.rel).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    groups.push({ sha256, size: list[0].size, paths });
    state.duplicateFiles += paths.length;
  }
  groups.sort((a, b) => (a.paths[0] < b.paths[0] ? -1 : a.paths[0] > b.paths[0] ? 1 : 0));

  const result = {
    groups,
    scanned: state.scanned,
    skipped: state.skipped,
  };

  state.groups = groups;
  state.phase = 'idle';
  state.running = false;
  state.finishedAt = nowIso();

  try {
    await persist(result);
  } catch (err) {
    console.error(`[duplicate-inspector] 写入结果失败：${err.message}`);
  }

  return result;
}

function startScan() {
  if (inFlight) return inFlight;

  state.running = true;
  state.lastScanSeq += 1;

  inFlight = runScan()
    .catch((err) => {
      state.running = false;
      state.phase = 'idle';
      state.error = err && err.message ? err.message : String(err);
      state.finishedAt = nowIso();
      throw err;
    })
    .finally(() => {
      state.running = false;
      state.lastScanSeq += 1;
      inFlight = null;
    });

  // 避免无人等待时产生 unhandledRejection
  inFlight.catch(() => {});
  return inFlight;
}

// ------------------------------------------------------------ 结果持久化

async function persist(result) {
  const payload = JSON.stringify({
    version: 1,
    finishedAt: nowIso(),
    root: ROOT_DIR,
    groups: result.groups,
    scanned: result.scanned,
    skipped: result.skipped,
  });
  const file = path.join(TMP_DIR, `last-result-${process.pid}-${Date.now()}.json`);
  await fsp.writeFile(file, payload, 'utf8');
  await fsp.rename(file, STATE_FILE);      // 原子替换：不会留下半份结果
}

async function loadPersistedResult() {
  let raw;
  try {
    raw = await fsp.readFile(STATE_FILE, 'utf8');
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.groups)) return null;
    const groups = [];
    for (const g of data.groups) {
      if (!g || typeof g.sha256 !== 'string' || !Array.isArray(g.paths)) continue;
      const paths = g.paths.filter((p) => typeof p === 'string');
      if (paths.length < 2) continue;
      const size = Number.isInteger(g.size) ? g.size : 0;
      groups.push({ sha256: g.sha256, size, paths });
    }
    return {
      groups,
      scanned: Number.isInteger(data.scanned) ? data.scanned : 0,
      skipped: Number.isInteger(data.skipped) ? data.skipped : 0,
      finishedAt: typeof data.finishedAt === 'string' ? data.finishedAt : null,
      persisted: true,
    };
  } catch {
    return null;
  }
}

/**
 * GET /api/result：返回最近一次「完整」结果。
 * 扫描进行中时 state 里的计数是半成品，此时回落到数据目录中上次落盘的结果，
 * 从而不会把半份结果发布出去。绝不在这里改写在跑的扫描状态。
 */
async function getLatestResult() {
  if (state.finishedAt !== null && state.error === null && state.phase === 'idle') {
    return {
      groups: state.groups,
      scanned: state.scanned,
      skipped: state.skipped,
      finishedAt: state.finishedAt,
      persisted: false,
    };
  }
  return loadPersistedResult();
}

// -------------------------------------------------------------- HTTP 服务

const INDEX_FILE = path.join(__dirname, 'index.html');

async function drainBody(req) {
  if (req.readableEnded) return '';
  const chunks = [];
  await new Promise((resolve) => {
    req.on('data', (chunk) => { chunks.push(chunk); });
    req.on('end', resolve);
    req.on('error', resolve);
    req.resume();
  });
  return Buffer.concat(chunks).toString('utf8');
}

/** 扫描根目录固定由 --root 决定，不接受请求指定任何路径，因此根外路径不可读取 */
function rejectRequestPaths(body) {
  if (!body || !body.trim()) return null;
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return '请求体不是合法 JSON（扫描根目录由启动参数 --root 固定，无需请求体）';
  }
  if (data === null) return null;
  if (typeof data !== 'object' || Array.isArray(data)) return '请求体必须是 JSON 对象';
  for (const key of ['root', 'path', 'paths', 'dir', 'directory', 'file', 'files']) {
    const value = data[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return `扫描根目录由启动参数 --root 固定，不接受请求指定路径（字段：${key}）`;
    }
  }
  return null;
}

async function handleRoot(res) {
  const html = await fsp.readFile(INDEX_FILE);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': html.length,
    'Cache-Control': 'no-store',
  });
  res.end(html);
}

async function handleScanStart(req, res) {
  const body = await drainBody(req);

  const bad = rejectRequestPaths(body);
  if (bad) {
    sendError(res, 400, bad);
    return;
  }

  // 根目录必须存在且是目录
  let stat;
  try {
    stat = await fsp.stat(ROOT_DIR);
  } catch {
    sendError(res, 400, `根目录不存在或不可读：${ROOT_DIR}`);
    return;
  }
  if (!stat.isDirectory()) {
    sendError(res, 400, `根路径不是目录：${ROOT_DIR}`);
    return;
  }

  // 已有扫描在跑 -> 合并到同一运行；否则启动新扫描。
  // 检查与启动之间没有 await，因此两个同时到达的请求不会各自启动一次扫描。
  const run = inFlight || startScan();

  await run.then(
    (result) => {
      sendJson(res, 200, result);
    },
    (err) => {
      sendError(res, 500, `扫描失败：${err && err.message ? err.message : err}`);
    },
  );
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = url.pathname;
  const method = req.method || 'GET';

  if (method === 'GET' && pathname === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }
  if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    await handleRoot(res);
    return;
  }
  if (pathname === '/api/scan') {
    if (method === 'POST') {
      await handleScanStart(req, res);
      return;
    }
    if (method === 'GET') {
      await drainBody(req);
      sendJson(res, 200, publicStatus());
      return;
    }    sendError(res, 405, `不支持的方法：${method}`);
    return;
  }
  if (method === 'GET' && pathname === '/api/result') {
    const latest = await getLatestResult();
    if (!latest) {
      sendError(res, 404, '尚未完成过扫描');
      return;
    }
    sendJson(res, 200, {
      groups: latest.groups,
      scanned: latest.scanned,
      skipped: latest.skipped,
      finishedAt: latest.finishedAt,
      persisted: latest.persisted,
    });
    return;
  }
  sendError(res, 404, '未找到该路径');
}

const server = http.createServer((req, res) => {
  route(req, res).catch((err) => {
    console.error(`[duplicate-inspector] 请求处理失败：${err && err.stack ? err.stack : err}`);
    sendError(res, 500, `服务器内部错误：${err && err.message ? err.message : err}`);
  });
});

// ----------------------------------------------------------------- 启动

async function main() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(TMP_DIR, { recursive: true });

  const saved = await loadPersistedResult();
  if (saved) {
    state.groups = saved.groups;
    state.scanned = saved.scanned;
    state.skipped = saved.skipped;
    state.finishedAt = saved.finishedAt;
  }

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[duplicate-inspector] 监听 http://127.0.0.1:${PORT}`);
    console.log(`[duplicate-inspector] 扫描根目录：${ROOT_DIR}`);
    console.log(`[duplicate-inspector] 数据目录：${DATA_DIR}`);
    if (saved) console.log(`[duplicate-inspector] 已恢复上次结果（${saved.groups.length} 组，${saved.finishedAt}）`);
    else console.log('[duplicate-inspector] 尚无历史结果，请在界面中启动扫描');
  });
}

main().catch((err) => {
  console.error(`[duplicate-inspector] 启动失败：${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
