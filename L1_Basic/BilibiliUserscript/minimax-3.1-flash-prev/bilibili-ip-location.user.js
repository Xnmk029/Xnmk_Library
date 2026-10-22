// ==UserScript==
// @name         B 站 IP 属地助手
// @namespace    https://bench.local/userscripts/bilibili-ip-location
// @version      1.0.0
// @description  在 B 站电脑端页面展示「页面已经返回」的 IP 属地信息：识别并规范页面上已渲染的「IP属地」文本；页面自身未展示时，使用页面已经拉取的公开接口响应中确实存在的 ip_location 字段补全；字段缺失时给出灰色占位。适配 SPA 动态路由与异步内容，不新增网络请求，不收集、不上传、不持久化任何用户数据。
// @author       bench-runs
// @license      MIT
// @match        *://www.bilibili.com/*
// @match        *://space.bilibili.com/*
// @match        *://t.bilibili.com/*
// @match        *://live.bilibili.com/*
// @match        *://message.bilibili.com/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

/*
 * 实现要点
 *
 * 1) 权限最小化：@grant none，不使用 GM_xmlhttpRequest / GM_setValue / GM_cookie 等特权 API。
 *    脚本自身「不发任何请求」，只读取两类已经存在的数据：
 *      a) DOM 中已经渲染出来的「IP属地：xxx」文本；
 *      b) 页面自己发起的 fetch / XHR 已经返回的 JSON（被动旁读响应副本，不额外请求）。
 *    中间数据只存在于内存中的 Map / Set：不写 localStorage、不写 Cookie、不上报任何服务器。
 *
 * 2) 绝不推断：只有文本或 JSON 字段里真的出现归属地字符串时才展示；
 *    字段缺失（或值为「未知」等）时展示灰色占位并说明原因，不猜测、不补全。
 *
 * 3) 幂等：每个挂载点最多一个徽标，用「节点引用 + 内容签名」双重判重；
 *    重复扫描、重复路由切换、重复 DOM 更新都不会重复插入。
 *
 * 4) 不打扰：徽标是行内小胶囊（inline-flex），跟随原文流，不覆盖任何原控件、
 *    不遮挡弹层；状态条只插到页面已有的容器里，不做全屏浮层。
 *    Alt + Shift + I 可全局隐藏 / 显示徽标。
 */

