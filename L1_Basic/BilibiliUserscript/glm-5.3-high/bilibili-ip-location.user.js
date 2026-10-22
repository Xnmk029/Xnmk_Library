// ==UserScript==
// @name         Bilibili IP 归属地展示（评论 / 动态）
// @namespace    https://github.com/glm-benchmark/bilibili-ip-location
// @version      1.0.0
// @description  在 B 站电脑端页面的评论区与动态区展示公开数据中已返回的 IP 归属地信息。仅被动解析页面自身的接口响应与页面初始状态，不发起任何额外网络请求，不收集、不上传、不持久化任何用户数据。
// @author       glm-benchmark
// @license      MIT
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/opus/*
// @match        https://www.bilibili.com/list/*
// @match        https://t.bilibili.com/*
// @match        https://space.bilibili.com/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

/*
 * ============================ 实现说明 ============================
 * 【IP 归属地获取方式】
 *   本脚本不主动发起任何网络请求（因此元数据块中未声明任何外部请求地址，
 *   也未申请 GM_xmlhttpRequest 等跨域权限，遵循最小权限原则）。
 *   归属地信息只来自"页面已经返回的公开数据"，共两类来源：
 *     1) 页面自身发出的评论接口（/x/v2/reply*，字段 reply_control.location）
 *        与动态接口（/polymer/web-dynamic/*，字段 modules.module_author.ip_label）
 *        的 JSON 响应——通过在 document-start 被动监听（不修改）fetch /
 *        XMLHttpRequest 获得；
 *     2) 服务端直出在 window.__INITIAL_STATE__ 中的页面初始数据。
 *   脚本只做"展示"，不做任何推断：接口未返回归属地的条目显示灰色占位，
 *   完全无数据的条目保持静默。
 *
 * 【评论 / 动态区 DOM 注入逻辑】
 *   以 rpid（评论）/ 动态 id 精确匹配 DOM 条目，把轻量灰色徽标插入到
 *   评论信息行（用户名 / 时间附近）与动态作者信息行之后，贴合原布局。
 *   兼容经典 DOM 与开放 ShadowRoot（新版 Web Component 评论区）。
 *   SPA 路由切换（pushState / replaceState / popstate / hashchange）与
 *   DOM 更新（MutationObserver 节流重扫 + 多波次延迟重扫）后功能持续生效。
 *
 * 【防重复】
 *   徽标带 data-bili-ip-loc 标记，条目带 data-bili-ip-state / 版本标记；
 *   已含原生 "IP属地" 文案的行不再插入；自身插入引发的 Mutation 会被
 *   观察者忽略，不会形成回环或重复插入。
 *
 * 【异常兜底】
 *   所有阶段均 try/catch 静默降级；JSON 解析失败、字段缺失、DOM 结构
 *   变化等异常均不影响原页面运行。字段缺失时显示可识别、不打扰的
 *   浅灰占位 "IP属地：--"。
 * ================================================================
 */

