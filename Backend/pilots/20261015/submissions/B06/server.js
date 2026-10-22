'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

function options(argv) {
  const config = { port: 3000, data: './data', upstream: 'http://127.0.0.1:9000',
    limit: 3, 'window-ms': 1000, 'timeout-ms': 150, 'failure-threshold': 2, 'open-ms': 500 };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].slice(2);
    if (!argv[i].startsWith('--') || !Object.hasOwn(config, key) || !argv[i + 1]) {
      throw new Error(`无效参数：${argv[i]}`);
    }
    config[key] = argv[i + 1];
  }
  for (const key of ['port', 'limit', 'window-ms', 'timeout-ms', 'failure-threshold', 'open-ms']) {
    if (!/^\d+$/.test(String(config[key]))) throw new Error(`${key} 必须是正整数`);
    config[key] = Number(config[key]);
    if (!Number.isSafeInteger(config[key]) || config[key] < 1 ||
        config[key] > (key === 'port' ? 65535 : 2147483647)) throw new Error(`${key} 超出有效范围`);
  }
  const upstream = new URL(config.upstream);
  if (upstream.protocol !== 'http:' || upstream.username || upstream.password ||
      upstream.pathname !== '/' || upstream.search || upstream.hash ||
      !(upstream.hostname === 'localhost' || upstream.hostname === '[::1]' || /^127\./.test(upstream.hostname))) {
    throw new Error('upstream 必须是本机 HTTP 地址（localhost、127.x.x.x 或 [::1]），不含路径、凭据、查询或片段');
  }
  return { ...config, upstream };
}

