// ==UserScript==
// @name         B站 IP 归属地提示 (Bili IP Geo Badge)
// @namespace    https://example.org/bili-ip-geo-badge
// @version      1.0.0
// @description  在 B 站电脑端（www/space/live）页面展示公开页面数据中已返回的 IP 归属地（省级/市级，如“广东”）。适配 SPA 动态路由与异步内容加载：路由切换后自动重新识别且不重复插入；只读取页面或公开接口已返回的字段，字段缺失或网络失败时静默降级为灰色占位。不收集、不上传、不持久化任何用户数据。
// @author       qwen3.8-27b
// @match        https://www.bilibili.com/*
// @match        https://space.bilibili.com/*
// @match        https://live.bilibili.com/*
// @grant        none
// @connect      api.bilibili.com
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

/*
 * 设计说明：
 * - 数据只来自两处：
 *   1) 页面 DOM 中已经展示的 “IP属地：xx” 文案（优先取 UP 主/主播卡片区域，其次页面其他区域）；
 *   2) 视频页的公开接口 api.bilibili.com/x/web-interface/view 返回中已经存在的 ip_info 字段
 *      （已在元数据 @connect 中显式声明；credentials: omit，不携带任何凭据）。
 *   两处都拿不到时显示灰色占位，绝不推断或猜测精确位置。
 * - 全程有且仅有一个徽章节点（#bili-ip-geo-badge）：路由切换或锚点变化时只“移动”该节点，
 *   不删除重建，因此多次路由切换/DOM 更新不会重复插入。
 * - SPA 适配：MutationObserver（过滤脚本自身的 DOM 写入）+ history.pushState/replaceState
 *   包装 + popstate/hashchange 事件 + 1 秒低频 URL 轮询兜底，多路触发统一去抖。
 * - 防串页：路由切换后先显示灰色占位；每次扫描结束都会记录“旧页面内容签名”（锚点与
 *   正文的文本指纹，不含本脚本节点）。只有当内容与该签名真实不同（新内容已到达）时，
 *   才重新读取 DOM，避免把上一页面的残留文本误读为新页面的归属地；3 秒后兜底放行，
 *   防止极端情况下一直占位。
 * - 无特权（@grant none）：不申请任何 GM 系列特权，不写浏览器存储与 cookie，
 *   不发送携带用户凭据的请求，不上传任何数据。
 */
