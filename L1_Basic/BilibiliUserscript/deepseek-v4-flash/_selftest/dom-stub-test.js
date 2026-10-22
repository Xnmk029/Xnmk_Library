/*
 * 自写轻量 DOM 桩 + 断言测试（零第三方依赖，纯 Node 前台进程运行）
 * 目的：对 answer.user.js 做可执行的自测——元数据、属性/内嵌状态/接口三条数据路径、
 *       路由切换后新节点生效、节点复用原地更新、重复扫描不重复插入、
 *       字段缺失灰色占位、接口失败灰色备注、空页面静默。
 *
 * 运行：node _selftest/dom-stub-test.js   （在 ws-userscript 目录下）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = fs.readFileSync(path.join(ROOT, 'answer.user.js'), 'utf8');

/* ---------------- 断言工具 ---------------- */
let failures = 0;
let checks = 0;
function check(name, cond, detail) {
  checks++;
  if (cond) {
    console.log('  [PASS] ' + name);
  } else {
    failures++;
    console.log('  [FAIL] ' + name + (detail ? '  -> ' + detail : ''));
  }
}

/* ---------------- 迷你 DOM 桩 ---------------- */
function makeEl(tag, attrs, children, text) {
  const el = {
    nodeType: 1,
    tagName: String(tag).toUpperCase(),
    parentNode: null,
    children: [],
    attrs: {},
    _text: text !== undefined ? String(text) : '',
    _className: '',
    __seDone: false,
    __seNative: false,
    __seUnknown: false,
    __seBadge: null,
    __seNoteDone: false
  };
  el.setAttribute = function (n, v) { this.attrs[n] = String(v); };
  if (attrs) for (const k of Object.keys(attrs)) el.setAttribute(k, attrs[k]);
  el.getAttribute = function (n) { return Object.prototype.hasOwnProperty.call(this.attrs, n) ? this.attrs[n] : null; };
  el.hasAttribute = function (n) { return Object.prototype.hasOwnProperty.call(this.attrs, n); };
  el.appendChild = function (c) { c.parentNode = this; this.children.push(c); return c; };
  el.closest = function (sel) { return closest(this, sel); };
  el.querySelectorAll = function (sel) { return queryAll(this, sel, false); };
  el.querySelector = function (sel) { return queryAll(this, sel, false)[0] || null; };
  el.isConnected = function () {
    let c = this;
    while (c) { if (c === document.documentElement) return true; c = c.parentNode; }
    return false;
  };
  Object.defineProperty(el, 'className', {
    get() { return this.getAttribute('class') || ''; },
    set(v) { this.attrs['class'] = String(v); }
  });
  Object.defineProperty(el, 'textContent', {
    get() {
      if (this._text !== '') return this._text;
      let s = '';
      for (const c of this.children) s += c.textContent;
      return s;
    },
    set(v) { this._text = String(v); }
  });
  Object.defineProperty(el, 'innerText', {
    get() { return this.textContent; }
  });
  if (children) for (const c of children) el.appendChild(c);
  return el;
}

/* 迷你选择器：仅支持逗号列表 + 单级简单选择器（本项目脚本用到的全部形态） */
function matches(el, part) {
  if (!el || el.nodeType !== 1) return false;
  part = part.trim();
  if (part[0] === '.') {
    const cls = part.slice(1);
    const klass = el.getAttribute('class') || '';
    return (' ' + klass + ' ').indexOf(' ' + cls + ' ') !== -1;
  }
  if (part[0] === '#') return el.getAttribute('id') === part.slice(1);
  if (part[0] === '[') {
    const inner = part.slice(1, -1);
    const star = inner.indexOf('*=');
    if (star !== -1) {
      const nm = inner.slice(0, star).trim();
      const vv = inner.slice(star + 2).trim();
      const av = el.getAttribute(nm);
      return av !== null && av.indexOf(vv.slice(1, -1)) !== -1;
    }
    const eq = inner.indexOf('=');
    if (eq === -1) return el.hasAttribute(inner.trim());
    const name = inner.slice(0, eq).trim();
    const val = inner.slice(eq + 1).trim();
    const rawVal = val[0] === '"' || val[0] === "'" ? val.slice(1, -1) : val;
    return el.getAttribute(name) === rawVal;
  }
  if (part[0] === '*') return true;
  return String(el.tagName).toLowerCase() === part.toLowerCase();
}

