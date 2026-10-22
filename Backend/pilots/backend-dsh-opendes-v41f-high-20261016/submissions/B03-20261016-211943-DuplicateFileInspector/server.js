'use strict';

/**
 * Read-only duplicate file inspector.
 *
 * Usage: node server.js --root <scan-root> --port <port> --data <data-dir>
 *
 * Serves a small HTTP API plus a static page on 127.0.0.1 only.
 * The scanner never deletes, moves or modifies anything it inspects.
 */

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MiB per file
const SCAN_CONCURRENCY = 4;
const READ_CHUNK = 1024 * 1024;
const RESULT_FILENAME = 'last-result.json';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    if (eq !== -1) {
      out[token.slice(2, eq)] = token.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        out[token.slice(2)] = next;
        i += 1;
      } else {
        out[token.slice(2)] = true;
      }
    }
  }
  return out;
}

function normalizeRoot(dir) {
  try {
    return fs.realpathSync.native(dir);
  } catch {
    return path.resolve(dir);
  }
}

function printHelp() {
  process.stdout.write(
    [
      'Read-only duplicate file inspector',
      '',
      'Usage:',
      '  node server.js --root <working-dir> --port <port> --data <data-dir>',
      '',
      'Options:',
      '  --root <dir>  Directory to scan (default: current directory).',
      '  --port <n>    TCP port to listen on (required, 1-65535).',
      '  --data <dir>  Directory for server state (default: ./data).',
      '  --host <ip>   Listen address; 127.0.0.1 unless set to localhost.',
      '  --help        Show this message.',
      '',
    ].join('\n'),
  );
}

function fail(message) {
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Runtime configuration
// ---------------------------------------------------------------------------

const rawArgs = parseArgs(process.argv.slice(2));
if (rawArgs.help) {
  printHelp();
  process.exit(0);
}

const PORT_RAW = rawArgs.port !== undefined ? String(rawArgs.port).trim() : '';
if (!/^\d{1,5}$/.test(PORT_RAW)) {
  fail('--port is required and must be an integer between 1 and 65535.');
}
const PORT = Number(PORT_RAW);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  fail('--port is required and must be an integer between 1 and 65535.');
}

const ROOT = normalizeRoot(
  typeof rawArgs.root === 'string' && rawArgs.root.trim() !== ''
    ? rawArgs.root
    : process.cwd(),
);

const DATA_DIR = path.resolve(
  typeof rawArgs.data === 'string' && rawArgs.data.trim() !== ''
    ? rawArgs.data
    : path.join(process.cwd(), 'data'),
);

// Only ever bind the loopback interface; anything else is refused rather than
// silently exposed.
const HOST_RAW =
  typeof rawArgs.host === 'string' && rawArgs.host.trim() !== ''
    ? rawArgs.host.trim().toLowerCase()
    : '127.0.0.1';
let HOST = HOST_RAW;
if (HOST_RAW === 'localhost') HOST = '127.0.0.1';
if (HOST !== '127.0.0.1' && HOST !== '::1') {
  fail(`refusing to listen on "${rawArgs.host}": only 127.0.0.1 may be used.`);
}

const PUBLIC_DIR = path.join(__dirname, 'public');
const PUBLIC_FILES = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
  '/styles.css': { file: 'styles.css', type: 'text/css; charset=utf-8' },
};

// ---------------------------------------------------------------------------
// Persisted state
// ---------------------------------------------------------------------------

const RESULT_FILE = path.join(DATA_DIR, RESULT_FILENAME);
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json');

/** Last fully published scan result, or null when nothing was scanned yet. */
let lastResult = null;
/** Snapshot of the scan currently running or last run, but always "running". */
let liveProgress = null;
/** The single in-flight scan promise; concurrent POST /api/scan awaits it. */
let activeScan = null;

async function ensureDataDir() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
}

function isValidResult(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    Array.isArray(value.groups) &&
    typeof value.scanned === 'number' &&
    typeof value.skipped === 'number' &&
    typeof value.generatedAt === 'string'
  );
}

