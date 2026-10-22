// ==UserScript==
// @name         Bilibili IP 属地标注助手
// @name:en      Bilibili IP Location Badge
// @namespace    ox-alpha.userscripts.bilibili-ip-location
// @version      1.0.0
// @description  在 B 站桌面端就地展示公开接口已返回的 IP 归属地。纯被动实现：仅解析页面自身请求的响应，零额外网络请求、零数据收集、零持久化；完整支持 SPA 动态路由与异步内容加载。
// @description:en  Passively render IP-location fields already returned by Bilibili's own public APIs. No extra requests, no tracking, no persistence; fully SPA-aware.
// @author       ox-alpha
// @license      MIT
// @match        https://www.bilibili.com/*
// @match        https://space.bilibili.com/*
// @match        https://t.bilibili.com/*
// @match        https://live.bilibili.com/*
// @grant        none
// @run-at       document-start
// @noframes
// ==/UserScript==

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * 设计说明 (Design Notes)
 * ─────────────────────────────────────────────────────────────────────────────
 * 【网络请求声明】本脚本自身【不发起任何网络请求】——不使用 GM_xmlhttpRequest，
 *   无需 @connect 指令。它仅通过 fetch / XMLHttpRequest 钩子“旁路观察”页面自身
 *   向 bilibili 公开接口发出的请求所返回的数据，例如：
 *     - api.bilibili.com/x/v2/reply*              评论区（主楼/楼中楼/对话）
 *         reply_control.location / member.user_profile.location
 *     - api.bilibili.com/x/web-interface/card     用户悬浮卡片
 *     - api.bilibili.com/x/polymer/web-dynamic*   动态
 *     - api.bilibili.com/x/polymer/opus*          图文（Opus）
 *     - api.live.bilibili.com/xlive/web-room*     直播间信息
 *   观察过程绝不修改、拦截、延迟或重放任何请求；响应体通过 Response.clone()
 *   或 XHR load 事件只读访问，对页面完全透明。
 *
 * 【真实性原则】只展示接口字面返回的归属地字符串（经省级/常用海外地区词表校验），
 *   绝不做推断、猜测或补全。无法识别的字段一律丢弃；字段缺失时展示灰色虚线
 *   占位符（仅限评论区等明确预期出现归属地的场景），静默降级、不打扰用户。
 *
 * 【隐私】全部中间数据仅存于内存 Map（容量受限、随页面刷新丢弃），不写 cookie /
 *   localStorage / sessionStorage / GM 存储，不上传、不共享任何信息。
 *
 * 【SPA 支持】钩住 history.pushState / replaceState 并监听 popstate / hashchange；
 *   配合 MutationObserver 增量扫描 + 低频兜底轮询，路由切换或 DOM 更新后功能持续
 *   生效。所有注入点均带标记位（元素属性 + WeakSet + 样式 id + 全局单例守卫），
 *   多次路由切换 / DOM 更新不会重复插入。
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  /* ══════════════════════ 0. 全局守卫与工具 ══════════════════════ */

  /** 单例守卫：防止管理器极端情况下重复注入导致双份钩子 */
  if (window.__BILI_IP_HELPER_ACTIVE__) {
    return;
  }
  window.__BILI_IP_HELPER_ACTIVE__ = true;

  var DEBUG = false;
  var TAG = '[BILI-IP]';

  function noop() {}

  function logWarn(msg) {
    if (!DEBUG) { return; }
    try { console.warn(TAG, msg); } catch (e) {}
  }

  /* ══════════════════════ 1. 归属地词表与归一化 ══════════════════════ */

  /**
   * 合法归属地词表：34 个省级行政区 + 常见海外国家/地区 + “其他”。
   * 仅用于【校验】接口返回值的合法性（过滤脏数据），绝不用于生成或推断内容。
   */
  var REGIONS = (
    '北京,上海,天津,重庆,' +
    '河北,山西,辽宁,吉林,黑龙江,江苏,浙江,安徽,福建,江西,山东,河南,' +
    '湖北,湖南,广东,海南,四川,贵州,云南,陕西,甘肃,青海,台湾,' +
    '内蒙古,广西,西藏,宁夏,新疆,香港,澳门,' +
    '美国,英国,日本,韩国,朝鲜,蒙古,俄罗斯,德国,法国,意大利,西班牙,葡萄牙,' +
    '荷兰,比利时,瑞士,奥地利,瑞典,挪威,丹麦,芬兰,冰岛,爱尔兰,希腊,' +
    '波兰,捷克,匈牙利,罗马尼亚,保加利亚,塞尔维亚,乌克兰,白俄罗斯,' +
    '土耳其,以色列,伊朗,沙特阿拉伯,阿联酋,卡塔尔,印度,巴基斯坦,孟加拉国,' +
    '斯里兰卡,尼泊尔,缅甸,泰国,越南,老挝,柬埔寨,马来西亚,新加坡,' +
    '印度尼西亚,菲律宾,文莱,澳大利亚,新西兰,斐济,' +
    '加拿大,墨西哥,古巴,哥伦比亚,委内瑞拉,秘鲁,巴西,智利,阿根廷,乌拉圭,' +
    '南非,埃及,摩洛哥,肯尼亚,尼日利亚,阿尔及利亚,埃塞俄比亚,' +
    '其他'
  ).split(',');

  var REGION_SET = {};
  for (var _ri = 0; _ri < REGIONS.length; _ri++) {
    REGION_SET[REGIONS[_ri]] = true;
  }

  /**
   * 归一化并校验一个原始归属地字符串。
   * @param {*} raw 接口返回的原始值
   * @returns {?string} 合法归属地短名（如 “广东”）；非法返回 null
   */
  function normalizeLocation(raw) {
    if (raw == null) { return null; }
    var s = String(raw).trim();
    if (!s) { return null; }

    // 去掉站点常见的展示性前缀/包裹符号（仍是字面返回内容的清洗，非推断）
    s = s.replace(/^\s*IP\s*属\s*地\s*[:：]?\s*/, '')
         .replace(/^[【\[]\s*/, '')
         .replace(/\s*[】\]]$/, '')
         .trim();

    if (!s || s.length > 12) { return null; }
    if (/[\n\r\t<>]/.test(s)) { return null; }          // 结构性脏数据
    if (REGION_SET[s]) { return s; }                    // 精确命中词表

    var stripped = s.replace(/[省市区]$/, '');           // “广东省”/“北京市”
    if (stripped && REGION_SET[stripped]) { return stripped; }

    // “广东广州”这类省市组合：仅当以已知省级开头且长度受限时接受原文
    for (var i = 0; i < REGIONS.length; i++) {
      var r = REGIONS[i];
      if (s.length > r.length && s.length <= 8 && s.indexOf(r) === 0) {
        return s;
      }
    }
    return null;                                        // 无法识别 → 一律丢弃
  }

  /* ══════════════════════ 2. 内存态归属地存储（不落盘） ══════════════════════ */

  var MAX_STORE = 4000;            // FIFO 容量上限，约束内存占用
  var storeMap = {};               // mid -> location(string)
  var storeOrder = [];             // FIFO 淘汰队列
  var storeListeners = [];         // fn(mid, loc) — 数据到位后的升级回调

  function storeGet(mid) {
    return Object.prototype.hasOwnProperty.call(storeMap, mid)
      ? storeMap[mid]
      : null;
  }

  function storeRecord(mid, loc) {
    if (!mid || !loc) { return; }
    if (Object.prototype.hasOwnProperty.call(storeMap, mid)) { return; }

    storeMap[mid] = loc;
    storeOrder.push(mid);
    if (storeOrder.length > MAX_STORE) {
      var evict = storeOrder.shift();
      if (evict !== undefined && evict !== mid) { delete storeMap[evict]; }
    }

    var listeners = storeListeners.slice();
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](mid, loc); } catch (e) {}
    }
  }

  /* ══════════════════════ 3. JSON 采集器 ══════════════════════ */

  var LOC_KEYS = ['location', 'ip_location', 'place'];
  var HARVEST_NODE_LIMIT = 30000;   // 单次走查节点上限（防御超大响应）
  var HARVEST_DEPTH_LIMIT = 14;

  function plausibleMid(v) {
    if (v == null) { return null; }
    var s = String(v);
    if (s === '0') { return null; }
    return /^\d{1,16}$/.test(s) ? s : null;
  }

  function midOf(obj) {
    return plausibleMid(obj.mid) ||
           plausibleMid(obj.uid) ||
           plausibleMid(obj.ruid);
  }

  /** 从对象自身属性里找第一个可通过校验的归属地 */
  function firstLocationOf(obj) {
    for (var i = 0; i < LOC_KEYS.length; i++) {
      var v = obj[LOC_KEYS[i]];
      if (typeof v === 'string') {
        var n = normalizeLocation(v);
        if (n) { return n; }
      }
    }
    return null;
  }

  /**
   * 尝试在单个对象上配对 “用户标识 × 归属地”，覆盖三种已知响应形态：
   *   a) 平铺形如 {mid, location}
   *   b) 用户资料嵌套 {mid, user_profile:{location}}
   *   c) 评论形态 {member:{mid, user_profile:{location}}, reply_control:{location}}
   */
  function tryPair(obj) {
    var mid = midOf(obj);
    if (mid) {
      var loc = firstLocationOf(obj);
      if (loc) { storeRecord(mid, loc); }
      var up = obj.user_profile;
      if (up && typeof up === 'object') {
        var l2 = firstLocationOf(up);
        if (l2) { storeRecord(mid, l2); }
      }
    }

    var member = obj.member;
    if (member && typeof member === 'object') {
      var mm = midOf(member);
      if (mm) {
        var l3 = firstLocationOf(member);
        if (l3) { storeRecord(mm, l3); }

        var up2 = member.user_profile;
        if (up2 && typeof up2 === 'object') {
          var l4 = firstLocationOf(up2);
          if (l4) { storeRecord(mm, l4); }
        }

        var rc = obj.reply_control;
        if (rc && typeof rc === 'object') {
          var l5 = firstLocationOf(rc);
          if (l5) { storeRecord(mm, l5); }
        }
      }
    }
  }

  /** 深度/数量受限的递归走查：从任意已解析 JSON 中收割归属地 */
  function harvest(value) {
    var visited = 0;

    function walk(v, depth) {
      if (visited >= HARVEST_NODE_LIMIT || depth > HARVEST_DEPTH_LIMIT) { return; }
      if (Array.isArray(v)) {
        for (var i = 0; i < v.length; i++) { walk(v[i], depth + 1); }
        return;
      }
      if (v && typeof v === 'object') {
        visited++;
        try { tryPair(v); } catch (e) {}
        for (var k in v) {
          if (Object.prototype.hasOwnProperty.call(v, k)) {
            walk(v[k], depth + 1);
          }
        }
      }
    }

    try { walk(value, 0); } catch (e) {}
  }

  /** 文本安全入口：非 JSON / 解析失败一律静默忽略（网络失败降级点） */
  function harvestText(text) {
    if (typeof text !== 'string' || !text) { return; }
    var c = text.charAt(0);
    if (c !== '{' && c !== '[') { return; }
    try { harvest(JSON.parse(text)); } catch (e) {}
  }

  /** SSR 页面内嵌的全局状态（video/dynamic 等首屏数据），只读走查一次 */
  function harvestEmbeddedState() {
    try {
      if (window.__INITIAL_STATE__) { harvest(window.__INITIAL_STATE__); }
    } catch (e) {}
  }

  /* ══════════════════════ 4. 网络旁路监听（fetch / XHR） ══════════════════════ */

  /** 只观察这些公开接口路径的响应；其余流量零介入 */
  var INSPECT_URL_HINTS = [
    '/x/v2/reply',            // 评论区全部形态（main/wbi/main/reply/dialog/half…）
    'web-interface/card',     // 用户卡片
    '/polymer/web-dynamic',   // 动态
    '/polymer/opus',          // 图文
    '/x/space/',              // 空间相关接口
    'xlive/web-room'          // 直播间信息
  ];

  function shouldInspect(rawUrl) {
    var url = String(rawUrl || '');
    if (url.length > 2048) { url = url.slice(0, 2048); }
    url = url.toLowerCase();
    for (var i = 0; i < INSPECT_URL_HINTS.length; i++) {
      if (url.indexOf(INSPECT_URL_HINTS[i]) !== -1) { return true; }
    }
    return false;
  }

  /** fetch 钩子：clone 后异步读取副本，绝不触碰原响应流 */
  function hookFetch() {
    if (typeof window.fetch !== 'function' || window.fetch.__biliIpTapped) { return; }
    var origFetch = window.fetch;

    var tapped = function (input, init) {
      var url = '';
      try {
        if (typeof input === 'string') {
          url = input;
        } else if (input && typeof input.url === 'string') {
          url = input.url;
        }
      } catch (e) {}

      var result = origFetch.apply(this, arguments);

      if (url && shouldInspect(url)) {
        try {
          result.then(function (res) {
            try {
              if (res && typeof res.clone === 'function') {
                res.clone().json().then(harvest, noop).catch(noop);
              }
            } catch (e) {}
          }, noop).catch(noop);
        } catch (e) {}
      }
      return result;
    };

    try { Object.defineProperty(tapped, '__biliIpTapped', { value: true }); }
    catch (e) { tapped.__biliIpTapped = true; }
    window.fetch = tapped;
  }

  /** XHR 钩子：open 时记 URL，send 时按需挂一次性 load 监听，只读响应文本 */
  function hookXhr() {
    var XO = window.XMLHttpRequest;
    if (!XO || !XO.prototype || XO.prototype.__biliIpTapped) { return; }

    var openOrig = XO.prototype.open;
    var sendOrig = XO.prototype.send;

    XO.prototype.open = function (method, url) {
      try { this.__biliIpUrl = String(url == null ? '' : url); } catch (e) {}
      return openOrig.apply(this, arguments);
    };

    XO.prototype.send = function () {
      var xhr = this;
      try {
        if (xhr.__biliIpUrl && shouldInspect(xhr.__biliIpUrl)) {
          xhr.addEventListener('load', function () {
            try {
              var rt = xhr.responseType;
              if (rt === '' || rt === 'text') {
                harvestText(xhr.responseText);
              } else if (rt === 'json') {
                harvest(xhr.response);
              }
            } catch (e) {}
          }, false);
        }
      } catch (e) {}
      return sendOrig.apply(this, arguments);
    };

    try { Object.defineProperty(XO.prototype, '__biliIpTapped', { value: true }); }
    catch (e) { XO.prototype.__biliIpTapped = true; }
  }

  /* ══════════════════════ 5. 渲染层（徽章注入） ══════════════════════ */

  var STYLE_ID = 'bili-ip-helper-style';
  var BADGE_ATTR = 'data-bili-ip-badge';       // 防重复插入标记（一）
  var BADGE_CLASS = 'bil-ip-badge';

  var CSS_TEXT =
    '.' + BADGE_CLASS + '{box-sizing:border-box;display:inline-block;' +
    'margin:0 0 0 6px;padding:0 5px;border-radius:3px;' +
    'background-color:#f1f2f3;color:#9499a0;font-size:12px;line-height:18px;' +
    'font-weight:400;vertical-align:middle;white-space:nowrap;' +
    'pointer-events:none;text-decoration:none;font-style:normal;}' +
    '.' + BADGE_CLASS + '--unknown{background-color:transparent;' +
    'color:#c9ccd0;border:1px dashed #dcdee0;}';

  var styleEnsured = false;

  function ensureStyle() {
    if (styleEnsured) { return; }
    if (!document.head && !document.documentElement) { return; }
    if (document.getElementById(STYLE_ID)) { styleEnsured = true; return; }
    var st = document.createElement('style');       // DOM 方式插入，不受页面 CSP 内联限制
    st.id = STYLE_ID;                               // 防重复插入标记（二）
    st.type = 'text/css';
    st.textContent = CSS_TEXT;
    (document.head || document.documentElement).appendChild(st);
    styleEnsured = true;
  }

  /**
   * 构造徽章：
   *   有数据  → 「IP属地·广东」（贴合 B 站原生灰调）
   *   无数据  → 「IP属地·--」灰色虚线占位（可识别但不打扰）
   */
  function makeBadge(loc) {
    var el = document.createElement('span');
    el.className = BADGE_CLASS + (loc ? '' : (' ' + BADGE_CLASS + '--unknown'));
    el.setAttribute(BADGE_ATTR, '1');
    el.textContent = loc ? ('IP属地·' + loc) : 'IP属地·--';
    el.title = loc
      ? 'IP 归属地：来自页面公开接口已返回的数据'
      : '归属地字段未由页面接口返回（静默降级占位）';
    return el;
  }

  /** 已处理锚点登记表：anchor -> {mid, badged, placeholderable}（防重复标记三） */
  var seenAnchors = new WeakMap();

  /** 占位符待升级索引：mid -> Array<anchor>（数据后到时原位升级） */
  var anchorIndex = {};
  var ANCHOR_INDEX_CAP = 300;

  function indexAnchor(mid, anchor) {
    var arr = anchorIndex[mid];
    if (!arr) { arr = anchorIndex[mid] = []; }
    if (arr.indexOf(anchor) === -1) { arr.push(anchor); }
    if (arr.length > ANCHOR_INDEX_CAP) { arr.splice(0, arr.length - ANCHOR_INDEX_CAP); }
  }

  function unindexAnchor(mid, anchor) {
    var arr = anchorIndex[mid];
    if (!arr) { return; }
    var i = arr.indexOf(anchor);
    if (i !== -1) { arr.splice(i, 1); }
    if (arr.length === 0) { delete anchorIndex[mid]; }
  }

  /** 数据到位回调：把该用户名旁的灰色占位符替换为真实归属地徽章 */
  storeListeners.push(function (mid, loc) {
    var arr = anchorIndex[mid];
    if (!arr || !arr.length) { return; }
    var snapshot = arr.slice();
    delete anchorIndex[mid];
    for (var i = 0; i < snapshot.length; i++) {
      try { upgradeAnchor(snapshot[i], loc); } catch (e) {}
    }
  });

  function upgradeAnchor(anchor, loc) {
    if (!anchor || !anchor.parentNode) { return; }
    var next = anchor.nextElementSibling;
    if (!next || !next.hasAttribute || !next.hasAttribute(BADGE_ATTR)) { return; }
    try { next.parentNode.replaceChild(makeBadge(loc), next); } catch (e) { return; }
    var info = seenAnchors.get(anchor);
    if (info) { info.badged = true; }
  }

  /** 从 space.bilibili.com/{mid} 形态链接提取 mid */
  function midFromHref(href) {
    var m = /space\.bilibili\.com\/(\d{1,16})/.exec(String(href || ''));
    return m ? m[1] : null;
  }

  /**
   * 注入范围（SCOPE_SEL）：只在语义相关的容器内标注，避免污染无关区域——
   *   评论区条目 / 用户悬浮卡片 / 动态·图文作者栏 / 视频页 UP 主信息区。
   * 占位符范围（PLACEHOLDER_SCOPE_SEL）：进一步收窄到评论区——只有那里才
   *   明确“应当存在归属地”，其余场景缺数据时直接不显示。
   */
  var SCOPE_SEL = [
    '[class*="reply-item"]',
    '[class*="comment-item"]',
    '[class*="sub-reply"]',
    '.bili-user-profile',
    '[class*="user-card"]',
    '[class*="user-profile"]',
    '[class*="module-author"]',
    '[class*="up-detail"]',
    '#v_upinfo'
  ].join(',');

  var PLACEHOLDER_SCOPE_SEL =
    '[class*="reply-item"],[class*="comment-item"],[class*="sub-reply"]';

  function insertBadge(anchor, badge) {
    var parent = anchor.parentNode;
    if (!parent) { return; }
    try { parent.insertBefore(badge, anchor.nextSibling); } catch (e) {}
  }

  /**
   * 对单个用户主页链接做判定与注入：
   *   ① 提取 mid；② 判定是否处于注入范围；③ 有数据→真实徽章；
   *   ④ 无数据但在评论区→灰色占位（并登记待升级）；⑤ 其余→跳过不打扰。
   */
  function annotateAnchor(anchor) {
    if (!anchor || anchor.nodeType !== 1) { return; }
    if (typeof anchor.closest !== 'function') { return; }

    var info = seenAnchors.get(anchor);
    if (!info) {
      var mid = midFromHref(anchor.getAttribute('href'));
      if (!mid) { return; }

      var scope = null;
      try { scope = anchor.closest(SCOPE_SEL); } catch (e) { scope = null; }
      if (!scope) { return; }                       // 与展示无关的空间链接：不处理

      var ph = false;
      try { ph = !!anchor.closest(PLACEHOLDER_SCOPE_SEL); } catch (e) {}

      info = { mid: mid, badged: false, placeholderable: ph };
      seenAnchors.set(anchor, info);
    }

    if (info.badged) { return; }

    // 防重复插入标记（四）：紧邻位置已存在徽章则视为已完成
    var next = anchor.nextElementSibling;
    if (next && next.hasAttribute && next.hasAttribute(BADGE_ATTR)) {
      info.badged = true;
      return;
    }

    var loc = storeGet(info.mid);
    if (loc) {
      insertBadge(anchor, makeBadge(loc));
      info.badged = true;
      unindexAnchor(info.mid, anchor);
    } else if (info.placeholderable) {
      insertBadge(anchor, makeBadge(null));         // 灰色占位：静默降级
      info.badged = true;
      indexAnchor(info.mid, anchor);                // 数据后到 → 原位升级
    }
    // 既无数据也非占位场景：保持未标记，留待后续扫描再判定（不污染页面）
  }

  /* ══════════════════════ 6. 扫描器（防抖 + 增量 + 兜底） ══════════════════════ */

  var SPACE_LINK_SEL = 'a[href*="space.bilibili.com/"]';

  /** 在指定子树内扫描所有指向用户空间的链接并尝试标注 */
  function scanTree(rootEl) {
    ensureStyle();
    var scopeRoot = (rootEl && rootEl.querySelectorAll) ? rootEl : document;
    var list = null;
    try { list = scopeRoot.querySelectorAll(SPACE_LINK_SEL); } catch (e) { return; }
    for (var i = 0; i < list.length; i++) {
      try { annotateAnchor(list[i]); } catch (e) {}
    }
    // querySelectorAll 不含根节点自身：若传入的就是锚点元素则单独补判
    if (rootEl && rootEl.tagName === 'A') {
      try { annotateAnchor(rootEl); } catch (e) {}
    }
  }

  /** 个人空间页头部昵称（非链接元素）的就地标注 */
  function annotateSpaceHeader() {
    try {
      if (String(location.hostname).toLowerCase() !== 'space.bilibili.com') { return; }
      var m = /^\/(\d{1,16})(?:\/|$)/.exec(location.pathname || '');
      if (!m) { return; }
      var loc = storeGet(m[1]);
      if (!loc) { return; }
      var cands = document.querySelectorAll('.h-name, [class*="nickname"]');
      for (var i = 0; i < cands.length; i++) {
        var el = cands[i];
        var next = el.nextElementSibling;
        if (next && next.hasAttribute && next.hasAttribute(BADGE_ATTR)) { return; }
        if (!el.parentElement) { continue; }
        el.parentElement.insertBefore(makeBadge(loc), el.nextSibling);
        return;
      }
    } catch (e) {}
  }

  function fullScan() {
    try { scanTree(document); } catch (e) {}
    try { annotateSpaceHeader(); } catch (e) {}
  }

  /* ── 防抖调度：MutationObserver 增量优先，数据/路由变化触发全量 ── */

  var pendingScanAll = false;
  var pendingRoots = [];
  var scanTimer = null;

  function scheduleScan(rootEl) {
    if (rootEl && rootEl.nodeType === 1) {
      if (pendingRoots.indexOf(rootEl) === -1) { pendingRoots.push(rootEl); }
      if (pendingRoots.length > 40) {               // 批量过大直接转全量
        pendingScanAll = true;
        pendingRoots.length = 0;
      }
    } else {
      pendingScanAll = true;
    }
    if (scanTimer !== null) { return; }
    scanTimer = setTimeout(runScheduled, 120);
  }

  function runScheduled() {
    scanTimer = null;
    try {
      if (pendingScanAll) {
        pendingScanAll = false;
        pendingRoots.length = 0;
        fullScan();
        // SPA 切换后 __INITIAL_STATE__ 会被框架重写，稍后再收割一次
        setTimeout(function () {
          try { harvestEmbeddedState(); } catch (e) {}
        }, 900);
      } else {
        var roots = pendingRoots.slice();
        pendingRoots.length = 0;
        for (var i = 0; i < roots.length; i++) { scanTree(roots[i]); }
      }
    } catch (e) {}
  }

  /** 新数据入库 → 触发全量扫描，让已渲染但未标注的节点立即受益 */
  storeListeners.push(function () { scheduleScan(null); });

  /* ══════════════════════ 7. SPA 动态路由支持 ══════════════════════ */

  function patchHistoryApi() {
    var hist = window.history || {};
    ['pushState', 'replaceState'].forEach(function (name) {
      var orig = hist[name];
      if (typeof orig !== 'function' || orig.__biliIpPatched) { return; }
      var patched = function () {
        var ret = orig.apply(this, arguments);
        try { scheduleScan(null); } catch (e) {}
        return ret;
      };
      try { Object.defineProperty(patched, '__biliIpPatched', { value: true }); }
      catch (e) { patched.__biliIpPatched = true; }
      try { hist[name] = patched; } catch (e) {}
    });
    window.addEventListener('popstate', function () { scheduleScan(null); }, false);
    window.addEventListener('hashchange', function () { scheduleScan(null); }, false);
  }

  function setupObserver() {
    if (!document.body || typeof MutationObserver !== 'function') { return false; }
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n && n.nodeType === 1) { scheduleScan(n); }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return true;
  }

  /* ══════════════════════ 8. 启动流程 ══════════════════════ */

  function onReady() {
    ensureStyle();
    patchHistoryApi();
    setupObserver();
    fullScan();                    // 首屏已有 DOM 的静态标注
    harvestEmbeddedState();        // SSR 首屏数据收割

    // 兜底心跳：低频全量扫描 + fetch 重挂钩自愈（若页面运行期替换了 fetch）
    setInterval(function () {
      try { hookFetch(); } catch (e) {}
      try { scheduleScan(null); } catch (e) {}
    }, 4000);
  }

  function boot() {
    // document-start 阶段第一优先级：抢在页面脚本之前挂好网络钩子
    try { hookFetch(); } catch (e) { logWarn('hookFetch failed'); }
    try { hookXhr(); } catch (e) { logWarn('hookXhr failed'); }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        try { onReady(); } catch (e) {}
      }, false);
    } else {
      try { onReady(); } catch (e) {}
    }
  }

  boot();
})();