function closest(el, sel) {
  const parts = sel.split(',').map((s) => s.trim()).filter(Boolean);
  let cur = el;
  while (cur && cur.nodeType === 1) {
    for (const p of parts) if (matches(cur, p)) return cur;
    cur = cur.parentNode;
  }
  return null;
}

function queryAll(root, sel, includeRoot) {
  const parts = sel.split(',').map((s) => s.trim()).filter(Boolean);
  const out = [];
  (function rec(node, isRoot) {
    if (node.nodeType !== 1) return;
    if ((isRoot ? includeRoot : true) && parts.some((p) => matches(node, p))) out.push(node);
    for (const c of node.children) rec(c, false);
  })(root, true);
  return out;
}

/* 沙箱全局 */
function makeDocument() {
  const doc = {
    body: null,
    head: null,
    documentElement: null,
    createElement(tag) { const e = makeEl(tag); return e; },
    querySelectorAll(sel) { return queryAll(doc.documentElement, sel, false); },
    querySelector(sel) { return queryAll(doc.documentElement, sel, false)[0] || null; },
    addEventListener() {}
  };
  const html = makeEl('html');
  const head = makeEl('head');
  const body = makeEl('body');
  html.appendChild(head);
  html.appendChild(body);
  doc.documentElement = html;
  doc.head = head;
  doc.body = body;
  return doc;
}

function makeSandbox(opts) {
  const document = opts.document || makeDocument();
  const timerQueue = [];
  let timerId = 0;
  const windowObj = {
    __INITIAL_STATE__: opts.initState !== undefined ? opts.initState : null,
    wrappedJSObject: null,
    addEventListener() {}
  };
  const locationObj = {
    pathname: opts.pathname || '/video/BV1mK4y1P7ju',
    search: '',
    hash: ''
  };
  const observers = [];
  function FakeMutationObserver(cb) { this.cb = cb; this.observe = function (t, cfg) { this.target = t; this.cfg = cfg; }; this.disconnect = function () { this.cb = null; }; observers.push(this); }
  const sandbox = {
    window: windowObj,
    document: document,
    location: locationObj,
    MutationObserver: FakeMutationObserver,
    setTimeout(fn) { timerQueue.push({ fn, id: ++timerId }); return timerId; },
    clearTimeout() {},
    console,
    JSON
  };
  if (opts.apiMode === 'ok') {
    sandbox.GM_xmlhttpRequest = function (o) {
      windowObj.__lastApiUrl = o.url;
      o.onload({ status: 200, responseText: JSON.stringify(opts.apiPayload) });
    };
  } else if (opts.apiMode === 'fail') {
    sandbox.GM_xmlhttpRequest = function (o) {
      windowObj.__lastApiUrl = o.url;
      o.onerror(new Error('network fail'));
    };
  }
  sandbox.__flushTimers = function () { const q = timerQueue.splice(0); q.forEach((t) => t.fn()); };
  sandbox.__triggerObserver = function () { observers.forEach((o) => { if (o.cb) o.cb([{ type: 'childList' }], o); }); };
  return sandbox;
}

function loadScript(sandbox) {
  vm.runInNewContext(SCRIPT, sandbox, { filename: 'answer.user.js' });
}