async function loadPersistedResult() {
  try {
    const text = await fsp.readFile(RESULT_FILE, 'utf8');
    const parsed = JSON.parse(text);
    if (isValidResult(parsed)) {
      lastResult = parsed;
      return true;
    }
  } catch (err) {
    if (err && err.code === 'ENOENT') return false;
    process.stderr.write(
      `warning: ignoring unreadable ${RESULT_FILE} (${err && err.message})\n`,
    );
  }
  return false;
}

async function saveResult(result) {
  const tmp = `${RESULT_FILE}.tmp-${process.pid}`;
  await fsp.writeFile(tmp, JSON.stringify(result, null, 2), 'utf8');
  await fsp.rename(tmp, RESULT_FILE);
}

async function saveProgress(progress) {
  try {
    await ensureDataDir();
    await fsp.writeFile(PROGRESS_FILE, JSON.stringify(progress), 'utf8');
  } catch {
    /* progress mirroring is best effort */
  }
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

/** Read a regular file and hash it, refusing files above the size cap. */
async function hashFile(absPath, size) {
  if (size > MAX_FILE_SIZE) return null;
  const handle = await fsp.open(absPath, 'r');
  try {
    const hash = crypto.createHash('sha256');
    const buffer = Buffer.allocUnsafe(READ_CHUNK);
    let position = 0;
    let total = 0;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > MAX_FILE_SIZE) return null;
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
    return { sha256: hash.digest('hex'), size: total };
  } finally {
    await handle.close();
  }
}

function createdTimeFrom(stats) {
  const ms = stats.birthtimeMs && stats.birthtimeMs > 0 ? stats.birthtimeMs : stats.mtimeMs;
  return new Date(ms).toISOString();
}

/**
 * Walk the root, yielding only regular files. Symlinks and junctions are
 * never followed: lstat identifies them and readdir's dirent types exclude
 * anything that is not a directory or a file.
 */
async function* walkFiles(rootAbs, errors) {
  const stack = [{ abs: rootAbs, rel: '' }];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = await fsp.readdir(current.abs, { withFileTypes: true });
    } catch (err) {
      errors.push({
        path: current.rel === '' ? '.' : current.rel,
        reason: describeError(err),
      });
      continue;
    }
    for (const entry of entries) {
      const rel = current.rel === '' ? entry.name : `${current.rel}/${entry.name}`;
      // Never follow links or junctions: on Windows a directory junction
      // reports isSymbolicLink() === true (and isDirectory() === false), so
      // this single check covers both platforms.
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        stack.push({ abs: path.join(current.abs, entry.name), rel });
        continue;
      }
      if (!entry.isFile()) continue; // sockets, FIFOs, devices
      yield { abs: path.join(current.abs, entry.name), rel };
    }
  }
}

function describeError(err) {
  if (!err) return 'unknown error';
  if (err.code === 'EACCES' || err.code === 'EPERM') return 'permission denied';
  if (err.code === 'ENOENT') return 'not found';
  if (err.code === 'ELOOP') return 'too many symbolic links';
  return err.message || String(err);
}

function elapsedMs(startedAt) {
  return Date.now() - Date.parse(startedAt);
}