(function () {
  'use strict';

  /* ================= 常量 ================= */

  var BADGE_ID = 'bili-ip-geo-badge';
  var STYLE_ID = 'bili-ip-geo-style';
  var URLCHANGE = 'bili-ip-geo:urlchange';
  var SETTLE_TIMEOUT = 3000; // 路由切换后 DOM 未确认更新的兜底放行时间（毫秒）

  // 唯一的外部请求：B 站公开视频详情接口（无需登录），已在元数据 @connect 中声明
  var API_VIEW = 'https://api.bilibili.com/x/web-interface/view?bvid=';

  // 页面中 IP 归属地文案（兼容中英文冒号、冒号后带空格）
  var IP_TEXT_RE = /IP属地[：:]\s*([^\s<，,。.；;]{2,12})/;
  // 只接受“省份/地区”风格的短文本：2~12 个非数字、非空白、非引号/斜杠字符；
  // 坐标、编号、URL 等一律拒绝 —— 宁可占位，不猜测
  var LOCATION_RE = /^[^\d\s<>"'`\\\/|]{2,12}$/;
  var BANNED = ['未提供', '未知', '无', '—', '-', '--', 'N/A', 'null', 'undefined', '加载中', '获取中'];

  // 视频页：UP 主卡片区域的多代选择器（B 站改版频繁，按优先级依次尝试）
  var VIDEO_ANCHORS = ['.video-up', '.up-panel', '.bili-video-card', '.video-owner', '.up-area', '.up-info'];
  // 直播页：主播信息区域
  var LIVE_ANCHORS = ['.live-up-info', '.anchor-card', '.anchor-info', '.room-info'];

  var state = {
    routeKey: '',      // location.pathname：SPA 路由的识别键（忽略 query/hash 噪声）
    location: null,    // 当前已确认的归属地文本；null = 缺失/未决
    source: 'none',    // dom | api | none
    quality: 0,        // 2 = UP主/主播来源，1 = 页面其他区域，0 = 无
    apiTried: false,   // 当前路由是否已请求过公开接口（避免重复请求）
    pendingRoute: false, // 路由已切换、内容尚未确认更新
    pendingSince: 0,   // pending 开始时间（兜底放行用）
    lastAnchor: null,  // 上一次扫描结束时的锚点（即“旧页面”内容）
    lastAnchorSig: null, // 旧锚点内容签名
    lastBodySig: '',   // 旧正文内容签名
    timer: null,       // 扫描去抖定时器
    badge: null        // 唯一的徽章节点
  };

  var CSS =
    '#' + BADGE_ID +
    '{display:inline-flex;align-items:center;max-width:320px;overflow:hidden;text-overflow:ellipsis;' +
    'margin:2px 0;padding:1px 8px;font-size:12px;line-height:1.7;font-family:inherit;border-radius:10px;' +
    'white-space:nowrap;vertical-align:middle;user-select:none;' +
    'background:#f4f5f7;color:#61666d;border:1px solid #e3e5e7;}' +
    '#' + BADGE_ID + '.ip-geo--empty{background:#fafafa;color:#b2b5ba;border-color:#efefef;}' +
    '#' + BADGE_ID + '.ip-geo--fixed' +
    '{position:fixed;right:16px;bottom:132px;z-index:9999;box-shadow:0 1px 4px rgba(0,0,0,.10);}';

  /* ================= 基础工具 ================= */

  function looksLikeLocation(v) {
    if (typeof v !== 'string') return false;
    v = v.trim();
    if (!LOCATION_RE.test(v)) return false;
    for (var i = 0; i < BANNED.length; i++) {
      if (v === BANNED[i]) return false;
    }
    return true;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  // 只创建一次；之后任何“重插”都通过移动同一节点实现。
  // 注意：SPA 移除旧锚点卡片时徽章会暂时脱离文档，此时必须继续复用 state.badge
  // 指向的同一节点（它只是 detach，不是消失），绝不能重新创建，否则会重复插入。
  function ensureBadge() {
    if (state.badge) return state.badge;
    var old = null;
    try { old = document.getElementById(BADGE_ID); } catch (e) { old = null; }
    if (old) {
      try { old.remove(); } catch (e) { /* 忽略 */ } // 清理旧版本脚本的残留节点（一次性）
    }
    var b = document.createElement('div');
    b.id = BADGE_ID;
    b.className = 'ip-geo';
    b.setAttribute('data-src', 'none');
    b.classList.add('ip-geo--empty');
    b.textContent = 'IP属地：—';
    (document.body || document.documentElement).appendChild(b);
    state.badge = b;
    return b;
  }

  function pageKind() {
    try {
      if (location.hostname === 'live.bilibili.com') return 'live';
      if (/^\/video\//.test(location.pathname || '')) return 'video';
    } catch (e) { /* 忽略 */ }
    return 'other';
  }

  function getBvid() {
    var m = (location.pathname || '').match(/\/video\/(BV[0-9A-Za-z]+)/);
    return m ? m[1] : null;
  }

  // 兜底锚点：类名含 up/owner/anchor 且内含 <img>（头像）的容器
  function findAnchorFallback() {
    var re = /(up|owner|anchor)/i;
    function hasImg(el, depth) {
      if (!el || depth > 4) return false;
      for (var i = 0; i < el.children.length; i++) {
        var c = el.children[i];
        if (c.nodeType !== 1) continue;
        if (c.tagName === 'IMG') return true;
        if (hasImg(c, depth + 1)) return true;
      }
      return false;
    }
    function walk(el) {
      for (var i = 0; i < el.children.length; i++) {
        var c = el.children[i];
        if (c.nodeType !== 1) continue;
        var cn = c.className;
        if (typeof cn === 'string' && cn && re.test(cn) && hasImg(c, 0)) return c;
        var r = walk(c);
        if (r) return r;
      }
      return null;
    }
    return document.body ? walk(document.body) : null;
  }

  function findAnchor() {
    var kind = pageKind();
    var sels = kind === 'video' ? VIDEO_ANCHORS : kind === 'live' ? LIVE_ANCHORS : [];
    for (var i = 0; i < sels.length; i++) {
      try {
        var el = document.querySelector(sels[i]);
        if (el) return el;
      } catch (e) { /* 选择器异常则尝试下一个 */ }
    }
    return findAnchorFallback();
  }

  // 内容签名：子树文本拼接（跳过本脚本徽章，避免自写入干扰对比）
  function sigOf(el) {
    if (!el) return '';
    var out = [];
    (function walk(n, depth) {
      if (!n || depth > 40) return;
      for (var i = 0; i < n.children.length; i++) {
        var c = n.children[i];
        if (c === state.badge) continue;
        if (c.nodeType === 3) out.push(c.data);
        else walk(c, depth + 1);
      }
    })(el, 0);
    return out.join('|');
  }

  // 深度优先遍历文本节点，返回第一个“IP属地：xx”中的 xx（跳过本脚本自身节点）
  function firstLocationIn(root, skipEl) {
    if (!root) return null;
    var walker;
    try {
      walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    } catch (e) {
      return null;
    }
    var node = walker.nextNode();
    while (node) {
      var parent = node.parentNode || null;
      var isSelf = !!(skipEl && parent && parent.closest &&
        parent.closest('#' + BADGE_ID));
      if (!isSelf) {
        var m = IP_TEXT_RE.exec(node.data || '');
        if (m && looksLikeLocation(m[1])) return m[1].trim();
      }
      node = walker.nextNode();
    }
    return null;
  }

  // 从接口返回对象中读取“已存在”的归属地字段（字段不存在则返回 null，不猜测）
  function readIpInfo(obj) {
    if (!obj || typeof obj !== 'object') return null;
    var keys = ['ip_district', 'at', 'district', 'province', 'location'];
    for (var i = 0; i < keys.length; i++) {
      var v = obj[keys[i]];
      if (looksLikeLocation(v)) return v.trim();
    }
    return null;
  }

  // 视频页公开接口补位。只读取返回中已存在的 ip_info 字段；任何失败都静默返回 null。
  // 目标域名已声明于元数据 @connect api.bilibili.com；credentials: omit 不发送用户凭据。
  function fetchUploaderIp(bvid) {
    return fetch(API_VIEW + encodeURIComponent(bvid), {
      method: 'GET',
      credentials: 'omit',
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      if (!res || !res.ok) return null;
      return res.json();
    }).then(function (j) {
      if (!j || j.code !== 0 || !j.data) return null;
      var d = j.data;
      return readIpInfo(d.ip_info) ||
        readIpInfo(d.owner && d.owner.ip_info) ||
        readIpInfo(d.author && d.author.ip_info) ||
        null;
    }).catch(function () {
      return null; // 网络失败/解析失败：静默降级
    });
  }

  /* ================= 徽章渲染（单节点，只移动不重建） ================= */

  function showEmptyState(b) {
    if (b.textContent !== 'IP属地：—') b.textContent = 'IP属地：—';
    b.classList.add('ip-geo--empty');
    b.setAttribute('data-src', 'none');
  }

  function placeBadge(b) {
    var anchor = findAnchor();
    var target = anchor || document.body || document.documentElement;
    if (b.parentNode === target) return; // 已在正确位置：零 DOM 变更
    target.appendChild(b); // 移动同一节点 —— 任意时刻全页有且仅有一个徽章
    b.classList.toggle('ip-geo--fixed', !anchor); // 无锚点时用右下角小芯片，避开回顶按钮
  }

  function render() {
    var b = ensureBadge();
    placeBadge(b);
    if (state.location) {
      var txt = 'IP属地：' + state.location;
      if (b.textContent !== txt) b.textContent = txt; // 值未变则不写 DOM（避免自触发循环）
      b.classList.remove('ip-geo--empty');
      b.setAttribute('data-src', state.source);
    } else {
      showEmptyState(b);
    }
  }

  /* ================= 扫描主流程 ================= */

  function scan() {
    var key = location.pathname || '';
    var routeChanged = key !== state.routeKey;
    if (routeChanged) {
      state.routeKey = key;
      state.location = null;
      state.source = 'none';
      state.quality = 0;
      state.apiTried = false;
      state.pendingRoute = true;
      state.pendingSince = Date.now();
    }

    var b = ensureBadge();
    showEmptyState(b); // 先置灰：路由切换瞬间不残留上一页面的归属地

    if (state.pendingRoute) {
      var now = Date.now();
      if (now - state.pendingSince > SETTLE_TIMEOUT) {
        state.pendingRoute = false; // 兜底：长时间未确认更新则放行，避免永远占位
      } else {
        // 与上一次扫描结束时记录的“旧页面”签名对比：内容真实变化才放行
        var a1 = findAnchor();
        if (a1) {
          // 当前锚点与旧锚点不是同一节点、或内容已变化 → 新内容已到达
          state.pendingRoute = (a1 === state.lastAnchor) && (sigOf(a1) === state.lastAnchorSig);
        } else {
          // 无锚点页面：正文内容变化即视为新内容已到达
          state.pendingRoute = !(document.body && sigOf(document.body) !== state.lastBodySig);
        }
      }
    }

    // 1) 页面 DOM 中已展示的归属地（优先 UP 主/主播卡片，其次页面其他区域）
    if (!state.pendingRoute) {
      var found = null;
      var quality = 0;
      var anchor = findAnchor();
      if (anchor) {
        found = firstLocationIn(anchor, b);
        if (found) quality = 2;
      }
      if (!found) {
        found = firstLocationIn(document.body, b);
        if (found) quality = 1;
      }
      if (found && quality >= state.quality) {
        state.location = found;
        state.quality = quality;
        state.source = 'dom';
      }
    }

    // 2) 视频页：公开接口补位（仅当 DOM 未给出 UP 主级来源时请求，且每路由最多一次）
    var bvid = getBvid();
    if (bvid && !state.apiTried && (!state.location || state.quality < 2)) {
      state.apiTried = true;
      var navKey = key;
      fetchUploaderIp(bvid).then(function (v) {
        // 回调落地时若路由已再次变化，则丢弃本次结果，防止串页
        if (v && (location.pathname || '') === navKey && getBvid() === bvid &&
          (!state.location || state.quality < 2)) {
          state.location = v;
          state.quality = 2;
          state.source = 'api';
          render();
        }
      });
    }

    render();

    // 记录“旧页面”内容签名（供下次路由切换对比；签名不含徽章自身）
    var aEnd = findAnchor();
    state.lastAnchor = aEnd;
    state.lastAnchorSig = aEnd ? sigOf(aEnd) : null;
    state.lastBodySig = document.body ? sigOf(document.body) : '';
  }

  function scheduleScan(delay) {
    if (state.timer) return; // 同一时刻至多一个待执行扫描（合并高频 DOM 抖动）
    state.timer = setTimeout(function () {
      state.timer = null;
      try {
        scan();
      } catch (e) { /* 静默降级：任何异常都不打扰用户 */ }
    }, typeof delay === 'number' && delay >= 0 ? delay : 200);
  }

  /* ================= SPA 适配 ================= */

  // 判断一条 MutationRecord 是否由本脚本自身产生（徽章文本/类名/移动）
  function isSelfRecord(r) {
    var b = state.badge;
    if (!b) return false;
    function insideBadge(n) {
      if (!n) return false;
      if (n === b) return true;
      var p = n.parentNode;
      while (p) {
        if (p === b) return true;
        p = p.parentNode;
      }
      return false;
    }
    var t = r.target;
    if (t === b || (t && t.nodeType === 3 && t.parentNode === b)) return true;
    var added = r.addedNodes || [];
    var removed = r.removedNodes || [];
    for (var i = 0; i < added.length; i++) if (!insideBadge(added[i])) return false;
    for (var j = 0; j < removed.length; j++) if (!insideBadge(removed[j])) return false;
    return true;
  }

  function startObserver() {
    if (typeof MutationObserver !== 'function') return;
    var root = document.body || document.documentElement;
    if (!root) return;
    try {
      new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          if (!isSelfRecord(records[i])) {
            scheduleScan(200); // 真实内容变化：触发重扫（是否采信由内容签名判定）
            return;
          }
        }
        // 全部为脚本自身写入：不触发重扫，避免自触发循环
      }).observe(root, { childList: true, subtree: true, characterData: true });
    } catch (e) { /* 忽略 */ }
  }

  function wrapHistory() {
    var names = ['pushState', 'replaceState'];
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var orig = window.history && window.history[name];
      if (typeof orig !== 'function') continue;
      (function (origFn, n) {
        window.history[n] = function () {
          var r = origFn.apply(this, arguments);
          try {
            window.dispatchEvent(new Event(URLCHANGE));
          } catch (e) { /* 忽略 */ }
          return r;
        };
      })(orig, name);
    }
  }

  function startPolling() {
    // 兜底：个别框架不触发 popstate 时，靠 1 秒低频轮询识别 pathname 变化
    // （只比对本地 URL 字符串，不读取、不发送任何用户数据）
    setInterval(function () {
      try {
        if ((location.pathname || '') !== state.routeKey) scheduleScan(0);
      } catch (e) { /* 忽略 */ }
    }, 1000);
  }

  /* ================= 初始化 ================= */

  function init() {
    ensureStyle();
    wrapHistory();
    state.routeKey = location.pathname || '';
    window.addEventListener('popstate', function () { scheduleScan(0); }, false);
    window.addEventListener('hashchange', function () { scheduleScan(0); }, false);
    window.addEventListener(URLCHANGE, function () { scheduleScan(0); }, false);
    startObserver();
    startPolling();
    scheduleScan(0); // 首屏：DOM 已就绪，立即渲染
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); }, { once: true });
  } else {
    init();
  }
})();

