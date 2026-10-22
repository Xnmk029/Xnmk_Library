// ==UserScript==
// @name         B 站 IP 归属地显示
// @namespace    https://github.com/bilibili-userscript/bilibili-ip-location
// @version      1.0.0
// @description  在 B 站电脑端页面（视频评论区、动态流、个人空间等）显示公开页面/接口已返回的 IP 归属地信息。仅读取页面 DOM 中已渲染的归属地，以及页面自身请求公开回复接口时已返回的 location 字段；脚本不发起任何额外网络请求，不推断、不猜测精确位置，不采集、不上传、不持久化任何用户隐私数据。
// @author       benchmark
// @match        https://www.bilibili.com/*
// @match        https://t.bilibili.com/*
// @match        https://space.bilibili.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/**
 * 设计说明（无任何用户隐私采集）：
 * 1. 归属地仅来自两个"已经返回"的来源：页面 DOM 里 B 站自己渲染出来的
 *    「IP属地」节点，以及页面自身请求公开回复接口（api.bilibili.com/x/v2/reply*）
 *    响应里已携带的 location 字段。脚本不自行构造任何归属地。
 * 2. 脚本不发起新的网络请求（fetch/XHR 仅为"观察"页面已有请求的响应，透传原调用），
 *    因此无需 @connect、@grant GM_xmlhttpRequest 等广域权限，@grant none 即最小权限。
 * 3. 通过 MutationObserver + history 钩子适配 SPA 动态路由与异步加载；
 *    通过徽章去重 + 灰色占位实现静默降级与不打扰状态。
 */
