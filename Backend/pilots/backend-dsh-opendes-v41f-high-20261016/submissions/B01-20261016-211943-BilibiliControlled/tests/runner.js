'use strict';
/*
 * 离线回放验证器：
 *  - 本地 HTTP 服务按契约提供页面、被测脚本、以及页面自身的 GET /x/v2/reply/main 夹具；
 *  - 用真实 Chromium（无头）加载页面，通过 CDP 读取断言结果；
 *  - 在 720px / 1280px 宽度下执行布局、可点击性与遮挡检查。
 * 该文件仅用于验证，不属于交付物。
 */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(ROOT, 'answer.user.js');
const PAGE_PATH = path.join(__dirname, 'replay.html');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const FETCH_FIXTURE = {
  code: 0,
  data: {
    replies: [{
      rpid_str: '9007199254741015', rpid: 9007199254741015,
      reply_control: { location: 'IP属地：海南' },
      member: { mid: '10001', uname: '测试用户', location: '资料城市：北京' },
      content: { message: '我来自上海' },
      replies: [{
        rpid_str: '9007199254741016', rpid: 9007199254741016,
        root_str: '9007199254741015', parent_str: '9007199254741015',
        reply_control: { location: 'IP属地：贵州' },
        member: { mid: '10001', uname: '测试用户', location: '资料城市：北京' },
        content: { message: '楼中楼' }
      }]
    }]
  }
};

function startServer() {
  const server = http.createServer((req, res) => {
    let pathname = '/';
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch (e) { /* ignore */ }
    if (pathname === '/answer.user.js') {
      const body = fs.readFileSync(SCRIPT_PATH);
      res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(body);
      return;
    }
    if (pathname === '/x/v2/reply/main') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(FETCH_FIXTURE));
      return;
    }
    if (pathname === '/x/v2/reply/fail') {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: -412, message: '请求被拦截' }));
      return;
    }
    const html = fs.readFileSync(PAGE_PATH);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* 极简 CDP 客户端（Node 内置 WebSocket，仅本验证器使用）
 * 通过浏览器级端点 + Target.attachToTarget(flatten) 建立会话，兼容只想定页面目标的情况。 */
class CDP {
  constructor(url) {
    this.url = url;
    this.id = 0;
    this.pending = new Map();
    this.ws = null;
    this.sessionId = null;
    this.listeners = [];
  }
  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.addEventListener('open', () => resolve());
      ws.addEventListener('error', () => reject(new Error('调试 WebSocket 连接失败')));
      ws.addEventListener('message', (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch (e) { return; }
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const { resolve: res, reject: rej } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) rej(new Error(JSON.stringify(msg.error)));
          else res(msg.result);
          return;
        }
        if (msg.method) this.listeners.forEach((fn) => fn(msg));
      });
    });
  }
  onEvent(fn) { this.listeners.push(fn); }
  send(method, params, useSession) {
    const id = ++this.id;
    const payload = { id, method, params: params || {} };
    if (useSession !== false && this.sessionId) payload.sessionId = this.sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('CDP timeout: ' + method));
        }
      }, 30000);
    });
  }
  close() { try { this.ws.close(); } catch (e) { /* ignore */ } }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) {
    throw new Error('page exception: ' + JSON.stringify(result.exceptionDetails.exception || result.exceptionDetails.text));
  }
  return result.result.value;
}

async function main() {
  const { server, port } = await startServer();
  const pageUrl = 'http://127.0.0.1:' + port + '/video/BV1xx411c7mD';
  const debugPort = 9200 + Math.floor(Math.random() * 300);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-replay-'));

  const chrome = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--window-size=1280,900',
    '--remote-debugging-port=' + debugPort,
    '--user-data-dir=' + userDataDir,
    'about:blank'
  ], { stdio: 'ignore' });

  let cdp = null;
  const cleanup = () => {
    if (cdp) cdp.close();
    try { chrome.kill(); } catch (e) { /* ignore */ }
    server.close();
  };

  try {
    let version = null;
    for (let i = 0; i < 100; i++) {
      try {
        version = await getJSON('http://127.0.0.1:' + debugPort + '/json/version');
        break;
      } catch (e) { await sleep(150); }
    }
    if (!version) throw new Error('Chromium 调试端口未就绪');

    let target = null;
    for (let i = 0; i < 60; i++) {
      const list = await getJSON('http://127.0.0.1:' + debugPort + '/json/list');
      target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (target) break;
      await sleep(150);
    }
    if (!target) throw new Error('未找到可用页面目标');

    /* 用浏览器级端点连一个 WebSocket，再 attach 到页面目标（单连接即可，避免多连接无响应） */
    cdp = new CDP(version.webSocketDebuggerUrl);
    await cdp.connect();
    const attached = await cdp.send('Target.attachToTarget', {
      targetId: target.id, flatten: true
    }, false);
    cdp.sessionId = attached.sessionId;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    const consoleErrors = [];
    cdp.onEvent((msg) => {
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params && msg.params.exceptionDetails;
        consoleErrors.push('exception: ' + ((d && d.exception && d.exception.description) || (d && d.text)));
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push('console.error: ' + msg.params.args.map((a) => a.value || a.description || '').join(' '));
      }
    });

    await cdp.send('Page.navigate', { url: pageUrl });

    let result = null;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      try {
        result = await evaluate(cdp, 'window.__RESULT__ || null');
      } catch (e) { result = null; }
      if (result) break;
      await sleep(250);
    }
    if (!result) throw new Error('页面未在时限内给出结果（可能脚本抛错阻塞）');

    const layoutReports = [];
    for (const width of [720, 1280]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width, height: 900, deviceScaleFactor: 1, mobile: false
      });
      await sleep(600);
      const problems = await evaluate(cdp, 'window.__layoutCheck()');
      const info = await evaluate(cdp, '({w: window.innerWidth, tags: document.querySelectorAll(".bili-ip-region-tag").length})');
      layoutReports.push({ width, problems, info });
    }

    const report = {
      summary: { pass: result.pass, fail: result.fail },
      failures: result.failures,
      errors: result.errors,
      consoleErrors,
      tagCount: result.tags,
      containers: result.containers,
      layout: layoutReports
    };
    console.log(JSON.stringify(report, null, 2));

    const layoutProblems = layoutReports.reduce((acc, r) => acc.concat(
      r.problems.map((p) => '[' + r.width + 'px] ' + p)), []);
    const ok = result.fail === 0 && result.errors.length === 0 && consoleErrors.length === 0 &&
      layoutProblems.length === 0;
    console.log('\n==== ' + (ok ? 'ALL CHECKS PASSED' : 'FAILURES PRESENT') + ' ====');
    if (layoutProblems.length) console.log('layout problems:\n' + layoutProblems.join('\n'));
    cleanup();
    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.error('验证器错误: ' + (err && err.stack || err));
    cleanup();
    process.exit(2);
  }
}

main();