(function () {
  'use strict';

  var VERSION = '1.0.0';
  var GLOBAL_KEY = '__BILI_IP_LOC__';
  var ROUTE_EVENT = 'bili-ip-loc:routechange';
  var UPDATE_EVENT = 'bili-ip-loc:update';
  var STYLE_ID = 'bili-ip-loc-style';
  var STATUS_ID = 'bili-ip-loc-status';
  var BADGE_ATTR = 'data-bili-ip-loc-badge';

  /* ------------------------------------------------------------------ 配置 */

  var CONFIG = {
    /* 条目容器：徽标挂载点 + 「嵌套条目隔离」依据 */
    rootSelectors: [
      '.bili-comment-thread-renderer',
      '.reply-item',
      '.reply-wrap',
      '.comment-item',
      '.bili-rich-card',
      '.bili-rich-card-legacy',
      '.card-wrap',
      '.feed-card',
      '.live-chat-item',
      '.chat-item',
      '.danmu-item',
      '.user-card',
      '.member-card',
      '.user-info-panel',
      '.up-info'
    ],
    /* 徽标优先插入的「信息行」，贴合原页面布局 */
    metaSelectors: [
      '.reply-show',
      '.bottom-left',
      '.reply-bottom',
      '.card-bottom',
      '.user-info',
      '.info-text',
      '.up-info',
      '.info',
      '.meta',
      '.detail-info',
      '.item-info'
    ],
    /* 徽标次选插入的「作者行」 */
    nameSelectors: [
      '.user-name',
      '.author-name',
      '.up-name',
      '.uname',
      '.name',
      '.nickname'
    ],
    /* 只旁读这些公开接口的响应，避免克隆无关流量 */
    watchUrlPattern: /\/x\/(v2\/reply|v2\/reply\/(main|detail)|web-interface\/(card|nav|arc\/stat)|polymer\/web-dynamic|live\/web-ucenter)/,
    ipKeyPattern: /^(ip_?location|ipLocation|ip_?area)$/i,
    /* 只接受标签式写法（「IP属地：广东」），不做「裸地名」猜测 */
    labelPattern: /(?:IP\s*属地|IP\s*归属地|归属地|属地)\s*[：:]\s*([^\s，。！？；、"'）)】\]|]{1,16})/,
    /* 合法归属地字符串：中文为主，可含分隔符，不含数字与长句 */
    validLocationPattern: /^[一-龥A-Za-z·\- ]{1,16}$/,
    unknownPattern: /^(未知|不详|暂无|无|保密|隐藏|不显示|unknown|n\/?a|-)$/i,
    walkDepth: 12,
    walkBudget: 30000,
    maxUsers: 8000,
    debounceMs: 120
  };

  var ROOT_SELECTOR = CONFIG.rootSelectors.join(',');
  var META_SELECTOR = CONFIG.metaSelectors.join(',');
  var NAME_SELECTOR = CONFIG.nameSelectors.join(',');

  /* -------------------------------------------------------------- 运行状态 */

  var state = {
    byMid: new Map(),         // mid -> { location, source }   仅内存
    missingMids: new Set(),   // 接口里有该用户记录、但没有可用归属地字段
    looseSeen: new WeakSet(), // 已标记过的「游离」原生标签
    stats: { native: 0, filled: 0, unknown: 0, loose: 0, users: 0 },
    netMode: 'pending',       // pending | hooked | page-only
    enabled: true,
    lastStatusSig: '',
    started: false
  };

  /* -------------------------------------------------------------- 基础工具 */

  function on(target, type, handler) {
    try {
      target.addEventListener(type, handler);
    } catch (e) { /* 忽略无法绑定的事件 */ }
  }

  function closestRoot(node) {
    if (!node || node.nodeType !== 1 || typeof node.closest !== 'function') return null;
    try {
      return node.closest(ROOT_SELECTOR);
    } catch (e) {
      return null;
    }
  }

  function isOwnedBy(el, item) {
    var owner = closestRoot(el);
    return !owner || owner === item;
  }

  function normalizeLocation(raw) {
    if (raw === null || raw === undefined) return '';
    var s = String(raw).replace(/^[\s:：]+/, '').replace(/[\s　]+$/, '');
    if (!s) return '';
    if (CONFIG.unknownPattern.test(s)) return '';
    if (s.length > 12) return '';
    if (/\d/.test(s)) return '';
    if (!CONFIG.validLocationPattern.test(s)) return '';
    return s;
  }

  /* ------------------------------------------------------------------ 样式 */

  var CSS = [
    '.bili-ip-loc-badge{display:inline-flex;align-items:center;gap:3px;',
    'box-sizing:border-box;height:18px;margin:0 0 0 8px;padding:0 6px;',
    'border-radius:9px;font-size:12px;line-height:18px;font-weight:400;',
    'white-space:nowrap;vertical-align:middle;letter-spacing:normal;',
    'color:#9499a0;background:rgba(0,0,0,.04);}',
    '.bili-ip-loc-badge::before{content:"";display:block;width:5px;height:5px;',
    'border-radius:50%;background:currentColor;opacity:.55;}',
    '.bili-ip-loc-badge[data-state="filled"]{color:#00a1d6;background:rgba(0,161,214,.09);}',
    '.bili-ip-loc-badge[data-state="unknown"]{color:#c9ccd0;background:transparent;',
    'box-shadow:inset 0 0 0 1px #e3e5e7;}',
    '.bili-ip-loc-badge[data-state="unknown"]::before{display:none;}',
    'body.bili-ip-loc-hidden .bili-ip-loc-badge{display:none !important;}',
    '#' + STATUS_ID + '{display:flex;flex-wrap:wrap;align-items:center;',
    'justify-content:flex-end;gap:8px;margin:8px 0 2px;padding:0 2px;',
    'font-size:12px;line-height:18px;font-weight:400;color:#9499a0;}',
    '#' + STATUS_ID + '[hidden]{display:none !important;}',
    '#' + STATUS_ID + ' > span{white-space:normal;}',
    '#' + STATUS_ID + ' > button{font:inherit;font-size:12px;line-height:18px;',
    'color:#61666d;background:transparent;border:1px solid #e3e5e7;',
    'border-radius:9px;padding:0 8px;height:18px;cursor:pointer;flex:none;}',
    '#' + STATUS_ID + ' > button:hover{color:#00a1d6;border-color:#c9ccd0;}'
  ].join('');

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  /* ---------------------------------------------- 原生「IP属地」文本定位 */

  /* 在条目内定位已经渲染的归属地文本：
     单次文本遍历同时完成「精确匹配」与「拼接兜底」（应对标签被拆成多个文本节点），
     并跳过嵌套条目与本脚本自己插入的徽标，避免张冠李戴或自我重复。 */
  function findNativeLabel(item) {
    var exact = null;
    var buffer = '';

    var walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent || !item.contains(parent)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[' + BADGE_ATTR + ']')) return NodeFilter.FILTER_REJECT;
        if (!isOwnedBy(parent, item)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    var node;
    while ((node = walker.nextNode())) {
      var value = node.nodeValue || '';
      if (!exact && (value.indexOf('属地') >= 0 || value.indexOf('归属') >= 0)) {
        var match = CONFIG.labelPattern.exec(value);
        if (match) {
          var location = normalizeLocation(match[1]);
          exact = { el: node.parentElement, location: location, unknown: !location };
        }
      }
      if (buffer.length < 600) buffer += value;
    }

    if (exact) return exact;

    var fallback = CONFIG.labelPattern.exec(buffer);
    if (!fallback) return null;
    var fbLocation = normalizeLocation(fallback[1]);
    return { el: null, location: fbLocation, unknown: !fbLocation };
  }

  function markNative(el) {
    if (el && el.classList && !el.classList.contains('bili-ip-loc-native')) {
      el.classList.add('bili-ip-loc-native');
    }
  }

  function findMid(item) {
    if (item.getAttribute) {
      var inline = item.getAttribute('data-mid') || item.getAttribute('data-userid') || item.getAttribute('data-uid');
      if (inline && /^\d+$/.test(inline)) return inline;
    }
    var link = item.querySelector('a[href*="space.bilibili.com/"]');
    if (link) {
      var match = /space\.bilibili\.com\/(\d+)/.exec(link.getAttribute('href') || '');
      if (match) return match[1];
    }
    return '';
  }

  /* -------------------------------------------------------------- 徽标挂载 */

  function pickAnchor(item) {
    var list;
    var i;
    var el;

    list = item.querySelectorAll(META_SELECTOR);
    for (i = 0; i < list.length; i++) {
      el = list[i];
      if (isOwnedBy(el, item) && !el.hasAttribute(BADGE_ATTR)) return { node: el, mode: 'append' };
    }
    list = item.querySelectorAll(NAME_SELECTOR);
    for (i = 0; i < list.length; i++) {
      el = list[i];
      if (isOwnedBy(el, item) && (el.textContent || '').trim()) return { node: el, mode: 'after' };
    }
    return null;
  }

  function badgeText(info) {
    return info.state === 'unknown' ? 'IP属地：未公开' : 'IP属地：' + info.location;
  }

  function badgeTitle(info) {
    if (info.state === 'unknown') {
      return '页面已加载的公开数据里，该条记录没有可用的归属地字段，因此不展示推断结果。';
    }
    if (info.source === 'api') {
      return '来自页面已经返回的公开接口数据（ip_location 字段），非推断结果。';
    }
    return '来自页面已渲染的公开文本，非推断结果。';
  }

  /* 幂等插入：同一挂载点最多一个徽标，内容变化时原地替换 */
  function ensureBadge(item, info) {
    var signature = info.state + '|' + (info.location || '');
    var existing = item.__biliIpLocBadge;

    if (existing && existing.isConnected) {
      if (item.__biliIpLocSig === signature) return true;
      existing.remove();
    }

    var anchor = pickAnchor(item);
    if (!anchor) return false;

    var badge = document.createElement('span');
    badge.className = 'bili-ip-loc-badge';
    badge.setAttribute(BADGE_ATTR, '1');
    badge.setAttribute('data-state', info.state);
    if (info.source) badge.setAttribute('data-source', info.source);
    badge.textContent = badgeText(info);
    badge.title = badgeTitle(info);

    if (anchor.mode === 'after') anchor.node.insertAdjacentElement('afterend', badge);
    else anchor.node.appendChild(badge);

    item.__biliIpLocBadge = badge;
    item.__biliIpLocSig = signature;
    return true;
  }

  function clearBadge(item) {
    var badge = item.__biliIpLocBadge;
    if (badge && badge.isConnected) badge.remove();
    item.__biliIpLocBadge = null;
    item.__biliIpLocSig = 'none';
  }

  /* -------------------------------------------------------------- 条目渲染 */

  function renderItem(item) {
    if (!item || item.nodeType !== 1) return;
    try {
      var native = findNativeLabel(item);
      if (native) {
        markNative(native.el);
        var nativeSig = 'native|' + (native.location || 'unknown');
        if (item.__biliIpLocSig !== nativeSig) {
          if (item.__biliIpLocBadge && item.__biliIpLocBadge.isConnected) item.__biliIpLocBadge.remove();
          item.__biliIpLocBadge = null;
          item.__biliIpLocSig = nativeSig;
          if (native.location) state.stats.native++;
          else state.stats.unknown++;
        }
        return;
      }

      var mid = findMid(item);
      var known = mid ? state.byMid.get(mid) : null;
      var target = null;

      if (known && known.location) {
        target = { location: known.location, state: 'filled', source: 'api', sig: 'filled|' + known.location, counter: 'filled' };
      } else if (mid && state.missingMids.has(mid)) {
        target = { location: '', state: 'unknown', source: 'api', sig: 'unknown|', counter: 'unknown' };
      }

      if (!target) {
        if (item.__biliIpLocSig !== 'none') clearBadge(item);
        return;
      }
      if (item.__biliIpLocSig === target.sig) return;
      if (ensureBadge(item, target)) state.stats[target.counter]++;
    } catch (e) { /* 单个条目失败不影响其它条目 */ }
  }

  /* 布局未知时同样可用：给不在已知容器里的「IP属地」文本打标记并计入统计。
     这里只打标记、不插入任何内容，因此不会产生重复信息。 */
  function scanLooseLabels() {
    var body = document.body;
    if (!body) return;
    try {
      var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          var value = node.nodeValue || '';
          if (value.indexOf('属地') < 0) return NodeFilter.FILTER_REJECT;
          var parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest('[' + BADGE_ATTR + ']')) return NodeFilter.FILTER_REJECT;
          if (parent.closest('#' + STATUS_ID)) return NodeFilter.FILTER_REJECT;
          if (closestRoot(parent)) return NodeFilter.FILTER_REJECT;
          if (state.looseSeen.has(parent)) return NodeFilter.FILTER_REJECT;
          if (!CONFIG.labelPattern.test(value)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var node;
      while ((node = walker.nextNode())) {
        var parent = node.parentElement;
        state.looseSeen.add(parent);
        markNative(parent);
        state.stats.loose++;
      }
    } catch (e) { /* 忽略 */ }
  }

  /* ------------------------------------------------- 公开接口响应解析（只读） */

  function readMid(obj) {
    if (!obj || typeof obj !== 'object') return '';
    var direct = obj.mid !== undefined && obj.mid !== null ? obj.mid
      : (obj.uid !== undefined && obj.uid !== null ? obj.uid : '');
    if (direct !== '' && /^\d+$/.test(String(direct))) return String(direct);

    var holders = ['member', 'card', 'sender', 'author', 'user', 'owner', 'up', 'info'];
    for (var i = 0; i < holders.length; i++) {
      var child = obj[holders[i]];
      if (child && typeof child === 'object' && child.mid !== undefined && child.mid !== null
        && /^\d+$/.test(String(child.mid))) return String(child.mid);
    }
    return '';
  }

  function remember(mid, location) {
    if (!mid || !location) return false;
    if (!state.byMid.has(mid) && state.byMid.size >= CONFIG.maxUsers) return false;
    var previous = state.byMid.get(mid);
    if (previous && previous.location === location) return false;
    state.byMid.set(mid, { location: location, source: 'api' });
    state.missingMids['delete'](mid);
    state.stats.users = state.byMid.size;
    return true;
  }

  function rememberMissing(mid) {
    if (!mid || state.byMid.has(mid)) return false;
    if (state.missingMids.size >= CONFIG.maxUsers) return false;
    if (state.missingMids.has(mid)) return false;
    state.missingMids.add(mid);
    return true;
  }

  /* 只读取响应里「本来就有」的归属地字段，不做任何推断补全 */
  function ingestJson(root) {
    if (!root || typeof root !== 'object') return false;
    var changed = false;
    var budget = CONFIG.walkBudget;
    var stack = [{ node: root, depth: 0 }];

    while (stack.length && budget > 0) {
      budget--;
      var frame = stack.pop();
      var node = frame.node;
      if (!node || typeof node !== 'object' || frame.depth > CONFIG.walkDepth) continue;

      if (Array.isArray(node)) {
        for (var i = node.length - 1; i >= 0; i--) {
          stack.push({ node: node[i], depth: frame.depth + 1 });
        }
        continue;
      }

      var keys = Object.keys(node);
      var location = '';
      var hasIpKey = false;
      for (var k = 0; k < keys.length; k++) {
        if (CONFIG.ipKeyPattern.test(keys[k])) {
          hasIpKey = true;
          location = normalizeLocation(node[keys[k]]);
          if (location) break;
        }
      }

      var mid = readMid(node);
      if (mid) {
        if (location) {
          changed = remember(mid, location) || changed;
        } else if (hasIpKey) {
          /* 字段存在但值不可用（如「未知」）：记为灰色占位，而不是隐藏 */
          changed = rememberMissing(mid) || changed;
        } else {
          var userish = typeof node.uname === 'string' || typeof node.face === 'string'
            || 'content' in node || 'message' in node || 'card' in node;
          if (userish) changed = rememberMissing(mid) || changed;
        }
      }

      for (var j = 0; j < keys.length; j++) {
        var child = node[keys[j]];
        if (child && typeof child === 'object') {
          stack.push({ node: child, depth: frame.depth + 1 });
        }
      }
    }

    if (changed) schedule(true);
    return changed;
  }

  /* --------------------------------------- 被动旁读页面「已经返回」的响应 */

  function isWatchedUrl(url) {
    if (!url) return false;
    if (url.indexOf('//') === 0) url = location.protocol + url;
    if (url.indexOf('bilibili.com') < 0 && url.indexOf('/x/') < 0) return false;
    return CONFIG.watchUrlPattern.test(url);
  }

  function isJsonResponse(response) {
    try {
      var type = response.headers && typeof response.headers.get === 'function'
        ? (response.headers.get('content-type') || '')
        : '';
      if (type && type.toLowerCase().indexOf('json') < 0) return false;
    } catch (e) { /* 读不到就当作可能 */ }
    return true;
  }

  function hookFetch() {
    var original = window.fetch;
    if (typeof original !== 'function' || original.__biliIpLocHooked) return;
    function hooked(input) {
      var url = '';
      try {
        url = typeof input === 'string' ? input : ((input && input.url) || '');
      } catch (e) { /* 忽略 */ }

      var promise = original.apply(this, arguments);
      if (!isWatchedUrl(url) || !promise || typeof promise.then !== 'function') return promise;

      return promise.then(function (response) {
        try {
          if (response && isJsonResponse(response) && typeof response.clone === 'function') {
            var copy = response.clone();
            if (typeof copy.text === 'function') {
              copy.text().then(function (text) {
                if (!text || text.length > 4 * 1024 * 1024) return;
                try { ingestJson(JSON.parse(text)); } catch (e) { /* 不是 JSON */ }
              })['catch'](function () {});
            }
          }
        } catch (e) { /* 旁读失败不影响页面本身 */ }
        return response;
      });
    }
    hooked.__biliIpLocHooked = true;
    try {
      window.fetch = hooked;
      if (state.netMode === 'pending') state.netMode = 'hooked';
    } catch (e) {
      state.netMode = 'page-only';
    }
  }

  function hookXhr() {
    var XHR = window.XMLHttpRequest;
    if (!XHR || !XHR.prototype) return;
    if (XHR.prototype.open && XHR.prototype.open.__biliIpLocHooked) return;
    var originalOpen = XHR.prototype.open;
    var originalSend = XHR.prototype.send;
    if (typeof originalOpen !== 'function' || typeof originalSend !== 'function') return;

    try {
      XHR.prototype.open = function (method, url) {
        this.__biliIpLocUrl = String(url || '');
        return originalOpen.apply(this, arguments);
      };
      XHR.prototype.open.__biliIpLocHooked = true;

      XHR.prototype.send = function () {
        var self = this;
        if (isWatchedUrl(self.__biliIpLocUrl)) {
          this.addEventListener('load', function () {
            try {
              if (self.responseType !== '' && self.responseType !== 'text') return;
              var text = self.responseText;
              if (!text || text.length > 4 * 1024 * 1024) return;
              ingestJson(JSON.parse(text));
            } catch (e) { /* 非 JSON 或跨域受限 */ }
          });
        }
        return originalSend.apply(this, arguments);
      };
      XHR.prototype.send.__biliIpLocHooked = true;
      if (state.netMode === 'pending') state.netMode = 'hooked';
    } catch (e) { /* 保持原状 */ }
  }

  function installNetworkObservers() {
    hookFetch();
    hookXhr();
  }

  /* -------------------------------------------------------------- 状态条 UI */

  function resolveStatusPlacement() {
    var headers = ['.reply-header', '.comments-header', '.bili-comment-header', '.reply-title-wrap', '.comments-title'];
    var i;
    var el;
    for (i = 0; i < headers.length; i++) {
      el = document.querySelector(headers[i]);
      if (el && el.parentNode) return { parent: el.parentNode, ref: el.nextSibling };
    }
    var containers = ['#commentapp', '.bili-comments', '.comment-container', '.reply-container',
      '.bili-comment-container', '.dynamic-detail', '.card-detail', '.video-info-container', 'main'];
    for (i = 0; i < containers.length; i++) {
      el = document.querySelector(containers[i]);
      if (el) return { parent: el, ref: null };
    }
    return null;
  }

  function updateStatus(force) {
    if (!state.enabled) {
      var disabled = document.getElementById(STATUS_ID);
      if (disabled) disabled.hidden = true;
      return;
    }
    var hiddenNow = document.body && document.body.classList.contains('bili-ip-loc-hidden');
    var s = state.stats;
    var signature = [s.native, s.filled, s.unknown, s.loose, s.users, state.netMode, hiddenNow ? 1 : 0].join('/');
    if (!force && signature === state.lastStatusSig) return;
    state.lastStatusSig = signature;

    var placement = resolveStatusPlacement();
    if (!placement) return;

    var el = document.getElementById(STATUS_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = STATUS_ID;

      var summary = document.createElement('span');
      summary.className = 'bili-ip-loc-summary';

      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.addEventListener('click', function () { toggleVisibility(); });

      el.appendChild(summary);
      el.appendChild(toggle);
    }
    el.hidden = false;

    if (el.parentNode !== placement.parent) {
      placement.parent.insertBefore(el, placement.ref);
    }

    el.querySelector('.bili-ip-loc-summary').textContent =
      'IP 属地助手：页面已展示 ' + s.native + ' 处 · 接口补全 ' + s.filled
      + ' 处 · 未公开 ' + s.unknown + ' 处 · 已识别 ' + s.users + ' 位用户'
      + (state.netMode === 'page-only' ? ' · 仅页面文本模式' : '')
      + ' · Alt+Shift+I 切换显示';
    el.querySelector('button').textContent = hiddenNow ? '显示徽标' : '隐藏徽标';

    try {
      window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: publicApi() }));
    } catch (e) { /* 旧浏览器忽略 */ }
  }

  function toggleVisibility() {
    var hidden = document.body.classList.toggle('bili-ip-loc-hidden');
    updateStatus(true);
    return !hidden;
  }

  /* ------------------------------------------------ 扫描与调度（SPA 适配核心） */

  var queue = [];
  var queued = new Set();
  var fullPending = false;
  var timer = 0;
  var lastHref = location.href;

  function enqueue(node) {
    if (!node || node.nodeType !== 1) return;
    if (queued.has(node)) return;
    queued.add(node);
    queue.push(node);
  }

  function processNode(node) {
    try {
      if (typeof node.matches === 'function' && node.matches(ROOT_SELECTOR)) renderItem(node);
      var list = node.querySelectorAll(ROOT_SELECTOR);
      for (var i = 0; i < list.length; i++) renderItem(list[i]);
    } catch (e) { /* 忽略 */ }
  }

  function scanAll() {
    try {
      var list = document.querySelectorAll(ROOT_SELECTOR);
      for (var i = 0; i < list.length; i++) renderItem(list[i]);
    } catch (e) { /* 忽略 */ }
  }

  function flush() {
    timer = 0;
    if (location.href !== lastHref) {
      lastHref = location.href;
      onRouteChange();
      return;
    }
    var full = fullPending;
    fullPending = false;
    var nodes = queue.splice(0, queue.length);
    queued.clear();
    if (full) {
      scanAll();
    } else {
      for (var i = 0; i < nodes.length; i++) processNode(nodes[i]);
    }
    scanLooseLabels();
    updateStatus();
  }

  function schedule(full) {
    if (full) fullPending = true;
    if (timer) return;
    timer = setTimeout(flush, CONFIG.debounceMs);
  }

  function onRouteChange() {
    queue.length = 0;
    queued.clear();
    fullPending = false;
    try {
      ensureStyle();
      scanAll();
      scanLooseLabels();
    } catch (e) { /* 忽略 */ }
    updateStatus(true);
  }

  function installObservers() {
    var target = document.documentElement;
    if (!target) return;
    var observer = new MutationObserver(function (records) {
      var dirty = false;
      for (var i = 0; i < records.length; i++) {
        var record = records[i];
        if (record.type === 'childList') {
          var added = record.addedNodes;
          for (var j = 0; j < added.length; j++) {
            var node = added[j];
            if (node.nodeType === 3) {
              if (node.parentElement) enqueue(node.parentElement);
              dirty = true;
              continue;
            }
            if (node.nodeType !== 1) continue;
            var tag = node.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK') continue;
            enqueue(node);
            dirty = true;
          }
        } else if (record.type === 'characterData') {
          if (record.target && record.target.parentElement) enqueue(record.target.parentElement);
          dirty = true;
        } else if (record.type === 'attributes' && record.target && record.target.nodeType === 1) {
          enqueue(record.target);
        }
      }
      if (dirty) schedule(false);
    });
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  /* -------------------------------------------------------- SPA 路由监听 */

  function dispatchRouteEvent() {
    try {
      window.dispatchEvent(new Event(ROUTE_EVENT));
    } catch (e) { /* 忽略 */ }
    schedule(true);
  }

  function installRouteHooks() {
    try {
      ['pushState', 'replaceState'].forEach(function (name) {
        var original = history[name];
        if (typeof original !== 'function' || original.__biliIpLocHooked) return;
        var patched = function () {
          var result = original.apply(this, arguments);
          dispatchRouteEvent();
          return result;
        };
        patched.__biliIpLocHooked = true;
        history[name] = patched;
      });
    } catch (e) { /* 只读环境，忽略 */ }

    on(window, 'popstate', dispatchRouteEvent);
    on(window, 'hashchange', dispatchRouteEvent);
    on(window, ROUTE_EVENT, function () { schedule(true); });
    on(window, 'pjax:end', dispatchRouteEvent);
    on(document, 'visibilitychange', function () {
      if (!document.hidden) schedule(true);
    });
  }

  /* -------------------------------------------------------------------- API */

  function publicApi() {
    return {
      version: VERSION,
      enabled: state.enabled,
      netMode: state.netMode,
      rescan: function () { schedule(true); },
      toggle: toggleVisibility,
      stats: function () {
        return {
          native: state.stats.native,
          filled: state.stats.filled,
          unknown: state.stats.unknown,
          loose: state.stats.loose,
          users: state.byMid.size
        };
      },
      setEnabled: function (value) {
        state.enabled = !!value;
        if (state.enabled) schedule(true);
        else updateStatus(true);
        return state.enabled;
      }
    };
  }

  /* ------------------------------------------------------------------ 启动 */

  function boot() {
    if (state.started) return;
    state.started = true;

    window[GLOBAL_KEY] = publicApi();

    installNetworkObservers();

    if (document.readyState === 'loading') {
      on(document, 'DOMContentLoaded', ready);
    } else {
      ready();
    }
  }

  function ready() {
    ensureStyle();
    installObservers();
    installRouteHooks();

    on(document, 'keydown', function (event) {
      if (!event.altKey || !event.shiftKey) return;
      if (String(event.code) !== 'KeyI' && String(event.key).toLowerCase() !== 'i') return;
      var tag = (event.target && event.target.tagName) || '';
      if (/^(input|textarea|select)$/i.test(tag)) return;
      if (event.target && event.target.isContentEditable) return;
      event.preventDefault();
      toggleVisibility();
    });

    onRouteChange();
  }

  /* 单例保护：脚本被重复注入时只触发一次重扫 */
  try {
    if (window[GLOBAL_KEY] && typeof window[GLOBAL_KEY].rescan === 'function') {
      window[GLOBAL_KEY].rescan();
      return;
    }
  } catch (e) { /* 继续启动 */ }

  boot();
})();