(function () {
  'use strict';

  // 在页面上下文运行（@grant none 时 window 即页面 window；个别管理器沙箱下退化为 unsafeWindow）
  var PAGE = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

  var BADGE_CLASS = 'bili-ip-badge';
  var PREFIX = 'IP属地：';
  var PLACEHOLDER = 'IP属地：未知';

  // 回复/动态卡片单元：归属地最终挂载到这些单元上
  var UNIT_SELECTOR = '.reply-item, .sub-reply-item, .reply-wrap, .bili-dyn-item';

  // 已知承载归属地的节点（B 站常见结构 + 属性兜底）
  var LOCATION_NODE_SELECTOR = '.reply-ip, [class*="ip-location"], [data-location]';

  // 归属地缓存：回复 ID -> 归属地文本（来自公开回复接口响应）
  var locationStore = new Map();

  // 未知形态统一视为"缺失"
  var UNKNOWN_RE = /^(未知|未知IP|未知归属地|未知地点|无)$/;

  // ---- 纯文本归一化：从"IP属地：广东"等文本中提取省份/地区，不推断 ----
  function normalizeLocation(text) {
    if (text == null) return '';
    var s = String(text).replace(/[\s\u00a0]+/g, ' ').trim();
    if (!s) return '';

    var m = s.match(/IP\s*属地\s*[:：]?\s*([\u4e00-\u9fa5]+)/i);
    if (m) {
      var v = m[1];
      if (v && !UNKNOWN_RE.test(v)) return v;
      return '';
    }

    var m2 = s.match(/属地\s*[:：]?\s*([\u4e00-\u9fa5]+)/i);
    if (m2) {
      var v2 = m2[1];
      if (v2 && !UNKNOWN_RE.test(v2)) return v2;
      return '';
    }

    // 裸归属地（如 data-location="广东"）
    var m3 = s.match(/^([\u4e00-\u9fa5]{2,4})$/);
    if (m3) {
      var v3 = m3[1];
      if (v3 && !UNKNOWN_RE.test(v3)) return v3;
    }
    return '';
  }

  function isBadgeNode(node) {
    var el = node && node.nodeType === 1 ? node : (node && node.parentElement);
    while (el) {
      if (el.className && typeof el.className === 'string' &&
          el.className.indexOf(BADGE_CLASS) !== -1) {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  function matchesLocationNode(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      if (typeof el.matches === 'function' && el.matches(LOCATION_NODE_SELECTOR)) return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  function matchesUnit(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      if (typeof el.matches === 'function' && el.matches(UNIT_SELECTOR)) return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  function closestUnit(node) {
    var el = node && node.nodeType === 1 ? node : (node && node.parentElement);
    while (el) {
      if (matchesUnit(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  // 从归属地节点（元素或文本节点）提取归属地
  function locationFromNode(node) {
    if (!node) return '';
    if (node.nodeType === 3) return normalizeLocation(node.nodeValue);
    if (node.nodeType === 1) {
      var loc = normalizeLocation(node.textContent);
      if (loc) return loc;
      if (node.getAttribute) {
        var d = normalizeLocation(node.getAttribute('data-location'));
        if (d) return d;
      }
    }
    return '';
  }

  // 收集子树内所有归属地候选（元素节点 + 独立文本节点），并跳过脚本自身徽章
  function collectCandidates(root, out) {
    if (!root) return;
    if (root.nodeType === 3) {
      if (/IP\s*属地/.test(root.nodeValue) && !isBadgeNode(root)) out.push(root);
      return;
    }
    if (root.nodeType !== 1) return;
    if (matchesLocationNode(root)) {
      if (!isBadgeNode(root)) out.push(root);
      return; // 元素本身就是归属地节点，无需再深入其文本
    }
    var child = root.firstChild;
    while (child) {
      collectCandidates(child, out);
      child = child.nextSibling;
    }
  }

  function safeQueryAll(root, selector) {
    if (!root || typeof root.querySelectorAll !== 'function') return [];
    try {
      return Array.prototype.slice.call(root.querySelectorAll(selector));
    } catch (e) {
      return [];
    }
  }

  function buildBadge(location) {
    var span = document.createElement('span');
    span.className = BADGE_CLASS + (location ? '' : ' is-empty');
    span.textContent = location ? PREFIX + location : PLACEHOLDER;
    span.title = 'IP 归属地（来自公开页面数据）';
    span.setAttribute('aria-hidden', 'true');
    var color = location ? '#9499a0' : '#c9ccd0';
    // 小字号、浅灰、不响应点击，贴合原页面且不遮挡控件
    span.style.cssText = 'display:inline-block;margin-left:6px;padding:0 2px;font-size:12px;' +
      'line-height:16px;color:' + color + ';vertical-align:middle;font-weight:normal;pointer-events:none;';
    return span;
  }

  function injectBadge(unit, location) {
    if (!unit || unit.nodeType !== 1) return null;
    if (unit.querySelector && unit.querySelector('.' + BADGE_CLASS)) return null; // 已存在，去重
    var badge = buildBadge(location);

    // 优先贴到用户名信息区（不遮挡弹层与操作控件），其次动态卡片/评论脚部，最后单元末尾
    var host = unit.querySelector('.user-info');
    if (host) {
      var name = host.querySelector('.user-name');
      if (name) name.insertAdjacentElement('afterend', badge);
      else host.appendChild(badge);
      return badge;
    }
    var alt = unit.querySelector('.bili-dyn-item__footer') ||
              unit.querySelector('.reply-footer') ||
              unit.querySelector('.reply-action');
    if (alt) {
      alt.appendChild(badge);
      return badge;
    }
    unit.appendChild(badge);
    return badge;
  }

  // 把某条归属地应用（或升级占位）到最近回复单元
  function applyLocationToUnit(unit, loc) {
    var existing = unit.querySelector('.' + BADGE_CLASS);
    if (existing) {
      if (existing.classList && existing.classList.contains('is-empty')) {
        existing.textContent = PREFIX + loc;
        existing.classList.remove('is-empty');
        existing.style.color = '#9499a0';
      }
      return;
    }
    injectBadge(unit, loc);
  }

  // 归属地驱动：把已渲染的归属地归到最近单元
  function injectFromLocations(root) {
    var candidates = [];
    collectCandidates(root, candidates);
    for (var i = 0; i < candidates.length; i++) {
      var loc = locationFromNode(candidates[i]);
      if (!loc) continue;
      var unit = closestUnit(candidates[i]);
      if (!unit) continue;
      applyLocationToUnit(unit, loc);
    }
  }

  // 单元驱动：为还没有徽章的单元补灰色占位（字段缺失时的静默降级状态）
  function injectPlaceholders(root) {
    var units = safeQueryAll(root, UNIT_SELECTOR);
    if (matchesUnit(root)) units.unshift(root);
    var seen = new Set();
    for (var i = 0; i < units.length; i++) {
      var unit = units[i];
      if (seen.has(unit)) continue;
      seen.add(unit);
      if (unit.querySelector && unit.querySelector('.' + BADGE_CLASS)) continue;
      injectBadge(unit, '');
    }
  }

  function scan(root) {
    if (!root) return;
    injectFromLocations(root);
    injectPlaceholders(root);
  }

  // ---- 公开接口响应观察（只读、透传，不产生新请求） ----
  function registerLocation(key, loc) {
    if (key == null) return;
    var normalized = normalizeLocation(loc);
    if (normalized) locationStore.set(String(key), normalized);
  }

  function harvestLocations(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (var i = 0; i < obj.length; i++) harvestLocations(obj[i]);
      return;
    }
    if (obj.rpid != null) {
      var loc = obj.location;
      if (!loc && obj.reply_control && typeof obj.reply_control === 'object') {
        loc = obj.reply_control.location;
      }
      registerLocation(obj.rpid, loc);
    }
    var keys = Object.keys(obj);
    for (var k = 0; k < keys.length; k++) {
      var v = obj[keys[k]];
      if (v && typeof v === 'object') harvestLocations(v);
    }
  }

  function patchFetch() {
    var originalFetch = PAGE.fetch;
    if (typeof originalFetch !== 'function') return;
    PAGE.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var result = originalFetch.apply(this, arguments);
      if (/api\.bilibili\.com\/x\/v2\/reply/i.test(url)) {
        Promise.resolve(result).then(function (res) {
          if (res && typeof res.clone === 'function') {
            try {
              res.clone().json().then(function (json) {
                harvestLocations(json);
                scheduleRefresh();
              }).catch(function () { /* 静默降级 */ });
            } catch (e) { /* 响应已被消费则跳过 */ }
          }
        }).catch(function () { /* 静默降级 */ });
      }
      return result;
    };
  }

  function patchXHR() {
    var XHR = PAGE.XMLHttpRequest;
    if (!XHR || !XHR.prototype) return;
    var origOpen = XHR.prototype.open;
    var origSend = XHR.prototype.send;
    XHR.prototype.open = function (method, url) {
      try { this.__biliIpUrl = String(url || ''); } catch (e) { /* ignore */ }
      return origOpen.apply(this, arguments);
    };
    XHR.prototype.send = function () {
      var self = this;
      try {
        if (/api\.bilibili\.com\/x\/v2\/reply/i.test(self.__biliIpUrl || '')) {
          self.addEventListener('load', function () {
            try {
              var raw = self.response;
              var data = (raw && typeof raw === 'object') ? raw : JSON.parse(self.responseText);
              harvestLocations(data);
              scheduleRefresh();
            } catch (e) { /* 静默降级 */ }
          });
        }
      } catch (e) { /* ignore */ }
      return origSend.apply(this, arguments);
    };
  }

  // ---- 灰色占位升级：字段/接口数据稍后到达时，把占位刷新为真实归属地 ----
  var refreshTimer = null;
  function scheduleRefresh() {
    if (refreshTimer) return;
    refreshTimer = setTimeout(function () {
      refreshTimer = null;
      refreshEmptyBadges();
    }, 200);
  }

  function findOwnLocationInUnit(unit) {
    var candidates = [];
    collectCandidates(unit, candidates);
    for (var i = 0; i < candidates.length; i++) {
      if (closestUnit(candidates[i]) === unit) {
        var loc = locationFromNode(candidates[i]);
        if (loc) return loc;
      }
    }
    return '';
  }

  function replyIdOf(unit) {
    if (!unit || !unit.getAttribute) return '';
    var attrs = ['data-rpid', 'data-id', 'data-reply-id', 'data-rid'];
    for (var i = 0; i < attrs.length; i++) {
      var v = unit.getAttribute(attrs[i]);
      if (v) return v;
    }
    return '';
  }

  function findLocationFromCache(unit) {
    var id = replyIdOf(unit);
    if (id && locationStore.has(id)) return locationStore.get(id);
    return '';
  }

  function refreshEmptyBadges() {
    var badges = safeQueryAll(document, '.' + BADGE_CLASS + '.is-empty');
    for (var i = 0; i < badges.length; i++) {
      var badge = badges[i];
      var unit = badge.closest ? badge.closest(UNIT_SELECTOR) : null;
      if (!unit) continue;
      var loc = findOwnLocationInUnit(unit);
      if (!loc) loc = findLocationFromCache(unit);
      if (loc) {
        badge.textContent = PREFIX + loc;
        badge.classList.remove('is-empty');
        badge.style.color = '#9499a0';
      }
    }
  }

  // ---- SPA 动态路由与异步加载适配 ----
  var observer = null;
  function startObserver() {
    if (typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(function (mutations) {
      var anyAdded = false;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type !== 'childList') continue;
        for (var j = 0; j < m.addedNodes.length; j++) {
          var node = m.addedNodes[j];
          if (node.nodeType !== 1) continue;
          scan(node);
          anyAdded = true;
        }
      }
      if (anyAdded) scheduleRefresh();
    });
    var target = document.documentElement || document;
    observer.observe(target, { childList: true, subtree: true });
  }

  var fullScanTimer = null;
  function scheduleFullScan() {
    if (fullScanTimer) return;
    fullScanTimer = setTimeout(function () {
      fullScanTimer = null;
      if (document.body) scan(document.body);
    }, 300);
  }

  function hookHistory() {
    try {
      var wrap = function (type) {
        var orig = PAGE.history[type];
        if (typeof orig !== 'function') return;
        PAGE.history[type] = function () {
          var r = orig.apply(this, arguments);
          scheduleFullScan();
          return r;
        };
      };
      wrap('pushState');
      wrap('replaceState');
      PAGE.addEventListener('popstate', scheduleFullScan);
    } catch (e) { /* ignore */ }
  }

  function init() {
    patchFetch();
    patchXHR();
    startObserver();
    hookHistory();

    if (document.body) {
      scan(document.body);
    } else {
      var waiter = new MutationObserver(function () {
        if (document.body) {
          try { scan(document.body); } catch (e) { /* ignore */ }
          waiter.disconnect();
        }
      });
      waiter.observe(document.documentElement || document, { childList: true, subtree: true });
      if (document.addEventListener) {
        document.addEventListener('DOMContentLoaded', function () {
          if (document.body) scan(document.body);
        }, { once: true });
      }
    }
  }

  init();
})();
