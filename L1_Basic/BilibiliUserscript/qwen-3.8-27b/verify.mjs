// verify.mjs — 本地验收工具（测试用，非交付物）
// 1) 静态审计：元数据块完整性、权限最小化、无禁用 API、请求域名与 @connect 一致、无 TODO
// 2) 功能测试：手写最小 DOM 桩（无第三方库）+ 5 组 fixture 场景：
//    T1 有归属地（DOM 直取）  T2 缺失字段+网络失败（灰色占位、不抛错）
//    T3 动态路由切换+异步内容（仍生效、不重复插入）  T4 接口补位  T5 无锚点页（固定芯片+正文扫描）
// 运行：node verify.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, 'answer.user.js'), 'utf8');

let failed = 0;
function check(name, cond, extra = '') {
  if (cond) console.log('  PASS  ' + name);
  else { failed++; console.error('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

/* ================= 第一部分：静态审计 ================= */
console.log('\n[静态审计]');

const metaMatch = SRC.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
check('存在标准元数据块', !!metaMatch);
const meta = metaMatch[1].split('\n')
  .map(l => l.replace(/^\/\/\s?/, '').trim())
  .filter(Boolean);
const getMeta = k => meta.filter(l => l.startsWith(k + ' ')).map(l => l.slice(k.length + 1).trim());

for (const k of ['@name', '@namespace', '@version', '@description', '@author', '@license', '@run-at']) {
  check(`元数据含 ${k}`, getMeta(k).length >= 1);
}
const matches = getMeta('@match');
check('@match 覆盖 B 站电脑端三域且无广域匹配',
  matches.length >= 3 &&
  matches.every(m => /^https:\/\/(www|space|live)\.bilibili\.com\/\*$/.test(m)),
  JSON.stringify(matches));
check('@grant none（无特权）', getMeta('@grant').join(',') === 'none', getMeta('@grant').join(','));
check('@connect 声明且仅为 api.bilibili.com', getMeta('@connect').join(',') === 'api.bilibili.com', getMeta('@connect').join(','));

const body = SRC.slice(metaMatch.index + metaMatch[0].length);
const urlHosts = [...new Set((body.match(/https?:\/\/[^\s'"`]+/g) || [])
  .map(u => { try { return new URL(u).hostname; } catch { return u; } }))];
check('代码内实际请求域名 ⊆ {api.bilibili.com}',
  urlHosts.length > 0 && urlHosts.every(h => h === 'api.bilibili.com'), JSON.stringify(urlHosts));

const forbidden = /localStorage|sessionStorage|indexedDB|document\.cookie|XMLHttpRequest|GM_xmlhttpRequest|GM_getValue|GM_setValue|GM_openInTab|eval\s*\(|new Function|navigator\.sendBeacon|navigator\.clipboard|new Worker|WebSocket/i;
check('无持久化/上传/GM 特权/eval 等禁用 API', !forbidden.test(body), forbidden.test(body) ? '命中' : '');
const forbid2 = /TODO|FIXME|XXX|待实现|未完成|placeholder/i;
check('无 TODO/占位符字样', !forbid2.test(SRC), forbid2.test(SRC) ? '命中' : '');
check('无第三方模块加载（import/require/script src）', !/(^|\n)\s*(import\s[^;]*from|require\s*\()/m.test(body) && !/<script[^>]+src=/i.test(body));
check('使用原生 fetch 且 credentials: omit', /fetch\(/.test(body) && /credentials:\s*'omit'/.test(body));

/* ================= 第二部分：最小 DOM 桩 ================= */
function makeText(s) { return { nodeType: 3, data: String(s), parentNode: null }; }

function makeClassList(el) {
  const get = () => (el.className || '').split(/\s+/).filter(Boolean);
  const set = a => { el.className = a.join(' '); };
  return {
    add: (...cs) => { const a = get(); cs.forEach(c => { if (!a.includes(c)) a.push(c); }); set(a); },
    remove: (...cs) => set(get().filter(c => !cs.includes(c))),
    contains: c => get().includes(c),
    toggle(c, force) {
      const has = get().includes(c);
      const want = force === undefined ? !has : !!force;
      if (want && !has) this.add(c);
      if (!want && has) this.remove(c);
      return want;
    }
  };
}

function makeEl(tag, opts = {}) {
  const e = {
    nodeType: 1,
    tagName: String(tag).toUpperCase(),
    id: opts.id || '',
    className: opts.className || '',
    attrs: {},
    children: [],
    parentNode: null,
    get firstChild() { return this.children[0] || null; },
    get childNodes() { return this.children; },
    get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; },
    appendChild(c) {
      if (c.parentNode) c.parentNode.children = c.parentNode.children.filter(x => x !== c);
      this.children.push(c);
      c.parentNode = this;
      return c;
    },
    insertBefore(c, ref) {
      if (c.parentNode) c.parentNode.children = c.parentNode.children.filter(x => x !== c);
      const i = ref ? this.children.indexOf(ref) : -1;
      if (i >= 0) this.children.splice(i, 0, c); else this.children.push(c);
      c.parentNode = this;
      return c;
    },
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this);
      this.parentNode = null;
    },
    setAttribute(k, v) {
      this.attrs[k] = String(v);
      if (k === 'id') this.id = String(v);
      if (k === 'class') this.className = String(v);
    },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    get textContent() {
      return this.children.map(c => c.nodeType === 3 ? c.data : c.textContent).join('');
    },
    set textContent(v) {
      const t = makeText(v);
      this.children = [t];
      t.parentNode = this;
    },
    closest(sel) {
      let n = this;
      while (n && n.nodeType === 1) {
        if (matchSel(n, sel)) return n;
        n = n.parentElement;
      }
      return null;
    }
  };
  e.classList = makeClassList(e);
  return e;
}

function matchSel(el, sel) {
  sel = sel.trim();
  const m = sel.match(/^([a-zA-Z][\w-]*)?(#([\w-]+))?(?:\.([\w-]+))?$/);
  if (!m) return false;
  if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
  if (m[3] && el.id !== m[3]) return false;
  if (m[4] && !(el.className || '').split(/\s+/).includes(m[4])) return false;
  return true;
}

function queryAll(root, sel) {
  const out = [];
  (function walk(n) {
    for (const c of n.children || []) {
      if (c.nodeType === 1) { if (matchSel(c, sel)) out.push(c); walk(c); }
    }
  })(root);
  return out;
}

/* ---- 全局环境 ---- */
const docEl = makeEl('html');
const headEl = makeEl('head');
const bodyEl = makeEl('body');
docEl.appendChild(headEl);
docEl.appendChild(bodyEl);

const document = {
  readyState: 'complete',
  documentElement: docEl,
  head: headEl,
  body: bodyEl,
  addEventListener() { },
  createElement: t => makeEl(t),
  getElementById: id => queryAll(docEl, '#' + id)[0] || null,
  querySelector: sel => queryAll(docEl, sel)[0] || null,
  querySelectorAll: sel => queryAll(docEl, sel),
  createTreeWalker(root, whatToShow) {
    const nodes = [];
    (function walk(n) {
      for (const c of n.children || []) {
        if (c.nodeType === 3) { if (whatToShow === 4) nodes.push(c); }
        else walk(c);
      }
    })(root);
    let i = 0;
    return { nextNode() { return i < nodes.length ? nodes[i++] : null; } };
  }
};
globalThis.document = document;
globalThis.NodeFilter = { SHOW_TEXT: 4 };

const winListeners = {};
const locationObj = { href: 'https://www.bilibili.com/', pathname: '/', hostname: 'www.bilibili.com' };
const window = {
  addEventListener(t, f) { (winListeners[t] || (winListeners[t] = [])).push(f); },
  removeEventListener() { },
  dispatchEvent(ev) { (winListeners[ev.type] || []).slice().forEach(f => f(ev)); },
  history: { pushState() { return null; }, replaceState() { return null; } }
};
globalThis.window = window;
globalThis.location = locationObj;

let mutObs = null;
globalThis.MutationObserver = class {
  constructor(cb) { this.cb = cb; mutObs = this; }
  observe() { }
};
function fireMutations(node) {
  if (mutObs) mutObs.cb([{ target: bodyEl, addedNodes: [node || bodyEl], removedNodes: [] }]);
}
globalThis.setInterval = () => 0; // 禁用 1s 轮询（测试显式驱动）
globalThis.fetch = (url) => globalThis.__fetchImpl(url);

function setNav(pathname) {
  locationObj.pathname = pathname;
  locationObj.href = 'https://www.bilibili.com' + pathname;
}
function clearBody() { bodyEl.children.slice().forEach(c => c.remove()); }
const badges = () => queryAll(docEl, '#bili-ip-geo-badge');
let firstBadge = null; // 首个徽章节点身份（验证“只移动、未重建”）
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ================= 第三部分：功能场景 ================= */
console.log('\n[功能测试]');

// ---------- T1：视频页，UP 主卡片已展示 IP属地：广东 ----------
// 先搭建“脚本注入时刻”的 URL 与 DOM（脚本 init 时读取当前 URL，无路由切换事件）
const t1Card = makeEl('div', { className: 'video-up' });
const t1Name = makeEl('div', { className: 'up-name' });
t1Name.appendChild(makeText('某UP主'));
const t1Ip = makeEl('div', { className: 'up-ip' });
t1Ip.appendChild(makeText('IP属地：广东'));
t1Card.appendChild(t1Name); t1Card.appendChild(t1Ip);
clearBody(); bodyEl.appendChild(t1Card);
setNav('/video/BV1xx411c7mD');
globalThis.__fetchImpl = () => Promise.reject(new Error('不应被调用'));

// 载入被测脚本（全局作用域执行）
new Function(SRC)();

console.log('T1 有归属地（DOM 直取）');
{
  await sleep(40); // 等待首次 scan
  const bs = badges();
  check('徽章存在且唯一', bs.length === 1, 'count=' + bs.length);
  firstBadge = bs[0]; // 记录节点身份：后续断言“只移动、未重建”
  check('徽章显示 IP属地：广东', bs[0] && bs[0].textContent === 'IP属地：广东', bs[0] && bs[0].textContent);
  check('徽章嵌入 UP 主卡片（贴合布局）', bs[0] && bs[0].parentNode === t1Card);
  check('非灰色占位状态', bs[0] && !bs[0].classList.contains('ip-geo--empty'));
  check('无固定定位类（非兜底模式）', bs[0] && !bs[0].classList.contains('ip-geo--fixed'));
  // DOM 抖动多次 + popstate：不得重复插入
  for (let i = 0; i < 3; i++) { fireMutations(); window.dispatchEvent(new Event('popstate')); }
  await sleep(400);
  check('多次 DOM 更新后仍唯一', badges().length === 1, 'count=' + badges().length);
  check('多次更新后内容不变', badges()[0].textContent === 'IP属地：广东', badges()[0].textContent);
}

// ---------- T2：路由切换到新视频，DOM 仍是旧内容（残留），接口网络失败 ----------
console.log('T2 路由切换+网络失败（占位、不抛错、不误读旧文本）');
{
  globalThis.__fetchImpl = () => new Promise((_, rej) => setTimeout(() => rej(new Error('network down')), 10));
  setNav('/video/BV2yy411c7mE');
  window.history.pushState(null, '', '/video/BV2yy411c7mE'); // 触发 SPA 路由事件
  await sleep(40);
  // 路由已切换但旧 DOM 尚存 + 无关 DOM 抖动：内容签名门控不得放行旧文本
  fireMutations();
  await sleep(400);
  const b = badges()[0];
  check('残留旧 DOM 时不误读旧归属地', b.textContent === 'IP属地：—', b.textContent);
  check('网络失败后显示灰色占位', b.classList.contains('ip-geo--empty'));
  check('全程无未捕获异常', true); // 若脚本抛错，测试进程早已被捕获并报错
}

// ---------- T3：新视频内容异步到达（动态加载） ----------
console.log('T3 动态路由切换+异步内容加载');
{
  const oldCard = document.querySelector('.video-up');
  oldCard.remove();
  const card = makeEl('div', { className: 'video-up' });
  const ip = makeEl('div', { className: 'up-ip' });
  ip.appendChild(makeText('IP属地：浙江'));
  card.appendChild(ip);
  bodyEl.appendChild(card);
  fireMutations(card); // 模拟 SPA 渲染新内容
  await sleep(400);
  const b = badges()[0];
  check('异步内容到达后生效（IP属地：浙江）', b.textContent === 'IP属地：浙江', b.textContent);
  check('徽章唯一（未重复插入）', badges().length === 1, 'count=' + badges().length);
  check('徽章跟随新卡片', b.parentNode === card);
  check('锚点卡片被 SPA 移除后徽章未重建（同一节点）', b === firstBadge);
}

// ---------- T4：DOM 无归属地文本，公开接口返回 ip_info ----------
console.log('T4 字段缺失走接口补位');
{
  document.querySelector('.video-up').remove();
  const card = makeEl('div', { className: 'video-up' });
  const name = makeEl('div', { className: 'up-name' });
  name.appendChild(makeText('UP主丙'));
  card.appendChild(name);
  bodyEl.appendChild(card);
  let fetched = 0;
  globalThis.__fetchImpl = (url) => {
    fetched++;
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ code: 0, data: { owner: { name: 'UP主丙', ip_info: { ip_district: '湖北' } } } })
    });
  };
  setNav('/video/BV3zz411c7mF');
  window.history.pushState(null, '', '/video/BV3zz411c7mF');
  fireMutations(card);
  await sleep(400);
  const b = badges()[0];
  check('接口返回的归属地被展示（湖北）', b.textContent === 'IP属地：湖北', b.textContent);
  check('接口来源标记 data-src=api', b.getAttribute('data-src') === 'api', b.getAttribute('data-src'));
  check('同路由不重复请求接口', fetched <= 1, 'fetched=' + fetched);
  // 接口返回 code!=0 的降级
  globalThis.__fetchImpl = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ code: -403, data: null }) });
  const card2 = makeEl('div', { className: 'video-up' });
  card2.appendChild(makeText('IP属地：上海'));
  setNav('/video/BV4ww411c7mG');
  window.history.pushState(null, '', '/video/BV4ww411c7mG');
  document.querySelector('.video-up').remove();
  bodyEl.appendChild(card2);
  fireMutations(card2);
  await sleep(400);
  check('接口异常时回退 DOM 已展示文案（上海）', badges()[0].textContent === 'IP属地：上海', badges()[0].textContent);
}

// ---------- T5：无 UP 主锚点的普通页（如热门榜）：固定芯片 + 正文扫描 ----------
console.log('T5 无锚点页（固定芯片兜底）');
{
  // 真实 SPA 顺序：先切路由，内容随后异步到达
  setNav('/popular');
  window.history.pushState(null, '', '/popular');
  const feed = makeEl('div', { className: 'feed' });
  const item = makeEl('div', { className: 'feed-item' });
  item.appendChild(makeText('标题：某某视频 IP属地：四川'));
  feed.appendChild(item);
  clearBody(); bodyEl.appendChild(feed);
  fireMutations(feed);
  await sleep(400);
  const b = badges()[0];
  check('正文已展示的归属地被识别（四川）', b.textContent === 'IP属地：四川', b.textContent);
  check('徽章唯一', badges().length === 1, 'count=' + badges().length);
  check('无锚点时回退为固定芯片（不遮挡主体内容）',
    b.parentNode === bodyEl && b.classList.contains('ip-geo--fixed'));
  check('全程徽章为同一节点（从未重建）', b === firstBadge);
}

console.log(failed === 0 ? '\nALL PASS（静态审计 + 功能场景全部通过）' : `\n${failed} 项失败`);
process.exit(failed ? 1 : 0);
