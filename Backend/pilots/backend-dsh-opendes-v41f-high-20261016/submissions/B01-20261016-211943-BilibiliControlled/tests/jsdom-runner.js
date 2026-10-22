'use strict';
/*
 * 离线回放验证器（jsdom 版）：
 *  - 用 jsdom 以契约给出的三种形态回放页面（Lit/Open Shadow DOM、Vue 3、bbComment）；
 *  - 在 document-start 注入被测脚本，模拟异步加载、重复渲染、DOM 复用、SPA 路由切换；
 *  - 通过 CDP 无法使用时（本沙箱限制命名管道/调试命令通道）改用本方案保证可重复验证；
 *  - 布局部分做结构性校验（标签归属、数量、可见性、截断样式、控件保留），
 *    真实像素级检查另由 tests/runner.js（真实 Chromium）在允许的环境下执行。
 * 该文件仅用于验证，不属于交付物。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { JSDOM, VirtualConsole } = require(path.join(__dirname, 'harness', 'node_modules', 'jsdom'));

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = fs.readFileSync(path.join(ROOT, 'answer.user.js'), 'utf8');
const PAGE = fs.readFileSync(path.join(__dirname, 'replay.html'), 'utf8');

const FETCH_FIXTURE = {
  code: 0,
  data: {
    replies: [{
      rpid_str: '9007199254741015', rpid: 9007199254741015,
      reply_control: { location: 'IP属地：海南' },
      member: { mid: '10001', uname: '测试用户', location: '资料城市：北京' },
      content: { message: '我来自上海' }
    }]
  }
};

function startServer() {
  const server = http.createServer((req, res) => {
    const pathname = (() => { try { return new URL(req.url, 'http://localhost').pathname; } catch (e) { return '/'; } })();
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
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(PAGE);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/* 静态布局校验：jsdom 无排版引擎，因此校验结构与样式属性 */
function layoutProblems(dom) {
  const doc = dom.window.document;
  const problems = [];
  const containers = dom.window.__containers || [];

  const tagsOf = (container) => Array.prototype.slice.call(container.querySelectorAll('.bili-ip-region-tag'));

  containers.forEach((entry, index) => {
    const container = entry.c;
    if (!container || !container.isConnected) {
      problems.push(entry.kind + '#' + index + ': container detached');
      return;
    }
    const tags = tagsOf(container);
    if (tags.length !== 1) {
      problems.push(entry.kind + '#' + index + ': tag count=' + tags.length);
      return;
    }
    const tag = tags[0];
    const label = entry.kind + '#' + index;
    if (tag.parentNode !== container) problems.push(label + ': tag not in time bar');
    const time = container.querySelector('.reply-time,.sub-reply-time,#pubdate');
    if (!time) problems.push(label + ': no time element');
    else if (time.parentNode !== container) problems.push(label + ': time bar mismatch');
    else if (time.nextSibling !== tag) problems.push(label + ': tag not adjacent to time');
    const style = (tag.getAttribute('style') || '').replace(/\s+/g, '');
    ['overflow:hidden', 'text-overflow:ellipsis', 'white-space:nowrap', 'max-width:']
      .forEach((needle) => {
        if (style.indexOf(needle) < 0) problems.push(label + ': missing style ' + needle);
      });
    if (style.indexOf('display:inline-block') < 0) problems.push(label + ': not inline-block');

    const buttons = Array.prototype.slice.call(
      container.querySelectorAll('button,.btn-reply,.btn-more'));
    if (buttons.length < 2) problems.push(label + ': controls missing (' + buttons.length + ')');
    buttons.forEach((btn, bi) => {
      if (btn.classList.contains('bili-ip-region-tag')) problems.push(label + ': tag is a button');
      const btnStyle = btn.getAttribute('style') || '';
      if (/display\s*:\s*none/.test(btnStyle)) problems.push(label + ': control ' + bi + ' hidden');
    });

    /* 标签不得吞掉时间文本 */
    if (!container.textContent.trim()) problems.push(label + ': empty bar');
    /* 原生属地标签与脚本标签不能同时出现 */
    const native = container.querySelectorAll('#location');
    if (native.length && tags.length) problems.push(label + ': native + script tag duplicate');
  });

  (dom.window.__nativeContainers || []).forEach((container, index) => {
    const label = 'lit-native#' + index;
    const tags = tagsOf(container);
    if (tags.length !== 0) problems.push(label + ': script tag added beside native tag');
    const native = container.querySelectorAll('#location');
    if (native.length !== 1) problems.push(label + ': native tag count=' + native.length);
    else if (native[0].textContent.trim() !== 'IP属地：北京') {
      problems.push(label + ': native tag text altered -> ' + native[0].textContent.trim());
    }
  });

  return problems;
}

async function main() {
  const { server, port } = await startServer();
  const virtualConsole = new VirtualConsole();
  const pageErrors = [];
  virtualConsole.on('jsdomError', (e) => pageErrors.push('jsdomError: ' + (e && e.message)));
  virtualConsole.on('error', (...args) => pageErrors.push('console.error: ' + args.join(' ')));

  const dom = new JSDOM(PAGE, {
    url: 'http://127.0.0.1:' + port + '/video/BV1xx411c7mD',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole
  });

  /* 以 jsdom 作为 DOM 实现，注入被测脚本；fetch 桥接到本地服务，走真实 Response 语义 */
  const realFetch = globalThis.fetch;
  const pageOrigin = 'http://127.0.0.1:' + port;
  dom.window.fetch = (input, init) => {
    const raw = typeof input === 'string' ? input : (input && input.url) || '';
    const url = raw.startsWith('http') ? raw : pageOrigin + (raw.startsWith('/') ? raw : '/' + raw);
    return realFetch(url, init);
  };
  dom.window.eval(SCRIPT);

  let result = null;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    result = await new Promise((r) => setTimeout(() => r(dom.window.__RESULT__ || null), 200));
    if (result) break;
  }
  if (!result) {
    console.error('回放未产生结果；页面错误：\n' + pageErrors.join('\n'));
    console.error('title=', dom.window.document.title);
    server.close();
    process.exit(2);
  }

  const layout = layoutProblems(dom);
  const report = {
    summary: { pass: result.pass, fail: result.fail },
    failures: result.failures,
    errors: result.errors,
    pageErrors,
    layoutProblems: layout,
    tagCount: result.tags,
    containers: result.containers
  };
  console.log(JSON.stringify(report, null, 2));

  const ok = result.fail === 0 && result.errors.length === 0 && pageErrors.length === 0 &&
    layout.length === 0;
  console.log('\n==== ' + (ok ? 'ALL CHECKS PASSED' : 'FAILURES PRESENT') + ' ====');
  server.close();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('验证器异常:', e && e.stack || e);
  process.exit(2);
});
