// ==UserScript==
// @name         B站IP归属地显示（零网络权限·只读页面已返回数据）
// @namespace    https://github.com/benchmark/userscripts/bilibili-ip-region
// @version      1.0.0
// @description  在 B 站电脑端（视频评论区/动态/用户空间）显示页面或公开数据中已经返回的 IP 归属地信息。数据来源仅限：条目 data-* 属性、data-* 内嵌 JSON、页面内嵌状态（如 __INITIAL_STATE__）、以及页面已渲染的「IP属地」文本；在对应条目行内注入一枚小号灰色标签，贴合原布局、不遮挡原控件、不响应指针事件。全程不发起任何网络请求，不推断/猜测精确位置，不收集、不上传、不持久化任何隐私数据。MutationObserver + history 路由钩子适配 SPA 动态路由与异步内容加载，多次更新幂等、绝不重复插入；字段缺失时静默降级为可识别但不打扰的灰色占位。
// @author       benchmark
// @license      MIT
// @match        https://www.bilibili.com/*
// @match        https://t.bilibili.com/*
// @match        https://space.bilibili.com/*
// @run-at       document-idle
// @grant        none
// @noframes
// ==/UserScript==
//
// 网络与权限显式声明：本脚本 @grant 为 none，不声明 @connect，不使用
// fetch / XMLHttpRequest / GM_xmlhttpRequest / WebSocket / 信标图片等任何网络通道，
// 也不使用 GM_* 存储、cookie、localStorage——归属地一律取自当前页面「已经返回」并
// 存在于 DOM 或页面内嵌状态中的数据；若条目数据中不含归属地，只显示灰色占位，
// 绝不额外发起请求、绝不推断位置。因此无任何需要显式声明的外部请求域名。
//
// 运行世界：@grant none ⇒ 与页面同处主世界，可直接读取页面自身的
// __INITIAL_STATE__ 等已返回数据，无需任何跨界权限，符合最小权限原则。

