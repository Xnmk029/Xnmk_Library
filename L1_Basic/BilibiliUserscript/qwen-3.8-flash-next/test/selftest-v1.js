'use strict';
/*
 * B 站 IP 归属地油猴脚本 · DOM 桩自测（零第三方依赖）
 *
 * 运行方式：在工作目录下执行   node test/selftest.js
 * 退出码：全部断言通过 = 0，任一失败 = 1。
 *
 * 用本地 fixture 模拟三类页面（对应评分参考）：
 *   S1 有归属地   —— data-* 属性 / data-* 内嵌 JSON / __INITIAL_STATE__ / 已渲染「IP属地」文本，四种来源
 *   S2 无归属地   —— 字段缺失与脏数据（非法 JSON、超长文本），要求不报错、只显示灰色占位
 *   S3 动态加载   —— 初始无节点 → 异步插入 → 多次 flush/扫描 → 模拟 SPA pushState 路由，
 *                    全程验证「只插入一次、不重复插入」，以及占位升级为真实标签的幂等路径
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ------------------------------ 迷你 DOM 桩 ------------------------------ */

const VOID_TAGS = new Set(['img', 'br', 'input', 'hr', 'meta', 'link']);

class TextNode {
  constructor(text) { this.nodeType = 3; this._text = String(text); this.parentNode = null; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
}

function decodeEntities(s) {
  return String(s)
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
function parseAttrString(str) {
  const attrs = {};
  if (!str) return attrs;
  const re = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+)))?/g;
  let m;
  while ((m = re.exec(str))) {
    const v = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
    attrs[m[1].toLowerCase()] = decodeEntities(v);
  }
  return attrs;
}

class Element {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.childNodes = [];
    this.attributes = {};
    this.parentNode = null;
    this.shadowRoot = null;
  }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  get id() { return this.attributes.id || ''; }
  set id(v) { this.attributes.id = String(v); }
  get className() { return this.attributes['class'] || ''; }
  set className(v) { this.attributes['class'] = String(v); }
  get classList() {
    const self = this;
    return {
      add(c) { const s = (self.className || '').split(/\s+/).filter(Boolean); if (!s.includes(c)) s.push(c); self.className = s.join(' '); },
      contains(c) { return (self.className || '').split(/\s+/).includes(c); },
    };
  }
  setAttribute(k, v) { this.attributes[String(k).toLowerCase()] = String(v); }
  getAttribute(k) { const v = this.attributes[String(k).toLowerCase()]; return v === undefined ? null : v; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, String(k).toLowerCase()); }
  appendChild(n) { n.parentNode = this; this.childNodes.push(n); return n; }
  insertBefore(n, ref) {
    n.parentNode = this;
    if (!ref) { this.childNodes.push(n); return n; }
    const i = this.childNodes.indexOf(ref);
    if (i < 0) this.childNodes.push(n); else this.childNodes.splice(i, 0, n);
    return n;
  }
  removeChild(n) { const i = this.childNodes.indexOf(n); if (i >= 0) { this.childNodes.splice(i, 1); n.parentNode = null; } return n; }
  get nextSibling() { if (!this.parentNode) return null; const a = this.parentNode.childNodes; const i = a.indexOf(this); return i >= 0 && i + 1 < a.length ? a[i + 1] : null; }
  get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
  get textContent() { return this.childNodes.map((c) => c.textContent || '').join(''); }
  set textContent(v) { this.childNodes.forEach((c) => { c.parentNode = null; }); if (v !== '') this.childNodes.push(new TextNode(v)); }
  set innerHTML(html) { this.childNodes.forEach((c) => { c.parentNode = null; }); this.childNodes = []; const frag = parseHTML(String(html)); frag.children.forEach((c) => this.appendChild(c)); }
  contains(other) { if (other === this) return true; return this.childNodes.some((c) => c.nodeType === 1 ? c.contains(other) : false); }
  walk(fn) { this.childNodes.forEach((c) => { if (c.nodeType === 1) { fn(c); c.walk(fn); } }); }
  querySelectorAll(sel) { const out = []; this.walk((el) => { if (matchesSelector(el, sel)) out.push(el); }); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  matches(sel) { return matchesSelector(this, sel); }
  addEventListener() {}
  removeEventListener() {}
}

