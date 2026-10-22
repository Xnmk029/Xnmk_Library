'use strict';
/*
 * B 站 IP 归属地油猴脚本 v2 · DOM 桩自测（零第三方依赖，fixture 全部来自 evidence/ 真实取证）
 *
 * 运行方式：node test/selftest.js
 * 退出码：全部断言通过 = 0；任一失败 = 1。
 *
 * 数据来源（真实抓取，evidence/）：
 *   [E-API] reply-main.json      —— 匿名 GET https://api.bilibili.com/x/v2/reply/main?type=1&oid=170001&mode=3&next=0（code=0，真实 replies/reply_control/cursor 结构；匿名不含 location）
 *   [E-DOC] doc-comment-list.md  —— 公开接口文档登录态示例："location": "IP属地：河北"（权威字段 reply_control.location，需登录）
 *   [E-DOM] video-page.html      —— <div id="commentapp"> 挂载点（@131468）
 *   [E-TPL] new-comment.js       —— 官方条目模板 <div class="reply-item reply-wrap" data-id=rpid>；归属地渲染位 <div class="info"><span class="time-location"><span class="reply-time">…（其后 .reply-location 行被 B 站注释禁用——v1 失效根因实证）
 *   [E-SHD] bili-comments.js     —— attachShadow({mode:"open"}) 全量 open → shadow 可穿透
 *
 * 覆盖：真实评论区(登录态)注入 / 匿名无字段降级 / 异步晚到 / shadow DOM 内条目 / SPA 路由切换 / 重复更新幂等（只插一次）
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---------------- 真实 API fixture（裁剪自 evidence/reply-main.json，登录态 location 按文档注入） ---------------- */

function slimReply(r, loc) {
  const o = {
    rpid: r.rpid, rpid_str: r.rpid_str, mid: r.mid, mid_str: r.mid_str,
    like: r.like, action: r.action, reply_control: Object.assign({}, r.reply_control),
    content: { message: (r.content && r.content.message && r.content.message.slice(0, 20)) || 'msg', members: (r.content && r.content.members) || [] },
  };
  if (loc !== undefined) o.reply_control.location = loc;
  if (Array.isArray(r.replies)) o.replies = r.replies.map((s) => slimReply(s));
  return o;
}
const rawMain = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'evidence', 'reply-main.json'), 'utf8'));
if (rawMain.code !== 0) throw new Error('evidence/reply-main.json 非 code=0，取证样本失效');

function makeReplyMainFixture() {
  const replies = rawMain.data.replies.slice(0, 6).map((r, i) => {
    const slim = slimReply(r);
    if (i === 0) slim.reply_control.location = 'IP属地：北京';            // E-DOC 逐字形态（登录态下发）
    if (i === 1) slim.reply_control.location = '河北';                     // 旧简模板裸值形态（E-TPL 拼接证据）
    if (i === 2) slim.reply_control.location = 'IP属地：IP属地：错误示例';   // 脏值 → 规范化丢弃 → 占位
    return slim;
  });
  if (replies[0].replies && replies[0].replies.length) {
    replies[0].replies[0].rpid_str = String(Number(replies[0].rpid_str) + 1);
    replies[0].replies[0].reply_control = Object.assign({}, replies[0].replies[0].reply_control, { location: 'IP属地：上海' });
  }
  return {
    code: 0, message: '0', ttl: 1,
    data: {
      cursor: Object.assign({}, rawMain.data.cursor, { is_end: true }),
      replies: replies,
    },
  };
}
function makeAnonReplyMainFixture() {
  return { code: 0, message: '0', ttl: 1, data: { cursor: Object.assign({}, rawMain.data.cursor, { is_end: true }), replies: rawMain.data.replies.slice(0, 3).map((r) => slimReply(r)) } };
}

/* ---------------- 迷你 DOM 桩（attachShadow / ShadowRoot / iframe / GM 拦截 / 假定时器） ---------------- */

