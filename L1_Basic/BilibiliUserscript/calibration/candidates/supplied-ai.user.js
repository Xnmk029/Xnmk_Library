// ==UserScript==
// @name         Bilibili 公开 IP 属地显示
// @namespace    https://bilibili.com/userscripts/public-ip-location
// @version      1.0.0
// @description  显示桌面评论及楼中楼已返回的 IP 属地；适配 SPA、异步加载及 Shadow DOM，无额外请求或数据存储。
// @match        https://bilibili.com/*
// @match        https://www.bilibili.com/*
// @match        https://space.bilibili.com/*
// @match        https://t.bilibili.com/*
// @match        https://live.bilibili.com/*
// @run-at       document-start
// @sandbox      raw
// @grant        none
// @noframes
// @license      MIT
// Network: none initiated by this script; no @connect, @require, or remote assets.
// Passive observation only: the page's existing GET responses from
// https://api.bilibili.com/x/v2/reply
// https://api.bilibili.com/x/v2/reply/main
// https://api.bilibili.com/x/v2/reply/wbi/main
// https://api.bilibili.com/x/v2/reply/reply
// https://api.bilibili.com/x/v2/reply/dialog
// ==/UserScript==

(() => {
  'use strict';

  // Install in Tampermonkey and reload the page once. No configuration required.
  // A location belongs to a particular published comment, not to a user account.
  // Never match by username, UID, IP address, or a comment's text. No geolocation,
  // cookies, storage, telemetry, API retries, login changes, or hidden-comment access.
  // Modern DOM reference: https://github.com/the1812/Bilibili-Evolved/discussions/4804
  const installationKey = Symbol.for('bilibili.public-comment-location.v1');
  if (window[installationKey]) return;
  try {
    Object.defineProperty(window, installationKey, { value: true });
  } catch {
    return;
  }

  const BADGE = 'data-bili-public-ip';
  const BADGE_SELECTOR = `[${BADGE}]`;
  const LEGACY = '.reply-wrap, .reply-item, .sub-reply-item';
  const COMPONENTS = [
    'bili-comments',
    'bili-comment-list',
    'bili-comment-thread-renderer',
    'bili-comment-renderer',
    'bili-comment-replies-renderer',
    'bili-comment-reply-renderer',
    'bili-comment-action-buttons-renderer',
  ].join(',');
  const DISCOVERY = `${COMPONENTS}, ${LEGACY}`;
  const NATIVE_LOCATION = '#location, .reply-location, .sub-reply-location, .ip-location';
  const locations = new Map();
  const targets = new Set();
  const observers = new Map();
  const pendingTrees = new Set();
  const labels = new Map();
  const MAX_CACHE = 1500;
  const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
  let currentURL = location.href;
  let routeGeneration = 0;
  let flushTimer = 0;

  function commentID(value) {
    if (typeof value === 'number') {
      return Number.isSafeInteger(value) && value > 0 ? String(value) : '';
    }
    if (typeof value === 'string' && /^[1-9]\d{0,23}$/.test(value)) return value;
    return '';
  }

  function recordID(record) {
    return record && typeof record === 'object'
      ? commentID(record.rpid_str) || commentID(record.rpid)
      : '';
  }

  function locationText(value) {
    if (typeof value !== 'string') return '';
    // textContent is used for output, so returned strings never become markup.
    const text = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (!text || text.length > 160) return '';
    const place = text.replace(/^IP\s*属地\s*[:：]?\s*/i, '').trim();
    return place ? `IP属地：${place}` : '';
  }

  function locationField(record) {
    if (!record || typeof record !== 'object') return { present: false, text: '' };
    const control = record.reply_control;
    if (control && Object.prototype.hasOwnProperty.call(control, 'location')) {
      return { present: true, text: locationText(control.location) };
    }
    // Only explicitly named IP-location fields are accepted; generic "location"
    // fields, addresses in comment text, and user-supplied profile cities are not.
    for (const key of ['ip_location', 'ipLocation']) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        return { present: true, text: locationText(record[key]) };
      }
    }
    return { present: false, text: '' };
  }

  function asReply(value) {
    return recordID(value) ? value : null;
  }

  function elementRecord(element, expectedID = '') {
    // Read known component properties only. Do not enumerate application state.
    try {
      const sources = [element.__data];
      const vue3 = element.__vueParentComponent;
      const vue2 = element.__vue__;
      const props = [vue3?.props, vue2?.$props, vue2?._props];
      for (const source of props) {
        if (!source) continue;
        for (const key of ['reply', 'item', 'replyInfo', 'replyData', 'data']) {
          sources.push(source[key]);
        }
      }
      if (vue2) sources.push(vue2.reply, vue2.item);
      for (const source of sources) {
        const reply = asReply(source);
        if (reply && (!expectedID || recordID(reply) === expectedID)) return reply;
      }
    } catch {
      // Framework upgrades or inaccessible properties must not break the page.
    }
    return null;
  }

  function modernRecord(element) {
    let node = element;
    let mainRendererSeen = false;
    // Prefer the nearest comment renderer's current record if its footer is
    // temporarily carrying an old record during a component update.
    for (let depth = 0; node && depth < 16; depth++) {
      if (node.nodeType === Node.ELEMENT_NODE &&
          /^(bili-comment-renderer|bili-comment-reply-renderer)$/.test(node.localName)) {
        const reply = elementRecord(node);
        if (reply) return reply;
        if (node.localName === 'bili-comment-reply-renderer') break;
        mainRendererSeen = true;
      }
      if (mainRendererSeen && node.localName === 'bili-comment-thread-renderer') {
        const reply = elementRecord(node);
        if (reply) return reply;
        break;
      }
      node = node.parentElement || node.getRootNode?.().host;
    }
    return elementRecord(element);
  }

  function attributeID(element) {
    for (const key of ['data-rpid', 'data-reply-id', 'data-id']) {
      const id = commentID(element.getAttribute(key));
      if (id) return id;
    }
    // data-root-reply-id is deliberately ignored: it identifies the parent,
    // and would incorrectly give all sub-replies the parent's IP location.
    return '';
  }

  function ownLegacyElement(comment, selector) {
    for (const element of comment.querySelectorAll(selector)) {
      if (element.closest(LEGACY) === comment) return element;
    }
    return null;
  }

  function legacyRecord(element) {
    const id = attributeID(element);
    const direct = elementRecord(element, id);
    if (direct) return direct;
    const body = ownLegacyElement(element, '.root-reply, .reply-con, .con');
    return body ? elementRecord(body, id) : null;
  }

  function visible(element) {
    if (!element.isConnected || !element.getClientRects().length) return false;
    const style = getComputedStyle(element);
    return style.visibility !== 'hidden' && style.visibility !== 'collapse' &&
      style.opacity !== '0';
  }

  function nativeLocation(container, legacyOwner) {
    let hiddenText = '';
    for (const element of container.querySelectorAll(NATIVE_LOCATION)) {
      if (element.hasAttribute(BADGE) || element.closest(BADGE_SELECTOR)) continue;
      if (legacyOwner && element.closest(LEGACY) !== legacyOwner) continue;
      const text = locationText(element.textContent);
      if (!text) continue;
      if (visible(element)) return { visible: true, text };
      hiddenText ||= text;
    }
    return { visible: false, text: hiddenText };
  }

  function removeLabel(target) {
    const span = labels.get(target);
    if (span) span.remove();
    labels.delete(target);
  }

  function render(target) {
    if (!target.isConnected) return;
    const modern = target.localName === 'bili-comment-action-buttons-renderer';
    const container = modern ? target.shadowRoot : target;
    if (!container) return;
    const anchor = modern
      ? container.querySelector('#pubdate, #time, .reply-time')
      : ownLegacyElement(target, '.reply-time, .sub-reply-time, .info .time');
    // Insert beside an existing date only; never into a menu, editor or overlay.
    if (!anchor || !anchor.parentNode || anchor.closest('[contenteditable="true"]')) {
      removeLabel(target);
      return;
    }
    const native = nativeLocation(container, modern ? null : target);
    if (native.visible) {
      removeLabel(target);
      return;
    }
    const reply = modern ? modernRecord(target) : legacyRecord(target);
    const id = recordID(reply) || (modern ? '' : attributeID(target));
    const field = locationField(reply);
    const text = field.present ? field.text : native.text || locations.get(id) || '';
    const status = text ? 'available' : 'missing';
    const output = text || 'IP属地：未提供';

    let span = labels.get(target);
    if (!span || !span.isConnected) {
      // Recover our own node if a framework moved it, without touching native nodes.
      span = Array.from(container.querySelectorAll(BADGE_SELECTOR)).find(element =>
        modern || element.closest(LEGACY) === target);
      if (!span) {
        span = document.createElement('span');
        span.setAttribute(BADGE, '');
        span.style.cssText = [
          'display:inline-block', 'position:static', 'margin-inline-start:10px',
          'font-family:inherit', 'font-size:12px', 'font-weight:400',
          'line-height:inherit', 'color:var(--text3,#9499a0)', 'vertical-align:baseline',
          'max-inline-size:min(28ch,45vw)', 'overflow:hidden', 'text-overflow:ellipsis',
          'white-space:nowrap', 'flex:0 1 auto', 'box-sizing:border-box',
        ].join(';');
      }
      labels.set(target, span);
    }
    if (span.textContent !== output) span.textContent = output;
    if (span.dataset.state !== status) span.dataset.state = status;
    const title = text
      ? `${text}（该条评论发布时由 B 站公开返回；不代表当前所在地）`
      : '该条评论未返回公开 IP 属地信息';
    if (span.title !== title) span.title = title;
    if (anchor.nextSibling !== span) anchor.after(span);

    // Idempotence also handles copied/recycled DOM containing an old injected span.
    for (const other of container.querySelectorAll(BADGE_SELECTOR)) {
      if (other !== span && (modern || other.closest(LEGACY) === target)) other.remove();
    }
  }

  function isOwnMutation(record) {
    const element = record.target.nodeType === Node.ELEMENT_NODE
      ? record.target : record.target.parentElement;
    if (element?.closest(BADGE_SELECTOR)) return true;
    if (record.type !== 'childList') return false;
    const changed = [...record.addedNodes, ...record.removedNodes];
    return changed.length > 0 && changed.every(node =>
      node.nodeType === Node.ELEMENT_NODE && node.hasAttribute(BADGE));
  }

  function observe(root) {
    if (observers.has(root)) return;
    const observer = new MutationObserver(records => {
      let changed = false;
      for (const record of records) {
        if (isOwnMutation(record)) continue;
        if (root.host) {
          pendingTrees.add(root);
          changed = true;
        } else {
          const element = record.target.nodeType === Node.ELEMENT_NODE
            ? record.target : record.target.parentElement;
          const comment = element?.closest(LEGACY);
          if (comment) {
            pendingTrees.add(comment);
            changed = true;
          }
          for (const added of record.addedNodes || []) {
            if (added.nodeType === Node.ELEMENT_NODE) {
              pendingTrees.add(added);
              changed = true;
            }
          }
        }
      }
      if (changed) schedule();
    });
    observer.observe(root, {
      childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['data-id', 'data-rpid', 'data-reply-id', 'class', 'style', 'hidden'],
    });
    observers.set(root, observer);
  }

  function discover(tree) {
    if (!tree?.querySelectorAll) return;
    const elements = tree.nodeType === Node.ELEMENT_NODE && tree.matches(DISCOVERY)
      ? [tree, ...tree.querySelectorAll(DISCOVERY)]
      : tree.querySelectorAll(DISCOVERY);
    for (const element of elements) {
      if (!element.isConnected) continue;
      if (element.localName === 'bili-comment-action-buttons-renderer' || element.matches(LEGACY)) {
        targets.add(element);
      }
      if (element.shadowRoot) {
        observe(element.shadowRoot);
        discover(element.shadowRoot);
      }
    }
  }

  function checkRoute() {
    if (currentURL === location.href) return;
    currentURL = location.href;
    routeGeneration++;
    locations.clear();
    for (const target of labels.keys()) removeLabel(target);
    pendingTrees.add(document);
  }

  function flush() {
    flushTimer = 0;
    checkRoute();
    const trees = [...pendingTrees];
    pendingTrees.clear();
    for (const tree of trees) {
      try { discover(tree); } catch { /* An obsolete component is harmless. */ }
    }
    for (const target of targets) {
      if (!target.isConnected) {
        removeLabel(target);
        targets.delete(target);
      } else {
        try { render(target); } catch { /* Missing data/layout: silently skip. */ }
      }
    }
    // Release observers and detached nodes after SPA unmounts or comment paging.
    for (const [root, observer] of observers) {
      if (root.host && !root.host.isConnected) {
        observer.disconnect();
        observers.delete(root);
      }
    }
  }

  function schedule() {
    if (!flushTimer) flushTimer = window.setTimeout(flush, 80);
  }

  function rememberResponse(payload, generation) {
    checkRoute();
    if (generation !== routeGeneration || !payload || payload.code !== 0 || !payload.data) return;
    // Traverse only public reply-list fields, not members, content or other data.
    const queue = [payload.data];
    const seen = new WeakSet();
    const edges = ['replies', 'hots', 'top_replies', 'top', 'upper', 'admin', 'vote', 'reply'];
    for (let index = 0; index < queue.length && index < 5000; index++) {
      const value = queue[index];
      if (!value || typeof value !== 'object' || seen.has(value)) continue;
      seen.add(value);
      if (Array.isArray(value)) {
        for (const child of value) if (queue.length < 5000) queue.push(child);
        continue;
      }
      const id = recordID(value);
      if (id) {
        locations.delete(id);
        locations.set(id, locationField(value).text);
      }
      for (const key of edges) {
        if (value[key] && typeof value[key] === 'object' && queue.length < 5000) {
          queue.push(value[key]);
        }
      }
    }
    while (locations.size > MAX_CACHE) locations.delete(locations.keys().next().value);
    schedule();
  }

  function publicReplyURL(input, method) {
    try {
      if (String(method || 'GET').toUpperCase() !== 'GET') return false;
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
      return url.protocol === 'https:' && url.hostname === 'api.bilibili.com' &&
        /^\/x\/v2\/reply(?:\/(?:main|wbi\/main|reply|dialog))?$/.test(url.pathname);
    } catch {
      return false;
    }
  }

  function observePageRequests() {
    // Observe only calls initiated by Bilibili. Never invoke a request ourselves,
    // change a URL/body/header, consume the page's original body, or retry a call.
    try {
      const originalFetch = window.fetch;
      if (typeof originalFetch === 'function') {
        window.fetch = function (...args) {
          checkRoute();
          const generation = routeGeneration;
          const result = Reflect.apply(originalFetch, this, args);
          if (publicReplyURL(args[0], args[1]?.method || args[0]?.method)) {
            result.then(response => {
              try {
                if (generation !== routeGeneration || !response.ok ||
                    !publicReplyURL(response.url || args[0], 'GET') ||
                    !response.headers.get('content-type')?.includes('json') ||
                    Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) return;
                response.clone().text().then(body => {
                  if (body.length > MAX_RESPONSE_BYTES) return;
                  try { rememberResponse(JSON.parse(body), generation); } catch { /* Invalid JSON. */ }
                }).catch(() => {});
              } catch { /* Opaque, aborted, or already-used response. */ }
            }, () => {}).catch(() => {});
          }
          return result; // Preserve the original fetch promise and rejection.
        };
      }
    } catch { /* DOM/component data remains available if interception is blocked. */ }

    try {
      const proto = XMLHttpRequest.prototype;
      const originalOpen = proto.open;
      const originalSend = proto.send;
      const requests = new WeakMap();
      proto.open = function (...args) {
        const result = Reflect.apply(originalOpen, this, args);
        requests.set(this, publicReplyURL(args[1], args[0]));
        return result;
      };
      proto.send = function (...args) {
        checkRoute();
        const generation = routeGeneration;
        let listener;
        if (requests.get(this)) {
          listener = () => {
            try {
              if (generation !== routeGeneration || this.status < 200 || this.status >= 300 ||
                  !publicReplyURL(this.responseURL, 'GET')) return;
              if (this.responseType === 'json') {
                rememberResponse(this.response, generation);
              } else if ((!this.responseType || this.responseType === 'text') &&
                         this.responseText.length <= MAX_RESPONSE_BYTES) {
                rememberResponse(JSON.parse(this.responseText), generation);
              }
            } catch { /* Failed requests, unsupported response types, invalid JSON. */ }
          };
          this.addEventListener('loadend', listener, { once: true });
        }
        try {
          return Reflect.apply(originalSend, this, args);
        } catch (error) {
          if (listener) this.removeEventListener('loadend', listener);
          throw error; // Preserve native errors for the page's own handlers.
        }
      };
    } catch { /* Component data and DOM monitoring are independent fallbacks. */ }
  }

  function observeRoutes() {
    for (const method of ['pushState', 'replaceState']) {
      try {
        const original = history[method];
        history[method] = function (...args) {
          const result = Reflect.apply(original, this, args);
          checkRoute();
          schedule();
          return result;
        };
      } catch { /* URL polling still catches route changes. */ }
    }
    for (const event of ['popstate', 'hashchange', 'pageshow']) {
      window.addEventListener(event, () => {
        checkRoute();
        pendingTrees.add(document);
        schedule();
      });
    }
  }

  observePageRequests();
  observeRoutes();
  observe(document);
  pendingTrees.add(document);
  schedule();

  // Covers late attachShadow(), data-property updates without DOM mutations,
  // virtualized/recycled nodes, and routers that replace the History wrappers.
  // No attachShadow override and no forcing open a closed shadow root.
  window.setInterval(() => {
    if (document.hidden) return;
    checkRoute();
    pendingTrees.add(document);
    schedule();
  }, 1500);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkRoute();
      pendingTrees.add(document);
      schedule();
    }
  });
})();