async function runScan(rootAbs, onProgress) {
  const startedAt = new Date().toISOString();
  const counter = { seen: 0, done: 0, scanned: 0, skipped: 0, oversize: 0, unreadable: 0 };
  const keyed = new Map();
  const errors = [];
  let lastReport = 0;

  // Refuse to "scan" a root that vanished or stopped being a directory: an
  // empty result would be a lie, so fail loudly instead.
  const rootStats = await fsp.stat(rootAbs).catch((err) => {
    throw new Error(`scan root is not readable: ${describeError(err)}`);
  });
  if (!rootStats.isDirectory()) {
    throw new Error('scan root is not a directory');
  }

  const report = (force) => {
    const now = Date.now();
    if (!force && now - lastReport < 120) return;
    lastReport = now;
    onProgress({
      state: 'running',
      seen: counter.seen,
      done: counter.done,
      scanned: counter.scanned,
      skipped: counter.skipped,
      oversize: counter.oversize,
      unreadable: counter.unreadable,
      elapsedMs: elapsedMs(startedAt),
    });
  };

  report(true);

  const pending = new Set();

  const handleFile = async (entry) => {
    let stats;
    try {
      stats = await fsp.lstat(entry.abs);
    } catch (err) {
      counter.done += 1;
      counter.skipped += 1;
      counter.unreadable += 1;
      errors.push({ path: entry.rel, reason: describeError(err) });
      return;
    }
    if (stats.isSymbolicLink() || !stats.isFile()) {
      counter.done += 1;
      return;
    }
    if (stats.size > MAX_FILE_SIZE) {
      counter.done += 1;
      counter.skipped += 1;
      counter.oversize += 1;
      errors.push({
        path: entry.rel,
        reason: `size ${stats.size} exceeds the 8 MiB limit`,
      });
      return;
    }
    let hashed;
    try {
      hashed = await hashFile(entry.abs, stats.size);
    } catch (err) {
      hashed = null;
      errors.push({ path: entry.rel, reason: describeError(err) });
    }
    counter.done += 1;
    if (hashed === null) {
      counter.skipped += 1;
      counter.unreadable += 1;
      if (!errors.some((e) => e.path === entry.rel)) {
        errors.push({ path: entry.rel, reason: 'file grew beyond the 8 MiB limit while reading' });
      }
      return;
    }
    counter.scanned += 1;
    const key = `${hashed.sha256}:${hashed.size}`;
    let bucket = keyed.get(key);
    if (!bucket) {
      bucket = { sha256: hashed.sha256, size: hashed.size, entries: [] };
      keyed.set(key, bucket);
    }
    bucket.entries.push({ path: entry.rel, created: createdTimeFrom(stats) });
  };

  for await (const entry of walkFiles(rootAbs, errors)) {
    counter.seen += 1;
    // handleFile already reports its own failures; this catch only guards
    // against an unexpected throw so one bad file cannot abort a scan.
    const job = handleFile(entry)
      .catch((err) => {
        counter.done += 1;
        counter.skipped += 1;
        counter.unreadable += 1;
        errors.push({ path: entry.rel, reason: describeError(err) });
      })
      .finally(() => {
        pending.delete(job);
        report(false);
      });
    pending.add(job);
    if (pending.size >= SCAN_CONCURRENCY) await Promise.race(pending);
  }
  await Promise.all(pending);

  const groups = [];
  for (const bucket of keyed.values()) {
    if (bucket.entries.length < 2) continue;
    const paths = bucket.entries.map((e) => e.path).sort(comparePaths);
    const created = bucket.entries
      .map((e) => e.created)
      .sort()
      .reduce((min, value) => (value < min ? value : min));
    groups.push({ sha256: bucket.sha256, size: bucket.size, paths, created });
  }
  groups.sort((a, b) => comparePaths(a.paths[0], b.paths[0]));

  const truncated = groups.length > 500;
  const published = truncated ? groups.slice(0, 500) : groups;

  report(true);
  return {
    result: {
      groups: published,
      scanned: counter.scanned,
      skipped: counter.skipped,
      generatedAt: new Date().toISOString(),
      durationMs: elapsedMs(startedAt),
      startedAt,
      root: rootAbs,
      groupCount: groups.length,
      duplicateFileCount: groups.reduce((sum, g) => sum + g.paths.length, 0),
      truncated,
      skippedReasons: {
        oversize: counter.oversize,
        unreadable: counter.unreadable,
      },
      errors: errors.slice(0, 200),
    },
    groups,
  };
}

/**
 * Join a concurrent request onto the running scan instead of starting a second
 * one, then publish the result exactly once.
 */
function startScan() {
  if (activeScan) return activeScan;
  const progress = {
    state: 'running',
    startedAt: new Date().toISOString(),
    seen: 0,
    done: 0,
    scanned: 0,
    skipped: 0,
    oversize: 0,
    unreadable: 0,
    elapsedMs: 0,
    root: ROOT,
  };
  liveProgress = progress;

  const promise = runScan(ROOT, (update) => {
    Object.assign(progress, update);
    saveProgress({ ...progress, root: ROOT }).catch(() => {});
  })
    .then(async ({ result, groups }) => {
      activeScan = null;
      // Publish in one step: the in-memory result and the on-disk copy both
      // exist before any request can observe the new state.
      lastResult = result;
      liveProgress = { ...progress, state: 'idle', elapsedMs: result.durationMs };
      try {
        await saveResult(result);
      } catch (err) {
        process.stderr.write(
          `warning: scan finished but could not be persisted (${err.message})\n`,
        );
      }
      return { result, groups };
    })
    .catch((err) => {
      activeScan = null;
      liveProgress = { ...progress, state: 'idle', failed: true };
      throw err;
    });

  activeScan = promise;
  return promise;
}

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

