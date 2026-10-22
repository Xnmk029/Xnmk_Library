'use strict';
/*
 * 边界场景验证：针对契约里容易出错的形态单独加压。
 * 覆盖：bbComment 以不可配置属性定义、原型方法后置、Vue 深层组件树、
 *       shadow root 稍后附加、属地字段被清空/换值、原生标签让位。
 * 该文件仅用于验证，不属于交付物。
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(__dirname, 'harness', 'node_modules', 'jsdom'));

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = fs.readFileSync(path.join(ROOT, 'answer.user.js'), 'utf8');
const TAG = '.bili-ip-region-tag';

const checks = [];
function check(name, cond, extra) {
  checks.push({ name, ok: !!cond, extra: extra === undefined ? '' : String(extra) });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* fetch 夹具必须在注入脚本前安装，否则会覆盖脚本的被动观察包装 */
function makeDom(fixture) {
  const vc = new VirtualConsole();
  const pageErrors = [];
  vc.on('jsdomError', (e) => pageErrors.push(e && e.message));
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="stage"></div></body></html>', {
    url: 'https://www.bilibili.com/video/BV1xx411c7mD',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const w = dom.window;
  const payloads = fixture ? fixture.slice() : [];
  w.__requested = [];
  w.fetch = (input) => {
    const url = String(typeof input === 'string' ? input : (input && input.url) || '');
    w.__requested.push(url);
    const payload = payloads.length ? payloads.shift() : { code: 0, data: { replies: [] } };
    return Promise.resolve({
      status: 200,
      url: url,
      headers: { get: () => 'application/json' },
      clone: function () {
        return {
          status: 200,
          url: url,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(payload)
        };
      },
      json: () => Promise.resolve(payload)
    });
  };
  w.eval(SCRIPT);
  return { w, d: w.document, pageErrors };
}

function textOf(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : null; }
function tagIn(el) { return el ? el.querySelector(TAG) : null; }

