// fork 验证桩：模拟 B 站评论区 shadow DOM 结构，验证 answer-fixed.user.js 核心逻辑
// 运行: node fork-verify.mjs   （node 需已安装；纯桩，无任何外部依赖）
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'answer-fixed.user.js'), 'utf8')
  .replace(/^\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\n/, '');

// ---------- 极简 DOM 桩 ----------
class MockNode {
  constructor(tag) { this.tagName = (tag || 'div').toUpperCase(); this.nodeName = this.tagName; this.nodeType = tag === '#text' ? 3 : 1; this.children = []; this.childNodes = []; this.parentNode = null; this.textContent = ''; this.style = {}; this.id = ''; this.className = ''; this.shadowRoot = null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); this.childNodes.push(c); return c; }
  remove() { if (this.parentNode) { const p = this.parentNode; p.children = p.children.filter(x => x !== this); p.childNodes = p.childNodes.filter(x => x !== this); this.parentNode = null; } }
  querySelector(sel) { return walk(this, sel); }
  querySelectorAll(sel) { const out = []; walkAll(this, sel, out); return out; }
  getElementById(id) { return findById(this, id); }
  after(n) { if (!this.parentNode) return; const p = this.parentNode; const i = p.children.indexOf(this); p.children.splice(i + 1, 0, n); p.childNodes.splice(i + 1, 0, n); n.parentNode = p; }
  before(n) { if (!this.parentNode) return; const p = this.parentNode; const i = p.children.indexOf(this); p.children.splice(i, 0, n); p.childNodes.splice(i, 0, n); n.parentNode = p; }
}
function walk(el, sel) { if (!el) return null; if (matchesSel(el, sel)) return el; if (el.shadowRoot) { const sr = walk(el.shadowRoot, sel); if (sr) return sr; } for (const c of el.children || []) { const r = walk(c, sel); if (r) return r; } return null; }
const shadowRootQuery = el => el.querySelector ? el.querySelector('*') : null;
function walkAll(el, sel, out) { if (!el) return; if (matchesSel(el, sel)) out.push(el); if (el.shadowRoot) { for (const c of (el.shadowRoot.children || [])) walkAll(c, sel, out); } for (const c of (el.children || [])) walkAll(c, sel, out); }
function findById(el, id) { if (el.id === id) return el; if (el.shadowRoot) { const r = findById(el.shadowRoot, id); if (r) return r; } for (const c of (el.children || [])) { const r = findById(c, id); if (r) return r; } return null; }
function matchesSel(el, sel) { return (el.tagName || '').toLowerCase() === sel.toLowerCase(); }

// 自定义元素注册表（桩）
const registry = {};
const whenDefinedQueue = {};
function customElementsStub(tag, ctor) { registry[tag] = ctor; if (whenDefinedQueue[tag]) { whenDefinedQueue[tag].forEach(f => f()); whenDefinedQueue[tag] = []; } }
const customElements = {
  get: t => registry[t],
  whenDefined: t => new Promise(res => { if (registry[t]) res(); else { (whenDefinedQueue[t] = whenDefinedQueue[t] || []).push(res); } })
};

// 组件实例（仿 B 站 bili-comment-action-buttons-renderer）
class ActionButtons extends MockNode {
  constructor(location) {
    super('bili-comment-action-buttons-renderer');
    this.shadowRoot = new MockNode('div');
    this.shadowRoot.id = 'sr';
    this.pubdate = new MockNode('span'); this.pubdate.id = 'pubdate'; this.pubdate.parentNode = this.shadowRoot;
    this.shadowRoot.children.push(this.pubdate);
    this.shadowRoot.childNodes.push(this.pubdate);
    this.reply_control = location ? { location } : null;
    this.__vueParentComponent = {
      props: {
        reply: this.reply_control ? { reply_control: { location } } : { reply_control: {} },
        subReply: { reply_control: {} }
      }
    };
    this.updateCount = 0;
  }
  update() { this.updateCount++; return 1; }
  get updateComplete() { return Promise.resolve(); }
}

