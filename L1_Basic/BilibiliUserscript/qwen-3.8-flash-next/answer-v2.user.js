// ==UserScript==
// @name         B站IP归属地显示 v2（评论区 reply_control.location 权威通道）
// @namespace    https://github.com/benchmark/userscripts/bilibili-ip-region
// @version      2.0.0
// @description  在 B 站电脑端显示 IP 归属地。取证结论（见交付包 evidence/）：新版评论区把渲染 "IP属地" 的组件代码注释禁用（new-comment.js: // item?.reply_control?.location ? `<span class="reply-location">IP属地：…`），且归属地仅存在于评论区自身数据源接口 /x/v2/reply/main 响应的 replies[].reply_control.location（登录态下发，文档：需登录）。因此 v2 双通道：①GM_xmlhttpRequest 按页面自身同款参数请求该公开接口（浏览器自动携带登录 cookie），构建 rpid→location 映射，注入到条目 .time-location（B站 自己预留的渲染位）；②本地四源（data-* 属性 / 内嵌 JSON / __INITIAL_STATE__ / 已渲染「IP属地」文本）作为动态页、空间页与 fixture 的兼容通道，并递归穿透 open shadowRoot（官方组件 attachShadow mode:"open"）且为每个 shadow 根挂观察器。只展示接口/页面已返回的信息，不推断位置；不收集、不上传、不持久化任何隐私；幂等注入，多次更新不重复；缺失字段灰色占位，请求失败静默降级。
// @author       benchmark
// @license      MIT
// @match        https://www.bilibili.com/*
// @match        https://t.bilibili.com/*
// @match        https://space.bilibili.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      api.bilibili.com
// @noframes
// ==/UserScript==
//
// 网络与权限显式声明（最小必要）：
//   唯一的网络出口 = 本页面评论区自身使用的公开接口
//   GET https://api.bilibili.com/x/v2/reply/main?type=1&oid=<当前视频aid>&mode=3&next=<页码>&plat=1
//   （与组件内 api.main 定义逐字一致，见 evidence/new-comment.js @316507；无 wbi 签名要求，见 evidence/reply-main.json code=0）
//   除此之外不使用 fetch / XMLHttpRequest / WebSocket / 信标；不使用任何 GM 存储；不上传任何数据。
//   @connect 仅声明 api.bilibili.com 单域名。aid 取自页面自身 __INITIAL_STATE__.aid（evidence/video-page.html）。
//