async function main() {
  /* ---- 1. bbComment：不可配置属性（页面用 defineProperty 定义，替换脚本的 setter）
   *      且原型方法在构造函数之后补齐，随后才渲染。 ---- */
  {
    const { w, d, pageErrors } = makeDom();
    function Bb() {}
    /* 不可配置：脚本的 window 访问器会被页面的定义覆盖 */
    Object.defineProperty(w, 'bbComment', { configurable: false, enumerable: true, value: Bb, writable: true });
    /* 注入后才挂原型方法（早于渲染） */
    Bb.prototype._createListCon = function (item) {
      return '<div class="reply-wrap" data-id="' + item.rpid_str + '">' +
        '<div class="comment-body">x</div>' +
        '<div class="info"><span class="reply-time">t</span><button>回复</button><button>更多</button></div></div>';
    };
    Bb.prototype._createSubReplyItem = function (item) {
      return '<div class="sub-reply-item" data-id="' + item.rpid_str + '">' +
        '<div class="comment-body">x</div>' +
        '<div class="info"><span class="reply-time">t</span><button>回复</button><button>更多</button></div></div>';
    };
    await sleep(1300);   /* 等兜底检查发现并包装原型方法 */
    const bb = new w.bbComment();
    const main = { rpid_str: '9007199254741200', reply_control: { location: 'IP属地：天津' }, content: { message: 'x' } };
    const sub = { rpid_str: '9007199254741201', reply_control: { location: 'IP属地：宁夏' }, content: { message: 'x' } };
    d.getElementById('stage').innerHTML =
      bb._createListCon(main, 0, 'main') + bb._createSubReplyItem(sub, 0);
    await sleep(1400);
    const mainInfo = d.querySelector('.reply-wrap .info');
    const subInfo = d.querySelector('.sub-reply-item .info');
    check('edge bb non-configurable + late proto', textOf(tagIn(mainInfo)) === 'IP属地：天津',
      textOf(tagIn(mainInfo)));
    check('edge bb subreply', textOf(tagIn(subInfo)) === 'IP属地：宁夏', textOf(tagIn(subInfo)));
    check('edge bb preserves controls',
      mainInfo.querySelectorAll('button').length === 2 && subInfo.querySelectorAll('button').length === 2);
    check('edge bb one tag each',
      mainInfo.querySelectorAll(TAG).length === 1 && subInfo.querySelectorAll(TAG).length === 1);
    check('edge bb no page errors', pageErrors.length === 0, pageErrors.join('|'));
  }

  /* ---- 2. Vue 深层组件树（只有 app._instance 里的 vnode.el 指向元素） ---- */
  {
    const { w, d, pageErrors } = makeDom();
    const reply = { rpid_str: '9007199254741201', reply_control: { location: 'IP属地：重庆' }, content: { message: 'v' } };
    const item = d.createElement('div');
    item.className = 'reply-item';
    item.setAttribute('data-id', reply.rpid_str);
    item.innerHTML = '<div class="comment-body">v</div>' +
      '<div class="reply-info"><span class="reply-time">t</span><button>回复</button><button>更多</button></div>';
    d.getElementById('stage').appendChild(item);

    /* 构造一棵最小 Vue 3 组件树，让某个实例的 subTree.el === item */
    const leaf = { props: { reply }, vnode: { props: { reply } } };
    leaf.subTree = { el: item, component: null, children: [] };
    const mid = { subTree: { el: null, component: leaf, children: [] } };
    const root = { subTree: { el: null, component: mid, children: [] } };
    item.__vue_app__ = { _instance: root };
    await sleep(1400);
    check('edge vue deep instance tree', textOf(tagIn(item.querySelector('.reply-info'))) === 'IP属地：重庆',
      textOf(tagIn(item.querySelector('.reply-info'))));
    check('edge vue deep one tag', item.querySelectorAll(TAG).length === 1);
    check('edge vue deep no page errors', pageErrors.length === 0, pageErrors.join('|'));
  }

  /* ---- 3. 属地清空 -> 移除旧值；再换值 -> 更新 ---- */
  {
    const { w, d } = makeDom();
    const reply = { rpid_str: '9007199254741202', reply_control: { location: 'IP属地：辽宁' }, content: { message: 'v' } };
    const item = d.createElement('div');
    item.className = 'reply-item';
    item.innerHTML = '<div class="reply-info"><span class="reply-time">t</span><button>回复</button><button>更多</button></div>';
    item.__vueParentComponent = { props: { reply } };
    d.getElementById('stage').appendChild(item);
    await sleep(1400);
    const info = item.querySelector('.reply-info');
    check('edge initial value', textOf(tagIn(info)) === 'IP属地：辽宁', textOf(tagIn(info)));

    /* 清空成空字符串 */
    item.__vueParentComponent = { props: { reply: { rpid_str: reply.rpid_str, reply_control: { location: '' }, content: {} } } };
    await sleep(1400);
    check('edge cleared becomes pending', textOf(tagIn(info)) === 'IP属地：未获取', textOf(tagIn(info)));
    check('edge cleared keeps single tag', info.querySelectorAll(TAG).length === 1);

    /* 删除字段 */
    item.__vueParentComponent = { props: { reply: { rpid_str: reply.rpid_str, content: {} } } };
    await sleep(1400);
    check('edge removed field pending', textOf(tagIn(info)) === 'IP属地：未获取', textOf(tagIn(info)));

    /* 换值 */
    item.__vueParentComponent = { props: { reply: { rpid_str: reply.rpid_str, reply_control: { location: 'IP属地：山西' }, content: {} } } };
    await sleep(1400);
    check('edge new value applied', textOf(tagIn(info)) === 'IP属地：山西', textOf(tagIn(info)));
  }

  /* ---- 4. 原生标签出现后让位；原生标签消失后恢复 ---- */
  {
    const { w, d } = makeDom();
    const reply = { rpid_str: '9007199254741203', reply_control: { location: 'IP属地：安徽' }, content: { message: 'v' } };
    const item = d.createElement('div');
    item.className = 'reply-item';
    item.innerHTML = '<div class="reply-info"><span class="reply-time">t</span>' +
      '<button>回复</button><button>更多</button></div>';
    item.__vueParentComponent = { props: { reply } };
    d.getElementById('stage').appendChild(item);
    await sleep(1400);
    const info = item.querySelector('.reply-info');
    check('edge tag before native', info.querySelectorAll(TAG).length === 1);

    /* 页面渲染出原生属地标签 */
    const native = d.createElement('span');
    native.id = 'location';
    native.textContent = 'IP属地：北京';
    info.appendChild(native);
    await sleep(1400);
    check('edge native wins', info.querySelectorAll(TAG).length === 0, info.querySelectorAll(TAG).length);
    check('edge native preserved', textOf(info.querySelector('#location')) === 'IP属地：北京');

    /* 原生标签被移除后，脚本标签恢复 */
    info.removeChild(native);
    await sleep(1400);
    check('edge tag restored after native gone', info.querySelectorAll(TAG).length === 1,
      info.querySelectorAll(TAG).length);
    check('edge restored value correct', textOf(tagIn(info)) === 'IP属地：安徽', textOf(tagIn(info)));
  }

  /* ---- 5. 大整数 ID 不被舍入：两条相邻 ID 不能串味 ---- */
  {
    const a = { rpid_str: '9007199254740992', rpid: 9007199254740992, reply_control: { location: 'IP属地：广东' }, content: {} };
    const b = { rpid_str: '9007199254740993', rpid: 9007199254740992, reply_control: { location: 'IP属地：湖北' }, content: {} };
    /* 页面自身的回复请求先取回两条评论（夹具在注入前装好，脚本只被动观察） */
    const { w, d } = makeDom([{ code: 0, data: { replies: [a, b] } }]);
    const mk = (reply) => {
      const el = d.createElement('div');
      el.className = 'reply-item';
      el.setAttribute('data-id', reply.rpid_str);
      el.innerHTML = '<div class="reply-info"><span class="reply-time">t</span><button>回复</button><button>更多</button></div>';
      d.getElementById('stage').appendChild(el);
      return el;
    };
    const ea = mk(a);
    const eb = mk(b);
    /* 页面自身发起请求；脚本只被动读取克隆响应，不自己请求 */
    await w.fetch('https://api.bilibili.com/x/v2/reply/main?oid=1&type=1');
    await sleep(1400);
    check('edge big id A', textOf(tagIn(ea.querySelector('.reply-info'))) === 'IP属地：广东',
      textOf(tagIn(ea.querySelector('.reply-info'))));
    check('edge big id B', textOf(tagIn(eb.querySelector('.reply-info'))) === 'IP属地：湖北',
      textOf(tagIn(eb.querySelector('.reply-info'))));
    check('edge big ids not conflated',
      textOf(tagIn(ea.querySelector('.reply-info'))) !== textOf(tagIn(eb.querySelector('.reply-info'))));
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({
    total: checks.length, passed: checks.length - failed.length, failed: failed.length,
    failures: failed
  }, null, 2));
  console.log('\n==== ' + (failed.length === 0 ? 'EDGE CASES PASSED' : 'EDGE CASE FAILURES') + ' ====');
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e && e.stack || e); process.exit(2); });