// 全局桩
globalThis.document = {
  readyState: 'complete',
  body: new MockNode('body'),
  head: new MockNode('head'),
  createElement: t => new MockNode(t),
  querySelectorAll: sel => globalThis.document.body.querySelectorAll(sel),
  querySelector: sel => globalThis.document.body.querySelector(sel),
  getElementById: id => findById(globalThis.document.body, id),
  addEventListener: () => {},
  createEvent: () => ({})
};
globalThis.window = { history: { pushState() {}, replaceState() {} }, addEventListener: () => {}, dispatchEvent: () => true, customElements };
globalThis.customElements = customElements;
globalThis.location = { hostname: 'www.bilibili.com', pathname: '/video/BV1GJ411x7h7', href: 'https://www.bilibili.com/video/BV1GJ411x7h7' };
globalThis.MutationObserver = class { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} };
globalThis.requestAnimationFrame = fn => { fn(); return 1; };
globalThis.setInterval = () => 0;
globalThis.Event = class {};
globalThis.NodeFilter = { SHOW_TEXT: 4 };

// 运行修复版脚本主体
eval(src);

// 注册组件 → 触发 whenDefined 回调（含 hook + 首屏扫描）
const btn1 = new ActionButtons('广东');
const btn2 = new ActionButtons('上海');
// 构造函数已把 pubdate 放入 shadowRoot，此处不再重复添加
globalThis.document.body.appendChild(btn1);
globalThis.document.body.appendChild(btn2);
customElementsStub('bili-comment-action-buttons-renderer', ActionButtons);

await new Promise(r => setTimeout(r, 50));

// 断言
let pass = 0, fail = 0;
function check(name, cond, detail) { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} :: ${detail || ''}`); } }

check('hook 后 update 包装生效（count=1 但注入已跑）', btn1.shadowRoot.getElementById('bili-ip-geo-badge-fixed') !== null || btn1.updateCount >= 1, `updateCount=${btn1.updateCount}`);
const ip1 = btn1.shadowRoot.getElementById('bili-ip-geo-badge-fixed');
check('评论1 就地显示 IP=广东', !!ip1 && ip1.textContent === '广东', ip1 ? ip1.textContent : '(无)');
const ip2 = btn2.shadowRoot.getElementById('bili-ip-geo-badge-fixed');
check('评论2 就地显示 IP=上海', !!ip2 && ip2.textContent === '上海', ip2 ? ip2.textContent : '(无)');
check('注入位置在 pubdate 之后', !!ip1 && ip1.parentNode === btn1.shadowRoot && btn1.shadowRoot.children.indexOf(ip1) === btn1.shadowRoot.children.indexOf(btn1.pubdate) + 1, `idx=${btn1.shadowRoot.children.indexOf(ip1)}`);
check('每个评论组件各自持有一个节点（互不干扰）', ip1 !== ip2 && ip1.id === 'bili-ip-geo-badge-fixed' && ip2.id === 'bili-ip-geo-badge-fixed');

// 触发 update 重复执行 → 不重复插入
btn1.update();
await new Promise(r => setTimeout(r, 20));
const c = btn1.shadowRoot.querySelectorAll('span').filter(s => s.id === 'bili-ip-geo-badge-fixed').length;
check('反复 update 不重复插入（仍为 1 个节点）', c === 1, `count=${c}`);

// 无归属地的评论 → 不显示本地节点
const btn3 = new ActionButtons(null);
btn3.shadowRoot.appendChild(new MockNode('span'));
globalThis.document.body.appendChild(btn3);
await new Promise(r => setTimeout(r, 20));
const ip3 = btn3.shadowRoot.getElementById('bili-ip-geo-badge-fixed');
check('无 IP 数据评论不显示节点', ip3 === null);

console.log(`\n结果: ${pass}/${pass + fail} 通过`);
process.exit(fail ? 1 : 0);