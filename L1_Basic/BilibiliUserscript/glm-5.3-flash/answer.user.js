// ==UserScript==
// @name         B站评论区 IP 归属地展示助手
// @name:en      bilibili Comment IP Location Helper
// @namespace    urn:userscript:bili-iploc-helper
// @version      2.0.0
// @description  以灰色小字就地补充展示 B 站已返回的评论者 IP 属地（省级）。数据三源均为透传：页面已渲染的 IP 属地文本（含 Shadow DOM）、页面自身评论接口响应的被动监听、以及 api.bilibili.com 公开只读 GET 回退。SPA 路由切换/异步加载后持续生效，幂等注入、静默降级、零存储、零上传、零推断。
// @description:en  Relay province-level IP location text already returned by bilibili as an inline grey tag: native rendered text, passive listen of page reply-API responses, one public GET fallback to api.bilibili.com. SPA-aware, idempotent, silent degradation, zero storage/upload/inference.
// @author       benchmark-model
// @license      MIT
// @match        https://www.bilibili.com/*
// @match        https://t.bilibili.com/*
// @match        https://space.bilibili.com/*
// @grant        none
// @connect      api.bilibili.com
// @run-at       document-start
// @noframes
// ==/UserScript==

/*
 * ===================== v2 · 以真实快照校准 =====================
 * 全部结构假设以 reference/ 下 5 个实抓快照为准（偏移号见 NOTES.md 映射表）：
 *  snap-video-av170001.html   SSR：window.__INITIAL_STATE__.aid=170001；
 *                             评论区挂载壳 <div id="commentapp"> 为空容器（动态注入）
 *  api-reply-av170001.json    未登录 code=0 实抓：replies[]（含嵌套 replies 子回复、
 *                             root!=0 者 7/10）；reply_control 键集合中 location 不存在
 *                             （未登录响应不下发该字段）
 *  comp-new-comment.min.js    渲染器（attachShadow=0，jQuery 式 light DOM 渲染）：
 *    - 主楼层模板  '<div class="list-item reply-wrap ..." data-id="' + item.rpid + ...
 *    - 楼中楼模板  '<div class="reply-item reply-wrap" data-id="' + item.rpid + '"...
 *                  （均 data-id=item.rpid，紧跟 data-index=i）
 *    - 信息区      '<div class="info">' > '<span class="time-location">' >
 *                  '<span class="reply-time">'
 *    - IP 属地原生渲染点（当前线上已被注释停用）：
 *      // item?.reply_control?.location ? `<span class="reply-location">IP属地：${...}</span>` : ''
 *      ⇒ 字段路径=reply_control.location（值为省份级裸文本），
 *        类名=.reply-location，位置=.time-location 内、.reply-time 之后
 *    - 容器链 CSS：".comment-list .list-item .reply-box .reply-item"；this.$root.find('.reply-box .reply-item')
 *  comp-bili-comments.js      webview 组件脚本含 attachShadow(mode:"open") —— 评论组件
 *                             未来形态可能迁入 open Shadow Root，故扫描层做通用
 *                             「light DOM + 递归 open shadowRoot」双路径，不依赖单一形态
 *
 * 数据通路（三条均为透传，零推断）：
 *  P1 被动监听：document-start 包一层 window.fetch，凡 URL 含 /x/v2/reply 的页面自身
 *     请求，clone 后只读解析 data.replies 递归吸收（免 wbi/风控/会话差异，零额外请求）
 *  P2 显式回退：唯一主动外呼，GET https://api.bilibili.com/x/v2/reply?type=&oid=&pn=
 *     （REQ#2 实测 code=0；credentials:'omit' 最小化凭据暴露；失败连续 3 次闩锁停呼）
 *  P3 DOM 透传：item 内已有 .reply-location 或任意「IP属地」文本即认定原生已展示跳过
 *
 * 权限最小化：@grant none，不用 GM_* 特权 API；外呼域已在 @connect 显式声明。
 *
 * 工程说明：核心处理函数全部写成对「节点外观对象」的通用操作，浏览器 DOM 与
 * _selftest/minidom.js 桩共用同一代码路径；文件可在 Node 环境 require 做纯逻辑与
 * fixture 回放自测（末尾导出分支），浏览器中该分支不存在、自动走 boot()。
 * ================================================================
 */
