// ==UserScript==
// @name         Bilibili IP 归属地
// @namespace    https://github.com/grok-4.6/bilibili-ip-location
// @version      1.0.0
// @description  在 B 站电脑端展示页面/公开接口已返回的 IP 归属地；适配 SPA 路由与异步加载；不发起额外请求、不推断、不收集、不持久化隐私数据
// @author       grok-4.6
// @license      MIT
// @match        https://www.bilibili.com/*
// @match        https://space.bilibili.com/*
// @match        https://t.bilibili.com/*
// @match        https://live.bilibili.com/*
// @match        https://member.bilibili.com/*
// @match        https://search.bilibili.com/*
// @match        https://bangumi.bilibili.com/*
// @match        https://manga.bilibili.com/*
// @exclude      https://message.bilibili.com/*
// @exclude      https://passport.bilibili.com/*
// @exclude      https://account.bilibili.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var MARK = 'data-grok-ip-loc';
  var BADGE_CLASS = 'grok-bili-ip';
  var STATUS_ID = 'grok-bili-ip-status';
  var STYLE_ID = 'grok-bili-ip-style';
  var CACHE_LIMIT = 8000;
  var SCAN_DELAY_MS = 120;

  var locByRpid = new Map();
  var locByMid = new Map();
  var pageNetState = 'idle';
  var scanTimer = 0;
  var lastHref = '';
  var observer = null;

  function looksLikeIp(text) {
    var s = String(text).trim();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return true;
    if (s.indexOf(':') !== -1 && /^[0-9a-fA-F:]+$/.test(s) && s.length >= 4) return true;
    return false;
  }

  function normalizeLocation(raw) {
    if (typeof raw !== 'string') return '';
    var s = raw.replace(/^\s+|\s+$/g, '');
    if (!s) return '';
    if (/^https?:\/\//i.test(s) || s.indexOf('/') !== -1) return '';
    if (looksLikeIp(s)) return '';
    s = s.replace(/^IP\s*属地\s*[：:]\s*/i, '');
    s = s.replace(/^属地\s*[：:]\s*/i, '');
    s = s.replace(/^\s+|\s+$/g, '');
    if (!s || s.length > 32) return '';
    if (looksLikeIp(s)) return '';
    return s;
  }

  function pickLocationField(obj) {
    if (!obj || typeof obj !== 'object') return '';
    var rc = obj.reply_control;
    var candidates = [
      rc && rc.location,
      obj.pub_location,
      obj.pub_location_text,
      obj.ip_location,
      obj.ip_location_text,
      obj.location_name,
      obj.loc_text
    ];
    var i;
    var n;
    for (i = 0; i < candidates.length; i++) {
      n = normalizeLocation(candidates[i]);
      if (n) return n;
    }
    if (typeof obj.location === 'string' && /属地|IP/i.test(obj.location)) {
      n = normalizeLocation(obj.location);
      if (n) return n;
    }
    return '';
  }

  function remember(map, key, loc) {
    if (key == null || !loc) return;
    var k = String(key);
    if (!k || k === '0') return;
    if (map.size >= CACHE_LIMIT && !map.has(k)) {
      map.delete(map.keys().next().value);
    }
    map.set(k, loc);
  }

  function harvest(node, seen, depth) {
    if (!node || typeof node !== 'object' || depth > 24) return;
    if (seen.has(node)) return;
    seen.add(node);

    var loc = pickLocationField(node);
    if (loc) {
      var rpid = node.rpid != null ? node.rpid : node.rp_id;
      var mid = node.mid != null ? node.mid : (node.member && node.member.mid);
      if (rpid != null) remember(locByRpid, rpid, loc);
      if (mid != null) remember(locByMid, mid, loc);
    }

    if (Array.isArray(node)) {
      var a;
      for (a = 0; a < node.length; a++) harvest(node[a], seen, depth + 1);
      return;
    }

    var keys = [
      'replies', 'reply', 'hots', 'top', 'top_replies', 'data', 'page',
      'item', 'items', 'modules', 'comment', 'comments', 'cursor', 'root'
    ];
    var k;
    for (k = 0; k < keys.length; k++) {
      if (Object.prototype.hasOwnProperty.call(node, keys[k])) {
        harvest(node[keys[k]], seen, depth + 1);
      }
    }
  }

  function ingestJson(data) {
    try {
      var seen = typeof WeakSet === 'function'
        ? new WeakSet()
        : { has: function () { return false; }, add: function () {} };
      harvest(data, seen, 0);
    } catch (e) { /* 静默 */ }
  }

  function parseEmbeddedState() {
    try {
      var scripts = document.getElementsByTagName('script');
      var i;
      for (i = 0; i < scripts.length; i++) {
        var t = scripts[i].textContent || '';
        if (t.indexOf('__INITIAL_STATE__') === -1) continue;
        var m = t.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
        if (m) {
          try { ingestJson(JSON.parse(m[1])); } catch (e1) { /* 静默 */ }
        }
      }
    } catch (e) { /* 静默 */ }
  }

  function urlLooksLikeReplyApi(url) {
    if (!url) return false;
    var u = String(url);
    return (
      u.indexOf('/x/v2/reply') !== -1 ||
      u.indexOf('/x/polymer/web-comment') !== -1 ||
      u.indexOf('/x/polymer/web-dynamic') !== -1
    );
  }

  function noteReplyResponse(ok) {
    pageNetState = ok ? 'ok' : 'fail';
    scheduleScan();
  }

  function hookFetch() {
    if (typeof window.fetch !== 'function') return;
    var orig = window.fetch;
    window.fetch = function () {
      var input = arguments[0];
      var url = '';
      try {
        if (typeof input === 'string') url = input;
        else if (input && input.url) url = input.url;
      } catch (e0) { url = ''; }
      return orig.apply(this, arguments).then(function (res) {
        try {
          if (urlLooksLikeReplyApi(url)) {
            noteReplyResponse(!!(res && res.ok));
            if (res && typeof res.clone === 'function') {
              res.clone().json().then(function (data) {
                ingestJson(data);
                scheduleScan();
              }).catch(function () {
                if (pageNetState !== 'ok') pageNetState = 'fail';
              });
            }
          }
        } catch (e1) { /* 静默 */ }
        return res;
      }, function (err) {
        try {
          if (urlLooksLikeReplyApi(url)) {
            pageNetState = 'fail';
            scheduleScan();
          }
        } catch (e2) { /* 静默 */ }
        throw err;
      });
    };
  }

  function hookXhr() {
    if (!window.XMLHttpRequest || !window.XMLHttpRequest.prototype) return;
    var origOpen = window.XMLHttpRequest.prototype.open;
    var origSend = window.XMLHttpRequest.prototype.send;
    window.XMLHttpRequest.prototype.open = function (method, url) {
      try { this.__grokIpUrl = url ? String(url) : ''; } catch (e) { this.__grokIpUrl = ''; }
      return origOpen.apply(this, arguments);
    };
    window.XMLHttpRequest.prototype.send = function () {
      var xhr = this;
      xhr.addEventListener('load', function () {
        try {
          var url = xhr.__grokIpUrl || '';
          if (!urlLooksLikeReplyApi(url)) return;
          noteReplyResponse(xhr.status >= 200 && xhr.status < 300);
          var body = xhr.responseText || xhr.response;
          if (typeof body === 'string' && body.charAt(0) === '{') {
            ingestJson(JSON.parse(body));
            scheduleScan();
          } else if (body && typeof body === 'object') {
            ingestJson(body);
            scheduleScan();
          }
        } catch (e1) { /* 静默 */ }
      });
      xhr.addEventListener('error', function () {
        try {
          if (urlLooksLikeReplyApi(xhr.__grokIpUrl)) {
            pageNetState = 'fail';
            scheduleScan();
          }
        } catch (e2) { /* 静默 */ }
      });
      return origSend.apply(this, arguments);
    };
  }

  function hookHistory() {
    function wrap(name) {
      var orig = history[name];
      if (typeof orig !== 'function') return;
      history[name] = function () {
        var ret = orig.apply(this, arguments);
        onRouteMaybe();
        return ret;
      };
    }
    wrap('pushState');
    wrap('replaceState');
    window.addEventListener('popstate', onRouteMaybe);
    window.addEventListener('hashchange', onRouteMaybe);
  }

  function onRouteMaybe() {
    var href = location.href;
    if (href === lastHref) return;
    lastHref = href;
    pageNetState = 'idle';
    setTimeout(parseEmbeddedState, 0);
    scheduleScan();
    setTimeout(scheduleScan, 400);
    setTimeout(scheduleScan, 1200);
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    if (!document.head && !document.documentElement) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '.' + BADGE_CLASS + '{' +
        'display:inline;' +
        'margin-left:8px;' +
        'padding:0;' +
        'font-size:12px;' +
        'line-height:18px;' +
        'font-weight:400;' +
        'color:#9499A0;' +
        'background:transparent;' +
        'border:0;' +
        'vertical-align:middle;' +
        'white-space:nowrap;' +
        'user-select:none;' +
        'pointer-events:none;' +
      '}' +
      '.' + BADGE_CLASS + '.is-unknown{color:#C9CCD0;}' +
      '#' + STATUS_ID + '{' +
        'display:inline;' +
        'margin-left:8px;' +
        'font-size:12px;' +
        'line-height:18px;' +
        'color:#C9CCD0;' +
        'font-weight:400;' +
        'vertical-align:middle;' +
        'pointer-events:none;' +
        'user-select:none;' +
      '}';
    (document.head || document.documentElement).appendChild(css);
  }

  function tagNameOf(el) {
    return (el && el.tagName ? el.tagName : '').toLowerCase();
  }

  function isCommentRoot(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = tagNameOf(el);
    if (tag === 'bili-comment-thread-renderer' ||
        tag === 'bili-comment-reply-renderer' ||
        tag === 'bili-comment-renderer') return true;
    if (el.classList && (
      el.classList.contains('reply-item') ||
      el.classList.contains('sub-reply-item')
    )) return true;
    return false;
  }

  function walkAll(root, visit) {
    if (!root) return;
    var stack = [root];
    while (stack.length) {
      var node = stack.pop();
      if (!node) continue;
      visit(node);
      if (node.shadowRoot) stack.push(node.shadowRoot);
      var children = node.children;
      if (!children) continue;
      var i;
      for (i = 0; i < children.length; i++) stack.push(children[i]);
    }
  }

  function walkOwn(root, visit) {
    visit(root);
    function dive(node) {
      if (node.shadowRoot) diveChildren(node.shadowRoot);
      diveChildren(node);
    }
    function diveChildren(node) {
      var children = node.children;
      if (!children) return;
      var i;
      for (i = 0; i < children.length; i++) {
        var child = children[i];
        if (child !== root && isCommentRoot(child)) continue;
        visit(child);
        dive(child);
      }
    }
    dive(root);
  }

  function readRpid(el) {
    if (!el) return '';
    var v = el.getAttribute && (el.getAttribute('rpid') || el.getAttribute('data-rpid') || el.getAttribute('data-id'));
    if (v) return String(v);
    try {
      if (el.rpid != null && el.rpid !== '') return String(el.rpid);
    } catch (e0) { /* 静默 */ }
    try {
      var vc = el.__vueParentComponent;
      var props = vc && vc.props;
      var reply = props && (props.reply || props.data || props.item);
      if (reply && reply.rpid != null) return String(reply.rpid);
      if (props && props.rpid != null) return String(props.rpid);
    } catch (e1) { /* 静默 */ }
    try {
      var vue = el.__vue__;
      if (vue) {
        if (vue.rpid != null) return String(vue.rpid);
        if (vue.reply && vue.reply.rpid != null) return String(vue.reply.rpid);
      }
    } catch (e2) { /* 静默 */ }
    return '';
  }

  function readMid(el) {
    if (!el) return '';
    var v = el.getAttribute && (
      el.getAttribute('data-usercard-mid') ||
      el.getAttribute('data-mid') ||
      el.getAttribute('mid')
    );
    if (v) return String(v);
    try {
      if (el.mid != null && el.mid !== '') return String(el.mid);
    } catch (e0) { /* 静默 */ }
    return '';
  }

  function hasOwnBadge(root) {
    var found = false;
    walkOwn(root, function (node) {
      if (found) return;
      if (node.classList && node.classList.contains(BADGE_CLASS)) found = true;
      if (node.id === STATUS_ID) return;
    });
    return found;
  }

  function hasNativeLocation(root) {
    var found = false;
    walkOwn(root, function (node) {
      if (found || !node || node.nodeType !== 1) return;
      if (node.classList && node.classList.contains(BADGE_CLASS)) return;
      if (node.childElementCount === 0) {
        var t = node.textContent || '';
        if (/IP\s*属地/.test(t) && t.length < 48) found = true;
      }
    });
    return found;
  }

  function findInsertHost(root) {
    var timeNode = null;
    var infoNode = null;
    var nameNode = null;
    walkOwn(root, function (node) {
      if (!node || node.nodeType !== 1) return;
      var tag = tagNameOf(node);
      var id = (node.id || '').toLowerCase();
      if (node.classList) {
        if (!timeNode && (
          node.classList.contains('reply-time') ||
          node.classList.contains('time') ||
          node.classList.contains('pubdate') ||
          node.classList.contains('comment-time')
        )) timeNode = node;
        if (!nameNode && (
          node.classList.contains('user-name') ||
          node.classList.contains('uname')
        )) nameNode = node;
        if (!infoNode && (
          node.classList.contains('reply-info') ||
          node.classList.contains('user-info')
        )) infoNode = node;
      }
      if (!infoNode && (id === 'info' || id === 'header')) infoNode = node;
      if (!nameNode && (tag === 'bili-comment-user-info' || tag === 'bili-username')) nameNode = node;
    });
    return timeNode || infoNode || nameNode || root;
  }

  function makeBadge(text, unknown) {
    var span = document.createElement('span');
    span.className = BADGE_CLASS + (unknown ? ' is-unknown' : '');
    span.setAttribute(MARK, '1');
    span.textContent = unknown ? (text || '属地未知') : ('IP属地：' + text);
    return span;
  }

  function appendBadge(host, badge) {
    if (host.shadowRoot) {
      var inner = host.shadowRoot.querySelector('.reply-time, .time, .user-name, .uname, .name, a, #info, #header');
      (inner || host.shadowRoot).appendChild(badge);
      return;
    }
    host.appendChild(badge);
  }

  function injectBadge(root, loc, unknown) {
    if (!root || root.nodeType !== 1) return false;
    if (root.getAttribute && root.getAttribute(MARK) === '1') return false;
    if (hasOwnBadge(root)) {
      root.setAttribute(MARK, '1');
      return false;
    }
    if (!unknown && hasNativeLocation(root)) {
      root.setAttribute(MARK, '1');
      return false;
    }
    var host = findInsertHost(root);
    if (!host) return false;
    try {
      appendBadge(host, makeBadge(loc, unknown));
      root.setAttribute(MARK, '1');
      return true;
    } catch (e) {
      return false;
    }
  }

  function resolveLoc(el) {
    var rpid = readRpid(el);
    if (rpid && locByRpid.has(rpid)) return locByRpid.get(rpid);
    var foundMid = '';
    walkOwn(el, function (node) {
      if (foundMid) return;
      var m = readMid(node);
      if (m && locByMid.has(m)) foundMid = m;
    });
    if (foundMid) return locByMid.get(foundMid);
    return '';
  }

  function processCommentEl(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.getAttribute && el.getAttribute(MARK) === '1') return;
    if (hasNativeLocation(el)) {
      el.setAttribute(MARK, '1');
      return;
    }
    var loc = resolveLoc(el);
    if (loc) {
      injectBadge(el, loc, false);
      return;
    }
    if (pageNetState === 'fail') {
      injectBadge(el, '属地暂不可用', true);
      return;
    }
    if (pageNetState === 'ok') {
      injectBadge(el, '属地未知', true);
    }
  }

  function collectCommentRoots(doc) {
    var list = [];
    walkAll(doc, function (node) {
      if (isCommentRoot(node)) list.push(node);
    });
    return list;
  }

  function updateStatusChip(doc) {
    var text = '';
    if (pageNetState === 'fail') text = '属地暂不可用';
    else if (pageNetState === 'ok' && locByRpid.size === 0) text = '属地未知';

    var old = doc.getElementById && doc.getElementById(STATUS_ID);
    if (!text) {
      if (old && old.parentNode) old.parentNode.removeChild(old);
      return;
    }
    if (old) {
      old.textContent = text;
      return;
    }

    var host = null;
    walkAll(doc, function (node) {
      if (host || !node || node.nodeType !== 1) return;
      var tag = tagNameOf(node);
      if (tag === 'bili-comments-header-renderer' || tag === 'bili-comment-header') {
        host = node;
        return;
      }
      if (node.classList && (
        node.classList.contains('reply-header') ||
        node.classList.contains('comment-header')
      )) {
        host = node;
      }
    });
    if (!host) return;
    try {
      var span = document.createElement('span');
      span.id = STATUS_ID;
      span.textContent = text;
      if (host.shadowRoot) host.shadowRoot.appendChild(span);
      else host.appendChild(span);
    } catch (e) { /* 静默 */ }
  }

  function scan() {
    try {
      if (!document.documentElement) return;
      ensureStyle();
      var roots = collectCommentRoots(document.documentElement);
      var i;
      for (i = 0; i < roots.length; i++) processCommentEl(roots[i]);
      updateStatusChip(document.documentElement);
    } catch (e) { /* 静默 */ }
  }

  function scheduleScan() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(function () {
      scanTimer = 0;
      scan();
    }, SCAN_DELAY_MS);
  }

  function startObserver() {
    if (observer || !document.documentElement) return;
    try {
      observer = new MutationObserver(function () {
        scheduleScan();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) { /* 静默 */ }
  }

  hookFetch();
  hookXhr();
  hookHistory();
  lastHref = location.href;

  function onReady() {
    ensureStyle();
    parseEmbeddedState();
    startObserver();
    scheduleScan();
    setTimeout(scheduleScan, 600);
    setTimeout(scheduleScan, 1800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