(function () {
  'use strict';

  /* ------------------------------ 元守卫 ------------------------------ */

  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return; // 环境缺失：静默退出
  if (window.__BILI_IPREGION_LOADED__) return; // 防止脚本被重复注入执行
  window.__BILI_IPREGION_LOADED__ = true;

  /* ------------------------------ 常量配置 ------------------------------ */

  var BADGE_ATTR = 'data-bili-ipregion-badge'; // 注入标签的判重标记（幂等依据）
  var STYLE_ID = 'bili-ipregion-style';
  var BADGE_CLASS = 'bili-ipregion-badge';
  var PLACEHOLDER_CLASS = 'is-placeholder';
  var PLACEHOLDER_TEXT = '归属地未知';
  var REGION_PREFIX = 'IP属地：';

  var DATA_ATTRS = ['data-ip-region', 'data-ip-restoration', 'data-region', 'data-location'];
  var JSON_ATTRS = ['data-user-info', 'data-member-info', 'data-card', 'data-reply', 'data-dyn', 'data-item'];
  var MID_ATTRS = ['data-mid', 'data-user-id', 'data-uid'];
  var REGION_KEYS = ['ip_region', 'ipRegion', 'IP_Restoration', 'ip_restore', 'ipRestore', 'ip_location', 'ipLocation', 'region', 'location'];

  // 「归属地条目宿主」候选：B 站评论区 / 动态流 / 用户卡片，以及以 data-* 承载归属地的节点（含本地 fixture 常用结构）
  var HOST_SELECTOR = [
    '.reply-item', '.reply-header', '.reply-content',
    '.comment-item', '.comment-body', '.comment-container',
    '.bili-dyn-item', '.dyn-item',
    '.user-card', '.member-card', '.user-info'
  ].join(',') + ',' +
    DATA_ATTRS.map(function (a) { return '[' + a + ']'; }).join(',') + ',' +
    JSON_ATTRS.map(function (a) { return '[' + a + ']'; }).join(',');

  // 只有这些明确的条目类型在缺字段时才显示灰色占位（避免给无关容器刷占位）
  var PLACEABLE_SELECTOR = '.reply-item,.reply-header,.reply-content,.comment-item,.comment-body,.bili-dyn-item,.dyn-item,.user-card,.member-card';

  // 页面已渲染文本的提取（只复制页面已展示/已返回的信息，不做任何推断）
  var REGION_TEXT_RE = /IP属地[:：]\s*([^\s，。；、,;:：|<>()（）【】"'“”‘’]{1,16})/;
  // 归属地取值白名单形态：省/市级中文或代码，1~16 字；不匹配则视为脏数据丢弃（静默降级）
  var REGION_VALUE_RE = /^[一-鿿A-Za-z0-9·]{1,16}$/;

  var MAX_HOSTS_PER_SCAN = 3000;        // 单次扫描宿主上限（防巨型页面卡顿）
  var MAX_PLACEHOLDER_PER_SCAN = 200;   // 单次扫描占位上限（防刷屏打扰）
  var MAX_TEXT_SCAN = 20000;            // 文本提取扫描长度上限
  var SCAN_DEBOUNCE_MS = 200;           // DOM 变更去抖窗口
  var STATE_WALK_MAX_DEPTH = 6;
  var OBJ_WALK_MAX_NODES = 8000;        // JSON 遍历规模上限

  /* ------------------------------ 通用小工具 ------------------------------ */

  function safeGet(obj, key) { try { return obj[key]; } catch (e) { return undefined; } }

  function attrOf(el, name) {
    try { return el.getAttribute(name); } catch (e) { return null; }
  }

  function matches(el, sel) {
    try { return !!(el.matches && el.matches(sel)); } catch (e) { return false; }
  }

  function validRegion(v) {
    if (typeof v !== 'string') return null;
    v = v.trim();
    if (!v || v === '未知') return null;
    return REGION_VALUE_RE.test(v) ? v : null;
  }

  function pickRegionFlat(o) {
    for (var i = 0; i < REGION_KEYS.length; i++) {
      var r = validRegion(safeGet(o, REGION_KEYS[i]));
      if (r) return r;
    }
    return null;
  }

  /* ------------------------------ 归属地提取（只读页面已返回数据） ------------------------------ */

  // 1) data-* 直取 + data-* 内嵌 JSON（深度/环/规模保护的递归找字段）
  function regionFromObject(root) {
    var seen = new Set();
    var budget = { n: 0 };
    function walk(node, depth) {
      if (!node || typeof node !== 'object' || depth > 5) return null;
      if (seen.has(node)) return null;
      seen.add(node);
      if (++budget.n > OBJ_WALK_MAX_NODES) return null;
      if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) {
          var ra = walk(node[i], depth + 1);
          if (ra) return ra;
        }
        return null;
      }
      var direct = pickRegionFlat(node);
      if (direct) return direct;
      for (var k in node) {
        if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
        var v;
        try { v = node[k]; } catch (e) { continue; }
        if (v && typeof v === 'object') {
          var rb = walk(v, depth + 1);
          if (rb) return rb;
        }
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
      try {
        var r2 = regionFromObject(JSON.parse(raw));
        if (r2) return r2;
      } catch (e) { /* 脏 JSON：静默跳过 */ }
    }
    return null;
  }

  // 2) 页面内嵌状态：__INITIAL_STATE__ / __INITIAL_DATA__ 里 mid → 归属地 映射（带引用缓存）
  var _sRef1 = null, _sRef2 = null, _stateCache = null;
  function buildStateMap(node, map, depth, seen, budget) {
    if (!node || typeof node !== 'object' || depth > STATE_WALK_MAX_DEPTH) return;
    if (seen.has(node)) return;
    seen.add(node);
    if (++budget.n > OBJ_WALK_MAX_NODES) return;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) buildStateMap(node[i], map, depth + 1, seen, budget);
      return;
    }
    var mid = node.mid !== undefined ? node.mid : node.mid_str;
    if (mid !== undefined && mid !== null && mid !== '') {
      var region = pickRegionFlat(node);
      if (!region) { // 归属地字段挂在 card/member/user 等一层子对象上的常见形态
        for (var key in node) {
          if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
          var child;
          try { child = node[key]; } catch (e) { continue; }
          if (child && typeof child === 'object' && !Array.isArray(child)) {
            region = pickRegionFlat(child);
            if (region) break;
          }
        }
      }
      if (region) {
        var mk = String(mid).trim();
        if (mk && !map[mk]) map[mk] = region;
      }
    }
    for (var k2 in node) {
      if (!Object.prototype.hasOwnProperty.call(node, k2)) continue;
      var v;
      try { v = node[k2]; } catch (e) { continue; }
      if (v && typeof v === 'object') buildStateMap(v, map, depth + 1, seen, budget);
    }
  }

  function stateRegionMap() {
    var s1 = safeGet(window, '__INITIAL_STATE__');
    var s2 = safeGet(window, '__INITIAL_DATA__');
    if (_stateCache && _sRef1 === s1 && _sRef2 === s2) return _stateCache;
    _sRef1 = s1; _sRef2 = s2;
    var map = {};
    var seen = new Set();
    var budget = { n: 0 };
    buildStateMap(s1, map, 0, seen, budget);
    buildStateMap(s2, map, 0, seen, budget);
    _stateCache = map;
    return map;
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

  // 3) 页面已渲染的「IP属地：xx」文本（数据同样来自页面已返回内容，仅原样呈现）
  function regionFromText(el) {
    var txt = '';
    try { txt = el.textContent || ''; } catch (e) { return null; }
    if (txt.length > MAX_TEXT_SCAN) txt = txt.slice(0, MAX_TEXT_SCAN);
    var m = REGION_TEXT_RE.exec(txt);
    return m ? validRegion(m[1]) : null;
  }

  function resolveRegion(host) {
    var region = regionFromAttrs(host);
    if (region) return region;
    var mid = midOfHost(host);
    if (mid) {
      var r = stateRegionMap()[mid];
      if (r) return r;
    }
    return regionFromText(host);
  }

  /* ------------------------------ 注入（幂等·贴合布局） ------------------------------ */

  function ensureStyle() {
    try {
      if (document.getElementById(STYLE_ID)) return;
      var st = document.createElement('style');
      st.id = STYLE_ID;
      // 行内小号灰色标签：pointer-events:none 不遮挡任何原控件/弹层；无定位浮动，随文档流走
      st.textContent =
        '.' + BADGE_CLASS + '{display:inline-block;margin-inline-start:8px;font-size:12px;line-height:18px;' +
        'color:#9499a0;background:rgba(148,153,160,.08);border:1px solid rgba(148,153,160,.35);' +
        'border-radius:4px;padding:0 6px;vertical-align:middle;white-space:nowrap;position:static;' +
        'pointer-events:none;user-select:none;font-family:inherit;}' +
        '.' + BADGE_CLASS + '.' + PLACEHOLDER_CLASS + '{border-style:dashed;color:#b8bdc7;background:transparent;}';
      (document.head || document.documentElement).appendChild(st);
    } catch (e) { /* 样式失败也继续：标签本身仍可识别 */ }
  }

  function makeBadge(region, placeholder) {
    var b = document.createElement('span');
    b.setAttribute(BADGE_ATTR, placeholder ? 'placeholder' : 'ok');
    b.className = BADGE_CLASS + (placeholder ? ' ' + PLACEHOLDER_CLASS : '');
    b.textContent = placeholder ? PLACEHOLDER_TEXT : REGION_PREFIX + region;
    try {
      b.title = placeholder ? '页面已返回的数据中不含该条目的 IP 归属地' : 'IP 归属地（取自页面已返回数据）：' + region;
    } catch (e) { /* 静默 */ }
    return b;
  }

  // 宿主下不存在「被识别为另一宿主」的更深层宿主时才可安全加占位
  function existingBadge(host) {
    var kids = host.children || [];
    for (var i = 0; i < kids.length; i++) {
      try { if (kids[i].hasAttribute && kids[i].hasAttribute(BADGE_ATTR)) return kids[i]; } catch (e) { /* skip */ }
    }
    return null;
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

  function insertBadgeAt(host, badge) {
    // 贴合原布局：优先插在用户名链接所在行（作为其直接子节点之后），否则追加到条目容器末尾
    var anchor = null;
    try {
      var links = host.querySelectorAll('a[href*="space.bilibili.com"]');
      if (links && links.length) anchor = links[0];
    } catch (e) { anchor = null; }
    try {
      if (anchor) {
        var child = directChildOf(host, anchor);
        if (child) { host.insertBefore(badge, child.nextSibling || null); return; }
      }
      host.appendChild(badge);
    } catch (e) {
      try { host.appendChild(badge); } catch (e2) { /* 彻底失败：静默降级 */ }
    }
  }

  function badgeRegionText(badge) {
    var t = '';
    try { t = badge.textContent || ''; } catch (e) { return null; }
    return t.indexOf(REGION_PREFIX) === 0 ? t.slice(REGION_PREFIX.length) : null;
  }

  function processHost(host, counters) {
    var region = null;
    try { region = resolveRegion(host); } catch (e) { region = null; } // 字段缺失/异常：走占位分支
    var badge = existingBadge(host);
    if (region) {
      if (badge && badge.getAttribute(BADGE_ATTR) === 'ok' && badgeRegionText(badge) === region) return; // 幂等：已一致，不重复插入
      if (badge) { try { host.removeChild(badge); } catch (e) { /* 静默 */ } }
      insertBadgeAt(host, makeBadge(region, false));
      counters.ok++;
    } else {
      if (badge) return;                                   // 已有标签/占位：不打扰、不重复
      if (!matches(host, PLACEABLE_SELECTOR)) return;      // 非条目类容器不加占位
      if (counters.ph >= MAX_PLACEHOLDER_PER_SCAN) return; // 占位总量上限
      insertBadgeAt(host, makeBadge(null, true));
      counters.ph++;
    }
  }

  /* ------------------------------ 扫描与宿主收集 ------------------------------ */

  function collectHosts() {
    var out = [];
    var isSet = (typeof Set === 'function');
    var seen = isSet ? new Set() : null;

    function collectFrom(root) {
      var list;
      try { list = root.querySelectorAll(HOST_SELECTOR); } catch (e) { return; }
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        if (!el || (seen && seen.has(el))) continue;
        if (seen) seen.add(el);
        out.push(el);
        if (out.length >= MAX_HOSTS_PER_SCAN) return;
      }
    }

    collectFrom(document);

    // 尽力而为：穿透新版评论区已知组件的「开放」Shadow Root（关闭式无法访问，属已知局限）
    try {
      var shadowTags = ['bili-comment-thread-renderer', 'bili-comment-renderer', 'bili-comment-list-renderer', 'bili-comment-reply-renderer'];
      for (var t = 0; t < shadowTags.length && out.length < MAX_HOSTS_PER_SCAN; t++) {
        var hosts;
        try { hosts = document.querySelectorAll(shadowTags[t]); } catch (e) { continue; }
        for (var s = 0; s < hosts.length; s++) {
          var sr = safeGet(hosts[s], 'shadowRoot');
          if (sr && typeof sr.querySelectorAll === 'function') collectFrom(sr);
        }
      }
    } catch (e) { /* 静默 */ }

    // 叶子化：若某宿主的后代中还有别的宿主，则剔除该祖先宿主，保证每个条目只有一枚标签
    if (seen && isSet) {
      var exclude = new Set();
      for (var j = 0; j < out.length; j++) {
        var p = out[j].parentElement || out[j].parentNode;
        while (p) {
          if (seen.has(p)) { exclude.add(p); break; }
          p = p.parentElement || p.parentNode;
          if (p === out[j] || !p) break;
        }
      }
      if (exclude.size) {
        out = out.filter(function (el) { return !exclude.has(el); });
      }
    }
    return out;
  }

  function scan() {
    try {
      ensureStyle();
      var hosts = collectHosts();
      var counters = { ok: 0, ph: 0 };
      for (var i = 0; i < hosts.length; i++) {
        try { processHost(hosts[i], counters); } catch (e) { /* 单条目异常不影响其它条目 */ }
      }
    } catch (e) { /* 全局静默降级：不打扰用户，下一轮 DOM 变更会再试 */ }
  }

  /* ------------------------------ SPA 动态路由与异步更新适配 ------------------------------ */

  var _timer = null;
  function scheduleScan() {
    if (_timer) return; // 去抖：多次 DOM 变更合并为一次扫描，天然幂等
    _timer = setTimeout(function () {
      _timer = null;
      scan();
    }, SCAN_DEBOUNCE_MS);
  }

  function startObserver() {
    try {
      var mo = new MutationObserver(function () { scheduleScan(); });
      mo.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: DATA_ATTRS.concat(JSON_ATTRS)
      });
    } catch (e) {
      // MutationObserver 挂载失败属异常环境：仅做一次性扫描
      scan();
    }
  }

  function hookRouting() {
    try {
      var his = window.history;
      if (his) {
        ['pushState', 'replaceState'].forEach(function (m) {
          var orig = his[m];
          if (typeof orig !== 'function' || orig.__biliIpRegionWrapped) return;
          var wrapped = function () {
            var r = orig.apply(this, arguments);
            scheduleScan(); // B 站为 SPA：路由切换后 DOM 异步重渲染，观察器兜底，这里再主动扫一次
            return r;
          };
          wrapped.__biliIpRegionWrapped = true;
          his[m] = wrapped;
        });
      }
    } catch (e) { /* 静默 */ }
    try { window.addEventListener('popstate', scheduleScan, false); } catch (e) { /* 静默 */ }
    try { window.addEventListener('hashchange', scheduleScan, false); } catch (e) { /* 静默 */ }
    try { document.addEventListener('visibilitychange', scheduleScan, false); } catch (e) { /* 静默 */ }
  }

  /* ------------------------------ 入口 ------------------------------ */

  function start() {
    ensureStyle();
    startObserver();
    hookRouting();
    scheduleScan();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, false);
  } else {
    start();
  }
})();