/* ---------------- 场景构建工具 ---------------- */
function withCommentArea(doc, items) {
  const area = makeEl('div', { id: 'comment' });
  doc.body.appendChild(area);
  for (const it of items) area.appendChild(it);
  return area;
}
function commentItem(rpid, userInfoKids, itemCls, extraAttrs) {
  const attrs = Object.assign({ class: itemCls || 'reply-item' }, extraAttrs || {});
  if (rpid !== undefined) attrs['data-rpid'] = String(rpid);
  return makeEl('div', attrs, [makeEl('span', { class: 'user-info' }, userInfoKids)]);
}

/* ---------------- 测试 1：元数据块 ---------------- */
console.log('\n=== 测试1：元数据块 ===');
{
  const meta = SCRIPT.slice(SCRIPT.indexOf('// ==UserScript=='), SCRIPT.indexOf('// ==/UserScript=='));
  check('包含 ==UserScript== 块', meta.indexOf('// ==UserScript==') !== -1);
  for (const key of ['@name', '@namespace', '@version', '@description', '@match', '@grant', '@connect', '@run-at']) {
    check('元数据含 ' + key, new RegExp('^//\\s*' + key + '\\b', 'm').test(meta), meta.split('\n').filter((l) => l.indexOf(key) !== -1).join('|').slice(0, 80));
  }
  check('@match 覆盖 www 与子域', /@match\s+\*:\/\/\*\.bilibili\.com\//.test(meta) && /@match\s+\*:\/\/bilibili\.com\//.test(meta));
  check('网络请求已声明（@grant GM_xmlhttpRequest + @connect api.bilibili.com）', /@grant\s+GM_xmlhttpRequest/.test(meta) && /@connect\s+api\.bilibili\.com/.test(meta));
  check('脚本内网络地址与 @connect 一致', SCRIPT.indexOf('https://api.bilibili.com/x/v2/reply') !== -1);
  check('无 TODO / 未完成占位符', !/TODO|FIXME|XXX|待完成|未完成/.test(SCRIPT));
}

/* ---------------- 测试 2：DOM 属性路径 + 原生文本跳过 + 空字段灰色占位 ---------------- */
console.log('\n=== 测试2：DOM 属性路径 / 原生跳过 / 灰色占位 ===');
{
  const doc = makeDocument();
  const c1 = commentItem(1, [
    makeEl('a', { class: 'user-name' }, [], '用户A'),
    makeEl('span', { 'data-ip-location': '江苏' }, [], '')
  ]);
  const c2 = commentItem(2, [
    makeEl('a', { class: 'user-name' }, [], '用户B'),
    makeEl('span', { 'data-ip-location': '' }, [], '')
  ]);
  const c3 = commentItem(3, [
    makeEl('a', { class: 'user-name' }, [], '用户C'),
    makeEl('span', { 'data-iploc': 'IP属地：广东' }, [], '')
  ]);
  const c4 = commentItem(4, [makeEl('a', { class: 'user-name' }, [], '用户D')]); // 无任何数据
  const c5 = commentItem(5, [
    makeEl('a', { class: 'user-name' }, [], '用户E'),
    makeEl('span', { class: 'ip-location' }, [], 'IP属地：浙江') // B站已自行渲染
  ]);
  const c5b = commentItem(51, [
    makeEl('a', { class: 'user-name' }, [], '用户E2'),
    makeEl('span', { 'data-ip-location': '安徽' }, [], ''),
    makeEl('span', { class: 'ip-location' }, [], 'IP属地：安徽') // 数据源存在但 B站已自行渲染
  ]);
  withCommentArea(doc, [c1, c2, c3, c4, c5, c5b]);
  const sandbox = makeSandbox({ document: doc });
  loadScript(sandbox);

  const badgeOf = (h) => h.querySelectorAll('[data-se-ip-badge]');
  check('属性路径：正常值显示 badge(江苏)', badgeOf(c1).length === 1 && badgeOf(c1)[0].textContent === 'IP属地：江苏');
  check('空字段：灰色占位“—”', badgeOf(c2).length === 1 && badgeOf(c2)[0].textContent === 'IP属地：—' && /se-ip-unknown/.test(badgeOf(c2)[0].className));
  check('值带前缀未渲染：归一化为广东', badgeOf(c3).length === 1 && badgeOf(c3)[0].textContent === 'IP属地：广东');
  check('无数据节点：完全不动', badgeOf(c4).length === 0);
  check('B站已渲染（无数据源）：不触碰', badgeOf(c5).length === 0);
  check('B站已渲染（有数据源）：跳过不重复插入', badgeOf(c5b).length === 0 && c5b.__seNative === true);
  check('badge 注入到 meta 行（贴合布局）', c1.querySelector('[data-se-ip-badge]') !== null && badgeOf(c1)[0].parentNode.className.indexOf('user-info') !== -1);
  check('样式已注入（小号灰色 + pointer-events:none）', doc.head.querySelectorAll('style').length === 1 && (doc.head.querySelectorAll('style')[0].textContent.indexOf('.se-ip-badge') !== -1) && (doc.head.querySelectorAll('style')[0].textContent.indexOf('pointer-events:none') !== -1));
  check('宿主已打去重标记', c1.getAttribute('data-se-ip-processed') === 'ok' && c2.getAttribute('data-se-ip-processed') === 'unknown');
}

/* ---------------- 测试 3：SPA/重复扫描去重 + 节点复用原地更新 + 新节点生效 ---------------- */
console.log('\n=== 测试3：SPA 去重与原地更新 ===');
{
  const doc = makeDocument();
  const c1 = commentItem(1, [
    makeEl('a', { class: 'user-name' }, [], '用户A'),
    makeEl('span', { 'data-ip-location': '江苏' }, [], '')
  ]);
  withCommentArea(doc, [c1]);
  const sandbox = makeSandbox({ document: doc });
  loadScript(sandbox);
  const badgeOf = (h) => h.querySelectorAll('[data-se-ip-badge]');

  check('初始注入 1 个 badge', badgeOf(c1).length === 1);

  // 模拟多次无关 DOM 更新
  for (let i = 0; i < 5; i++) { sandbox.__triggerObserver(); sandbox.__flushTimers(); }
  check('反复扫描后仍只有 1 个 badge（不重复插入）', badgeOf(c1).length === 1);

  // 模拟路由切换：节点被复用但数据变化（原地更新而非新增）
  const ipSpan = c1.querySelector('[data-ip-location]');
  ipSpan.setAttribute('data-ip-location', '上海');
  sandbox.__triggerObserver();
  sandbox.__flushTimers();
  check('节点复用数据变化：原地更新为上海', badgeOf(c1).length === 1 && badgeOf(c1)[0].textContent === 'IP属地：上海');

  // 模拟路由切换：整块评论替换为新评论（全新节点）
  const c6 = commentItem(6, [
    makeEl('a', { class: 'user-name' }, [], '用户F'),
    makeEl('span', { 'data-ip-location': '湖北' }, [], '')
  ]);
  doc.getElementById = undefined; /* 不需要 */
  doc.body.appendChild(makeEl('div', { id: 'comment' }, [c6]));
  sandbox.__triggerObserver();
  sandbox.__flushTimers();
  check('路由切换后新增节点自动生效', badgeOf(c6).length === 1 && badgeOf(c6)[0].textContent === 'IP属地：湖北');
  check('旧节点数量不受影响（去重仍成立）', badgeOf(c1).length === 1);
}

/* ---------------- 测试 4：内嵌全局状态路径 ---------------- */
console.log('\n=== 测试4：__INITIAL_STATE__ 路径 ===');
{
  const doc = makeDocument();
  const c7 = commentItem(7, [makeEl('a', { class: 'user-name' }, [], '用户G')]);
  withCommentArea(doc, [c7]);
  const sandbox = makeSandbox({
    document: doc,
    initState: { replyData: { replies: [{ rpid: 7, ip_location: '北京' }] } }
  });
  loadScript(sandbox);
  const badgeOf = (h) => h.querySelectorAll('[data-se-ip-badge]');
  check('按 rpid 关联注入', badgeOf(c7).length === 1 && badgeOf(c7)[0].textContent === 'IP属地：北京');
}

/* ---------------- 测试 5：公开接口路径（含子回复） ---------------- */
console.log('\n=== 测试5：公开接口路径 ===');
{
  const doc = makeDocument();
  const c9 = commentItem(9, [makeEl('a', { class: 'user-name' }, [], '用户H')]);
  const c91 = commentItem(91, [makeEl('a', { class: 'user-name' }, [], '用户I')], 'sub-reply-item');
  withCommentArea(doc, [c9, c91]);
  const sandbox = makeSandbox({
    document: doc,
    initState: { videoData: { aid: 114514 } },
    apiMode: 'ok',
    apiPayload: {
      code: 0,
      data: {
        replies: [
          { rpid: 9, ip_location: '河南', replies: [{ rpid: 91, member: { ip_location: '湖北' } }] }
        ]
      }
    }
  });
  loadScript(sandbox);
  const badgeOf = (h) => h.querySelectorAll('[data-se-ip-badge]');
  check('接口路径：顶楼注入', badgeOf(c9).length === 1 && badgeOf(c9)[0].textContent === 'IP属地：河南');
  check('接口路径：楼中楼注入', badgeOf(c91).length === 1 && badgeOf(c91)[0].textContent === 'IP属地：湖北');
  check('请求地址与声明一致（oid=114514）', sandbox.window.__lastApiUrl && /api\.bilibili\.com\/x\/v2\/reply/.test(sandbox.window.__lastApiUrl) && sandbox.window.__lastApiUrl.indexOf('oid=114514') !== -1);
  // 不再重复请求
  sandbox.__triggerObserver();
  sandbox.__flushTimers();
  check('同页不重复请求接口', badgeOf(c9).length === 1);
}

/* ---------------- 测试 6：接口失败 → 灰色备注（不打扰） ---------------- */
console.log('\n=== 测试6：网络失败降级 ===');
{
  const doc = makeDocument();
  const c10 = commentItem(10, [makeEl('a', { class: 'user-name' }, [], '用户J')]);
  const area = withCommentArea(doc, [c10]);
  const sandbox = makeSandbox({
    document: doc,
    initState: { videoData: { aid: 114515 } },
    apiMode: 'fail'
  });
  loadScript(sandbox);
  const notes = area.querySelectorAll('.se-ip-note');
  check('失败降级：出现灰色备注', notes.length === 1 && notes[0].textContent.indexOf('暂不可用') !== -1 && /se-ip-note/.test(notes[0].className));
  sandbox.__triggerObserver();
  sandbox.__flushTimers();
  check('失败备注不重复', area.querySelectorAll('.se-ip-note').length === 1);
}

/* ---------------- 测试 7：空页面静默 ---------------- */
console.log('\n=== 测试7：空页面/无评论页静默 ===');
{
  const doc = makeDocument();
  doc.body.appendChild(makeEl('div', { class: 'live-room' }));
  const sandbox = makeSandbox({ document: doc });
  loadScript(sandbox); // 不应抛错
  sandbox.__triggerObserver();
  sandbox.__flushTimers();
  check('无数据页无 badge 无备注且不抛错', doc.querySelectorAll('[data-se-ip-badge]').length === 0 && doc.querySelectorAll('.se-ip-note').length === 0);
}

/* ---------------- 汇总 ---------------- */
console.log('\n====================================');
console.log('断言总数: ' + checks + '，失败: ' + failures);
if (failures > 0) {
  console.log('结果: FAIL');
  process.exit(1);
} else {
  console.log('结果: ALL PASS');
  process.exit(0);
}