(function () {
  'use strict';

  if (typeof document === 'undefined') return;
  var w = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window; // @grant 非 none 时经 unsafeWindow 读页面主世界状态
  var hasGM = (typeof GM_xmlhttpRequest === 'function');
  if (w.__BILI_IPREGION_LOADED_V2__) return;
  w.__BILI_IPREGION_LOADED_V2__ = true;

  /* ---------------- 常量（全部锚点/字段均来自 evidence/ 一手取证） ---------------- */

  var BADGE_ATTR = 'data-bili-ipregion-badge';   // 注入标签（幂等判重）
  var BADGE_CLASS = 'bili-ipregion-badge';
  var PLACEHOLDER_CLASS = 'is-placeholder';
  var PLACEHOLDER_TEXT = '归属地未知';
  var REGION_PREFIX = 'IP属地：';
  var STYLE_ID = 'bili-ipregion-style';

  // E-06/E-07：字段=reply_control.location，登录态下发；两种历史值形态并存："IP属地：河北"(文档实测) 与裸值"河北"(旧简模板拼接)
  var LOCATION_FIELD = 'location';
  var REPLY_CONTROL_FIELD = 'reply_control';
  // E-13：官方条目模板 <div class="reply-item reply-wrap" data-id="<rpid>">；主评 .list-item 同源 data-id(@336414 rpid=node.data('id'))
  var RP_ID_ATTR = 'data-id';
  // E-10/E-12：评论区容器（真实页观察锚，条目定位以 [data-id] 为准）
  var ITEM_HOST_SELECTOR = '.list-item, .reply-item, .comment-item, .bili-dyn-item, .dyn-item, .user-card, .member-card';
  // E-10/E-12：官方归属地渲染位为 .time-location（其内 .reply-time 之后），插入逻辑见 insertAtOfficialSpot
  // v1 兼容本地通道（fixture / 老结构）
  var DATA_ATTRS = ['data-ip-region', 'data-ip-restoration', 'data-region', 'data-location'];
  var JSON_ATTRS = ['data-user-info', 'data-member-info', 'data-card', 'data-reply', 'data-dyn', 'data-item'];
  var MID_ATTRS = ['data-mid', 'data-user-id', 'data-uid', 'data-usercard-mid']; // E-13: 用户名模板带 data-usercard-mid
  var REGION_KEYS = ['ip_region', 'ipRegion', 'IP_Restoration', 'ip_restore', 'ipRestore', 'ip_location', 'ipLocation', 'region'];
  var HOST_SELECTOR = ITEM_HOST_SELECTOR + ',' +
    DATA_ATTRS.map(function (a) { return '[' + a + ']'; }).join(',') + ',' +
    JSON_ATTRS.map(function (a) { return '[' + a + ']'; }).join(',');
  var PLACEABLE_SELECTOR = ITEM_HOST_SELECTOR;

  var REGION_TEXT_RE = /IP属地[:：]\s*([^\s，。；、,;:：|<>()（）【】"'“”‘’]{1,16})/;
  var REGION_VALUE_RE = /^[一-鿿A-Za-z0-9·]{1,16}$/;

  var SCAN_DEBOUNCE_MS = 300;
  var MAX_PAGES = 5;          // /x/v2/reply/main 最多顺取 5 页（≈100 主评，覆盖首屏与滚动前几屏）
  var MAX_HOSTS_PER_SCAN = 3000;
  var MAX_PLACEHOLDER_PER_SCAN = 200;
  var MAX_TEXT_SCAN = 20000;
  var SHADOW_DEPTH = 4;
  var IFRAME_DEPTH = 1;

  /* ---------------- 归属地取值规范化（仅呈现已返回字符串，不推断） ---------------- */

  function normalizeLocation(raw) {
    if (typeof raw !== 'string') return null;
    raw = raw.trim();
    if (!raw || raw === '未知') return null;
    var m = /^IP属地[:：]\s*(.+)$/.exec(raw); // 文档形态 "IP属地：河北"（E-06 逐字）
    var v = (m ? m[1] : raw).trim();
    return REGION_VALUE_RE.test(v) ? v : null;
  }

  function validRegion(v) {
    if (typeof v !== 'string') return null;
    v = v.trim();
    if (!v || v === '未知') return null;
    return REGION_VALUE_RE.test(v) ? v : null;
  }

  function pickRegionFlat(o) {
    for (var i = 0; i < REGION_KEYS.length; i++) {
      var r = validRegion(o[REGION_KEYS[i]]);
      if (r) return r;
    }
    return null;
  }

  /* ---------------- 通道①：页面自身公开接口 /x/v2/reply/main（E-02/E-12） ---------------- */

  var _api = { oid: null, done: false, pending: false, page: 0, next: 0, byRpid: {}, covered: {} };

  function currentAid() {
    try {
      var st = w.__INITIAL_STATE__;
      if (st && (st.aid || (st.videoData && st.videoData.aid))) {
        var a = st.aid || st.videoData.aid;
        if (/^\d{1,18}$/.test(String(a))) return String(a);
      }
    } catch (e) { /* 静默 */ }
    try {
      var m = /\/video\/(?:BV[\w]+|av(\d+))/i.exec(w.location.pathname || '');
      if (m && m[1]) return m[1];
    } catch (e) { /* 静默 */ }
    return null;
  }

  function replyMainUrl(oid, page, next) {
    return 'https://api.bilibili.com/x/v2/reply/main?type=1&oid=' + encodeURIComponent(oid) +
      '&mode=3&next=' + next + '&plat=1';
  }

  function ingestReplyList(data) {
    if (!data || typeof data !== 'object') return;
    var lists = [];
    try {
      lists.push(data.replies || [], data.top_replies || [], data.hot_replies || []);
      if (data.top && data.top.reply) lists.push([data.top.reply]);
    } catch (e) { /* 静默 */ }
    function take(item) {
      if (!item || !item.reply_control) return;
      var key = String(item.rpid_str || item.rpid || '');
      if (!key) return;
      _api.covered[key] = true;                       // 接口已覆盖该 rpid（有无 location 都算覆盖）
      var loc = normalizeLocation(item.reply_control[LOCATION_FIELD]);
      if (loc && !_api.byRpid[key]) _api.byRpid[key] = loc;
      (item.replies || []).forEach(function (sub) {    // 预加载的前3条子回复同样带 reply_control（E-02）
        if (!sub || !sub.reply_control) return;
        var sk = String(sub.rpid_str || sub.rpid || '');
        if (!sk) return;
        _api.covered[sk] = true;
        var sl = normalizeLocation(sub.reply_control[LOCATION_FIELD]);
        if (sl && !_api.byRpid[sk]) _api.byRpid[sk] = sl;
      });
    }
    lists.forEach(function (list) { (list || []).forEach(take); });
  }

  function loadMoreOrFinish() {
    if (_api.page + 1 >= MAX_PAGES) { _api.done = true; scheduleScan(); return; }
    fetchPage();
  }

  function fetchPage() {
    if (!hasGM || _api.done || _api.pending || !_api.oid) return;
    _api.pending = true;
    var url = replyMainUrl(_api.oid, _api.page, _api.next);
    try {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        headers: { 'Accept': 'application/json' },
        timeout: 15000,
        onload: function (res) {
          _api.pending = false;
          try {
            var j = JSON.parse(res.responseText);
            if (j && j.code === 0 && j.data) {
              ingestReplyList(j.data);
              _api.page++;
              var cur = j.data.cursor || {};
              _api.next = cur.next || (_api.next + 1);
              if (cur.is_end) _api.done = true;
            } else {
              _api.done = true; // 风控/无权限/非0码：静默降级（本地通道仍工作）
            }
          } catch (e) { _api.done = true; }
          scheduleScan();
          if (!_api.done) loadMoreOrFinish();
        },
        onerror: function () { _api.pending = false; _api.done = true; scheduleScan(); },     // 网络失败：静默
        ontimeout: function () { _api.pending = false; _api.done = true; scheduleScan(); },
      });
    } catch (e) { _api.pending = false; _api.done = true; }
  }

  function ensureApi() {
    if (!hasGM) return;
    var aid = currentAid();
    if (!aid) return;
    if (aid !== _api.oid) { // SPA 路由切视频：重置并重新拉取（旧数据自然失效）
      _api = { oid: aid, done: false, pending: false, page: 0, next: 0, byRpid: {}, covered: {} };
    }
    fetchPage();
  }

  /* ---------------- 通道②：本地数据源（v1 四路兼容，fixture/动态/空间页） ---------------- */

  function attrOf(el, name) { try { return el.getAttribute(name); } catch (e) { return null; } }
  function matches(el, sel) { try { return !!(el.matches && el.matches(sel)); } catch (e) { return false; } }

  function regionFromObject(root) {
    var seen = new Set(); var budget = { n: 0 };
    function walk(node, depth) {
      if (!node || typeof node !== 'object' || depth > 5) return null;
      if (seen.has(node)) return null;
      seen.add(node);
      if (++budget.n > 8000) return null;
      if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) { var ra = walk(node[i], depth + 1); if (ra) return ra; }
        return null;
      }
      var direct = pickRegionFlat(node);
      if (direct) return direct;
      var rc = node[REPLY_CONTROL_FIELD];
      if (rc && typeof rc === 'object') { var rl = normalizeLocation(rc[LOCATION_FIELD]); if (rl) return rl; }
      for (var k in node) {
        if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
        var v; try { v = node[k]; } catch (e) { continue; }
        if (v && typeof v === 'object') { var rb = walk(v, depth + 1); if (rb) return rb; }
      }
      return null;
    }
    return walk(root, 0);
  }

  function regionFromAttrs(el) {
    for (var i = 0; i < DATA_ATTRS.length; i++) {
      var r = validRegion(attrOf(el, DATA_ATTRS[i]));
      if (r) return r;
    }
    for (var j = 0; j < JSON_ATTRS.length; j++) {
      var raw = attrOf(el, JSON_ATTRS[j]);
      if (!raw) continue;
      try { var r2 = regionFromObject(JSON.parse(raw)); if (r2) return r2; } catch (e) { /* 脏 JSON 静默 */ }
    }
    return null;
  }

  function regionFromText(el) {
    var txt = '';
    try { txt = el.textContent || ''; } catch (e) { return null; }
    if (txt.length > MAX_TEXT_SCAN) txt = txt.slice(0, MAX_TEXT_SCAN);
    var m = REGION_TEXT_RE.exec(txt);
    return m ? validRegion(m[1]) : null;
  }

  function midOfHost(host) {
    for (var i = 0; i < MID_ATTRS.length; i++) {
      var v = attrOf(host, MID_ATTRS[i]);
      if (v && /^\d{1,15}$/.test(v.trim())) return v.trim();
    }
    try {
      var links = host.querySelectorAll('a[href*="space.bilibili.com"]');
      for (var j = 0; j < links.length; j++) {
        var m = /space\.bilibili\.com\/(\d{1,15})/.exec(attrOf(links[j], 'href') || '');
        if (m) return m[1];
      }
    } catch (e) { /* 静默 */ }
    return null;
  }

  var _sRef = null, _stateCache = null;
  function buildStateMap(node, map, depth, seen, budget) {
    if (!node || typeof node !== 'object' || depth > 6) return;
    if (seen.has(node)) return;
    seen.add(node);
    if (++budget.n > 8000) return;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) buildStateMap(node[i], map, depth + 1, seen, budget);
      return;
    }
    var mid = node.mid !== undefined ? node.mid : node.mid_str;
    if (mid !== undefined && mid !== null && mid !== '') {
      var region = pickRegionFlat(node) || (node[REPLY_CONTROL_FIELD] && normalizeLocation(node[REPLY_CONTROL_FIELD][LOCATION_FIELD]));
      if (region) { var mk = String(mid).trim(); if (mk && !map[mk]) map[mk] = region; }
    }
    for (var k2 in node) {
      if (!Object.prototype.hasOwnProperty.call(node, k2)) continue;
      var v; try { v = node[k2]; } catch (e) { continue; }
      if (v && typeof v === 'object') buildStateMap(v, map, depth + 1, seen, budget);
    }
  }

  function stateRegionMap() {
    var s1 = null, s2 = null;
    try { s1 = w.__INITIAL_STATE__; } catch (e) { /* 静默 */ }
    try { s2 = w.__INITIAL_DATA__; } catch (e) { /* 静默 */ }
    if (_stateCache && _sRef === s1) return _stateCache;
    _sRef = s1;
    var map = {};
    var seen = new Set();
    var budget = { n: 0 };
    buildStateMap(s1, map, 0, seen, budget);
    buildStateMap(s2, map, 0, seen, budget);
    _stateCache = map;
    return map;
  }

  function localRegion(host) {
    var region = regionFromAttrs(host);
    if (region) return region;
    var mid = midOfHost(host);
    if (mid) { var r = stateRegionMap()[mid]; if (r) return r; }
    return regionFromText(host);
  }

  /* ---------------- 注入与样式 ---------------- */

  function styleText() {
    return '.' + BADGE_CLASS + '{display:inline-block;margin-inline-start:8px;font-size:12px;line-height:18px;' +
      'color:#9499a0;background:rgba(148,153,160,.08);border:1px solid rgba(148,153,160,.35);' +
      'border-radius:4px;padding:0 6px;vertical-align:middle;white-space:nowrap;position:static;' +
      'pointer-events:none;user-select:none;font-family:inherit;}' +
      '.' + BADGE_CLASS + '.' + PLACEHOLDER_CLASS + '{border-style:dashed;color:#b8bdc7;background:transparent;}';
  }

  function ensureStyleIn(root) { // root: document / shadowRoot（E-10 官方组件全为 mode:"open"，可穿透）
    try {
      if (root.getElementById ? root.getElementById(STYLE_ID) : root.querySelector('#' + STYLE_ID)) return;
    } catch (e) { /* 静默 */ }
    try {
      var st = document.createElement('style');
      st.id = STYLE_ID;
      st.textContent = styleText();
      (root.head || root).appendChild(st);
    } catch (e) { /* 静默 */ }
  }

  function makeBadge(region, owner) {
    var b = document.createElement('span');
    b.setAttribute(BADGE_ATTR, region ? 'ok' : 'placeholder');
    if (owner) b.setAttribute('data-rpid-owner', owner);
    b.className = BADGE_CLASS + (region ? '' : ' ' + PLACEHOLDER_CLASS);
    b.textContent = region ? REGION_PREFIX + region : PLACEHOLDER_TEXT;
    try { b.title = region ? 'IP 归属地（来自评论区接口已返回的 reply_control.location）' : '该评论数据中无 IP 归属地（旧评论或来源限制）'; } catch (e) { /* 静默 */ }
    return b;
  }

  function existingBadgeIn(host) {
    try {
      var found = host.querySelectorAll('[' + BADGE_ATTR + ']');
      return found && found.length ? found[0] : null;
    } catch (e) { return null; }
  }

  function insertAtOfficialSpot(host, badge) {
    // 官方预留位：.time-location 内 .reply-time 之后（evidence/new-comment.js 属地#1/#2 逐字结构）
    try {
      var spot = host.querySelector('.time-location');
      if (spot) {
        var rt = spot.querySelector('.reply-time') || spot;
        if (rt.parentNode === spot) { spot.insertBefore(badge, rt.nextSibling || null); return; }
        spot.appendChild(badge);
        return;
      }
    } catch (e) { /* 静默 */ }
    try {
      var links = host.querySelectorAll('a[href*="space.bilibili.com"], a.name');
      if (links && links.length) {
        var anchor = links[0];
        var child = directChildOf(host, anchor);
        if (child) { host.insertBefore(badge, child.nextSibling || null); return; }
      }
    } catch (e) { /* 静默 */ }
    try { host.appendChild(badge); } catch (e2) { /* 彻底失败静默 */ }
  }

  function directChildOf(root, node) {
    var cur = node;
    while (cur && cur !== root) {
      var p = cur.parentNode;
      if (p === root) return cur;
      cur = p;
    }
    return null;
  }

  function upgradeBadgeState(host, badge, region) {
    if (!badge) return;
    badge.setAttribute(BADGE_ATTR, region ? 'ok' : 'placeholder');
    badge.className = BADGE_CLASS + (region ? '' : ' ' + PLACEHOLDER_CLASS);
    badge.textContent = region ? REGION_PREFIX + region : PLACEHOLDER_TEXT;
  }

  /* ---------------- 候选收集：主文档 + 递归 shadowRoot + 同源 iframe ---------------- */

  var _shadowObserved = (typeof WeakSet === 'function') ? new WeakSet() : null;
  var _shadowRoots = [];

  function observeRoot(root) {
    if (_shadowObserved) {
      if (_shadowObserved.has(root)) return;
      _shadowObserved.add(root);
    } else if (root.__biliIpRegionObserved) return;
    if (_shadowObserved === null) root.__biliIpRegionObserved = true;
    try {
      var mo = new MutationObserver(function () { scheduleScan(); });
      mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: DATA_ATTRS.concat(JSON_ATTRS) });
    } catch (e) { /* 静默 */ }
  }

  function collectHosts() {
    var out = [];
    var seen = new Set();
    _shadowRoots = [];

    function collectFromRoot(root, depth) {
      if (out.length >= MAX_HOSTS_PER_SCAN) return;
      var list;
      try { list = root.querySelectorAll(HOST_SELECTOR); } catch (e) { return; }
      for (var i = 0; i < list.length && out.length < MAX_HOSTS_PER_SCAN; i++) {
        var el = list[i];
        if (!el || seen.has(el)) continue;
        seen.add(el);
        out.push(el);
      }
      // 递归进入 open shadowRoot（E-10：attachShadow({mode:"open"}) 全量 open）
      if (depth < SHADOW_DEPTH) {
        var walk = [];
        try { walk = root.querySelectorAll('*'); } catch (e) { /* 静默 */ }
        for (var j = 0; j < walk.length && _shadowRoots.length < 60; j++) {
          var sr;
          try { sr = walk[j].shadowRoot; } catch (e) { continue; }
          if (sr && sr.host && !seen.has(sr) && typeof sr.querySelectorAll === 'function') {
            seen.add(sr);
            _shadowRoots.push(sr);
            observeRoot(sr);
            ensureStyleIn(sr);
            collectFromRoot(sr, depth + 1);
          }
        }
      }
      // 同源 iframe（如评论区 webview）：尝试进入一次（跨源抛 SecurityError → 静默）
      if (depth < IFRAME_DEPTH) {
        var frs = [];
        try { frs = root.querySelectorAll('iframe'); } catch (e) { /* 静默 */ }
        for (var f = 0; f < frs.length && out.length < MAX_HOSTS_PER_SCAN; f++) {
          var doc = null;
          try { doc = frs[f].contentDocument; } catch (e) { continue; }
          if (doc && typeof doc.querySelectorAll === 'function') {
            _shadowRoots.push(doc);
            observeRoot(doc);
            ensureStyleIn(doc);
            collectFromRoot(doc, depth + 1);
          }
        }
      }
    }

    collectFromRoot(document, 0);

    // 叶子化：剔除包含其它候选的祖先宿主（子评 .reply-item 位于主评 .list-item 内部，data-id 不同 → 按 rpid 独立处理，不做互斥）
    return out;
  }

  /* ---------------- 条目处理（通道①优先，②兜底；幂等 owner 判定） ---------------- */

  var _hostKeyMap = (typeof WeakMap === 'function') ? new WeakMap() : null;
  var _hkSeq = 0;
  function hostKey(host) {
    if (_hostKeyMap) {
      if (!_hostKeyMap.has(host)) _hostKeyMap.set(host, 'h' + (++_hkSeq));
      return _hostKeyMap.get(host);
    }
    if (host.__iprKey) return host.__iprKey;
    host.__iprKey = 'h' + (++_hkSeq);
    return host.__iprKey;
  }

  function ownerOf(host, rpid) { return rpid ? 'r' + rpid : hostKey(host); }

  function badgeBelongsTo(badge, key) {
    try { return badge.getAttribute('data-ipr-owner') === key; } catch (e) { return false; }
  }

  function ownBadge(host, key) {
    var found;
    try { found = host.querySelectorAll('[' + BADGE_ATTR + ']'); } catch (e) { return null; }
    for (var i = 0; i < found.length; i++) if (badgeBelongsTo(found[i], key)) return found[i];
    return null;
  }

  function rpIdOf(host) {
    var v = attrOf(host, RP_ID_ATTR);
    return (v && /^\d{6,20}$/.test(v.trim())) ? v.trim() : null;
  }

  function processHost(host, counters) {
    var rpid = null;
    try { rpid = rpIdOf(host); } catch (e) { /* 静默 */ }
    var covered = !!(rpid && _api.covered[rpid]);
    var apiRegion = covered ? (_api.byRpid[rpid] || null) : null;

    var region = null;
    var reliable = false; // reliable=true：结论来自该条目自身数据（可做占位判定）
    if (covered) { region = apiRegion; reliable = true; }
    if (!region) {
      try { region = localRegion(host); } catch (e) { region = null; } // 通道②：本地四源（含异常兜底）
      if (region) reliable = true;
    }

    var key = ownerOf(host, rpid);
    var badge = ownBadge(host, key);

    if (region) {
      if (badge && badge.getAttribute(BADGE_ATTR) === 'ok' && (badge.textContent || '').slice(REGION_PREFIX.length) === region) return; // 幂等：完全一致
      if (badge) upgradeBadgeState(host, badge, region);
      else insertAtOfficialSpot(host, attachOwner(makeBadge(region, rpid), key));
      counters.ok++;
      return;
    }
    if (badge) return; // 已有占位：不重复、不打扰
    if (!reliable) {
      // rpid 未被接口覆盖：真实页深页条目，静默（避免整屏无意义占位）；
      // 非评论宿主（动态/空间/fixture）沿用 v1 占位规则：
      if (rpid && _api.oid) return;
      if (!matches(host, PLACEABLE_SELECTOR)) return;
      if (counters.ph >= MAX_PLACEHOLDER_PER_SCAN) return;
    }
    insertAtOfficialSpot(host, attachOwner(makeBadge(null, rpid), key));
    counters.ph++;
  }

  function attachOwner(badge, key) {
    try { badge.setAttribute('data-ipr-owner', key); } catch (e) { /* 静默 */ }
    return badge;
  }

  /* ---------------- 扫描调度（去抖合并多次 DOM 更新 → 天然幂等） ---------------- */

  var _timer = null;
  function scheduleScan() {
    if (_timer) return;
    _timer = setTimeout(function () {
      _timer = null;
      try { scan(); } catch (e) { /* 全局静默降级，下轮变更再试 */ }
    }, SCAN_DEBOUNCE_MS);
  }

  function scan() {
    ensureStyleIn(document);
    ensureApi(); // oid 变化 → 重置重取；同 oid → 续页或已停
    var hosts = collectHosts();
    var counters = { ok: 0, ph: 0 };
    for (var i = 0; i < hosts.length; i++) {
      try { processHost(hosts[i], counters); } catch (e) { /* 单条目异常隔离 */ }
    }
  }

  /* ---------------- SPA 路由与异步更新适配 ---------------- */

  function startObserver() {
    if (typeof MutationObserver === 'undefined') { scan(); return; }
    try {
      var mo = new MutationObserver(function () { scheduleScan(); });
      mo.observe(document.documentElement, {
        childList: true, subtree: true,
        attributes: true, attributeFilter: DATA_ATTRS.concat(JSON_ATTRS).concat([RP_ID_ATTR]),
      });
    } catch (e) { /* 静默 */ }
  }

  function hookRouting() {
    try {
      var his = w.history;
      if (his) {
        ['pushState', 'replaceState'].forEach(function (m) {
          var orig = his[m];
          if (typeof orig !== 'function' || orig.__iprWrapped) return;
          var wrapped = function () { var r = orig.apply(this, arguments); scheduleScan(); return r; };
          wrapped.__iprWrapped = true;
          his[m] = wrapped;
        });
      }
    } catch (e) { /* 静默 */ }
    try { w.addEventListener('popstate', scheduleScan, false); } catch (e) { /* 静默 */ }
    try { w.addEventListener('hashchange', scheduleScan, false); } catch (e) { /* 静默 */ }
    try { document.addEventListener('visibilitychange', scheduleScan, false); } catch (e) { /* 静默 */ }
  }

  function start() {
    ensureStyleIn(document);
    startObserver();
    hookRouting();
    scheduleScan();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, false);
  else start();
})();