/**
 * Resolve a user-supplied relative path and refuse anything outside ROOT.
 *
 * Returns null when the path is missing, absolute, contains a traversal
 * segment, or when resolving it (following symlinks/junctions) lands outside
 * the scan root. A path that stays under ROOT textually but escapes through a
 * reparse point is therefore rejected as well.
 */
function resolveInsideRoot(relative) {
  if (typeof relative !== 'string' || relative.trim() === '') return null;
  if (relative.length > 4096 || relative.includes('\0')) return null;
  const normalized = relative.replace(/\\/g, '/');
  const abs = path.resolve(ROOT, normalized);
  const rel = path.relative(ROOT, abs);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;

  // Canonicalise the root and the target (when it exists). If the target or
  // any of its parents is a link that leaves the root, this catches it.
  let realRoot = ROOT;
  let realTarget = null;
  try {
    realRoot = fs.realpathSync.native(ROOT);
  } catch {
    /* keep the configured root */
  }
  try {
    realTarget = fs.realpathSync.native(abs);
  } catch {
    realTarget = null; // missing target: the textual check above is enough
  }
  if (realTarget !== null) {
    const realRel = path.relative(realRoot, realTarget);
    if (realRel === '' || realRel.startsWith('..') || path.isAbsolute(realRel)) {
      return null;
    }
  }
  return { abs, rel: rel.split(path.sep).join('/') };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function comparePaths(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store, no-cache, must-revalidate',
  });
  res.end(payload);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function readBody(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('request body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function serveStatic(req, res, urlPath) {
  let key = urlPath;
  if (key === '/') key = '/';
  if (key.endsWith('/')) key = `${key}index.html`;
  const asset = PUBLIC_FILES[key];
  if (!asset) return sendError(res, 404, `no such resource: ${urlPath}`);
  try {
    const body = await fsp.readFile(path.join(PUBLIC_DIR, asset.file));
    res.writeHead(200, {
      'content-type': asset.type,
      'content-length': body.length,
      'cache-control': 'no-store, no-cache, must-revalidate',
    });
    res.end(body);
  } catch (err) {
    sendError(res, 500, `cannot read ${asset.file}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname);
  const method = req.method;

  if (method === 'GET' || method === 'HEAD') {
    if (PUBLIC_FILES[pathname] || pathname.endsWith('/')) {
      return serveStatic(req, res, pathname);
    }
  }

  if (method === 'GET' && pathname === '/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/scan') {
    if (method !== 'POST') return sendError(res, 405, 'use POST /api/scan');
    let body = '';
    try {
      body = await readBody(req);
    } catch (err) {
      return sendError(res, 413, err.message);
    }
    if (body.trim() !== '') {
      try {
        JSON.parse(body);
      } catch {
        return sendError(res, 400, 'request body must be empty JSON or valid JSON');
      }
    }
    try {
      const { result } = await startScan();
      return sendJson(res, 200, {
        groups: result.groups.map((g) => ({
          sha256: g.sha256,
          size: g.size,
          paths: g.paths,
        })),
        scanned: result.scanned,
        skipped: result.skipped,
      });
    } catch (err) {
      return sendError(res, 500, `scan failed: ${err.message}`);
    }
  }

  if (pathname === '/api/result') {
    if (method !== 'GET') return sendError(res, 405, 'use GET /api/result');
    if (!lastResult) {
      return sendError(res, 404, 'no completed scan result yet');
    }
    return sendJson(res, 200, {
      groups: lastResult.groups.map((g) => ({
        sha256: g.sha256,
        size: g.size,
        paths: g.paths,
        created: g.created,
      })),
      scanned: lastResult.scanned,
      skipped: lastResult.skipped,
      generatedAt: lastResult.generatedAt,
      durationMs: lastResult.durationMs,
      root: lastResult.root,
      groupCount: lastResult.groupCount,
      duplicateFileCount: lastResult.duplicateFileCount,
      truncated: lastResult.truncated,
      skippedReasons: lastResult.skippedReasons,
      errors: lastResult.errors,
    });
  }

  if (pathname === '/api/progress') {
    if (method !== 'GET') return sendError(res, 405, 'use GET /api/progress');
    const running = activeScan !== null;
    let progress = liveProgress;
    if (!progress) {
      // Fall back to the on-disk snapshot left by an earlier run, but never
      // report it as running: no scan is in flight after this process starts.
      try {
        const parsed = JSON.parse(await fsp.readFile(PROGRESS_FILE, 'utf8'));
        if (parsed && typeof parsed === 'object') progress = parsed;
      } catch {
        progress = null;
      }
    }
    const snapshot = { ...(progress || { scanned: 0, skipped: 0, done: 0, seen: 0 }), state: running ? 'running' : 'idle' };
    return sendJson(res, 200, { state: running ? 'running' : 'idle', progress: snapshot });
  }

  if (pathname === '/api/files') {
    if (method !== 'GET') return sendError(res, 405, 'use GET /api/files');
    const target = resolveInsideRoot(url.searchParams.get('path') || '');
    if (!target) {
      return sendError(res, 400, 'path must be a relative path inside the scan root');
    }
    try {
      const stats = await fsp.lstat(target.abs);
      if (stats.isSymbolicLink()) {
        return sendError(res, 400, 'symbolic links are not followed');
      }
      if (!stats.isFile()) {
        return sendError(res, 400, 'path is not a regular file');
      }
      if (stats.size > MAX_FILE_SIZE) {
        return sendError(
          res,
          413,
          `file size ${stats.size} exceeds the 8 MiB limit`,
        );
      }
      const data = await fsp.readFile(target.abs);
      return sendJson(res, 200, {
        path: target.rel.replace(/\\/g, '/'),
        size: data.length,
        mode: 'utf8-or-base64',
        encoding: isProbablyText(data) ? 'utf8' : 'base64',
        content: isProbablyText(data)
          ? data.toString('utf8')
          : data.toString('base64'),
      });
    } catch (err) {
      if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
        return sendError(res, 404, 'file not found inside the scan root');
      }
      if (err && (err.code === 'EACCES' || err.code === 'EPERM')) {
        return sendError(res, 403, 'permission denied while reading the file');
      }
      return sendError(res, 500, `cannot read file: ${err.message}`);
    }
  }

  if (pathname.startsWith('/api/')) {
    return sendError(res, 404, `no such endpoint: ${pathname}`);
  }

  if (method === 'GET' || method === 'HEAD') {
    return serveStatic(req, res, pathname);
  }
  return sendError(res, 404, `no such resource: ${pathname}`);
}

function isProbablyText(buffer) {
  if (buffer.includes(0)) return false;
  const probe = buffer.subarray(0, Math.min(buffer.length, 4096));
  let suspicious = 0;
  for (const byte of probe) {
    if (byte < 9 || (byte > 13 && byte < 32)) suspicious += 1;
  }
  return suspicious / Math.max(probe.length, 1) < 0.05;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main() {
  const rootStats = await fsp.stat(ROOT).catch(() => null);
  if (rootStats === null) {
    fail(`scan root does not exist: ${ROOT}`);
  }
  if (!rootStats.isDirectory()) {
    fail(`scan root is not a directory: ${ROOT}`);
  }

  await ensureDataDir();
  const restored = await loadPersistedResult();
  if (!restored) liveProgress = null;

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      if (!res.headersSent) sendError(res, 500, `internal error: ${err.message}`);
      else res.end();
    });
  });

  server.on('clientError', (err, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      fail(`port ${PORT} is already in use on ${HOST}`);
    }
    if (err.code === 'EACCES') {
      fail(`not allowed to listen on ${HOST}:${PORT}`);
    }
    fail(`server error: ${err.message}`);
  });

  server.listen(PORT, HOST, () => {
    process.stdout.write(
      [
        `duplicate file inspector listening on http://${HOST}:${PORT}`,
        `scan root : ${ROOT}`,
        `data dir  : ${DATA_DIR}`,
        restored ? 'restored previous scan result' : 'no previous scan result',
        '',
      ].join('\n'),
    );
  });
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
});