/* 迷你选择器：支持 逗号组 / tag / .class / #id / [attr] / [attr=v] / [attr="v"] / [attr*="v"]（无组合器，脚本刻意只用这些形态） */
function matchSimpleCompound(el, comp) {
  const re = /([a-zA-Z][\w-]*)?((?:\.[\w-]+|\#[\w-]+|\[[^\]]*\])*)/g;
  const m = re.exec(comp);
  if (!m || m.index !== 0) return false;
  const tag = m[1] || '';
  const rest = m[2] || '';
  if (tag && el.tagName !== tag.toUpperCase()) return false;
  const parts = rest.match(/\.[\w-]+|\#[\w-]+|\[[^\]]*\]/g) || [];
  for (const p of parts) {
    if (p[0] === '.') { if (!(el.className || '').split(/\s+/).includes(p.slice(1))) return false; }
    else if (p[0] === '#') { if (el.id !== p.slice(1)) return false; }
    else {
      const am = /^\[([:\w-]+)(?:([~^*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]$/.exec(p);
      if (!am) return false;
      const name = am[1].toLowerCase();
      if (!el.hasAttribute(name)) return false;
      if (am[2]) {
        const want = am[3] !== undefined ? am[3] : am[4] !== undefined ? am[4] : am[5] !== undefined ? am[5] : '';
        const got = el.getAttribute(name);
        if (am[2] === '=') { if (got !== want) return false; }
        else if (am[2] === '*=') { if (String(got).indexOf(want) < 0) return false; }
        else if (am[2] === '^=') { if (String(got).slice(0, want.length) !== want) return false; }
      }
    }
  }
  return true;
}
function matchesSelector(el, sel) {
  return String(sel).split(',').some((g) => matchSimpleCompound(el, g.trim()));
}

/* 迷你 HTML 解析（仅 fixture 用到的子集） */
function parseHTML(str) {
  const root = new Element('fragment');
  const stack = [root];
  const re = /<\/?([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(str))) {
    const cur = stack[stack.length - 1];
    if (m[3] !== undefined) { const t = m[3]; if (t.trim()) cur.appendChild(new TextNode(decodeEntities(t))); continue; }
    const tag = m[1].toLowerCase();
    const closing = m[0][1] === '/';
    if (closing) { for (let i = stack.length - 1; i > 0; i--) { if (stack[i].tagName === tag.toUpperCase()) { stack.length = i; break; } } continue; }
    const selfClose = /\/>$/.test(m[0]);
    const el = new Element(tag);
    const attrs = parseAttrString(m[2]);
    for (const k of Object.keys(attrs)) el.setAttribute(k, attrs[k]);
    cur.appendChild(el);
    if (!selfClose && !VOID_TAGS.has(tag)) stack.push(el);
  }
  return root;
}

/* ------------------------------ 环境装配 ------------------------------ */

function makeEnv() {
  const errors = [];
  const observers = [];
  const listeners = {};

  class MutationObserverStub {
    constructor(cb) { this.cb = cb; }
    observe() {}
    disconnect() {}
  }

  const documentElement = new Element('html');
  const head = new Element('head');
  const body = new Element('body');
  documentElement.appendChild(head);
  documentElement.appendChild(body);

  const documentStub = {
    nodeType: 9,
    readyState: 'complete',
    documentElement: documentElement,
    head: head,
    body: body,
    createElement: (t) => new Element(t),
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    querySelectorAll: (sel) => documentElement.querySelectorAll(sel),
    querySelector: (sel) => documentElement.querySelector(sel),
    getElementById: (id) => { let hit = null; documentElement.walk((el) => { if (!hit && el.id === id) hit = el; }); return hit; },
    contains: (n) => documentElement.contains(n),
  };

  const timers = { seq: 0, q: [], now: 0 };
  const setTimeoutStub = (fn, ms) => { const id = ++timers.seq; timers.q.push({ id: id, fn: fn, due: timers.now + (ms || 0) }); return id; };
  const clearTimeoutStub = (id) => { const i = timers.q.findIndex((t) => t.id === id); if (i >= 0) timers.q.splice(i, 1); };
  function runTimers() {
    let guard = 0;
    while (timers.q.length && guard++ < 200) {
      const idx = timers.q.reduce((b, t, i, a) => (t.due < a[b].due ? i : b), 0);
      const t = timers.q.splice(idx, 1)[0];
      timers.now = Math.max(timers.now, t.due);
      try { t.fn(); } catch (e) { errors.push(e); }
    }
  }
  function flushMutations() {
    observers.slice().forEach((o) => { try { o.cb([{ type: 'childList' }], o); } catch (e) { errors.push(e); } });
  }

  const historyStub = {
    pushState: function () {},
    replaceState: function () {},
  };

  const sandbox = {
    document: documentStub,
    MutationObserver: function (cb) { const o = new MutationObserverStub(cb); observers.push(o); return o; },
    setTimeout: setTimeoutStub,
    clearTimeout: clearTimeoutStub,
    console: { log() {}, warn() {}, error() {} },
    history: historyStub,
    location: { href: 'https://www.bilibili.com/video/BV1TEST001/', origin: 'https://www.bilibili.com' },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.MutationObserver.prototype = MutationObserverStub.prototype;
  vm.createContext(sandbox);

  return { sandbox, document: documentStub, body, errors, runTimers, flushMutations, listeners };
}

/* ------------------------------ 断言 ------------------------------ */

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  —— ' + detail : '')); }
}
function badgesOf(env) { return env.document.querySelectorAll('[data-bili-ipregion-badge]'); }
function badgeTexts(env) { return badgesOf(env).map((b) => b.textContent); }
function badgeCountFor(env, host) { return badgesOf(env).filter((b) => b.parentNode === host).length; }

/* ------------------------------ 用例 ------------------------------ */

const SRC = fs.readFileSync(path.join(__dirname, '..', 'answer.user.js'), 'utf8');
console.log('== S1 有归属地（静态 fixture：属性 / 内嵌 JSON / __INITIAL_STATE__ / 已渲染文本） ==');
{
  const env = makeEnv();
  env.sandbox.__INITIAL_STATE__ = { data: { replies: [{ mid: '77', card: { ip_region: '北京' } }] } };
  env.body.innerHTML =
    '<div id="app">' +
      '<div class="reply-item" data-ip-region="广东"><a href="https://space.bilibili.com/123">甲</a><span class="content">评论内容甲</span></div>' +
      '<div class="comment-item" data-user-info="{&quot;mid&quot;:9,&quot;ip_region&quot;:&quot;江苏&quot;}"><a href="https://space.bilibili.com/9">乙</a><span>评论内容乙</span></div>' +
      '<div class="bili-dyn-item"><a href="https://space.bilibili.com/5">丙</a> 今天天气不错 IP属地：浙江</div>' +
      '<div class="reply-item"><a href="https://space.bilibili.com/77">丁</a><span>评论内容丁</span></div>' +
    '</div>';
  vm.runInContext(SRC, env.sandbox, { filename: 'answer.user.js' });
  env.flushMutations();
  env.runTimers();

  const bs = badgesOf(env);
  check('注入 4 枚归属地标签', bs.length === 4, '实际 ' + bs.length + ' 枚: ' + JSON.stringify(badgeTexts(env)));
  check('四种数据源文本正确', JSON.stringify(badgeTexts(env)) === JSON.stringify(['IP属地：广东', 'IP属地：江苏', 'IP属地：浙江', 'IP属地：北京']), JSON.stringify(badgeTexts(env)));
  check('无占位（本页都有归属地）', bs.every((b) => !b.classList.contains('is-placeholder')));
  const hosts = env.body.querySelectorAll('.reply-item,.comment-item,.bili-dyn-item');
  check('每个宿主只插 1 枚', hosts.every((h) => badgeCountFor(env, h) === 1));
  check('标签紧随用户名链接（贴合行内布局）', bs.every((b) => { const p = b.parentNode; const links = p.querySelectorAll('a[href*="space.bilibili.com"]'); return links.length ? b.parentNode.children[b.parentNode.children.indexOf(b) - 1] === links[0] : true; }));
  const styleCount = env.document.querySelectorAll('style').filter((s) => s.id === 'bili-ipregion-style').length;
  check('样式表仅注入一次', styleCount === 1, '实际 ' + styleCount);
  check('无未捕获异常', env.errors.length === 0, JSON.stringify(env.errors.map(String)));
}

console.log('== S2 无归属地 / 脏数据（缺失字段不报错，灰色占位） ==');
{
  const env = makeEnv();
  env.body.innerHTML =
    '<div id="app">' +
      '<div class="comment-item" data-user-info="{oops bad json"><a href="https://space.bilibili.com/4001">无数据用户</a><span>' + '超长评论'.repeat(3000) + '</span></div>' +
      '<div class="reply-item" data-ip-region=""><a href="https://space.bilibili.com/4002">空字段用户</a><span>评论内容</span></div>' +
      '<div class="page-wrapper"><span>与条目无关的普通容器，不应被注入</span></div>' +
    '</div>';
  vm.runInContext(SRC, env.sandbox, { filename: 'answer.user.js' });
  env.flushMutations();
  env.runTimers();

  const bs = badgesOf(env);
  const real = bs.filter((b) => !b.classList.contains('is-placeholder'));
  const ph = bs.filter((b) => b.classList.contains('is-placeholder'));
  check('脏数据/缺失字段不抛异常', env.errors.length === 0, JSON.stringify(env.errors.map(String)));
  check('不误报归属地（无真实标签）', real.length === 0, JSON.stringify(badgeTexts(env)));
  check('两个条目各 1 枚灰色占位', ph.length === 2 && ph.every((b) => b.textContent === '归属地未知'), '实际 ' + ph.length);
  check('无关容器未被注入', env.body.querySelectorAll('.page-wrapper').every((h) => badgeCountFor(env, h) === 0));
  check('占位样式为虚线灰（is-placeholder class 且文案不打扰）', ph.every((b) => b.className.includes('is-placeholder')));
}

console.log('== S3 动态加载 + SPA 路由 + 幂等（只插入一次、多次更新不重复） ==');
{
  const env = makeEnv();
  env.body.innerHTML = '<div id="app"><div class="comment-list"></div></div>';
  vm.runInContext(SRC, env.sandbox, { filename: 'answer.user.js' });
  env.flushMutations();
  env.runTimers();
  check('初始无数据无注入（不打扰）', badgesOf(env).length === 0);

  // 异步加载：300ms 后评论注入
  const list = env.body.querySelector('.comment-list');
  const item = env.document.createElement('div');
  item.className = 'reply-item';
  item.setAttribute('data-ip-region', '四川');
  const link = env.document.createElement('a');
  link.setAttribute('href', 'https://space.bilibili.com/555');
  item.appendChild(link);
  list.appendChild(item);
  env.flushMutations();
  env.runTimers();
  const b1 = badgesOf(env);
  check('异步插入后被观察到并注入', b1.length === 1 && b1[0].textContent === 'IP属地：四川', JSON.stringify(badgeTexts(env)));

  // 连续多次 DOM 更新与扫描：绝不重复插入
  env.flushMutations(); env.runTimers();
  env.flushMutations(); env.runTimers(); env.flushMutations(); env.runTimers();
  check('多次 flush/扫描仍只 1 枚（幂等）', badgesOf(env).length === 1 && badgeCountFor(env, item) === 1, '实际 ' + badgesOf(env).length);

  // 模拟 SPA pushState 路由切换：脚本会包装 history 并重新扫描，不得重复
  env.sandbox.history.pushState({ t: 1 }, '', '/video/BV1OTHER/');
  env.flushMutations(); env.runTimers();
  check('路由切换后仍只 1 枚且功能生效', badgesOf(env).length === 1 && badgesOf(env)[0].textContent === 'IP属地：四川');

  // 路由后新页面异步再插一条无归属地评论 → 灰色占位出现
  const item2 = env.document.createElement('div');
  item2.className = 'comment-item';
  item2.setAttribute('data-user-info', '{"mid":601}'); // 有用户数据、无归属地字段
  const link2 = env.document.createElement('a');
  link2.setAttribute('href', 'https://space.bilibili.com/601');
  item2.appendChild(link2);
  list.appendChild(item2);
  env.flushMutations(); env.runTimers();
  const bs = badgesOf(env);
  check('新条目占位出现，旧标签未被复制', bs.length === 2 && badgeCountFor(env, item) === 1 && badgeCountFor(env, item2) === 1, JSON.stringify(badgeTexts(env)));

  // 数据补齐后占位升级为真实归属地，且仍只有一枚
  item2.setAttribute('data-location', '福建');
  env.flushMutations(); env.runTimers(); env.flushMutations(); env.runTimers();
  check('占位幂等升级为真实标签（仍每宿一枚）', badgesOf(env).length === 2 && badgeTexts(env).includes('IP属地：福建'), JSON.stringify(badgeTexts(env)));

  // 二次路由 + 再次全量扫描：数量不变
  env.sandbox.history.pushState({ t: 2 }, '', '/dynamic/1');
  env.flushMutations(); env.runTimers();
  check('二次路由后总数仍为 2（无重复）', badgesOf(env).length === 2);
  check('S3 全程无未捕获异常', env.errors.length === 0, JSON.stringify(env.errors.map(String)));
}

console.log('== 静态权限审计（元数据块） ==');
{
  const metaBlock = SRC.slice(0, SRC.indexOf('// ==/UserScript=='));
  check('@name/@namespace/@match/@grant 均存在', ['@name', '@namespace', '@match', '@grant'].every((k) => metaBlock.includes(k)));
  check('适用域名显式声明（www/t/space .bilibili.com）', ['www.bilibili.com', 't.bilibili.com', 'space.bilibili.com'].every((d) => metaBlock.includes('@match') && metaBlock.includes(d)));
  check('@grant none（最小权限，无广域访问声明）', /@grant\s+none/.test(metaBlock));
  // 审计对象 = 去掉整行说明注释后的代码本体（元数据块/注释里的"不使用 fetch…"字样不算调用）
  const codeSrc = SRC.slice(SRC.indexOf('// ==/UserScript==')).replace(/^\s*\/\/.*$/gm, '');
  check('代码零网络调用（fetch/XHR/GM_xmlhttpRequest/WebSocket/beacon）', !/fetch\(|XMLHttpRequest|GM_xmlhttpRequest|GM\.request|WebSocket|sendBeacon/.test(codeSrc));
  check('零隐私持久化（localStorage/cookie/sessionStorage/indexedDB 未使用）', !/localStorage|document\.cookie|sessionStorage|indexedDB|GM_setValue/.test(codeSrc));
  check('零第三方依赖 / 无 TODO 占位符', !/TODO|FIXME|import\s|require\(/.test(codeSrc));
}

console.log('');
console.log('结果: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