const VOID_TAGS = new Set(['img', 'br', 'input', 'hr', 'meta', 'link']);
class TextNode {
  constructor(t) { this.nodeType = 3; this._text = String(t); this.parentNode = null; }
  get textContent() { return this._text; } set textContent(v) { this._text = String(v); }
}
function decodeEntities(s) {
  return String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');
}
function parseAttrString(str) {
  const attrs = {}; if (!str) return attrs;
  const re = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+)))?/g; let m;
  while ((m = re.exec(str))) { const v = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : ''; attrs[m[1].toLowerCase()] = decodeEntities(v); }
  return attrs;
}
function matchSimpleCompound(el, comp) {
  comp = comp.trim();
  if (comp === '*') return true;
  const m = /^([a-zA-Z][\w-]*)?((?:\.[\w-]+|\#[\w-]+|\[[^\]]*\])*)$/.exec(comp);
  if (!m) return false;
  if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
  const parts = (m[2] || '').match(/\.[\w-]+|\#[\w-]+|\[[^\]]*\]/g) || [];
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
function matchesSelector(el, sel) { return String(sel).split(',').some((g) => matchSimpleCompound(el, g)); }

class Element {
  constructor(tag) { this.nodeType = 1; this.tagName = String(tag).toUpperCase(); this.childNodes = []; this.attributes = {}; this.parentNode = null; this._sr = null; this._listeners = {}; }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  get id() { return this.attributes.id || ''; } set id(v) { this.attributes.id = String(v); }
  get className() { return this.attributes['class'] || ''; } set className(v) { this.attributes['class'] = String(v); }
  get classList() { const self = this; return { add(c) { const s = (self.className || '').split(/\s+/).filter(Boolean); if (!s.includes(c)) s.push(c); self.className = s.join(' '); }, contains(c) { return (self.className || '').split(/\s+/).includes(c); } }; }
  setAttribute(k, v) { this.attributes[String(k).toLowerCase()] = String(v); }
  getAttribute(k) { const v = this.attributes[String(k).toLowerCase()]; return v === undefined ? null : v; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, String(k).toLowerCase()); }
  appendChild(n) { n.parentNode = this; this.childNodes.push(n); return n; }
  insertBefore(n, ref) { n.parentNode = this; if (!ref) { this.childNodes.push(n); return n; } const i = this.childNodes.indexOf(ref); if (i < 0) this.childNodes.push(n); else this.childNodes.splice(i, 0, n); return n; }
  removeChild(n) { const i = this.childNodes.indexOf(n); if (i >= 0) { this.childNodes.splice(i, 1); n.parentNode = null; } return n; }
  get nextSibling() { if (!this.parentNode) return null; const a = this.parentNode.childNodes; const i = a.indexOf(this); return i >= 0 && i + 1 < a.length ? a[i + 1] : null; }
  get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
  get textContent() { return this.childNodes.map((c) => (c.textContent || '')).join(''); }
  set textContent(v) { this.childNodes.forEach((c) => { c.parentNode = null; }); this.childNodes = []; if (v !== '') this.childNodes.push(new TextNode(v)); }
  set innerHTML(html) { this.childNodes.forEach((c) => { c.parentNode = null; }); this.childNodes = []; parseHTML(String(html)).children.forEach((c) => this.appendChild(c)); }
  contains(o) { if (o === this) return true; return this.childNodes.some((c) => (c.nodeType === 1 ? c.contains(o) : false)); }
  walk(fn) { this.childNodes.forEach((c) => { if (c.nodeType === 1) { fn(c); c.walk(fn); } }); }
  querySelectorAll(sel) { const out = []; this.walk((el) => { if (matchesSelector(el, sel)) out.push(el); }); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  matches(sel) { return matchesSelector(this, sel); }
  attachShadow() { this._sr = new ShadowRoot(this); return this._sr; }
  get shadowRoot() { return this._sr; }
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  removeEventListener() {}
}
class ShadowRoot {
  constructor(host) { this.nodeType = 11; this.host = host; this.childNodes = []; this.parentNode = null; }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  appendChild(n) { n.parentNode = this; this.childNodes.push(n); return n; }
  insertBefore(n, ref) { n.parentNode = this; if (!ref) { this.childNodes.push(n); return n; } const i = this.childNodes.indexOf(ref); if (i < 0) this.childNodes.push(n); else this.childNodes.splice(i, 0, n); return n; }
  removeChild(n) { const i = this.childNodes.indexOf(n); if (i >= 0) { this.childNodes.splice(i, 1); n.parentNode = null; } return n; }
  walk(fn) { this.childNodes.forEach((c) => { if (c.nodeType === 1) { fn(c); c.walk(fn); } }); }
  querySelectorAll(sel) { const out = []; this.walk((el) => { if (matchesSelector(el, sel)) out.push(el); }); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  contains(o) { return this.children.some((c) => c.contains(o)); }
  get textContent() { return this.childNodes.map((c) => (c.textContent || '')).join(''); }
  getElementById(id) { let h = null; this.walk((el) => { if (!h && el.id === id) h = el; }); return h; }
}
function parseHTML(str) {
  const root = new Element('fragment'); const stack = [root];
  const re = /<\/?([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g; let m;
  while ((m = re.exec(str))) {
    const cur = stack[stack.length - 1];
    if (m[3] !== undefined) { if (m[3].trim()) cur.appendChild(new TextNode(decodeEntities(m[3]))); continue; }
    const tag = m[1].toLowerCase();
    if (m[0][1] === '/') { for (let i = stack.length - 1; i > 0; i--) if (stack[i].tagName === tag.toUpperCase()) { stack.length = i; break; } continue; }
    const selfClose = /\/>$/.test(m[0]);
    const el = new Element(tag);
    const attrs = parseAttrString(m[2]);
    for (const k of Object.keys(attrs)) el.setAttribute(k, attrs[k]);
    cur.appendChild(el);
    if (!selfClose && !VOID_TAGS.has(tag)) stack.push(el);
  }
  return root;
}

/* ---------------- 环境装配 ---------------- */

function makeEnv(opts) {
  opts = opts || {};
  const errors = []; const observers = []; const gmCalls = [];
  const documentElement = new Element('html');
  const head = documentElement.appendChild(new Element('head'));
  const body = documentElement.appendChild(new Element('body'));
  const documentStub = {
    nodeType: 9, readyState: 'complete', documentElement, head, body,
    createElement: (t) => new Element(t),
    addEventListener() {}, removeEventListener() {},
    querySelectorAll: (s) => documentElement.querySelectorAll(s),
    querySelector: (s) => documentElement.querySelector(s),
    getElementById: (id) => { let h = null; documentElement.walk((el) => { if (!h && el.id === id) h = el; }); return h; },
    contains: (n) => documentElement.contains(n),
  };
  const timers = { seq: 0, q: [], now: 0 };
  const setTimeoutStub = (fn, ms) => { const id = ++timers.seq; timers.q.push({ id, fn, due: timers.now + (ms || 0) }); return id; };
  const clearTimeoutStub = (id) => { const i = timers.q.findIndex((t) => t.id === id); if (i >= 0) timers.q.splice(i, 1); };
  function runTimers() { let guard = 0; while (timers.q.length && guard++ < 400) { const idx = timers.q.reduce((b, t, i, a) => (t.due < a[b].due ? i : b), 0); const t = timers.q.splice(idx, 1)[0]; timers.now = Math.max(timers.now, t.due); try { t.fn(); } catch (e) { errors.push(e); } } }
  function flushMutations() { observers.slice().forEach((o) => { try { o.cb([{ type: 'childList' }], o); } catch (e) { errors.push(e); } }); }
  function gmStub(cfg) {
    gmCalls.push(cfg.url);
    if (opts.fail403) { try { cfg.onload({ status: 200, responseText: JSON.stringify({ code: -403, message: '访问权限不足', ttl: 1 }) }); } catch (e) { errors.push(e); } return; }
    setTimeoutStub(() => {
      let resp;
      if (/reply\/main/.test(cfg.url)) resp = (opts.anon ? makeAnonReplyMainFixture : makeReplyMainFixture)();
      else resp = { code: -1 };
      try { cfg.onload({ status: 200, responseText: JSON.stringify(resp) }); } catch (e) { errors.push(e); }
    }, 50);
  }
  const sandbox = {
    document: documentStub,
    MutationObserver: function (cb) { observers.push({ cb }); return { observe() {}, disconnect() {} }; },
    setTimeout: setTimeoutStub, clearTimeout: clearTimeoutStub,
    console: { log() {}, warn() {}, error() {} },
    history: { pushState() {}, replaceState() {} },
    location: { href: 'https://www.bilibili.com/video/BV1GJ411x7h7/', pathname: '/video/BV1GJ411x7h7/', origin: 'https://www.bilibili.com' },
  };
  if (!opts.noGM) sandbox.GM_xmlhttpRequest = gmStub;
  sandbox.window = sandbox; sandbox.self = sandbox;
  sandbox.__INITIAL_STATE__ = { aid: 170001, bvid: 'BV1GJ411x7h7', videoData: { aid: 170001 } };
  vm.createContext(sandbox);
  return { sandbox, document: documentStub, body, head, errors, runTimers, flushMutations, gmCalls };
}

/* 按 E-TPL/E-DOM 真实模板生成一条评论区 DOM */
function commentItemHtml(rpid, mid, cls) {
  return '<div class="' + (cls || 'list-item') + '" data-id="' + rpid + '"><div class="user"><a class="face" href="//space.bilibili.com/' + mid + '"></a></div>' +
    '<div class="content"><div class="user-info"><a data-usercard-mid="' + mid + '" href="//space.bilibili.com/' + mid + '" class="name">用户' + mid + '</a></div>' +
    '<div class="content" data-audited="1">评论内容</div>' +
    '<div class="info"><span class="time-location"><span class="reply-time">1天前</span></span>' +
    '<span class="like"><i></i><span>0</span></span><span class="hate"><i></i></span><span class="reply btn-hover">回复</span></div>' +
    '</div></div>';
}

/* ---------------- 断言 ---------------- */
let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  —— ' + detail : '')); }
}
const SRC = fs.readFileSync(path.join(__dirname, '..', 'answer-v2.user.js'), 'utf8');
const V1SRC = fs.readFileSync(path.join(__dirname, '..', 'answer.user.js'), 'utf8');

function badges(env, root) { return (root || env.document).querySelectorAll('[data-bili-ipregion-badge]'); }
function texts(env) { return badges(env).map((b) => b.textContent); }
function settle(env) { env.runTimers(); env.flushMutations(); env.runTimers(); }

/* ============ A. 真实评论区（登录态）：官方 DOM 模板 + reply_control.location ============ */
console.log('== A 真实评论区结构（E-TPL 模板 + E-DOC 登录态 location） ==');
{
  const env = makeEnv();
  const fx = makeReplyMainFixture();
  const r0 = fx.data.replies[0], r1 = fx.data.replies[1], r2 = fx.data.replies[2];
  const sub0 = (r0.replies && r0.replies[0]) || null;
  env.body.innerHTML = '<div id="app"><div id="commentapp"><div class="comment-container"><div class="comment-list">' +
    commentItemHtml(r0.rpid_str, r0.mid) + commentItemHtml(r1.rpid_str, r1.mid) + commentItemHtml(r2.rpid_str, r2.mid) +
    (sub0 ? '<div class="reply-box">' + commentItemHtml(sub0.rpid_str, sub0.mid, 'reply-item reply-wrap') + '</div>' : '') +
    '</div></div></div></div>';
  vm.runInContext(SRC, env.sandbox, { filename: 'answer-v2.user.js' });
  settle(env); settle(env); settle(env);
  check('仅请求已声明接口 /x/v2/reply/main（api.bilibili.com 单域）', env.gmCalls.length >= 1 && env.gmCalls.every((u) => /^https:\/\/api\.bilibili\.com\/x\/v2\/reply\/main\?type=1&oid=170001&mode=3/.test(u)), JSON.stringify(env.gmCalls));
  const bs = badges(env);
  const b0 = bs.find((b) => b.getAttribute('data-rpid-owner') === String(r0.rpid_str));
  const b1 = bs.find((b) => b.getAttribute('data-rpid-owner') === String(r1.rpid_str));
  const b2 = bs.find((b) => b.getAttribute('data-rpid-owner') === String(r2.rpid_str));
  check('条目0：E-DOC 形态 "IP属地：北京" 注入', !!b0 && b0.textContent === 'IP属地：北京', JSON.stringify(texts(env)));
  check('条目1：裸值形态规范化为 "IP属地：河北"', !!b1 && b1.textContent === 'IP属地：河北');
  check('条目2：脏值(双重前缀)丢弃 → 灰色占位', !!b2 && b2.textContent === '归属地未知' && b2.className.includes('is-placeholder'));
  if (sub0) {
    const bs2 = bs.find((b) => b.getAttribute('data-rpid-owner') === String(sub0.rpid_str));
    check('预加载子回复(.reply-item[data-id])注入', !!bs2 && bs2.textContent === 'IP属地：上海');
  } else check('（fixture 无子回复可断言）', false);
  const spot = b0 && b0.parentNode;
  check('注入位于官方预留渲染位 .time-location（E-TPL）', !!spot && spot.className.includes('time-location') && !!spot.querySelector('.reply-time') && spot.children[spot.children.indexOf(b0) - 1].classList.contains('reply-time'));
  const dup = {};
  bs.forEach((b) => { const k = b.getAttribute('data-rpid-owner'); dup[k] = (dup[k] || 0) + 1; });
  check('每 rpid 仅一枚标签（无重复）', Object.values(dup).every((n) => n === 1));
  const styles = env.document.querySelectorAll('style').filter((s) => s.id === 'bili-ipregion-style').length;
  check('样式表全局仅 1 份', styles === 1, '实际 ' + styles);
  check('无未捕获异常', env.errors.length === 0, JSON.stringify(env.errors.map(String)));
}

/* ============ B. 匿名/无字段降级：真实匿名抓包响应（无任何 location） ============ */
console.log('== B 无归属地：逐字匿名响应（E-02：reply_control 不含 location） ==');
{
  const env = makeEnv({ anon: true });
  const fx = makeAnonReplyMainFixture();
  const rs = fx.data.replies;
  env.body.innerHTML = '<div id="commentapp"><div class="comment-list">' + rs.map((r) => commentItemHtml(r.rpid_str, r.mid)).join('') + '</div></div>';
  vm.runInContext(SRC, env.sandbox, { filename: 'answer-v2.user.js' });
  settle(env); settle(env);
  const bs = badges(env);
  check('无真实标签（不误报）', bs.every((b) => b.getAttribute('data-bili-ipregion-badge') === 'placeholder'), JSON.stringify(texts(env)));
  check('接口覆盖到的每个条目 1 枚灰色占位', bs.length === rs.length && rs.every((r) => bs.filter((b) => b.getAttribute('data-rpid-owner') === String(r.rpid_str)).length === 1), 'badges=' + bs.length + ' items=' + rs.length);
  check('异常未抛出', env.errors.length === 0, JSON.stringify(env.errors.map(String)));
}

/* ============ C. 异步晚到 / shadow(open) / SPA 路由 / 幂等 ============ */
console.log('== C 异步晚到 + shadow(E-SHD open) + SPA 路由 + 幂等 ==');
{
  const env = makeEnv();
  env.body.innerHTML = '<div id="commentapp"><div class="comment-list"></div></div>';
  vm.runInContext(SRC, env.sandbox, { filename: 'answer-v2.user.js' });
  settle(env);
  check('条目未渲染时零注入（不打扰）', badges(env).length === 0);

  const fx = makeReplyMainFixture();
  const r0 = fx.data.replies[0];
  env.body.querySelector('.comment-list').innerHTML = commentItemHtml(r0.rpid_str, r0.mid);
  settle(env); settle(env);
  const b1 = badges(env).filter((b) => b.getAttribute('data-rpid-owner') === String(r0.rpid_str));
  check('异步晚到条目被注入（观察器+续扫生效）', b1.length === 1 && b1[0].textContent === 'IP属地：北京', JSON.stringify(texts(env)));

  env.flushMutations(); env.runTimers(); env.flushMutations(); env.runTimers(); env.flushMutations(); env.runTimers();
  check('6 轮更新后仍只 1 枚（幂等）', badges(env).length === 1);

  // shadow DOM 内条目（官方组件 mode:"open"）
  const r1 = fx.data.replies[1];
  const host = env.document.createElement('bili-comments-webview');
  const sr = host.attachShadow();
  const wrap = env.document.createElement('div');
  wrap.innerHTML = '<div class="comment-list">' + commentItemHtml(r1.rpid_str, r1.mid) + '</div>';
  sr.appendChild(wrap.children[0]);
  env.body.appendChild(host);
  settle(env); settle(env);
  const bsh = badges(env, sr).filter((b) => b.getAttribute('data-rpid-owner') === String(r1.rpid_str));
  check('open shadowRoot 内条目注入成功（穿透）', bsh.length === 1 && bsh[0].textContent === 'IP属地：河北', 'shadow badges=' + badges(env, sr).length);
  check('shadow 根内样式表 1 份', sr.querySelectorAll('style').length === 1);
  settle(env); settle(env);
  check('shadow 内重复扫描不叠加', badges(env, sr).length === 1);

  // SPA 路由：切换新视频（pushState + 新 aid）
  env.sandbox.__INITIAL_STATE__.aid = 170002;
  env.sandbox.history.pushState({}, '', '/video/BV1OTHER/');
  env.body.innerHTML = '<div id="commentapp"><div class="comment-list">' + commentItemHtml(r0.rpid_str, r0.mid) + '</div></div>';
  settle(env); settle(env); settle(env);
  check('路由后按新 oid 重新拉取', env.gmCalls.some((u) => /oid=170002/.test(u)));
  const afterRoute = badges(env, env.body);
  check('路由后条目重新注入且仅 1 枚', afterRoute.length === 1 && afterRoute[0].textContent === 'IP属地：北京', JSON.stringify(afterRoute.map((b) => b.textContent)));
  check('C 场景全程无未捕获异常', env.errors.length === 0, JSON.stringify(env.errors.map(String)));
}

/* ============ D. 降级：-403 / 无 GM 环境 ============ */
console.log('== D 降级：接口失败与零权限环境 ==');
{
  const env = makeEnv({ fail403: true });
  const fx = makeReplyMainFixture();
  env.body.innerHTML = '<div id="commentapp"><div class="comment-list">' + commentItemHtml(fx.data.replies[0].rpid_str, fx.data.replies[0].mid) + '</div></div>';
  vm.runInContext(SRC, env.sandbox, { filename: 'answer-v2.user.js' });
  settle(env); settle(env);
  check('-403：不注入任何标签（静默降级）', badges(env).length === 0, JSON.stringify(texts(env)));
  check('-403：无未捕获异常', env.errors.length === 0, JSON.stringify(env.errors.map(String)));
}
{
  const env = makeEnv({ noGM: true });
  env.body.innerHTML = '<div class="reply-item" data-ip-region="四川"><a class="name" href="//space.bilibili.com/9">甲</a><span>c</span></div>' +
    '<div class="comment-item"><span>无数据用户</span></div>';
  vm.runInContext(SRC, env.sandbox, { filename: 'answer-v2.user.js' });
  settle(env); settle(env);
  const bs = badges(env);
  check('零网络权限环境：本地 data-* 通道仍注入', bs.some((b) => b.textContent === 'IP属地：四川'), JSON.stringify(texts(env)));
  check('零网络权限环境：缺字段占位出现', bs.some((b) => b.textContent === '归属地未知'));
  check('零网络权限环境：无任何请求', env.gmCalls.length === 0);
}

/* ============ E. 静态审计 + v1 根因回归 ============ */
console.log('== E 静态审计 / 根因回归 ==');
{
  const meta = SRC.slice(0, SRC.indexOf('// ==/UserScript=='));
  check('元数据块完整（@name/@namespace/@match/@grant/@connect）', ['@name', '@namespace', '@match', '@grant', '@connect'].every((k) => meta.includes(k)));
  check('@connect 仅 api.bilibili.com 单域名', (meta.match(/@connect/g) || []).length === 1 && /@connect\s+api\.bilibili\.com/.test(meta));
  const code = SRC.replace(/^\s*\/\/.*$/gm, '');
  check('网络出口仅 GM_xmlhttpRequest→reply/main', /GM_xmlhttpRequest/.test(code) && !/XMLHttpRequest\(|fetch\(|WebSocket|sendBeacon/.test(code));
  check('无隐私持久化（localStorage/cookie/indexedDB/GM_setValue）', !/localStorage|document\.cookie|sessionStorage|indexedDB|GM_setValue/.test(code));
  check('零 TODO / 零第三方依赖', !/TODO|FIXME|import\s|require\(/.test(code));

  const env = makeEnv();
  const fx = makeReplyMainFixture();
  env.body.innerHTML = '<div id="commentapp"><div class="comment-list">' + fx.data.replies.slice(0, 2).map((r) => commentItemHtml(r.rpid_str, r.mid)).join('') + '</div></div>';
  vm.runInContext(V1SRC, env.sandbox, { filename: 'answer.user.js' });
  settle(env); settle(env);
  const v1real = badges(env).filter((b) => b.getAttribute('data-bili-ipregion-badge') === 'ok');
  check('回归对照：v1 在真实结构下 0 枚真实标签（根因复现）', v1real.length === 0, '实际 ' + v1real.length);
}

console.log('');
console.log('结果: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
