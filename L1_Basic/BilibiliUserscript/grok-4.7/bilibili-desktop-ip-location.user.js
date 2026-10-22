// ==UserScript==
// @name         B站电脑端 IP 属地
// @name:en      Bilibili Desktop IP Region
// @namespace    bilibili-desktop-ip-location
// @version      1.0.0
// @description  在哔哩哔哩电脑端展示页面或公开接口已经返回的 IP 属地（省 / 国家一级）。不推断精确位置，脚本自身不发起网络请求，不收集、不上传、不保存隐私数据。
// @author       local
// @match        *://*.bilibili.com/*
// @match        *://bilibili.com/*
// @exclude      *://m.bilibili.com/*
// @exclude      *://passport.bilibili.com/*
// @exclude      *://account.bilibili.com/*
// @exclude      *://message.bilibili.com/*
// @run-at       document-start
// @inject-into  page
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var MARK = 'data-bili-ip-loc';
  var PLACEHOLDER = 'IP属地：—';
  var MAX_MAP = 3000;
  var STYLE = [
    'display:inline-block',
    'flex:0 0 auto',
    'margin:0 0 0 8px',
    'padding:0',
    'border:0',
    'background:transparent',
    'box-shadow:none',
    'position:static',
    'float:none',
    'z-index:auto',
    'line-height:inherit',
    'font-size:inherit',
    'font-weight:400',
    'font-family:inherit',
    'vertical-align:baseline',
    'pointer-events:none',
    'user-select:none',
    'white-space:nowrap',
    'max-width:16em',
    'overflow:hidden',
    'text-overflow:ellipsis'
  ].join(';');

  var SCAN_SELECTOR = [
    'bili-comments',
    'bili-comment-thread-renderer',
    'bili-comment-renderer',
    'bili-comment-reply-renderer',
    'bili-comment-replies-renderer',
    'bili-comment-action-buttons-renderer',
    '.reply-item',
    '.sub-reply-item',
    '.bili-dyn-item',
    '.bili-dyn-list__item',
    '.opus-module-author',
    '.article-up-info',
    '.article-info'
  ].join(',');

  var SKIP_KEYS = {
    dm: 1,
    subtitle: 1,
    subtitles: 1,
    player: 1,
    script: 1,
    styles: 1,
    pic: 1,
    cover: 1,
    face: 1,
    emote: 1,
    pictures: 1,
    jump_url: 1
  };

  function normalizeLocation(raw) {
    if (typeof raw !== 'string') return null;
    var text = raw.replace(/\s+/g, ' ').trim();
    if (!text || text.length > 32) return null;
    if (/[<>]/.test(text) || /\d/.test(text)) return null;
    if (/https?:|[@/\\]/.test(text)) return null;
    if (/纬度|经度|latitude|longitude|\bisp\b/i.test(text)) return null;
    var body = text;
    if (text.indexOf('IP属地') === 0) {
      body = text.replace(/^IP属地\s*[:：]\s*/, '');
    }
    if (!body || body.length > 16) return null;
    if (!/^[\u4e00-\u9fff·]{1,16}$/.test(body)) return null;
    return 'IP属地：' + body;
  }

  function classifyUrl(url) {
    if (!url || typeof url !== 'string') return '';
    if (/\/(?:zone|getIpInfo|get_ip_addr|getInfoNew)(?:\?|$)/.test(url)) return '';
    if (/\/x\/v2\/reply\/(?:add|action|like|hate|del|top|report|vote)/.test(url)) return '';
    if (/\/x\/v2\/reply(?:\/|\?|$)/.test(url)) return 'reply';
    if (/\/x\/article\/view(?:\?|$)/.test(url)) return 'article';
    if (/\/x\/polymer\/web-dynamic\//.test(url)) return 'dyn';
    return '';
  }

  function isDetailUrl(url) {
    return /\/opus\/detail|\/web-dynamic\/v1\/detail|\/x\/article\/view/.test(url || '');
  }

  function readPageIds(href) {
    var ids = [];
    var rules = [
      /\/read\/cv(\d+)/i,
      /\/opus\/(\d+)/,
      /\/dynamic\/(\d+)/,
      /\/\/t\.bilibili\.com\/(\d+)/
    ];
    var i;
    for (i = 0; i < rules.length; i++) {
      var matched = String(href || '').match(rules[i]);
      if (matched && ids.indexOf(matched[1]) < 0) ids.push(matched[1]);
    }
    return ids;
  }

  function isPlainObject(node) {
    if (!node || typeof node !== 'object') return false;
    if (node.nodeType) return false;
    if (typeof Window !== 'undefined' && node === window) return false;
    return true;
  }

  function numericId(value) {
    if (typeof value === 'number' && isFinite(value) && value > 0 && Math.floor(value) === value) return String(value);
    if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) return value;
    return '';
  }

  function remember(map, key, value) {
    if (!key) return;
    if (map.has(key)) map.delete(key);
    map.set(key, value);
    if (map.size > MAX_MAP) {
      var oldest = map.keys().next().value;
      map.delete(oldest);
    }
  }

  function indexPayload(root, url, state) {
    var replyMap = state.replyMap;
    var pubMap = state.pubMap;
    var pageIds = state.pageIds || [];
    var detail = isDetailUrl(url);
    var firstDetail = null;
    var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
    var budget = 0;

    function walk(node, depth, inheritedId) {
      if (!isPlainObject(node) || depth > 12 || budget > 6000) return;
      if (seen) {
        if (seen.has(node)) return;
        try { seen.add(node); } catch (err) { return; }
      }
      budget++;
      if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) walk(node[i], depth + 1, inheritedId);
        return;
      }
      var idHere = inheritedId;
      var explicit = numericId(node.id_str) || numericId(node.dynamic_id_str) || numericId(node.dyn_id_str) || numericId(node.opus_id);
      if (explicit) idHere = explicit;

      if (Object.prototype.hasOwnProperty.call(node, 'reply_control')) {
        var rid = numericId(node.rpid != null ? node.rpid : node.rpid_str);
        var control = node.reply_control;
        var replyText = control && typeof control === 'object' ? normalizeLocation(control.location) : null;
        if (rid) {
          remember(replyMap, rid, replyText ? { text: replyText, missing: false } : { text: null, missing: true });
        }
      }

      if (Object.prototype.hasOwnProperty.call(node, 'pub_location_text')) {
        var pubText = normalizeLocation(node.pub_location_text);
        var rec = pubText ? { text: pubText, missing: false } : { text: null, missing: true };
        if (idHere) {
          remember(pubMap, idHere, rec);
          if (pageIds.indexOf(idHere) >= 0) state.pageAuthor = rec;
        }
        if (detail && !firstDetail) firstDetail = rec;
      }

      var keys = Object.keys(node);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        if (SKIP_KEYS[key]) continue;
        var child = node[key];
        if (child && typeof child === 'object') walk(child, depth + 1, idHere);
      }
    }

    try { walk(root, 0, ''); } catch (err) { /* 页面数据异常时放弃本段索引 */ }
    if (detail && firstDetail && !state.pageAuthor) state.pageAuthor = firstDetail;
  }

  function unwrap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    if (Object.prototype.hasOwnProperty.call(value, 'value') && value.value && typeof value.value === 'object') {
      var keys = Object.keys(value);
      if (keys.length <= 4) return value.value;
    }
    return value;
  }

  function inspect(root) {
    var result = { text: null, missing: false, rpid: '', pubId: '' };
    var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
    var budget = 0;

    function walk(node, depth) {
      if (!isPlainObject(node) || depth > 7 || budget > 180 || result.text) return;
      node = unwrap(node);
      if (!isPlainObject(node)) return;
      if (Array.isArray(node) && depth > 0 && node.length > 40) return;
      if (seen) {
        if (seen.has(node)) return;
        try { seen.add(node); } catch (err) { return; }
      }
      budget++;
      if (Array.isArray(node)) {
        for (var i = 0; i < node.length && !result.text; i++) walk(node[i], depth + 1);
        return;
      }
      if (!result.rpid) {
        var rid = numericId(node.rpid != null ? node.rpid : node.rpid_str);
        if (rid) result.rpid = rid;
      }
      if (!result.pubId) {
        var pid = numericId(node.id_str) || numericId(node.dynamic_id_str) || numericId(node.dyn_id_str) || numericId(node.opus_id);
        if (pid) result.pubId = pid;
      }
      if (Object.prototype.hasOwnProperty.call(node, 'reply_control')) {
        var control = unwrap(node.reply_control);
        if (control && typeof control === 'object') {
          result.text = normalizeLocation(control.location);
          if (!result.text) result.missing = true;
        } else {
          result.missing = true;
        }
        return;
      }
      if (Object.prototype.hasOwnProperty.call(node, 'pub_location_text')) {
        result.text = normalizeLocation(node.pub_location_text);
        if (!result.text) result.missing = true;
        return;
      }
      var keys = Object.keys(node);
      for (var k = 0; k < keys.length; k++) {
        if (result.text) return;
        var key = keys[k];
        if (key === 'replies' || key === 'top_replies' || key === 'hots' || SKIP_KEYS[key]) continue;
        var child = node[key];
        if (child && typeof child === 'object') walk(child, depth + 1);
      }
    }

    try { walk(root, 0); } catch (err) { /* 组件数据不可读则视为尚未就绪 */ }
    return result;
  }

  function resolveRecord(sources, opts) {
    var options = opts || {};
    var list = sources || [];
    var i;
    for (i = 0; i < list.length; i++) {
      var hit = inspect(list[i]);
      if (hit.text) return { text: hit.text, missing: false };
      if (hit.rpid && options.replyMap && options.replyMap.has(hit.rpid)) {
        var fromReply = options.replyMap.get(hit.rpid);
        if (fromReply.text) return { text: fromReply.text, missing: false };
        return { text: null, missing: true };
      }
      if (hit.pubId && options.pubMap && options.pubMap.has(hit.pubId)) {
        var fromPub = options.pubMap.get(hit.pubId);
        if (fromPub.text) return { text: fromPub.text, missing: false };
        return { text: null, missing: true };
      }
      if (hit.missing) return { text: null, missing: true };
    }
    if (options.pubId && options.pubMap && options.pubMap.has(options.pubId)) {
      var linked = options.pubMap.get(options.pubId);
      return linked.text ? { text: linked.text, missing: false } : { text: null, missing: true };
    }
    if (options.pageAuthor) {
      return options.pageAuthor.text ? { text: options.pageAuthor.text, missing: false } : { text: null, missing: true };
    }
    if (options.failed) return { text: null, missing: true };
    return null;
  }

  function boot() {
    if (window.__biliDesktopIpLoc) return;
    window.__biliDesktopIpLoc = 1;

    var replyMap = new Map();
    var pubMap = new Map();
    var state = {
      replyMap: replyMap,
      pubMap: pubMap,
      pageAuthor: null,
      pageIds: readPageIds(location.href)
    };
    var navGen = 0;
    var lastPath = '';
    var replyFailed = false;
    var dynFailed = false;
    var articleFailed = false;
    var scheduled = false;
    var shadows = typeof WeakMap === 'function' ? new WeakMap() : null;

    function refreshPageIds() {
      state.pageIds = readPageIds(location.href);
    }

    function ingest(url, data, gen) {
      if (!data || typeof data !== 'object') {
        if (gen === navGen) markFailed(url);
        return;
      }
      if (typeof data.code === 'number' && data.code !== 0) {
        if (gen === navGen) markFailed(url);
        return;
      }
      indexPayload(data, url, state);
      if (gen === navGen) markOk(url);
      scheduleScan();
    }

    function markFailed(url) {
      var kind = classifyUrl(url);
      if (kind === 'reply') replyFailed = true;
      else if (kind === 'article') articleFailed = true;
      else if (kind === 'dyn') dynFailed = true;
      scheduleScan();
    }

    function markOk(url) {
      var kind = classifyUrl(url);
      if (kind === 'reply') replyFailed = false;
      else if (kind === 'article') articleFailed = false;
      else if (kind === 'dyn') dynFailed = false;
    }

    function urlOf(input) {
      if (!input) return '';
      if (typeof input === 'string') return input;
      if (typeof input.url === 'string') return input.url;
      try { return String(input); } catch (err) { return ''; }
    }

    function hookFetch() {
      if (typeof window.fetch !== 'function' || window.fetch.__biliIpLoc) return;
      var orig = window.fetch;
      var wrapped = function (input) {
        var url = urlOf(input);
        var kind = classifyUrl(url);
        var gen = navGen;
        var pending = orig.apply(this, arguments);
        if (!kind) return pending;
        return pending.then(function (res) {
          try {
            if (!res || !res.ok) {
              if (gen === navGen) markFailed(url);
              return res;
            }
            res.clone().json().then(function (data) {
              ingest(url, data, gen);
            }).catch(function () {
              if (gen === navGen) markFailed(url);
            });
          } catch (err) {
            if (gen === navGen) markFailed(url);
          }
          return res;
        }, function (err) {
          if (gen === navGen) markFailed(url);
          throw err;
        });
      };
      wrapped.__biliIpLoc = true;
      window.fetch = wrapped;
    }

    function hookXhr() {
      if (!window.XMLHttpRequest || XMLHttpRequest.prototype.open.__biliIpLoc) return;
      var origOpen = XMLHttpRequest.prototype.open;
      var origSend = XMLHttpRequest.prototype.send;
      var open = function (method, url) {
        try { this.__biliIpUrl = urlOf(url); } catch (err) { this.__biliIpUrl = ''; }
        this.__biliIpGen = navGen;
        return origOpen.apply(this, arguments);
      };
      open.__biliIpLoc = true;
      XMLHttpRequest.prototype.open = open;
      XMLHttpRequest.prototype.send = function () {
        var xhr = this;
        var watched = classifyUrl(xhr.__biliIpUrl || '');
        if (watched) {
          xhr.addEventListener('load', function () {
            var gen = xhr.__biliIpGen;
            try {
              if (xhr.status >= 400) {
                if (gen === navGen) markFailed(xhr.__biliIpUrl);
                return;
              }
              var data = null;
              if (xhr.responseType === 'json') data = xhr.response;
              else if (!xhr.responseType || xhr.responseType === 'text') data = JSON.parse(xhr.responseText);
              else data = xhr.response;
              ingest(xhr.__biliIpUrl, data, gen);
            } catch (err) {
              if (gen === navGen) markFailed(xhr.__biliIpUrl);
            }
          });
          xhr.addEventListener('error', function () {
            if (xhr.__biliIpGen === navGen) markFailed(xhr.__biliIpUrl);
          });
          xhr.addEventListener('timeout', function () {
            if (xhr.__biliIpGen === navGen) markFailed(xhr.__biliIpUrl);
          });
        }
        return origSend.apply(this, arguments);
      };
    }

    function hookHistory() {
      if (history.pushState && !history.pushState.__biliIpLoc) {
        var origPush = history.pushState;
        var push = function () {
          var result = origPush.apply(this, arguments);
          onNav();
          return result;
        };
        push.__biliIpLoc = true;
        history.pushState = push;
      }
      if (history.replaceState && !history.replaceState.__biliIpLoc) {
        var origReplace = history.replaceState;
        var replace = function () {
          var result = origReplace.apply(this, arguments);
          onNav();
          return result;
        };
        replace.__biliIpLoc = true;
        history.replaceState = replace;
      }
      window.addEventListener('popstate', onNav);
      window.addEventListener('hashchange', onNav);
    }

    function onNav() {
      var path = location.pathname;
      if (path === lastPath) {
        scheduleScan();
        return;
      }
      lastPath = path;
      navGen++;
      replyFailed = false;
      dynFailed = false;
      articleFailed = false;
      state.pageAuthor = null;
      refreshPageIds();
      scheduleScan();
      setTimeout(scheduleScan, 400);
      setTimeout(scheduleScan, 1400);
    }

    function hookCustomElements() {
      if (!window.customElements || customElements.define.__biliIpLoc) return;
      var orig = customElements.define;
      var define = function (name, ctor, options) {
        try { patchCtor(name, ctor); } catch (err) { /* 定义失败不影响页面注册组件 */ }
        return orig.call(customElements, name, ctor, options);
      };
      define.__biliIpLoc = true;
      customElements.define = define;
      [
        'bili-comment-action-buttons-renderer',
        'bili-comment-renderer',
        'bili-comment-reply-renderer',
        'bili-comment-thread-renderer',
        'bili-comments'
      ].forEach(function (name) {
        try {
          var existing = customElements.get(name);
          if (existing) patchCtor(name, existing);
        } catch (err) { /* 组件尚未注册 */ }
      });
    }

    function patchCtor(name, ctor) {
      if (!name || String(name).indexOf('bili-comment') !== 0 || !ctor || !ctor.prototype) return;
      var proto = ctor.prototype;
      if (proto.__biliIpLocPatched) return;
      proto.__biliIpLocPatched = true;
      ['updated', 'update'].forEach(function (method) {
        var orig = proto[method];
        if (typeof orig !== 'function' || orig.__biliIpLoc) return;
        var wrapped = function () {
          var result = orig.apply(this, arguments);
          try { paint(this); } catch (err) { /* 单条渲染失败不影响评论区 */ }
          return result;
        };
        wrapped.__biliIpLoc = true;
        proto[method] = wrapped;
      });
    }

    function hookAttachShadow() {
      if (!window.Element || !Element.prototype.attachShadow || Element.prototype.attachShadow.__biliIpLoc) return;
      var orig = Element.prototype.attachShadow;
      var wrapped = function (init) {
        var shadow = orig.apply(this, arguments);
        try {
          var tag = this.tagName ? this.tagName.toLowerCase() : '';
          if (tag.indexOf('bili-comment') !== -1) {
            if (shadows) shadows.set(this, shadow);
            watchRoot(shadow);
            scheduleScan();
          }
        } catch (err) { /* 影子根监听失败时仍返回原根 */ }
        return shadow;
      };
      wrapped.__biliIpLoc = true;
      Element.prototype.attachShadow = wrapped;
    }

    function rootOf(el) {
      if (!el) return null;
      if (el.shadowRoot) return el.shadowRoot;
      if (shadows && shadows.has(el)) return shadows.get(el);
      return null;
    }

    function watchRoot(root) {
      if (!root || root.__biliIpWatch) return;
      try {
        root.__biliIpWatch = true;
        var mo = new MutationObserver(function () { scheduleScan(); });
        mo.observe(root, { childList: true, subtree: true });
      } catch (err) { /* 无法观察的根由定时补扫覆盖 */ }
    }

    function collectSources(el) {
      var list = [];
      if (!el || el.nodeType !== 1) return list;
      function push(value) {
        if (value && typeof value === 'object') list.push(value);
      }
      push(el.__data);
      var bag = {};
      var any = false;
      ['reply_control', 'rpid', 'rpid_str', 'pub_location_text', 'id_str', 'dynamic_id_str'].forEach(function (key) {
        if (el[key] !== undefined) {
          bag[key] = el[key];
          any = true;
        }
      });
      if (any) push(bag);
      var vue = el.__vue__;
      if (vue) {
        if (vue.$props) {
          push(vue.$props.reply || vue.$props.subReply || vue.$props.replyData || vue.$props);
        }
        if (vue.$data) push(vue.$data.reply || vue.$data.subReply || vue.$data);
        if (vue._props) push(vue._props.reply || vue._props.subReply || vue._props);
        if (vue.vnode && vue.vnode.props) {
          var vprops = vue.vnode.props;
          push(vprops.reply || vprops.subReply || vprops.replyData || vprops);
        }
      }
      var vpc = el.__vueParentComponent;
      if (vpc) {
        if (vpc.props) push(vpc.props.reply || vpc.props.subReply || vpc.props.replyData || vpc.props);
        var setup = vpc.setupState;
        if (setup && (setup.reply || setup.subReply || setup.replyData || setup.reply_control || setup.pub_location_text)) {
          push(setup.reply || setup.subReply || setup.replyData || setup);
        }
        if (vpc.vnode && vpc.vnode.props) {
          var pprops = vpc.vnode.props;
          push(pprops.reply || pprops.subReply || pprops.replyData || pprops);
        }
      }
      return list;
    }

    function ancestorChain(start) {
      var out = [];
      var node = start;
      var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
      while (node && out.length < 16) {
        if (seen) {
          if (seen.has(node)) break;
          seen.add(node);
        }
        out.push(node);
        var root = null;
        try { root = node.getRootNode ? node.getRootNode() : null; } catch (err) { root = null; }
        if (root && root.host && root.host !== node) {
          node = root.host;
          continue;
        }
        node = node.parentElement || null;
      }
      return out;
    }

    function sourcesFor(el) {
      var hosts = ancestorChain(el);
      var flat = [];
      for (var i = 0; i < hosts.length; i++) {
        var host = hosts[i];
        var part = collectSources(host);
        for (var j = 0; j < part.length; j++) flat.push(part[j]);
        var tag = host.tagName ? host.tagName.toLowerCase() : '';
        var stop = tag === 'bili-comment-thread-renderer' || tag === 'bili-comment-reply-renderer';
        if (!stop && host.classList) {
          stop = host.classList.contains('reply-item') || host.classList.contains('sub-reply-item') || host.classList.contains('bili-dyn-item') || host.classList.contains('bili-dyn-list__item');
        }
        if (stop) break;
      }
      return flat;
    }

    function cardId(el) {
      var keys = ['data-did', 'data-dyn-id', 'data-opus-id', 'data-id'];
      var node = el;
      var depth = 0;
      while (node && depth < 5) {
        if (node.getAttribute) {
          for (var i = 0; i < keys.length; i++) {
            var value = node.getAttribute(keys[i]);
            if (value && /^\d{3,}$/.test(value)) return value;
          }
        }
        node = node.parentElement;
        depth++;
      }
      return '';
    }

    function grayColor() {
      try {
        var bg = getComputedStyle(document.body).backgroundColor || '';
        var matched = bg.match(/(\d+),\s*(\d+),\s*(\d+)/);
        if (matched) {
          var lum = (0.299 * +matched[1] + 0.587 * +matched[2] + 0.114 * +matched[3]) / 255;
          return lum < 0.5 ? '#8b919a' : '#c0c4cc';
        }
      } catch (err) { /* 使用默认灰色 */ }
      return '#c0c4cc';
    }

    function knownColor(anchor) {
      try {
        var color = getComputedStyle(anchor).color;
        if (color) return color;
      } catch (err) { /* 使用时间戳的常见灰色 */ }
      return '#9499a0';
    }

    function officialBeside(anchor) {
      if (anchor && anchor.textContent && /IP属地/.test(anchor.textContent)) return true;
      var node = anchor.nextSibling;
      while (node) {
        if (node.nodeType === 1 && node.hasAttribute && node.hasAttribute(MARK)) return false;
        var text = node.nodeType === 3 || node.nodeType === 1 ? node.textContent : '';
        if (text && /IP属地/.test(text)) return true;
        if (node.nodeType === 1) break;
        node = node.nextSibling;
      }
      return false;
    }

    function placeBadge(anchor, rec) {
      if (!anchor || !rec) return;
      var parent = anchor.parentNode;
      if (!parent) return;
      if (officialBeside(anchor)) {
        var stray = anchor.nextElementSibling;
        if (stray && stray.hasAttribute && stray.hasAttribute(MARK)) stray.remove();
        return;
      }
      var text = rec.text || PLACEHOLDER;
      var missing = !rec.text;
      var badge = anchor.nextElementSibling;
      if (!(badge && badge.hasAttribute && badge.hasAttribute(MARK))) {
        badge = null;
        var kids = parent.children || [];
        var extras = [];
        for (var i = 0; i < kids.length; i++) {
          if (kids[i].hasAttribute && kids[i].hasAttribute(MARK)) extras.push(kids[i]);
        }
        if (extras.length) {
          badge = extras[0];
          for (var e = 1; e < extras.length; e++) extras[e].remove();
        }
      }
      if (!badge) {
        badge = document.createElement('span');
        badge.setAttribute(MARK, '1');
        anchor.insertAdjacentElement('afterend', badge);
      } else if (badge.previousElementSibling !== anchor) {
        anchor.insertAdjacentElement('afterend', badge);
      }
      if (badge.textContent !== text) badge.textContent = text;
      var className = missing ? 'bili-ip-loc bili-ip-loc-missing' : 'bili-ip-loc';
      if (badge.className !== className) badge.className = className;
      var color = missing ? grayColor() : knownColor(anchor);
      var signature = color + '|' + (missing ? '0' : '1');
      if (badge.getAttribute('data-bili-ip-style') !== signature) {
        badge.setAttribute('data-bili-ip-style', signature);
        badge.style.cssText = STYLE + ';color:' + color + ';opacity:1';
      }
    }

    function findTime(scope, selector) {
      if (!scope || !scope.querySelectorAll) return null;
      var nodes = scope.querySelectorAll(selector);
      for (var i = 0; i < nodes.length; i++) {
        var owner = nodes[i].closest ? nodes[i].closest('.sub-reply-item, .reply-item, .bili-dyn-item') : null;
        if (!owner || owner === scope) return nodes[i];
      }
      return null;
    }

    function paintAction(el) {
      var shadow = rootOf(el);
      if (!shadow) return;
      watchRoot(shadow);
      var anchor = shadow.querySelector('#pubdate, .pubdate, #time');
      if (!anchor) return;
      var rec = resolveRecord(sourcesFor(el), {
        replyMap: replyMap,
        pubMap: pubMap,
        failed: replyFailed
      });
      if (!rec) return;
      placeBadge(anchor, rec);
    }

    function paintRenderer(el) {
      var shadow = rootOf(el);
      if (!shadow) return;
      watchRoot(shadow);
      if (shadow.querySelector('bili-comment-action-buttons-renderer')) return;
      var anchor = shadow.querySelector('#pubdate, .pubdate, .reply-time, .sub-reply-time');
      if (!anchor) return;
      var rec = resolveRecord(sourcesFor(el), {
        replyMap: replyMap,
        pubMap: pubMap,
        failed: replyFailed
      });
      if (!rec) return;
      placeBadge(anchor, rec);
    }

    function paintLegacy(el) {
      var anchor = findTime(el, '.reply-time, .sub-reply-time');
      if (!anchor) return;
      var rec = resolveRecord(sourcesFor(el), {
        replyMap: replyMap,
        pubMap: pubMap,
        failed: replyFailed
      });
      if (!rec) return;
      placeBadge(anchor, rec);
    }

    function paintDynamic(el) {
      var anchor = findTime(el, '.bili-dyn-time, .opus-module-author__pub__time, .opus-pub-time, .publish-text');
      if (!anchor) return;
      var rec = resolveRecord(sourcesFor(el), {
        replyMap: replyMap,
        pubMap: pubMap,
        pubId: cardId(el),
        failed: dynFailed
      });
      if (!rec) return;
      placeBadge(anchor, rec);
    }

    function pageIsDetail() {
      return /\/read\/cv\d+|\/opus\/\d+|\/dynamic\/\d+|\/\/t\.bilibili\.com\/\d+/.test(location.href);
    }

    function paintAuthor(el) {
      if (el.closest && el.closest('.bili-dyn-item, .bili-dyn-list__item, .reply-item')) return;
      var anchor = findTime(el, '.publish-text, .create-time, .opus-module-author__pub__time, .opus-pub-time, .bili-dyn-time');
      if (!anchor) return;
      var failed = pageIsDetail() && (articleFailed || dynFailed);
      var rec = resolveRecord(sourcesFor(el), {
        replyMap: replyMap,
        pubMap: pubMap,
        pubId: cardId(el),
        pageAuthor: pageIsDetail() ? state.pageAuthor : null,
        failed: failed
      });
      if (!rec) return;
      placeBadge(anchor, rec);
    }

    function paint(el) {
      if (!el || el.nodeType !== 1) return;
      var tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (tag === 'bili-comment-action-buttons-renderer') return paintAction(el);
      if (tag === 'bili-comment-renderer' || tag === 'bili-comment-reply-renderer') return paintRenderer(el);
      if (tag.indexOf('bili-comment') === 0 || tag === 'bili-comments') {
        var shadow = rootOf(el);
        if (shadow) watchRoot(shadow);
        return;
      }
      if (el.classList) {
        if (el.classList.contains('reply-item') || el.classList.contains('sub-reply-item')) return paintLegacy(el);
        if (el.classList.contains('bili-dyn-item') || el.classList.contains('bili-dyn-list__item')) return paintDynamic(el);
        if (el.classList.contains('opus-module-author') || el.classList.contains('article-up-info') || el.classList.contains('article-info')) return paintAuthor(el);
      }
    }

    function scan(root) {
      var scope = root && root.querySelectorAll ? root : document;
      var nodes;
      try { nodes = scope.querySelectorAll(SCAN_SELECTOR); } catch (err) { return; }
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        try { paint(el); } catch (err) { /* 跳过单节点 */ }
        var shadow = rootOf(el);
        if (shadow) scan(shadow);
      }
    }

    function scheduleScan() {
      if (scheduled) return;
      scheduled = true;
      var run = function () {
        scheduled = false;
        try { scan(document); } catch (err) { /* 整页扫描失败时等待下一次 DOM 更新 */ }
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
      else setTimeout(run, 16);
    }

    function nodeInteresting(node, depth) {
      if (!node || node.nodeType !== 1 || depth > 2) return false;
      var tag = node.tagName ? node.tagName.toLowerCase() : '';
      if (tag.indexOf('bili-comment') !== -1 || tag === 'bili-comments') return true;
      var cls = typeof node.className === 'string' ? node.className : '';
      if (/reply-item|sub-reply-item|bili-dyn-item|opus-module-author|article-up-info|article-info|reply-info/.test(cls)) return true;
      if (node.querySelector) {
        try {
          if (node.querySelector('bili-comments, bili-comment-thread-renderer, .reply-item, .bili-dyn-item, .opus-module-author')) return true;
        } catch (err) { /* 选择器在该节点上不可用 */ }
      }
      return false;
    }

    function startObserver() {
      if (!document.documentElement || document.documentElement.__biliIpObs) return;
      document.documentElement.__biliIpObs = true;
      var mo = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var added = mutations[i].addedNodes;
          if (!added) continue;
          for (var j = 0; j < added.length; j++) {
            if (nodeInteresting(added[j], 0)) {
              scheduleScan();
              return;
            }
          }
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }

    function ingestGlobals() {
      try { if (window.__INITIAL_STATE__) indexPayload(window.__INITIAL_STATE__, location.href, state); } catch (err) { /* 没有首屏状态 */ }
      scheduleScan();
    }

    lastPath = location.pathname;
    try { hookFetch(); } catch (err) { /* 页面没有可包装的 fetch */ }
    try { hookXhr(); } catch (err) { /* 页面没有可包装的 XHR */ }
    try { hookHistory(); } catch (err) { /* 历史 API 不可写时仍依赖 DOM 观察 */ }
    try { hookCustomElements(); } catch (err) { /* 组件注册不可写时依赖扫描 */ }
    try { hookAttachShadow(); } catch (err) { /* 无法拦截影子根时读取已打开的 shadowRoot */ }

    function onReady() {
      startObserver();
      ingestGlobals();
      scheduleScan();
    }

    if (document.documentElement) onReady();
    else document.addEventListener('DOMContentLoaded', onReady);
    document.addEventListener('DOMContentLoaded', ingestGlobals);
    window.addEventListener('load', function () {
      ingestGlobals();
      scheduleScan();
    });
  }

  var api = {
    normalizeLocation: normalizeLocation,
    classifyUrl: classifyUrl,
    readPageIds: readPageIds,
    indexPayload: indexPayload,
    resolveRecord: resolveRecord,
    inspect: inspect
  };

  if (typeof module !== 'undefined' && module.exports && typeof document === 'undefined') {
    module.exports = api;
  }

  if (typeof document !== 'undefined') boot();
})();
