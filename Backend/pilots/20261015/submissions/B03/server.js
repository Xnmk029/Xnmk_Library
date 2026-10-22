'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const LIMIT = 8 * 1024 * 1024;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const emptyResult = () => ({ groups: [], scanned: 0, skipped: 0 });

function options(argv) {
  const result = { port: 3000, data: path.resolve('.duplicate-inspector'), root: process.cwd() };
  const seen = new Set();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.slice(2);
    if (!['--port', '--data', '--root'].includes(argv[i]) || !argv[i + 1] || seen.has(key)) {
      throw new Error('用法：node server.js --port <端口> --data <数据目录> --root <扫描根目录>');
    }
    seen.add(key);
    result[key] = argv[i + 1];
  }
  if (!/^\d+$/.test(String(result.port)) || +result.port < 1 || +result.port > 65535) throw new Error('端口必须在 1–65535 之间');
  result.port = +result.port;
  result.root = path.resolve(result.root);
  result.data = path.resolve(result.data);
  return result;
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}

async function main() {
  const config = options(process.argv.slice(2));
  // Reject links in the configured root's ancestry, including Windows junctions.
  let ancestor = config.root;
  for (;;) {
    const stat = await fs.lstat(ancestor);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('扫描根目录及其父目录必须是实际目录，不能是符号链接或 junction');
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  const root = await fs.realpath(config.root);
  await fs.mkdir(config.data, { recursive: true });
  const data = await fs.realpath(config.data);
  const resultFile = path.join(data, 'result.json');
  let result = emptyResult();
  try {
    result = JSON.parse(await fs.readFile(resultFile, 'utf8'));
    if (!validResult(result)) throw new Error('结果结构无效');
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('无法恢复上次结果：' + error.message);
  }
  let running = null;
  let status = { running: false, phase: 'idle', scanned: 0, skipped: 0, total: 0, error: null };
  const page = await fs.readFile(path.join(__dirname, 'index.html'));

  async function checkedPath(relative) {
    const target = path.resolve(root, relative);
    if (!inside(root, target)) throw new Error('路径超出扫描根目录');
    let current = root;
    const segments = path.relative(root, target).split(path.sep).filter(Boolean);
    // Check root again on every use: it may have been replaced since startup.
    const base = await fs.lstat(root);
    if (base.isSymbolicLink() || !base.isDirectory()) throw new Error('根目录发生变化');
    for (let i = 0; i < segments.length; i++) {
      current = path.join(current, segments[i]);
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error('不跟随符号链接或 junction');
      if (i < segments.length - 1 && !stat.isDirectory()) throw new Error('父目录发生变化');
    }
    const resolved = await fs.realpath(target);
    if (!inside(root, resolved)) throw new Error('路径超出扫描根目录');
    return target;
  }

  async function readRegular(relative) {
    const target = await checkedPath(relative);
    const before = await fs.lstat(target);
    if (!before.isFile() || before.size > LIMIT) throw new Error('不是普通文件或文件超过 8 MiB');
    const handle = await fs.open(target, constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0));
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.size > LIMIT || opened.ino !== before.ino || opened.dev !== before.dev) throw new Error('文件发生变化');
      await checkedPath(relative);
      // Read at most LIMIT + 1 even if a file grows while it is open.
      const buffer = Buffer.alloc(LIMIT + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      const after = await handle.stat();
      if (length > LIMIT || after.size !== length || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) throw new Error('文件超限或读取期间发生变化');
      return buffer.subarray(0, length);
    } finally {
      await handle.close();
    }
  }

  async function scan() {
    status = { running: true, phase: 'discovering', scanned: 0, skipped: 0, total: 0, error: null };
    let scratch;
    let temporaryResult;
    try {
      const files = [];
      const directories = [''];
      while (directories.length) {
        const relative = directories.pop();
        const directory = await checkedPath(relative);
        // An unreadable directory aborts the scan, rather than publishing an incomplete inventory.
        const entries = await fs.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isSymbolicLink()) continue;
          const child = path.join(relative, entry.name);
          if (entry.isDirectory()) directories.push(child);
          else if (entry.isFile()) files.push(child);
        }
        status.total = files.length;
      }
      files.sort(compare);
      status.phase = 'reading';
      // Enumerate first, so this run's temporary snapshots never enter its inventory.
      // Disk snapshots bound memory and allow byte-for-byte verification even if source files change later.
      scratch = await fs.mkdtemp(path.join(data, '.scan-'));
      const hashes = new Map();
      let nextSnapshot = 0;
      for (const relative of files) {
        let bytes;
        try {
          bytes = await readRegular(relative);
        } catch {
          status.skipped++;
          continue;
        }
        status.scanned++;
        const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
        const key = `${bytes.length}:${sha256}`;
        const bucket = hashes.get(key) || [];
        let match;
        for (const candidate of bucket) {
          if (bytes.equals(await fs.readFile(candidate.snapshot))) {
            match = candidate;
            break;
          }
        }
        const displayPath = relative.split(path.sep).join('/');
        if (match) match.paths.push(displayPath);
        else {
          const snapshot = path.join(scratch, String(nextSnapshot++));
          await fs.writeFile(snapshot, bytes, { flag: 'wx', mode: 0o600 });
          bucket.push({ sha256, size: bytes.length, paths: [displayPath], snapshot });
          hashes.set(key, bucket);
        }
      }
      const groups = [...hashes.values()].flat().filter(group => group.paths.length >= 2)
        .map(({ sha256, size, paths }) => ({ sha256, size, paths: paths.sort(compare) }))
        .sort((a, b) => compare(a.paths[0], b.paths[0]));
      const complete = { groups, scanned: status.scanned, skipped: status.skipped };
      status.phase = 'saving';
      temporaryResult = path.join(data, `.result-${crypto.randomUUID()}.tmp`);
      const output = await fs.open(temporaryResult, 'wx', 0o600);
      try {
        await output.writeFile(JSON.stringify(complete, null, 2) + '\n');
        await output.sync();
      } finally {
        await output.close();
      }
      await fs.rename(temporaryResult, resultFile);
      temporaryResult = undefined;
      result = complete;
      status.phase = 'complete';
      return complete;
    } catch (error) {
      status.phase = 'failed';
      status.error = error.message;
      throw error;
    } finally {
      if (scratch) await fs.rm(scratch, { recursive: true, force: true }).catch(error => console.error('临时快照清理失败：', error.message));
      if (temporaryResult) await fs.unlink(temporaryResult).catch(() => {});
      status.running = false;
    }
  }

  const server = http.createServer(async (request, response) => {
    const json = (code, body) => {
      response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(JSON.stringify(body));
    };
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/health') return json(200, { ok: true });
      if (request.method === 'GET' && url.pathname === '/') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'" });
        return response.end(page);
      }
      if (request.method === 'GET' && url.pathname === '/api/result') return json(200, result);
      if (request.method === 'GET' && url.pathname === '/api/status') return json(200, { ...status, root, limit: LIMIT });
      if (request.method === 'POST' && url.pathname === '/api/scan') {
        const origin = request.headers.origin;
        if (origin && origin !== `http://127.0.0.1:${config.port}` && origin !== `http://localhost:${config.port}`) return json(403, { error: '不接受跨站扫描请求' });
        if (url.search) return json(400, { error: '扫描根目录只能由服务启动参数 --root 指定' });
        request.resume();
        if (!running) running = scan().finally(() => { running = null; });
        return json(200, await running);
      }
      if (['/', '/health', '/api/result', '/api/status', '/api/scan'].includes(url.pathname)) return json(405, { error: '不支持的请求方法' });
      return json(404, { error: '接口不存在' });
    } catch (error) {
      return json(500, { error: error.message || '扫描失败' });
    }
  });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(config.port, '127.0.0.1', () => {
    console.log(`重复文件检测器：http://127.0.0.1:${config.port}\n扫描根目录：${root}\n数据目录：${data}`);
  });
}

function validResult(value) {
  return value && Number.isSafeInteger(value.scanned) && value.scanned >= 0 && Number.isSafeInteger(value.skipped) && value.skipped >= 0 && Array.isArray(value.groups) && value.groups.every(group =>
    /^[a-f0-9]{64}$/.test(group.sha256) && Number.isSafeInteger(group.size) && group.size >= 0 && group.size <= LIMIT && Array.isArray(group.paths) && group.paths.length >= 2 && group.paths.every(p => typeof p === 'string' && p && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
