// ==UserScript==
// @name         B站 IP 归属地显示（仅透传公开数据）
// @namespace    https://github.com/local/bilibili-ip-location-viewer
// @version      1.0.0
// @description  在 B 站（bilibili.com）电脑端页面展示公开数据中已返回的 IP 归属地信息：只透传页面（DOM 属性 / 内嵌全局状态）或公开接口（api.bilibili.com/x/v2/reply，见 @connect）已给出的省份级文本，不推断、不猜测精确位置；不收集、不上传、不持久化任何用户隐私数据。
// @author       local
// @match        *://*.bilibili.com/*
// @match        *://bilibili.com/*
// @grant        GM_xmlhttpRequest
// @connect      api.bilibili.com
// @run-at       document-idle
// @noframes
// @license      MIT
// ==/UserScript==

/*
 * 设计说明
 * ------------------------------------------------------------------
 * 1. 数据来源（按优先级，均为“页面或公开接口已经返回”的信息，仅透传，不做推断）：
 *    a. DOM 属性：data-ip-location / data-iplocation / data-ip_location / data-iploc / ip_location；
 *    b. 页面内嵌全局状态：window.__INITIAL_STATE__（含 Firefox 的 wrappedJSObject 兼容）中
 *       key 为 ip_location / ipLoc / ipLocation / ip-location 的字符串，且同一对象带 rpid 时按
 *       rpid 关联到评论节点；
 *    c. 公开接口兜底：https://api.bilibili.com/x/v2/reply（已在元数据块以
 *       @grant GM_xmlhttpRequest + @connect api.bilibili.com 显式声明），仅当页面评论
 *       缺少归属地数据且能从内嵌状态取得 aid 时发起一次，透传响应中的 ip_location 字符串。
 * 2. SPA 适配：MutationObserver(subtree) + 150ms 防抖重扫；popstate / hashchange 兜底；
 *    路由切换或 DOM 更新后对新增节点自动生效。
 * 3. 去重：宿主节点只插入一个 badge（data-se-ip-processed 属性 + 节点自身引用 __seBadge）；
 *    节点被复用且数据变化时原地更新文本，绝不重复插入。
 * 4. 降级：字段存在但内容缺失 → 灰色“IP属地：—”；网络请求失败 → 评论区底部一条灰色备注；
 *    完全无数据痕迹的节点一律不动（静默）。
 * 5. 隐私与最小权限：无 GM_setValue / localStorage / 任何上传行为；接口 GET 请求带
 *    cookie:false（不携带浏览器 Cookie）；只读取已公开的省份级归属地文本与公开 id。
 */