function createGateway(config, assets) {
  const stats = { state: 'CLOSED', requests: 0, upstreamCalls: 0, rateRejected: 0, circuitRejected: 0 };
  let windowStart = null;
  let windowUsed = 0;
  let failures = 0;
  let openedAt = 0;
  let probeInFlight = false;
  let generation = 0;

  function refresh(now) {
    if (stats.state === 'OPEN' && now - openedAt >= config['open-ms']) stats.state = 'HALF_OPEN';
  }
  function open() {
    stats.state = 'OPEN';
    openedAt = performance.now();
    probeInFlight = false;
    generation++;
  }
  function recordResult(ticket, failed, status) {
    // Results from requests admitted before an OPEN transition cannot override it.
    if (ticket.generation !== generation) return;
    if (ticket.probe) {
      probeInFlight = false;
      if (failed) open();
      else {
        stats.state = 'CLOSED';
        failures = 0;
        generation++;
      }
    } else if (stats.state === 'CLOSED') {
      if (failed) {
        if (++failures >= config['failure-threshold']) open();
      } else if (status >= 200 && status < 400) failures = 0;
    }
  }
  function json(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  }
  function relay(req, res, url) {
    stats.requests++;
    const now = performance.now();
    if (windowStart === null) windowStart = now;
    if (now - windowStart >= config['window-ms']) {
      windowStart += Math.floor((now - windowStart) / config['window-ms']) * config['window-ms'];
      windowUsed = 0;
    }
    if (windowUsed >= config.limit) {
      stats.rateRejected++;
      return json(res, 429, { error: '固定窗口请求限额已用尽' });
    }
    windowUsed++;
    refresh(now);
    if (stats.state === 'OPEN' || (stats.state === 'HALF_OPEN' && probeInFlight)) {
      stats.circuitRejected++;
      return json(res, 503, { error: '熔断器拒绝请求，请稍后重试' });
    }

    let target;
    try {
      const values = url.searchParams.getAll('path');
      const value = values[0];
      if (values.length !== 1 || !value.startsWith('/') || value.startsWith('//') ||
          /[\\\u0000-\u0020\u007f#]/.test(value)) throw new Error('invalid path');
      // Check encoded authority separators too, without interpreting the query as a host.
      const decodedPath = decodeURIComponent(value.split('?')[0]);
      if (decodedPath.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decodedPath)) throw new Error('invalid path');
      target = new URL(value, config.upstream);
      if (target.origin !== config.upstream.origin) throw new Error('invalid origin');
    } catch {
      return json(res, 400, { error: 'path 必须是以 / 开头的路径，不能包含主机、反斜杠、控制字符或片段' });
    }

    const ticket = { generation, probe: stats.state === 'HALF_OPEN' };
    if (ticket.probe) probeInFlight = true;
    let completed = false;
    let outbound;
    let timer;
    function finish(status, body, headers, failed) {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      recordResult(ticket, failed, status);
      if (res.destroyed) return;
      res.writeHead(status, { ...headers, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      res.end(body);
    }
    function fail(status, reason) {
      finish(status, JSON.stringify({ error: reason }), { 'content-type': 'application/json; charset=utf-8' }, true);
      outbound?.destroy();
    }
    try {
      outbound = http.request({
        hostname: config.upstream.hostname.replace(/^\[|\]$/g, ''),
        port: config.upstream.port || 80,
        method: 'GET',
        path: target.pathname + target.search,
        agent: false,
      }, incoming => {
        const chunks = [];
        incoming.on('data', chunk => chunks.push(chunk));
        incoming.on('aborted', () => fail(502, '上游连接中断'));
        incoming.on('error', () => fail(502, '上游响应读取失败'));
        incoming.on('end', () => {
          const headers = {};
          for (const name of ['content-type', 'content-encoding', 'content-language']) {
            if (incoming.headers[name]) headers[name] = incoming.headers[name];
          }
          // Isolate upstream HTML if /relay is opened directly in a browser.
          headers['content-security-policy'] = "sandbox; default-src 'none'";
          finish(incoming.statusCode, Buffer.concat(chunks), headers, incoming.statusCode >= 500);
        });
      });
      outbound.on('error', () => fail(502, '无法连接上游'));
      outbound.on('upgrade', (_response, socket) => { socket.destroy(); fail(502, '不支持上游协议升级'); });
      timer = setTimeout(() => fail(504, '上游请求超时'), config['timeout-ms']);
      outbound.end();
      stats.upstreamCalls++;
    } catch {
      fail(502, '无法发起上游请求');
    }
  }

  return http.createServer((req, res) => {
    let url;
    try { url = new URL(req.url, 'http://127.0.0.1'); }
    catch { return json(res, 400, { error: '请求地址无效' }); }
    if (req.method !== 'GET') {
      res.setHeader('allow', 'GET');
      return json(res, 405, { error: '仅支持 GET 请求' });
    }
    if (url.pathname === '/relay') return relay(req, res, url);
    if (url.pathname === '/health') return json(res, 200, { ok: true });
    if (url.pathname === '/api/stats') {
      refresh(performance.now());
      return json(res, 200, stats);
    }
    const asset = assets[url.pathname];
    if (asset) {
      res.writeHead(200, { 'content-type': asset.type, 'cache-control': 'no-store',
        'content-security-policy': "default-src 'self'; base-uri 'none'; frame-ancestors 'none'",
        'x-content-type-options': 'nosniff' });
      return res.end(asset.body);
    }
    json(res, 404, { error: '接口不存在' });
  });
}

async function main() {
  const config = options(process.argv.slice(2));
  await fs.mkdir(path.resolve(config.data), { recursive: true });
  const assets = {};
  for (const [route, filename, type] of [
    ['/', 'index.html', 'text/html; charset=utf-8'],
    ['/app.js', 'app.js', 'text/javascript; charset=utf-8'],
    ['/style.css', 'style.css', 'text/css; charset=utf-8'],
  ]) assets[route] = { body: await fs.readFile(path.join(__dirname, filename)), type };
  const server = createGateway(config, assets);
  server.on('error', error => { console.error(`启动失败：${error.message}`); process.exitCode = 1; });
  server.listen(config.port, '127.0.0.1', () => {
    console.log(`工作台：http://127.0.0.1:${config.port} | 上游：${config.upstream.origin} | 数据目录：${path.resolve(config.data)}`);
  });
}

if (require.main === module) main().catch(error => { console.error(`启动失败：${error.message}`); process.exitCode = 1; });
module.exports = { options, createGateway };