(function () {
  'use strict';

  /* ------------------------------ 常量（全部有快照出处） ------------------------------ */

  var TAG_CLASS = 'bili-iploc-tag';
  var TAG_NA_CLASS = 'bili-iploc-tag--na';
  var TAG_VALUE_ATTR = 'data-iploc-value';
  var API_BASE = 'https://api.bilibili.com';
  var PLACEHOLDER = '--'; // 条目已知存在但接口未含 IP 字段时的灰色占位
  var DEBOUNCE_MS = 180;
  var REQ_TIMEOUT_MS = 6000;
  var NET_FAIL_LIMIT = 3; // 连续失败达此数后本路由内停止主动外呼（静默降级）

  var IP_RE = /IP\s*属\s*地/;

  // 条目判别标记类（comp-new-comment.min.js:278089 主楼 / :306976 楼中楼模板原文）
  var ITEM_TOP_CLASSES = ['list-item', 'reply-wrap'];  // 主楼：list-item reply-wrap
  var ITEM_SUB_CLASSES = ['reply-item', 'reply-wrap']; // 楼中楼：reply-item reply-wrap

  // 徽标宿主候选链（按原生邻近度排序，均出自渲染器模板原文）：
  //   time-location(.info>.time-location>:283394) > info(:283340) > user/con 容器 > userInfo(楼中楼)
  var HOST_CANDIDATES = ['time-location', 'info', 'user', 'userInfo'];

  // 原生已展示判别类（模板原文 reply-location；现状被注释，若上线则直接复用原生展示）
  var NATIVE_IP_CLASS = 'reply-location';

  // 浏览器端根级查询（light DOM；组件未来入 shadow 时由 BFS 兜底覆盖）
  var ITEM_QUERY = [
    '#commentapp .list-item.reply-wrap',
    '#commentapp .reply-item.reply-wrap',
    '.comment-list .list-item.reply-wrap',
    '.comment-list .reply-item.reply-wrap',
    '#commentapp .list-item',
    '#commentapp .reply-item'
  ].join(',');

  // 内联徽标样式（元素级注入，light/shadow 两界通用；贴合原布局不遮挡控件）
  var BADGE_CSS_TEXT =
    'display:inline-block;margin-left:6px;padding:0 2px;' +
    'font-size:12px;line-height:18px;color:#9499A0;font-weight:400;vertical-align:middle;' +
    'white-space:nowrap;pointer-events:none;user-select:none;-webkit-user-select:none;opacity:.85';
  var BADGE_NA_EXTRA = 'color:#C9CDD4';

  var TAP_FLAG = '__biliIplocTapped';

  /* --------------------- 纯逻辑层（与 v1 契约一致，可独立自测） --------------------- */

  /** 归一化归属地：「IP属地：广东」->「广东」；裸省份原样透传；无法解析返回 ''（零推断）。 */
  function normalizeLocation(raw) {
    if (typeof raw !== 'string') return '';
    var s = raw.replace(/\s+/g, ' ').trim();
    s = s.replace(/^IP\s*属\s*地\s*[:：]?\s*/, '');
    s = s.replace(/[:：]\s*$/, '').trim();
    return s;
  }

  /**
   * 从接口返回的单条评论对象中提取 {rpid, mid, location}。
   * 字段路径唯一依据真实快照：reply_control.location（值为省份级裸文本，
   * 见 comp-new-comment.min.js:283542 模板；api-reply 快照未登录时无此键 → '' 已知缺失）。
   */
  function extractEntry(reply) {
    if (!reply || typeof reply !== 'object') return null;
    var rc = reply.reply_control && typeof reply.reply_control === 'object' ? reply.reply_control : {};
    var mp = reply.member && typeof reply.member === 'object' ? reply.member : {};

    var raw = typeof rc.location === 'string' && rc.location.trim() ? rc.location : undefined;

    return {
      rpid: reply.rpid !== undefined && reply.rpid !== null ? String(reply.rpid) : '',
      mid: mp.mid !== undefined && mp.mid !== null ? String(mp.mid) : '',
      location: raw === undefined ? '' : normalizeLocation(raw)
    };
  }

  /**
   * 将接口 replies 数组（含嵌套子回复）吸收进映射表。byRpid/byMid: Map<string,string>；
   * 空串值为「已知缺失」，未出现的键为「未知」（未知条目永远不动）。
   */
  function buildMaps(replies, byRpidMap, byMidMap) {
    var mR = byRpidMap || new Map();
    var mM = byMidMap || new Map();
    function walk(r) {
      if (!r || typeof r !== 'object') return;
      var e = extractEntry(r);
      if (e && e.rpid && /^\d+$/.test(e.rpid)) {
        if (!mR.has(e.rpid)) mR.set(e.rpid, e.location);
        if (e.mid && /^\d+$/.test(e.mid) && !mM.has(e.mid)) mM.set(e.mid, e.location);
      }
      if (Array.isArray(r.replies)) for (var i = 0; i < r.replies.length; i++) walk(r.replies[i]);
    }
    if (Array.isArray(replies)) for (var j = 0; j < replies.length; j++) walk(replies[j]);
    return { byRpid: mR, byMid: mM };
  }

  /**
   * 由当前路径解析评论目标 {type,oid}，供 P2 回退请求取参：
   * 仅在能从 URL / __INITIAL_STATE__ 确凿取得 oid 时返回（BV 号不做本地换算，零推断）。
   * type=1 视频(av) 12=专栏(cv) 17=动态/图文(opus)，为 B 站公开接口参数语义；
   * 本次实抓证据仅覆盖 type=1（snap-video-av170001.html），其余分支保留兼容但
   * 局限披露：非视频页主要由 P1 被动监听/P3 DOM 透传覆盖，不依赖本函数。
   */
  function resolveTarget(pathname, hostname, initialState) {
    var p = String(pathname || '');
    var m;
    if (hostname === 't.bilibili.com') {
      m = p.match(/^\/(\d{6,})(?:[/?#]|$)/);
      return m ? { type: 17, oid: m[1] } : null;
    }
    m = p.match(/^\/video\/av(\d+)/i);
    if (m) return { type: 1, oid: m[1] };
    m = p.match(/^\/video\/(BV[0-9A-Za-z]{8,})/);
    if (m) {
      var st = initialState && typeof initialState === 'object' ? initialState : {};
      var aid = st.aid || (st.videoData && st.videoData.aid);
      return aid ? { type: 1, oid: String(aid) } : null;
    }
    m = p.match(/^\/read\/cv(\d+)/i);
    if (m) return { type: 12, oid: m[1] };
    m = p.match(/^\/opus\/(\d+)/i);
    if (m) return { type: 17, oid: m[1] };
    return null;
  }

  /**
   * 幂等决策核心（v1 契约不变）。
   * facts.existing : 已注入徽标状态 {value,na} 或 null
   * facts.resolved : 归属地串 | ''(已知缺失) | undefined(映射中尚无该条目)
   * facts.netBlocked : 连续网络失败达上限 → 对未知条目静默不动
   * 返回 action ∈ noop | wait | silent | ensure（ensure 携带 value/na）。
   */
  function decide(facts) {
    var ex = facts.existing || null;
    var r = facts.resolved;
    var blocked = !!facts.netBlocked;
    if (typeof r === 'undefined') {
      if (blocked) return { action: 'silent' };
      return { action: 'wait' };
    }
    var na = !r;                    // 空串 → 已知缺失 → 灰占位
    var value = na ? PLACEHOLDER : r;
    if (ex && ex.value === value && ex.na === na) return { action: 'noop' };
    return { action: 'ensure', value: value, na: na };
  }

  /* ------------- 通用节点工具（真实 DOM 与 minidom 桩共用同一代码路径） ------------- */

  function isElementLike(n) {
    return !!n && typeof n === 'object' && (n.nodeType === undefined || n.nodeType === 1);
  }

  function childrenOf(n) {
    var out = [];
    if (!isElementLike(n)) return out;
    if (n.shadowRoot && n.shadowRoot.childNodes) {
      for (var s = 0; s < n.shadowRoot.childNodes.length; s++) out.push(n.shadowRoot.childNodes[s]);
    }
    if (n.childNodes) for (var i = 0; i < n.childNodes.length; i++) out.push(n.childNodes[i]);
    return out;
  }

  function leafValue(n) {
    // 文本叶子节点取值兼容（真实 DOM: nodeValue/data；桩: text/textContent 叶子）
    if (n.nodeValue != null) return String(n.nodeValue);
    if (typeof n.data === 'string') return n.data;
    if ((n.nodeType === undefined || n.nodeType === 1) && !n.childNodes && typeof n.textContent === 'string') {
      return n.textContent;
    }
    return '';
  }

  /** 深度优先聚合元素内可见文本（穿透 open Shadow Root；替代原生 textContent 以兼容桩环境）。 */
  function getText(node) {
    var buf = [];
    (function rec(n) {
      var kids = childrenOf(n);
      if (!kids.length) { buf.push(leafValue(n)); return; }
      buf.push(leafValue(n));
      for (var i = 0; i < kids.length; i++) rec(kids[i]);
    })(node);
    return buf.join('');
  }

  function getAttr(node, name) {
    try { var v = node.getAttribute ? node.getAttribute(name) : null; return v == null ? '' : String(v); }
    catch (e) { return ''; }
  }

  function hasAllClasses(node, names) {
    var cl = node.classList;
    if (!cl || typeof cl.contains !== 'function') return false;
    for (var i = 0; i < names.length; i++) if (!cl.contains(names[i])) return false;
    return true;
  }

  function classifyItem(node) {
    if (!isElementLike(node)) return '';
    if (hasAllClasses(node, ITEM_TOP_CLASSES)) return 'top';
    if (hasAllClasses(node, ITEM_SUB_CLASSES)) return 'sub';
    return '';
  }

  /** 深度优先查找首个满足谓词的后代元素（open shadow 内一并覆盖）。 */
  function findDescendant(root, pred) {
    var stack = childrenOf(root);
    while (stack.length) {
      var n = stack.shift();
      if (!isElementLike(n)) continue;
      if (pred(n)) return n;
      var kids = childrenOf(n);
      for (var i = kids.length - 1; i >= 0; i--) stack.unshift(kids[i]);
    }
    return null;
  }

  function findByIdClass(root, cls) { return findDescendant(root, function (n) { return n.classList && n.classList.contains(cls); }); }

  /* --------------------------- 运行期状态 --------------------------- */

  var byRpid = new Map();          // rpid -> province(''|value)；仅内存，路由切换清空
  var byMid = new Map();           // mid  -> province（兜底映射）
  var mainFetched = new Set();     // P2 已请求过的 "type:oid"（无论成败闩锁防重试风暴）
  var netFailStreak = 0;
  var nativeSeen = new WeakSet();  // 原生已展示 IP 属地的条目（幂等标记位，永真终态）
  var scanTimer = 0;
  var scanning = false;
  var routeEpoch = 0;              // 路由切换代际，丢弃陈旧响应

  function inNetBlocked() { return netFailStreak >= NET_FAIL_LIMIT; }
  function markResult(ok) {
    netFailStreak = ok ? 0 : Math.min(netFailStreak + 1, NET_FAIL_LIMIT);
  }

  function lookupResolved(ids) {
    if (ids.rpid && byRpid.has(ids.rpid)) return byRpid.get(ids.rpid);
    if (ids.mid && byMid.has(ids.mid)) return byMid.get(ids.mid);
    return undefined;
  }

  /**
   * 接口 payload 吸收（P1 tap / P2 回退共用）。code===0 且含 data.replies 才算有效；
   * 吸收成功后请求一次重扫。返回是否吸收成功。
   */
  function absorbPayload(json) {
    try {
      if (!json || json.code !== 0 || !json.data || !Array.isArray(json.data.replies)) return false;
      buildMaps(json.data.replies, byRpid, byMid);
      markResult(true);
      debounceSchedule(30); // 吸收新映射后立即重扫一次（经防抖合并）
      return true;
    } catch (e) { return false; }
  }

  /* --------------------- 条目识别与徽标注入（通用节点版） --------------------- */

  function getIdFromNode(item) {
    var v = getAttr(item, 'data-id'); // 渲染器模板：data-id="' + item.rpid + '"
    return /^\d{4,20}$/.test(v) ? v : '';
  }

  function midFromSpaceLink(item) {
    var a = findDescendant(item, function (n) {
      return String(n.tagName || '').toUpperCase() === 'A' &&
        /space\.bilibili\.com\/(\d+)/.test(getAttr(n, 'href'));
    });
    if (!a) return '';
    var m = getAttr(a, 'href').match(/space\.bilibili\.com\/(\d+)/);
    return m ? m[1] : '';
  }

  function identifyIds(item) {
    return { rpid: getIdFromNode(item), mid: midFromSpaceLink(item) };
  }

  function findHostInItem(item) {
    for (var i = 0; i < HOST_CANDIDATES.length; i++) {
      var h = findByIdClass(item, HOST_CANDIDATES[i]);
      if (h) return h;
    }
    return null;
  }

  function getExistingBadge(item) {
    var b = findByIdClass(item, TAG_CLASS);
    if (!b) return null;
    var na = b.classList.contains(TAG_NA_CLASS);
    return {
      node: b,
      value: b.getAttribute ? b.getAttribute(TAG_VALUE_ATTR) : '',
      na: na
    };
  }

  /** 注入/复用徽标：已存在则原地更新（绝不二次插入）；textContent 写入无注入面。 */
  function applyBadgeInto(host, item, d) {
    var existing = getExistingBadge(item);
    var b = existing ? existing.node : createElementSafe();
    if (!existing) {
      b.className = TAG_CLASS;
      if (host.appendChild) host.appendChild(b);
    }
    setText(b, 'IP属地：' + d.value);
    setAttrSafe(b, TAG_VALUE_ATTR, d.value);
    setAttrSafe(b, 'title', d.na ? '' : '发布者 IP 属地（来自 B 站公开数据）');
    if (b.classList) {
      if (d.na) { b.classList.add(TAG_NA_CLASS); b.setAttribute('style', BADGE_CSS_TEXT + ';' + BADGE_NA_EXTRA); }
      else { b.classList.remove(TAG_NA_CLASS); b.setAttribute('style', BADGE_CSS_TEXT); }
    } else {
      b.setAttribute('style', BADGE_CSS_TEXT + (d.na ? ';' + BADGE_NA_EXTRA : ''));
    }
  }

  function setText(node, txt) {
    if (typeof node.textContent !== 'undefined' || typeof node.appendChild === 'function') {
      node.textContent = txt; // 真实 DOM 与桩均支持赋值式 textContent（桩内部实现为叶子替换）
      return;
    }
  }

  function setAttrSafe(node, k, v) {
    if (node.setAttribute) { try { node.setAttribute(k, v); } catch (e) {} }
    else if (node.attributes) node.attributes[k] = v;
  }

  function createElementSafe() {
    // 仅在浏览器引导层使用 document.createElement；桩测试通过传入工厂覆写本函数引用
    return ENV.document.createElement('span');
  }

  /**
   * 单条目处理（核心；不触碰任何全局浏览器对象，可被桩直接驱动）。
   * 返回 'native'(原生已展示) | 'done'(注入/noop) | 'defer'(等数据/结构就绪) | 'silent'(降级不动)。
   */
  function processItemNode(item) {
    // 先查自家旧徽标：其文本含「IP属地」属于脚本自身产物，
    // 必须走既有徽标的幂等更新路径，而不得误判为「原生已展示」
    var earlyExisting = getExistingBadge(item);
    if (!earlyExisting) {
      if (nativeSeen.has(item)) return 'native';
      if (findByIdClass(item, NATIVE_IP_CLASS) || IP_RE.test(getText(item))) {
        nativeSeen.add(item); return 'native'; // 原生已展示则不打扰（v2 依据：reply-location 为原生气泡类）
      }
    }

    var host = findHostInItem(item);
    if (!host) return earlyExisting ? 'done' : 'defer';

    var ids = identifyIds(item);
    var resolved = lookupResolved(ids);
    var d = decide({
      existing: earlyExisting,
      resolved: resolved,
      netBlocked: inNetBlocked()
    });

    if (d.action === 'ensure') { applyBadgeInto(host, item, d); return 'done'; }
    if (d.action === 'noop') return 'done';
    if (d.action === 'silent') return 'silent';
    return 'defer';
  }

  /* ---------------------- 浏览器引导层（仅此层触碰全局环境） ---------------------- */

  var ENV = { window: null, document: null }; // boot()/测试注入；其余代码零全局依赖

  function bindEnvironment(win, doc) { ENV.window = win; ENV.document = doc; }

  function debounceSchedule(ms) {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(function () { scanTimer = 0; scan(); }, ms || DEBOUNCE_MS);
  }

  /** 遍历可及根：light DOM 文档根 + 递归发现的每个 open ShadowRoot。 */
  function forEachReachableRoot(cb) {
    if (!ENV.document || !ENV.document.documentElement) return;
    cb(ENV.document);
    var queue = [ENV.document.documentElement];
    while (queue.length) {
      var el = queue.shift();
      if (!el || typeof el !== 'object') continue;
      if (el.shadowRoot && !el.shadowRoot.__biliIplocObserved) {
        el.shadowRoot.__biliIplocObserved = true;
        cb(el.shadowRoot);
        registerObserverOn(el.shadowRoot);
      }
      var lists = [];
      if (el.children) for (var i = 0; i < el.children.length; i++) lists.push(el.children[i]);
      if (el.childNodes) for (var j = 0; j < el.childNodes.length; j++) lists.push(el.childNodes[j]);
      for (var k = 0; k < lists.length; k++) queue.push(lists[k]);
    }
  }

  function collectItems() {
    var out = [], seen = new Set();
    forEachReachableRoot(function (root) {
      var nodes = null;
      try { nodes = root.querySelectorAll ? root.querySelectorAll(ITEM_QUERY) : null; } catch (e) { nodes = null; }
      if (!nodes) return;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (!seen.has(n)) { seen.add(n); out.push(n); }
      }
    });
    return out;
  }

  /* ------------------------------ 扫描 ------------------------------ */

  function scan() {
    if (scanning || !ENV.document || !ENV.document.body) return;
    scanning = true;
    try {
      var items = collectItems();
      var waitingAny = false;
      for (var i = 0; i < items.length; i++) {
        if (processItemNode(items[i]) === 'defer') waitingAny = true;
      }
      // P2 回退：仅在确能取得 type/oid、且该目标尚未尝试过时发起一次
      if (waitingAny) {
        var t = resolveTarget(String(ENV.window.location.pathname), String(ENV.window.location.hostname), pageState());
        if (t) refreshMain(t);
      }
    } finally {
      scanning = false;
    }
  }

  function pageState() {
    try { return ENV.window.__INITIAL_STATE__ || null; } catch (e) { return null; }
  }

  /* ----------------------------- 网络层 ----------------------------- */

  function mainListUrl(t) {
    return API_BASE + '/x/v2/reply?type=' + encodeURIComponent(t.type) +
      '&oid=' + encodeURIComponent(t.oid) + '&pn=1&ps=20&sort=1';
  }

  /**
   * P2 显式回退：只读 GET（api-reply 快照实测 code=0 免签名端点），6s 超时，
   * credentials:'omit' 最小化凭据暴露；无论成败均闩锁防重试风暴；异常全部吞掉。
   */
  function refreshMain(target) {
    try {
      var key = target.type + ':' + target.oid;
      if (mainFetched.has(key)) return Promise.resolve(false);
      mainFetched.add(key);
      var epoch = routeEpoch;
      var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { try { ctl.abort(); } catch (e) {} }, REQ_TIMEOUT_MS) : 0;
      return ENV.window.fetch(mainListUrl(target), {
        method: 'GET', credentials: 'omit', signal: ctl ? ctl.signal : undefined
      }).then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res || !res.ok || epoch !== routeEpoch) { markResult(false); return false; }
        return res.json().then(function (json) {
          if (epoch !== routeEpoch) return false; // 路由已切换，丢弃陈旧响应
          var ok = absorbPayload(json);
          if (!ok) markResult(false);
          return ok;
        }).catch(function () { markResult(false); return false; });
      }).catch(function () {
        if (timer) clearTimeout(timer);
        markResult(false); return false;
      });
    } catch (e) { return Promise.resolve(false); }
  }

  /**
   * P1 被动监听：包装 window.fetch，凡页面自身对评论接口的请求都 clone 后只读吸收。
   * 不改写返回值、不发额外请求；url 过滤子串 /x/v2/reply 同时覆盖 legacy 与 wbi 变体。
   */
  function installNetworkTap() {
    try {
      var W = ENV.window;
      if (!W || typeof W.fetch !== 'function' || W.fetch[TAP_FLAG]) return;
      var orig = W.fetch;
      var wrapped = function () {
        var args = arguments;
        var input = args[0];
        var url = '';
        try { url = typeof input === 'string' ? input : (input && input.url) || ''; } catch (e) {}
        var pr = orig.apply(this, args);
        try {
          if (url && url.indexOf('/x/v2/reply') !== -1) {
            pr.then(function (res) {
              try {
                if (res && res.clone) res.clone().json().then(absorbPayload).catch(function () {});
              } catch (e) {}
            }).catch(function () {});
          }
        } catch (e) {}
        return pr;
      };
      wrapped[TAP_FLAG] = true;
      W.fetch = wrapped;
    } catch (e) {}
  }

  /* ------------------------- 观察器 / 路由 / 引导 ------------------------- */

  var sharedObserver = null;

  function registerObserverOn(target) {
    try {
      if (!sharedObserver || !target) return;
      if (target.__biliIplocObservedOn) return;
      target.__biliIplocObservedOn = true;
      sharedObserver.observe(target, { childList: true, subtree: true });
    } catch (e) {}
  }

  function onRouteChange() {
    // 换页即丢内存缓存与失败计数：省请求且保证新页数据新鲜（零持久化）
    byRpid.clear(); byMid.clear();
    mainFetched.clear();
    netFailStreak = 0;
    routeEpoch++;
    debounceSchedule(50);
  }

  function hookHistory() {
    var W = ENV.window;
    if (!W || !W.history) return;
    ['pushState', 'replaceState'].forEach(function (k) {
      var orig = W.history[k];
      if (typeof orig !== 'function' || orig.__biliIplocHooked) return;
      var wrapped = function () {
        var ret = orig.apply(this, arguments);
        onRouteChange();
        return ret;
      };
      wrapped.__biliIplocHooked = true;
      W.history[k] = wrapped;
    });
    W.addEventListener('popstate', onRouteChange);
    W.addEventListener('hashchange', onRouteChange);
  }

  function boot() {
    bindEnvironment(window, document);
    installNetworkTap(); // 尽早安装，抢在页面应用首评请求之前

    sharedObserver = new MutationObserver(function () { debounceSchedule(); });
    if (document.body) registerObserverOn(document.body);
    else document.addEventListener('DOMContentLoaded', function () {
      registerObserverOn(document.body);
      debounceSchedule(40);
    });

    hookHistory();
    setInterval(function () { debounceSchedule(); }, 3000); // 兜底轮询（经防抖合并，开销极小）
    debounceSchedule(60);
  }

  /* ---------------- Node 自测导出（浏览器不经过；v1 兼容 + v2 扩展） ---------------- */

  var internalsForTest = {
    /* v1 契约导出（53 断言依赖） */
    normalizeLocation: normalizeLocation,
    extractEntry: extractEntry,
    buildMaps: buildMaps,
    resolveTarget: resolveTarget,
    decide: decide,
    IP_RE: IP_RE,
    PLACEHOLDER: PLACEHOLDER,
    /* v2 扩展 */
    MARKERS: {
      ITEM_TOP_CLASSES: ITEM_TOP_CLASSES,
      ITEM_SUB_CLASSES: ITEM_SUB_CLASSES,
      HOST_CANDIDATES: HOST_CANDIDATES,
      NATIVE_IP_CLASS: NATIVE_IP_CLASS
    },
    classifyItem: classifyItem,
    getText: getText,
    getAttr: getAttr,
    findDescendant: findDescendant,
    findByIdClass: findByIdClass,
    identifyIds: identifyIds,
    processItemNode: processItemNode,
    applyBadgeInto: applyBadgeInto,
    absorbPayload: absorbPayload,
    markResult: markResult,
    inNetBlocked: inNetBlocked,
    stateSnapshot: function () { return { byRpidSize: byRpid.size, byMidSize: byMid.size, blocked: inNetBlocked(), fetched: mainFetched.size }; },
    resetForTest: function () {
      byRpid = new Map(); byMid = new Map();
      mainFetched = new Set();
      netFailStreak = 0; scanning = false; scanTimer = 0; routeEpoch++;
      nativeSeen = new WeakSet();
    },
    setTestEnv: bindEnvironment
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = internalsForTest;
    return;
  }

  boot();
})();
