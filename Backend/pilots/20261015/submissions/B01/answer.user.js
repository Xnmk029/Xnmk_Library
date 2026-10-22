// ==UserScript==
// @name         Bilibili 评论公开 IP 属地
// @namespace    https://www.bilibili.com/userscripts/comment-location
// @version      1.0.0
// @description  在评论时间旁显示该条评论已返回的公开属地；没有额外请求，仅被动观察页面既有 GET 响应。
// @match        https://www.bilibili.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  const installed = Symbol.for('bili.comment.public-location.installed');
  if (window[installed]) return;
  window[installed] = true;

  const badgeClass = 'bili-public-location-badge';
  const times = '#pubdate, .reply-time, .sub-reply-time';
  const rows = 'bili-comment-renderer,bili-comment-reply-renderer,.reply-item,.reply-wrap,.sub-reply-item';
  const missing = 'IP属地：未获取';
  const cache = new Map();
  const roots = new Map();
  const badges = new Map();
  const components = new Set();
  const seenComponents = new WeakSet();
  const componentAt = new WeakMap();
  const wrapped = new WeakSet();
  let scheduled = false;

  // Instrumentation must never replace a page method's return value or exception.
  const safely = fn => { try { return fn(); } catch { return undefined; } };
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      safely(scan);
    }, 30);
  }
  function identifier(reply) {
    return reply && typeof reply.rpid_str === 'string' ? reply.rpid_str : null;
  }
  function locationOf(reply) {
    const value = reply?.reply_control?.location;
    return typeof value === 'string' ? value.trim() : '';
  }
  function remember(reply) {
    const id = identifier(reply);
    if (!id) return;
    // Only the full string ID and the public field enter this in-memory cache.
    cache.delete(id);
    cache.set(id, locationOf(reply));
    if (cache.size > 5000) cache.delete(cache.keys().next().value);
  }
  function rememberTree(items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      remember(item);
      rememberTree(item.replies);
    }
  }

  // A proxy-only Vue instance may acquire vnode.el after proxy construction.
  // Keep weak references, then resolve its CURRENT vnode during every refresh.
  function trackComponent(component) {
    if (!component || typeof component !== 'object' || seenComponents.has(component)) return;
    seenComponents.add(component);
    components.add(new WeakRef(component));
    schedule();
  }
  safely(() => {
    const NativeProxy = window.Proxy;
    window.Proxy = new NativeProxy(NativeProxy, {
      construct(target, args, newTarget) {
        const proxy = Reflect.construct(target, args, newTarget);
        safely(() => {
          const descriptor = Object.getOwnPropertyDescriptor(args[0], '_');
          if (descriptor && 'value' in descriptor) trackComponent(descriptor.value);
        });
        return proxy;
      }
    });
  });
  function bindComponents() {
    for (const reference of components) {
      const component = reference.deref();
      if (!component) { components.delete(reference); continue; }
      safely(() => {
        for (const el of [component.vnode?.el, component.subTree?.el]) {
          if (el?.nodeType === 1) componentAt.set(el, component);
        }
      });
    }
  }
  function fromProps(props, sub) {
    if (!props || typeof props !== 'object') return undefined;
    // Finding an explicitly empty prop is authoritative, too: do not resurrect cache.
    if (sub && 'subReply' in props) return { reply: props.subReply };
    if ('reply' in props) return { reply: props.reply };
    return undefined;
  }
  function fromComponent(component, sub) {
    if (!component) return undefined;
    component = component._ || component;
    return fromProps(component.props, sub) || fromProps(component.vnode?.props, sub) ||
      fromProps(component.$props, sub);
  }
  function parentAcrossShadow(node) {
    return node.parentElement || node.getRootNode()?.host || null;
  }
  function resolve(time) {
    const row = time.closest(rows);
    const sub = !!row?.matches('.sub-reply-item');
    let node = time;
    while (node && node !== document.documentElement) {
      if (node.localName === 'bili-comment-action-buttons-renderer' && 'data' in node) {
        if (node.data !== undefined) return { value: locationOf(node.data) };
      }
      if (node.matches?.('bili-comment-renderer,bili-comment-reply-renderer') && '__data' in node) {
        return { value: locationOf(node.__data) };
      }
      const inferred = componentAt.get(node);
      const current = inferred && (inferred.vnode?.el === node || inferred.subTree?.el === node)
        ? inferred : null;
      for (const component of [node.__vueParentComponent, node.__vue__, current]) {
        const found = fromComponent(component, sub);
        if (found) return { value: locationOf(found.reply) };
      }
      // Do not let a nested reply inherit the root comment's props or ID.
      if (node === row || node.matches?.('bili-comment-renderer,bili-comment-reply-renderer')) break;
      node = parentAcrossShadow(node);
    }
    const id = row?.getAttribute('data-id');
    return { value: id && cache.has(id) ? cache.get(id) : '' };
  }

  function visible(element) {
    if (!element.textContent.trim() || !element.getClientRects().length) return false;
    for (let node = element; node; node = parentAcrossShadow(node)) {
      const css = getComputedStyle(node);
      if (node.hidden || css.display === 'none' || css.visibility === 'hidden' ||
          css.visibility === 'collapse' || css.opacity === '0') return false;
    }
    return true;
  }
  function paint(time) {
    const bar = time.parentElement;
    if (!bar) return;
    let badge = badges.get(time);
    if (badge && badge.parentElement !== bar) {
      badge.remove();
      badges.delete(time);
      badge = null;
    }
    const native = [...bar.querySelectorAll('#location,.reply-location,.ip-location')]
      .some(el => !el.classList.contains(badgeClass) && visible(el));
    if (native) {
      if (badge) badge.remove();
      badges.delete(time);
      return;
    }
    const value = resolve(time).value;
    const text = value || missing;
    if (!badge || !badge.isConnected) {
      badge = document.createElement('span');
      badge.className = badgeClass;
      // A normal-flow, shrinkable text box cannot cover the reply/more buttons.
      badge.style.cssText = 'display:inline-block;position:static;float:none;' +
        'box-sizing:border-box;min-width:0;max-width:min(10em,22vw);' +
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
        'vertical-align:middle;margin-inline:6px;font-size:inherit;line-height:inherit;' +
        'font-weight:normal;flex:0 1 auto;pointer-events:none;color:#888;';
      time.after(badge);
      badges.set(time, badge);
    } else if (time.nextSibling !== badge) {
      time.after(badge);
    }
    if (badge.textContent !== text) badge.textContent = text;
    if (badge.title !== text) badge.title = text;
    if (badge.dataset.state !== (value ? 'available' : 'missing')) {
      badge.dataset.state = value ? 'available' : 'missing';
    }
    const display = getComputedStyle(bar).display;
    if ((display === 'flex' || display === 'inline-flex') && bar.style.flexWrap !== 'wrap') {
      bar.style.flexWrap = 'wrap';
    }
  }
  function observe(root) {
    if (roots.has(root)) return;
    const observer = new MutationObserver(schedule);
    observer.observe(root, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['data-id', 'class', 'style', 'hidden'] });
    roots.set(root, observer);
  }
  function scan() {
    safely(installLegacy);
    bindComponents();
    for (const [time, badge] of badges) {
      if (!time.isConnected || !time.matches(times) || !badge.isConnected) {
        badge.remove();
        badges.delete(time);
      }
    }
    for (const [root, observer] of roots) {
      if (root !== document && !root.host.isConnected) {
        observer.disconnect();
        roots.delete(root);
      }
    }
    const pending = [document];
    for (let i = 0; i < pending.length; i++) {
      const root = pending[i];
      observe(root);
      for (const element of root.querySelectorAll('*')) {
        if (element.shadowRoot) pending.push(element.shadowRoot);
        if (element.matches(times)) safely(() => paint(element));
      }
    }
  }

  safely(() => {
    const original = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (...args) {
      const root = Reflect.apply(original, this, args);
      safely(() => { if (root.mode === 'open') { observe(root); schedule(); } });
      return root;
    };
  });
  function wrapMethod(object, name, before, after) {
    const original = object?.[name];
    if (typeof original !== 'function' || wrapped.has(original)) return;
    const replacement = function (...args) {
      if (before) safely(() => before(args));
      try { return Reflect.apply(original, this, args); }
      finally { if (after) safely(after); }
    };
    object[name] = replacement;
    wrapped.add(replacement);
  }
  safely(() => {
    const registry = window.customElements;
    const original = registry.define;
    registry.define = function (...args) {
      const result = Reflect.apply(original, this, args);
      safely(() => {
        if (args[0].startsWith('bili-comment')) wrapMethod(args[1].prototype, 'update', null, schedule);
        schedule();
      });
      return result;
    };
    for (const name of ['bili-comment-action-buttons-renderer', 'bili-comment-renderer', 'bili-comment-reply-renderer']) {
      const constructor = registry.get(name);
      if (constructor) wrapMethod(constructor.prototype, 'update', null, schedule);
    }
  });
  function installLegacy(value = window.bbComment) {
    for (const object of [value?.prototype, value]) {
      for (const name of ['_createListCon', '_createSubReplyItem']) {
        safely(() => wrapMethod(object, name, args => remember(args[0]), schedule));
      }
    }
  }
  safely(() => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'bbComment');
    if (!descriptor || (descriptor.configurable && 'value' in descriptor && descriptor.writable)) {
      let value = descriptor?.value;
      Object.defineProperty(window, 'bbComment', {
        configurable: true, enumerable: descriptor?.enumerable ?? true,
        get() { return value; },
        set(next) { value = next; safely(() => installLegacy(next)); schedule(); }
      });
      installLegacy(value);
    } else installLegacy();
  });

  // Call the original fetch exactly once; return its original promise. Clone only
  // successful existing reply GET responses, leaving the page's body untouched.
  safely(() => {
    const original = window.fetch;
    if (typeof original !== 'function') return;
    window.fetch = function (...args) {
      const promise = Reflect.apply(original, this, args);
      safely(() => {
        const input = args[0];
        const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, document.baseURI);
        const method = String(args[1]?.method || input?.method || 'GET').toUpperCase();
        if (method !== 'GET' || url.hostname !== 'api.bilibili.com' ||
            !/^\/x\/v2\/reply\/(main|reply)\/?$/.test(url.pathname)) return;
        promise.then(response => {
          if (!response.ok) return;
          return response.clone().json().then(body => {
            if (body?.code !== 0) return;
            rememberTree(body.data?.replies);
            schedule();
          });
        }).catch(() => {});
      });
      return promise;
    };
  });
  for (const method of ['pushState', 'replaceState']) {
    safely(() => wrapMethod(history, method, null, schedule));
  }
  addEventListener('popstate', schedule);
  addEventListener('pageshow', schedule);
  addEventListener('resize', schedule);
  observe(document);
  schedule();
  // Plain JS props, a vnode binding, or an already-attached open root can change
  // without any DOM mutation. This bounded fallback also repairs replaced hooks.
  setInterval(schedule, 400);
})();