(function () {
  'use strict';

  /* ============ 常量 ============ */
  var CONTAINER_SELECTOR = '[data-rpid],.reply-item,.comment-item,[class*="reply-item"],[class*="comment-item"]';
  var IP_SOURCE_SELECTOR = '[data-ip-location],[data-iplocation],[data-ip_location],[data-iploc],[ip_location]';
  var META_SELECTOR = '[class*="meta"],[class*="info"],[class*="user-info"],[class*="bili-comment-user"]';
  var COMMENT_AREA_SELECTOR = '#comment,#commentapp,.comment-area,[class*="comment-area"]';
  var SKIP_ANCESTOR_SELECTOR = 'script,style,template,[hidden]';
  var NAIVE_IP_RE = /IP属地\s*[·:：]?\s*([\u4e00-\u9fa5·]{1,12})/;
  var API_ENDPOINT = 'https://api.bilibili.com/x/v2/reply'; // 公开评论接口（响应含 ip_location），已声明于元数据块
  var ATTR_KEYS = ['data-ip-location', 'data-iplocation', 'data-ip_location', 'data-iploc', 'ip_location'];

  /* ============ 数据清洗：只透传 B 站已返回的文本，不推断任何位置 ============ */
  function normalizeLocation(raw) {
    var v = typeof raw === 'string' ? raw.trim() : '';
    if (!v) return null;
    var m = v.match(NAIVE_IP_RE);
    if (m) v = m[1].trim();
    if (!v || v.length > 24) return null;
    if (!/^[\u4e00-\u9fa5A-Za-z0-9·\s\-—.]+$/.test(v)) return null;
    if (/^(未知|unknown|null|undefined|none|-)$/i.test(v)) return null;
    return v;
  }

  /* ============ 内嵌全局状态（页面已经返回的数据） ============ */
  var stateCache = null;
  var stateCacheKey = '';

  function getStateObject() {
    try {
      if (window.__INITIAL_STATE__ && typeof window.__INITIAL_STATE__ === 'object') return window.__INITIAL_STATE__;
      if (window.wrappedJSObject && window.wrappedJSObject.__INITIAL_STATE__ && typeof window.wrappedJSObject.__INITIAL_STATE__ === 'object') return window.wrappedJSObject.__INITIAL_STATE__;
    } catch (e) { /* 沙箱受限则跳过该数据源 */ }
    return null;
  }

  function walkState(o, depth, budget, out) {
    if (!o || typeof o !== 'object') return;
    if (depth > 12 || budget.nodes <= 0) return;
    budget.nodes -= 1;
    if (Array.isArray(o)) {
      for (var i = 0; i < o.length; i++) walkState(o[i], depth + 1, budget, out);
      return;
    }
    for (var k in o) {
      if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
      var v = o[k];
      var lk = String(k).toLowerCase();
      if (lk === 'ip_location' || lk === 'iplocation' || lk === 'iploc' || lk === 'ip-location') {
        var loc = normalizeLocation(v);
        if (loc && o.rpid != null) out.push({ rpid: String(o.rpid), location: loc });
      } else if (v && typeof v === 'object') {
        walkState(v, depth + 1, budget, out);
      }
    }
  }

  function collectFromState() {
    var key = location.pathname + location.search + location.hash;
    if (key === stateCacheKey && stateCache) return stateCache;
    var out = [];
    var state = getStateObject();
    if (state) walkState(state, 0, { nodes: 60000 }, out);
    var seen = {};
    var rows = [];
    for (var i = 0; i < out.length; i++) {
      if (seen[out[i].rpid]) continue;
      seen[out[i].rpid] = true;
      rows.push(out[i]);
    }
    stateCache = rows;
    stateCacheKey = key;
    return rows;
  }

  /* ============ 宿主定位 ============ */
  function findOwner(el) {
    if (!el || el.nodeType !== 1) return null;
    try { return el.closest(CONTAINER_SELECTOR) || el; } catch (e) { return el; }
  }

  function hostHasNativeIpText(host) {
    try {
      var hay = host.innerText != null ? host.innerText : (host.textContent || '');
      return NAIVE_IP_RE.test(hay);
    } catch (e) { return false; }
  }

  function getOwnBadge(host) {
    var b = host.__seBadge;
    if (b && b.isConnected) return b;
    return null;
  }

  /* ============ badge 注入（含原地更新，绝无二次插入） ============ */
  function applyBadge(entry) {
    var host = entry.host;
    if (!host || host.nodeType !== 1) return;
    if (host.__seDone) { /* 已有我们注入的 badge：仅原地更新文本 */
      var b = getOwnBadge(host);
      if (b && !entry.unknown && b.textContent !== 'IP属地：' + entry.location) {
        b.textContent = 'IP属地：' + entry.location;
        b.className = 'se-ip-badge';
      }
      return;
    }
    if (hostHasNativeIpText(host)) { /* B 站自己已显示该条 IP 属地 → 不重复插入 */
      host.__seDone = true;
      host.__seNative = true;
      return;
    }
    var badge = document.createElement('span');
    badge.setAttribute('data-se-ip-badge', '1');
    badge.className = 'se-ip-badge' + (entry.unknown ? ' se-ip-unknown' : '');
    badge.textContent = entry.unknown ? 'IP属地：—' : 'IP属地：' + entry.location;
    host.setAttribute('data-se-ip-processed', entry.unknown ? 'unknown' : 'ok');
    host.__seDone = true;
    host.__seBadge = badge;
    host.__seUnknown = !!entry.unknown;
    var target = host;
    try {
      var meta = host.querySelector ? host.querySelector(META_SELECTOR) : null;
      if (meta) target = meta;
    } catch (e) { /* 忽略 */ }
    target.appendChild(badge);
  }

  /* ============ 页面扫描（防抖后在 MutationObserver 回调中调用） ============ */
  function scan() {
    var entries = [];

    /* 源 1：DOM 属性 */
    var sources = [];
    try { sources = Array.prototype.slice.call(document.querySelectorAll(IP_SOURCE_SELECTOR)); } catch (e) { sources = []; }
    for (var i = 0; i < sources.length; i++) {
      var el = sources[i];
      if (!el || el.nodeType !== 1) continue;
      var owner = findOwner(el);
      if (!owner) continue;
      if (owner.closest && owner.closest(SKIP_ANCESTOR_SELECTOR)) continue;
      var raw = '';
      for (var a = 0; a < ATTR_KEYS.length; a++) {
        if (el.hasAttribute(ATTR_KEYS[a])) { raw = el.getAttribute(ATTR_KEYS[a]) || ''; break; }
      }
      if (raw.trim() === '') {
        /* 字段存在但内容缺失 → 灰色占位（可识别但不打扰） */
        entries.push({ host: owner, location: null, unknown: true });
      } else {
        var loc = normalizeLocation(raw);
        if (loc) entries.push({ host: owner, location: loc, unknown: false });
      }
    }

    /* 源 2：内嵌全局状态（按 rpid 关联到评论节点） */
    var rows = collectFromState();
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var node = null;
      try { node = document.querySelector('[data-rpid="' + row.rpid + '"]'); } catch (e) { node = null; }
      if (!node || node.nodeType !== 1) continue;
      var owner2 = findOwner(node);
      if (!owner2) continue;
      if (owner2.closest && owner2.closest(SKIP_ANCESTOR_SELECTOR)) continue;
      entries.push({ host: owner2, location: row.location, unknown: false });
    }

    for (var k = 0; k < entries.length; k++) applyBadge(entries[k]);
  }

  /* ============ 公开接口兜底（@grant GM_xmlhttpRequest + @connect api.bilibili.com 已声明） ============ */
  var apiFetched = {};
  var apiBusy = false;

  function getAid() {
    var state = getStateObject();
    var aid = null;
    try {
      if (state && state.videoData && state.videoData.aid != null) aid = state.videoData.aid;
      else if (state && state.aid != null) aid = state.aid;
    } catch (e) { aid = null; }
    return aid != null ? String(aid) : null;
  }

  function hasEnrichableItems() {
    try {
      var nodes = document.querySelectorAll(CONTAINER_SELECTOR);
      for (var i = 0; i < nodes.length; i++) {
        if (!nodes[i].__seDone) return true;
      }
    } catch (e) { /* 忽略 */ }
    return false;
  }

  function showApiFailNote() {
    var area = null;
    try { area = document.querySelector(COMMENT_AREA_SELECTOR); } catch (e) { area = null; }
    if (!area || area.__seNoteDone) return;
    area.__seNoteDone = true;
    var note = document.createElement('div');
    note.className = 'se-ip-note';
    note.textContent = 'IP属地信息暂不可用（已静默降级）';
    area.appendChild(note);
  }

  function handleApiRow(r) {
    if (!r || typeof r !== 'object') return;
    var loc =
      normalizeLocation(r.ip_location) ||
      normalizeLocation(r.member && r.member.ip_location) ||
      normalizeLocation(r.member && r.member.ipLoc);
    var rpid = r.rpid != null ? String(r.rpid) : null;
    if (!rpid) return;
    var node = null;
    try { node = document.querySelector('[data-rpid="' + rpid + '"]'); } catch (e) { node = null; }
    if (!node || node.nodeType !== 1) return;
    var owner = findOwner(node);
    if (!owner) return;
    applyBadge({ host: owner, location: loc, unknown: loc === null });
  }

  function handleApiResponse(res) {
    if (!res || res.status < 200 || res.status >= 300) { showApiFailNote(); return; }
    var json = null;
    try { json = JSON.parse(res.responseText); } catch (e) { json = null; }
    if (!json || json.code !== 0 || !json.data) { showApiFailNote(); return; }
    var replies = Array.isArray(json.data.replies) ? json.data.replies : [];
    for (var i = 0; i < replies.length; i++) {
      handleApiRow(replies[i]);
      var sub = replies[i] && replies[i].replies;
      if (Array.isArray(sub)) {
        for (var j = 0; j < sub.length; j++) handleApiRow(sub[j]);
      }
    }
  }

  function tryFetchReplies() {
    var aid = getAid();
    if (!aid || apiBusy || apiFetched[aid]) return;
    if (!hasEnrichableItems()) return;
    apiBusy = true;
    apiFetched[aid] = true;
    var url = API_ENDPOINT + '?type=1&oid=' + encodeURIComponent(aid) + '&ps=20&pn=1';
    if (typeof GM_xmlhttpRequest === 'function') {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        headers: { 'Accept': 'application/json' },
        cookie: false, /* 不发送浏览器 Cookie；脚本本身不读取、不存储任何用户信息 */
        timeout: 8000,
        onload: function (res) { apiBusy = false; handleApiResponse(res); },
        onerror: function () { apiBusy = false; showApiFailNote(); },
        ontimeout: function () { apiBusy = false; showApiFailNote(); }
      });
    } else {
      /* 运行环境未提供 GM_xmlhttpRequest → 静默降级，不重复尝试 */
      apiBusy = false;
      showApiFailNote();
    }
  }

  /* ============ 注入样式：内联、小号、灰色、不拦截指针 → 不遮挡原控件与弹层 ============ */
  var styleAdded = false;
  function addStyle() {
    if (styleAdded) return;
    styleAdded = true;
    var st = document.createElement('style');
    st.textContent = '.se-ip-badge{display:inline-block;margin-left:6px;font-size:12px;line-height:1.5;color:#8a919f;vertical-align:middle;white-space:nowrap;pointer-events:none;user-select:none}.se-ip-badge.se-ip-unknown{color:#c4ccd4}.se-ip-note{display:block;margin:8px 0;font-size:12px;color:#c4ccd4;pointer-events:none}';
    (document.head || document.documentElement).appendChild(st);
  }

  /* ============ SPA 适配：MutationObserver + 防抖 + popstate/hashchange 兜底 ============ */
  var scanTimer = null;
  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(function () {
      scanTimer = null;
      scan();
      tryFetchReplies();
    }, 150);
  }

  function init() {
    addStyle();
    scan();
    tryFetchReplies();
    try {
      var obs = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].type === 'childList') { scheduleScan(); return; }
        }
      });
      obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch (e) { /* 极老环境无 MutationObserver：依赖下方事件兜底 */ }
    if (window.addEventListener) {
      window.addEventListener('popstate', scheduleScan);
      window.addEventListener('hashchange', scheduleScan);
    }
  }

  if (document.body) {
    init();
  } else if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', init);
  }
})();