(function () {
  'use strict';

  // 防止脚本被重复注入（部分脚本管理器 / iframe 场景）
  if (window.__BILI_IP_LOC_ACTIVE__) { return; }
  window.__BILI_IP_LOC_ACTIVE__ = true;

  /* ------------------------------ 常量配置 ------------------------------ */

  // 页面自身的评论接口（含 /x/v2/reply、/x/v2/reply/main、/x/v2/reply/reply）
  var REPLY_URL_RE = /\/x\/v2\/reply(?=\/|\?|$)/;
  // 页面自身的动态接口（含 feed、detail、feed/space 等）
  var DYNAMIC_URL_RE = /\/polymer\/web-dynamic\//;
  // 原生或已注入的归属地文案检测
  var IP_TEXT_RE = /ip属地/i;

  var BADGE_ATTR = 'data-bili-ip-loc';     // 徽标元素标记
  var STATE_ATTR = 'data-bili-ip-state';   // 条目处理状态（done / native）
  var SEEN_VER_ATTR = 'data-bili-ip-ver';  // 条目最近一次处理时的数据版本

  // 递归解析 __INITIAL_STATE__ / 接口响应的安全上限
  var MAX_WALK_DEPTH = 12;
  var MAX_WALK_NODES = 60000;
  var MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
  var MAX_SHADOW_ROOTS = 64;
  var MAX_SHADOW_DEPTH = 4;

  // 评论条目：id 提取属性与徽标锚点候选
  var REPLY_ID_ATTRS = ['data-id', 'data-rpid', 'data-reply-id'];
  var REPLY_ANCHORS = ['.reply-info', '.user-name', '.reply-time', '.reply-decimal'];
  var SUB_REPLY_ANCHORS = ['.sub-reply-info', '.sub-user-name', '.sub-reply-time'];
  // 新版评论区（Web Component）内部的候选锚点
  var WC_REPLY_ANCHORS = ['.user-name', '#user-name', '.comment-info', '#info', '.info', '.name', '.date', '#date', '.time'];

  // 动态条目：id 提取属性与徽标锚点候选
  var DYN_ID_ATTRS = ['data-did', 'data-dyn-id', 'data-id'];
  var DYN_LINK_RES = [
    /t\.bilibili\.com\/(\d{6,})/,
    /\/(?:opus|dynamic|detail|expand)\/(\d{6,})/,
    /^\/(\d{10,})\/dynamic/
  ];
  var DYN_FEED_ANCHORS = ['.bili-dyn-title', '.dyn-header', '.bili-dyn-author', '.bili-dyn-item__panel', '.dyn-item__panel'];
  // 动态详情页（t.bilibili.com/{id}、/opus/{id}）锚点候选
  var DYN_DETAIL_CONTAINERS = ['.dyn-header', '.opus-module-author', '.bili-dyn-author', '.dyn-info', '.detail-info'];
  var DYN_DETAIL_TIMES = ['.dyn-time', '.bili-dyn-time', '.opus-module-time', '.dyn-info-time', '.dyn-text'];

  /* ------------------------------ 数据存储 ------------------------------ */

  // rpid(string) -> 归属地字符串；null 表示"接口已返回该条目但无归属地字段"
  var replyMap = new Map();
  // 动态 id(string) -> 归属地字符串；null 含义同上
  var dynMap = new Map();
  // 每次成功采集到新数据时递增，用于版本门控重扫
  var dataVersion = 0;
  // 一次遍历中是否采集到新数据
  var dirty = false;

  function bumpData() {
    dataVersion += 1;
    scheduleScan();
  }

  function noop() {}

  /* --------------------------- 数据采集：遍历器 --------------------------- */

  function walk(node, visit) {
    var budget = { count: 0 };
    walkInternal(node, visit, 0, budget);
  }

  function walkInternal(node, visit, depth, budget) {
    if (!node || typeof node !== 'object') { return; }
    if (depth > MAX_WALK_DEPTH || budget.count > MAX_WALK_NODES) { return; }
    budget.count += 1;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) {
        walkInternal(node[i], visit, depth + 1, budget);
      }
      return;
    }
    try { visit(node); } catch (e) { /* 单个节点解析失败：静默跳过 */ }
    var keys = Object.keys(node);
    for (var j = 0; j < keys.length; j++) {
      var v = node[keys[j]];
      if (v && typeof v === 'object') {
        walkInternal(v, visit, depth + 1, budget);
      }
    }
  }

  // 归一化：部分接口返回形如 "IP属地：上海"，统一去掉前缀仅保留地名
  function normalizeLocation(raw) {
    var label = typeof raw === 'string' ? raw.trim() : '';
    if (label) {
      label = label.replace(/^ip属地[:：]?\s*/i, '').trim();
    }
    return label;
  }

  // 评论节点：提取 rpid -> reply_control.location（兼容 content.location 兜底）
  function visitReplyNode(node) {
    var rpid = '';
    if (node.rpid != null) { rpid = String(node.rpid); }
    else if (node.rpid_str != null) { rpid = String(node.rpid_str); }
    if (!/^\d+$/.test(rpid)) { return; }

    var loc = '';
    if (node.reply_control && typeof node.reply_control.location === 'string') {
      loc = node.reply_control.location;
    }
    if (!loc && node.content && typeof node.content.location === 'string') {
      loc = node.content.location;
    }
    if (!loc && typeof node.location === 'string') {
      loc = node.location;
    }
    storeEntry(replyMap, rpid, normalizeLocation(loc));
  }

  // 动态节点：提取动态 id -> modules.module_author.ip_label
  function visitDynNode(node) {
    var modules = node.modules;
    if (!modules || typeof modules !== 'object') { return; }
    var author = modules.module_author;
    if (!author || typeof author !== 'object') { return; }

    var id = '';
    if (node.id_str != null) { id = String(node.id_str); }
    else if (node.id != null) { id = String(node.id); }
    else if (node.dyn_id_str != null) { id = String(node.dyn_id_str); }
    else if (node.dyn_id != null) { id = String(node.dyn_id); }
    if (!/^\d+$/.test(id)) { return; }

    var label = typeof author.ip_label === 'string' ? author.ip_label : '';
    storeEntry(dynMap, id, normalizeLocation(label));
  }

  function storeEntry(map, key, value) {
    var prev = map.get(key);
    if (value) {
      if (prev !== value) {
        map.set(key, value);
        dirty = true;
      }
    } else if (prev === undefined) {
      // 条目已知但接口未返回归属地字段：记录为 null（用于灰色占位）
      map.set(key, null);
      dirty = true;
    }
  }

  /* ---------------------- 数据采集：接口响应被动监听 ---------------------- */

  function handleResponseText(url, text) {
    try {
      if (typeof url !== 'string' || typeof text !== 'string' || !text) { return; }
      if (text.length > MAX_RESPONSE_BYTES) { return; }
      var isReply = REPLY_URL_RE.test(url);
      var isDyn = DYNAMIC_URL_RE.test(url);
      if (!isReply && !isDyn) { return; }
      var json = JSON.parse(text);
      dirty = false;
      if (isReply) { walk(json, visitReplyNode); }
      if (isDyn) { walk(json, visitDynNode); }
      if (dirty) { bumpData(); }
    } catch (e) { /* 解析失败：静默降级，不影响页面 */ }
  }

  function shouldInspect(url) {
    return !!url && (REPLY_URL_RE.test(url) || DYNAMIC_URL_RE.test(url));
  }

  function urlOf(u) {
    try {
      if (typeof u === 'string') { return u; }
      if (u && typeof u.url === 'string') { return u.url; } // Request 对象
      return '';
    } catch (e) { return ''; }
  }

  function hookNetwork() {
    // 被动监听 fetch（不修改请求与响应本身）
    try {
      if (typeof window.fetch === 'function' && !window.fetch.__biliIpLocPatched) {
        var origFetch = window.fetch;
        var patchedFetch = function () {
          var url = urlOf(arguments[0]);
          var promise = origFetch.apply(this, arguments);
          if (shouldInspect(url)) {
            promise.then(function (res) {
              try {
                if (res && typeof res.clone === 'function') {
                  res.clone().text().then(function (t) {
                    handleResponseText(url, t);
                  }).catch(noop);
                }
              } catch (e) { /* 静默 */ }
            }).catch(noop);
          }
          return promise;
        };
        patchedFetch.__biliIpLocPatched = true;
        window.fetch = patchedFetch;
      }
    } catch (e) { /* 静默降级：仅失去接口监听，不影响其他功能 */ }

    // 被动监听 XMLHttpRequest
    try {
      var XHR = window.XMLHttpRequest;
      if (XHR && XHR.prototype && !XHR.prototype.__biliIpLocPatched) {
        var origOpen = XHR.prototype.open;
        var origSend = XHR.prototype.send;
        XHR.prototype.open = function () {
          try { this.__biliIpLocUrl = urlOf(arguments[1]); } catch (e) { this.__biliIpLocUrl = ''; }
          return origOpen.apply(this, arguments);
        };
        XHR.prototype.send = function () {
          try {
            var xhr = this;
            var url = xhr.__biliIpLocUrl;
            if (shouldInspect(url)) {
              xhr.addEventListener('load', function () {
                try {
                  if (xhr.responseType === '' || xhr.responseType === 'text') {
                    handleResponseText(url, xhr.responseText);
                  }
                } catch (e) { /* 静默 */ }
              });
            }
          } catch (e) { /* 静默 */ }
          return origSend.apply(this, arguments);
        };
        XHR.prototype.__biliIpLocPatched = true;
      }
    } catch (e) { /* 静默降级 */ }
  }

  /* ------------------- 数据采集：服务端直出的初始状态 ------------------- */

  function harvestInitialState() {
    try {
      var state = window.__INITIAL_STATE__;
      if (!state || typeof state !== 'object') { return; }
      dirty = false;
      walk(state, visitReplyNode);
      walk(state, visitDynNode);
      if (dirty) { bumpData(); }
    } catch (e) { /* 静默降级 */ }
  }

  /* ------------------------------ 徽标渲染 ------------------------------ */

  function makeBadge(value, isMissing) {
    var span = document.createElement('span');
    span.textContent = isMissing ? 'IP属地：--' : 'IP属地：' + value;
    span.setAttribute(BADGE_ATTR, isMissing ? 'missing' : 'ok');
    span.title = isMissing
      ? '该条内容对应的公开接口数据中未包含归属地字段'
      : '来自页面公开数据（接口响应 / 页面初始状态）的 IP 归属地';
    // 贴合 B 站原布局的轻量灰色小标签，不遮挡、不响应鼠标
    span.style.cssText = [
      'display:inline-block',
      'margin-left:8px',
      'padding:0 4px',
      'font-size:12px',
      'line-height:18px',
      'vertical-align:middle',
      'white-space:nowrap',
      'pointer-events:none',
      'color:' + (isMissing ? '#c9ccd0' : '#9499a0'),
      'background-color:#f1f2f3',
      'border-radius:4px'
    ].join(';');
    return span;
  }

  // 在条目自身及其开放 ShadowRoot 中查找第一个命中的锚点
  function pickAnchor(item, selectors) {
    var scopes = [item];
    try {
      if (item.shadowRoot) { scopes.push(item.shadowRoot); }
    } catch (e) { /* 静默 */ }
    for (var c = 0; c < selectors.length; c++) {
      for (var s = 0; s < scopes.length; s++) {
        try {
          var el = scopes[s].querySelector(selectors[c]);
          if (el) { return el; }
        } catch (e) { /* 非法选择器：跳过 */ }
      }
    }
    return null;
  }

  // 返回 true 表示已注入或无需注入（原生已展示 / 已存在徽标）
  function renderBadgeForItem(item, anchorSelectors, value) {
    var anchor = pickAnchor(item, anchorSelectors);
    if (!anchor) { return false; }
    var scope = anchor.parentNode || anchor;
    // 防重复：锚点所在信息行已有徽标
    if (scope.querySelector && scope.querySelector('[' + BADGE_ATTR + ']')) { return true; }
    // 页面原生已展示归属地文案：不再插入
    if (IP_TEXT_RE.test(scope.textContent || '')) { return true; }
    var badge = makeBadge(value, value == null || value === '');
    try {
      if (/time/i.test(String(anchor.className || ''))) {
        if (anchor.parentNode) {
          anchor.parentNode.insertBefore(badge, anchor.nextSibling);
        } else {
          return false;
        }
      } else {
        anchor.appendChild(badge);
      }
    } catch (e) { return false; }
    return true;
  }

  /* ------------------------------ DOM 扫描 ------------------------------ */

  function extractNumericAttr(el, attrs) {
    for (var i = 0; i < attrs.length; i++) {
      var v = el.getAttribute(attrs[i]);
      if (v && /^\d{6,}$/.test(v)) { return v; }
    }
    var idAttr = el.getAttribute('id');
    if (idAttr) {
      var m = idAttr.match(/(\d{6,})/);
      if (m) { return m[1]; }
    }
    return null;
  }

  function extractDynId(el) {
    var id = extractNumericAttr(el, DYN_ID_ATTRS);
    if (id) { return id; }
    // 兜底：从条目内指向动态详情的链接中提取动态 id
    try {
      var links = el.querySelectorAll('a[href]');
      for (var i = 0; i < links.length; i++) {
        var href = links[i].getAttribute('href') || '';
        for (var j = 0; j < DYN_LINK_RES.length; j++) {
          var m = href.match(DYN_LINK_RES[j]);
          if (m) { return m[1]; }
        }
      }
    } catch (e) { /* 静默 */ }
    return null;
  }

  function scanComments(root) {
    var items = null;
    try {
      items = root.querySelectorAll('.reply-item, .sub-reply-item, bili-comment-thread-renderer');
    } catch (e) { return; }
    if (!items || !items.length) { return; }
    var ver = String(dataVersion);
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      try {
        if (item.getAttribute(STATE_ATTR)) { continue; }            // 已处理：不再重复
        if (item.getAttribute(SEEN_VER_ATTR) === ver) { continue; } // 数据未更新：跳过
        item.setAttribute(SEEN_VER_ATTR, ver);
        var rpid = extractNumericAttr(item, REPLY_ID_ATTRS);
        if (!rpid) { continue; }        // 无法定位条目 id：静默等待后续数据
        var entry = replyMap.get(rpid);
        if (entry === undefined) { continue; } // 暂无该条目数据：静默等待
        var anchors = REPLY_ANCHORS;
        if (item.classList && item.classList.contains('sub-reply-item')) {
          anchors = SUB_REPLY_ANCHORS;
        } else if (item.tagName === 'BILI-COMMENT-THREAD-RENDERER') {
          anchors = WC_REPLY_ANCHORS;
        }
        if (renderBadgeForItem(item, anchors, entry)) {
          item.setAttribute(STATE_ATTR, 'done');
        }
      } catch (e) { /* 单条失败不影响其余条目 */ }
    }
  }

  function scanDynamics(root) {
    // 动态列表条目
    var items = null;
    try {
      items = root.querySelectorAll('.bili-dyn-item, .dyn-item, [data-did]');
    } catch (e) { items = null; }
    if (items && items.length) {
      var ver = String(dataVersion);
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        try {
          if (item.getAttribute(STATE_ATTR)) { continue; }
          if (item.getAttribute(SEEN_VER_ATTR) === ver) { continue; }
          item.setAttribute(SEEN_VER_ATTR, ver);
          var dynId = extractDynId(item);
          if (!dynId) { continue; }
          var entry = dynMap.get(dynId);
          if (entry === undefined) { continue; }
          if (renderBadgeForItem(item, DYN_FEED_ANCHORS, entry)) {
            item.setAttribute(STATE_ATTR, 'done');
          }
        } catch (e) { /* 单条失败不影响其余条目 */ }
      }
    }
    // 动态详情页（单条直出，可能不经过列表渲染）
    if (root === document) { scanDynamicDetail(); }
  }

  function currentDetailDynId() {
    try {
      var m = location.pathname.match(/\/(?:opus|dynamic|detail|expand)\/?(\d{6,})/);
      if (m) { return m[1]; }
      m = location.pathname.match(/^\/(\d{6,})\/?$/); // t.bilibili.com/{id}
      if (m) { return m[1]; }
    } catch (e) { /* 静默 */ }
    return null;
  }

  function scanDynamicDetail() {
    try {
      var id = currentDetailDynId();
      if (!id) { return; }
      var entry = dynMap.get(id);
      if (entry === undefined) { return; } // 无数据：静默
      var target = null;
      var mode = 'append';
      for (var i = 0; i < DYN_DETAIL_TIMES.length; i++) {
        var t = document.querySelector(DYN_DETAIL_TIMES[i]);
        if (t) { target = t; mode = 'after'; break; }
      }
      if (!target) {
        for (var j = 0; j < DYN_DETAIL_CONTAINERS.length; j++) {
          var c = document.querySelector(DYN_DETAIL_CONTAINERS[j]);
          if (c) { target = c; mode = 'append'; break; }
        }
      }
      if (!target) { return; }
      var scope = mode === 'after' ? (target.parentNode || target) : target;
      if (scope.querySelector && scope.querySelector('[' + BADGE_ATTR + ']')) { return; }
      if (IP_TEXT_RE.test((scope.textContent || ''))) { return; }
      var badge = makeBadge(entry, entry == null || entry === '');
      if (mode === 'after' && target.parentNode) {
        target.parentNode.insertBefore(badge, target.nextSibling);
      } else {
        target.appendChild(badge);
      }
    } catch (e) { /* 静默降级 */ }
  }

  // 收集 document 与所有开放 ShadowRoot 作为扫描根
  function collectRoots() {
    var roots = [document];
    try { collectShadowRootsInto(document, roots, 0); } catch (e) { /* 静默 */ }
    return roots;
  }

  function collectShadowRootsInto(root, out, depth) {
    if (depth > MAX_SHADOW_DEPTH || !root.querySelectorAll) { return; }
    var all;
    try { all = root.querySelectorAll('*'); } catch (e) { return; }
    for (var i = 0; i < all.length && out.length < MAX_SHADOW_ROOTS; i++) {
      var sr = null;
      try { sr = all[i].shadowRoot; } catch (e) { sr = null; }
      if (sr) {
        out.push(sr);
        collectShadowRootsInto(sr, out, depth + 1);
      }
    }
  }

  function scanAll() {
    try {
      if (!document.body) { return; }
      var roots = collectRoots();
      for (var i = 0; i < roots.length; i++) {
        scanComments(roots[i]);
        scanDynamics(roots[i]);
      }
    } catch (e) { /* 静默降级：任何异常都不影响原页面 */ }
  }

  /* --------------------------- SPA 与 DOM 变更监听 --------------------------- */

  var scanTimer = null;

  function scheduleScan(delay) {
    if (scanTimer !== null) { return; }
    scanTimer = window.setTimeout(function () {
      scanTimer = null;
      scanAll();
    }, delay == null ? 600 : delay);
  }

  // 路由切换后内容异步加载，采用多波次重扫保证生效
  function onRouteChange() {
    var waves = [0, 600, 1800];
    for (var i = 0; i < waves.length; i++) {
      window.setTimeout(function (d) {
        return function () {
          harvestInitialState();
          scanAll();
        };
      }(waves[i]), waves[i]);
    }
  }

  function hookSpaRouting() {
    try {
      var names = ['pushState', 'replaceState'];
      for (var i = 0; i < names.length; i++) {
        (function (name) {
          var orig = history[name];
          if (typeof orig !== 'function' || orig.__biliIpLocPatched) { return; }
          var patched = function () {
            var ret = orig.apply(this, arguments);
            onRouteChange();
            return ret;
          };
          patched.__biliIpLocPatched = true;
          try {
            history[name] = patched;
          } catch (e2) {
            try {
              Object.defineProperty(history, name, { value: patched, writable: true, configurable: true });
            } catch (e3) { /* 静默降级 */ }
          }
        }(names[i]));
      }
    } catch (e) { /* 静默降级 */ }
    try {
      window.addEventListener('popstate', onRouteChange);
      window.addEventListener('hashchange', onRouteChange);
    } catch (e) { /* 静默降级 */ }
  }

  // 判断一批 Mutation 是否全部由本脚本插入的徽标引起
  function allOwnMutations(records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var nodes = [];
      if (r.addedNodes && r.addedNodes.length) {
        for (var a = 0; a < r.addedNodes.length; a++) { nodes.push(r.addedNodes[a]); }
      }
      if (r.removedNodes && r.removedNodes.length) {
        for (var b = 0; b < r.removedNodes.length; b++) { nodes.push(r.removedNodes[b]); }
      }
      for (var j = 0; j < nodes.length; j++) {
        var n = nodes[j];
        if (n.nodeType !== 1) { continue; }
        var own = false;
        try { own = n.getAttribute && n.getAttribute(BADGE_ATTR) != null; } catch (e) { own = false; }
        if (!own) { return false; }
      }
    }
    return true;
  }

  function startObserver() {
    try {
      var mo = new MutationObserver(function (records) {
        if (allOwnMutations(records)) { return; } // 忽略自身插入，避免回环
        scheduleScan();
      });
      var observe = function () {
        try {
          mo.observe(document.documentElement, { childList: true, subtree: true });
        } catch (e) { /* 静默降级 */ }
      };
      if (document.documentElement) {
        observe();
      } else {
        document.addEventListener('readystatechange', observe);
      }
    } catch (e) { /* 静默降级：仍有路由级重扫兜底 */ }
  }

  /* -------------------------------- 启动 -------------------------------- */

  function boot() {
    hookNetwork();      // document-start：先于页面脚本挂钩网络层
    hookSpaRouting();   // 拦截 SPA 路由切换
    startObserver();    // 监听异步 DOM 更新
    scheduleScan(0);
    try {
      document.addEventListener('DOMContentLoaded', function () {
        harvestInitialState();
        scanAll();
      });
    } catch (e) { /* 静默 */ }
    try {
      window.addEventListener('load', function () {
        harvestInitialState();
        scheduleScan(300);
      });
    } catch (e) { /* 静默 */ }
    // 兜底：SPA 晚初始化场景
    window.setTimeout(function () {
      harvestInitialState();
      scanAll();
    }, 2500);
  }

  boot();
})();
