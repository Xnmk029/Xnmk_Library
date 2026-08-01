// ==UserScript==
// @name             B站电脑端显示IP归属地
// @name:zh-CN       B站电脑端显示IP归属地
// @namespace        bilibili-ip-location
// @version          1.1.0
// @description      在 B 站网页版评论区的每条评论与回复旁显示 IP 属地。兼容新版 Lit 评论区（shadow DOM）与旧版评论区。数据来自 B 站官方评论接口（reply_control.location），不发任何第三方请求。
// @description:zh-CN 在 B 站网页版评论区的每条评论与回复旁显示 IP 属地。兼容新版 Lit 评论区（shadow DOM）与旧版评论区。数据来自 B 站官方评论接口，不发任何第三方请求。
// @author           Codex
// @match            *://*.bilibili.com/*
// @run-at           document-start
// @grant            none
// @noframes
// @license          MIT
// ==/UserScript==

(function () {
  'use strict';

  const PAGE_WIN = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  // 评论主接口 / 楼中楼接口 / 动态详情接口
  const COMMENT_API_RE = /\/x\/v2\/reply\/|\/x\/polymer\/web-dynamic\//;
  const locationMap = new Map(); // rpid -> "IP属地：xx"

  // ---------- 从接口数据中提取属地 ----------
  function getLocation(reply) {
    if (!reply || typeof reply !== 'object') return '';
    const rc = reply.reply_control;
    if (typeof rc === 'string') return rc; // 个别接口直接给字符串
    if (rc && typeof rc.location === 'string') return rc.location;
    if (typeof reply.location === 'string') return reply.location; // 兼容兜底
    return '';
  }

  function getLocationByRpid(reply) {
    const location = getLocation(reply);
    if (location) return location;
    // 兜底：用接口里抓到的 rpid -> 属地映射
    if (reply && reply.rpid && locationMap.has(String(reply.rpid))) {
      return locationMap.get(String(reply.rpid));
    }
    return '';
  }

  function collectReply(reply) {
    if (!reply || !reply.rpid) return;
    const location = getLocation(reply);
    if (location) locationMap.set(String(reply.rpid), location);
    if (Array.isArray(reply.replies)) {
      for (const sub of reply.replies) collectReply(sub);
    }
  }

  function collectData(data) {
    if (!data || typeof data !== 'object') return;
    if (Array.isArray(data.replies)) {
      for (const reply of data.replies) collectReply(reply);
    }
    if (Array.isArray(data.root)) {
      for (const reply of data.root) collectReply(reply);
    }
    if (data.reply && typeof data.reply === 'object') collectReply(data.reply);
    if (Array.isArray(data.comments)) {
      for (const reply of data.comments) collectReply(reply);
    }
  }

  // ---------- Hook XMLHttpRequest，抓取评论接口返回 ----------
  try {
    const XHR = PAGE_WIN.XMLHttpRequest;
    if (XHR && XHR.prototype) {
      const originalOpen = XHR.prototype.open;
      const originalSend = XHR.prototype.send;

      XHR.prototype.open = function (method, url) {
        this.__biliCommentUrl = String(url || '');
        return originalOpen.apply(this, arguments);
      };

      XHR.prototype.send = function () {
        this.addEventListener('load', function () {
          try {
            const url = this.__biliCommentUrl || '';
            if (COMMENT_API_RE.test(url) && this.responseText) {
              collectData(JSON.parse(this.responseText).data);
            }
          } catch (_) {
            /* 非评论接口或解析失败，忽略 */
          }
        });
        return originalSend.apply(this, arguments);
      };
    }
  } catch (_) {
    /* 忽略 Hook 失败 */
  }

  // ---------- Hook fetch，抓取评论接口返回 ----------
  try {
    const originalFetch = PAGE_WIN.fetch;
    if (typeof originalFetch === 'function') {
      PAGE_WIN.fetch = function (input, init) {
        const url =
          typeof input === 'string'
            ? input
            : (input && input.url) || '';
        const promise = originalFetch.call(this, input, init);
        if (COMMENT_API_RE.test(url)) {
          promise
            .then((res) => res.clone().json())
            .then((json) => collectData(json && json.data))
            .catch(() => {});
        }
        return promise;
      };
    }
  } catch (_) {
    /* 忽略 Hook 失败 */
  }

  // ---------- 新版 Lit 评论区（视频页等）：patch 自定义组件 ----------
  // 当前 B 站视频页评论使用 Lit Web Components，时间/操作栏在
  // <bili-comment-action-buttons-renderer> 的 shadowRoot 内，普通 DOM 选择器访问不到。
  function updateLitLocation(el) {
    if (!el || !el.shadowRoot) return;
    const location = getLocationByRpid(el.data);
    if (!location) return;

    const pubDateEl = el.shadowRoot.querySelector('#pubdate');
    if (!pubDateEl) return;

    let locEl = el.shadowRoot.querySelector('#bilireveal-location');
    if (!locEl) {
      locEl = document.createElement('span');
      locEl.id = 'bilireveal-location';
      locEl.style.cssText =
        'margin-left:8px;color:#9499a0;font-size:12px;white-space:nowrap;';
      pubDateEl.insertAdjacentElement('afterend', locEl);
    }
    if (locEl.textContent !== location) {
      locEl.textContent = location;
    }
  }

  function hookLit() {
    const registry = PAGE_WIN.customElements;
    if (!registry || typeof registry.define !== 'function') return;

    const originalDefine = registry.define.bind(registry);
    registry.define = function (name, classConstructor, options) {
      if (
        name === 'bili-comment-action-buttons-renderer' &&
        typeof classConstructor === 'function' &&
        classConstructor.prototype &&
        typeof classConstructor.prototype.update === 'function'
      ) {
        if (!classConstructor.prototype.update.__biliIpPatched) {
          const originalUpdate = classConstructor.prototype.update;
          classConstructor.prototype.update = function (...args) {
            const result = originalUpdate.apply(this, args);
            try {
              updateLitLocation(this);
            } catch (_) {
              /* 忽略注入失败 */
            }
            return result;
          };
          classConstructor.prototype.update.__biliIpPatched = true;
        }
      }
      return originalDefine(name, classConstructor, options);
    };
  }

  // ---------- 把属地文本注入评论 DOM ----------
  function inject(node) {
    if (!node || node.nodeType !== 1) return;
    const rpid = node.getAttribute && node.getAttribute('data-rpid');
    if (!rpid) return;
    const location = locationMap.get(rpid);
    if (!location) return;
    if (node.querySelector('.bili-ip-location')) return; // 已注入过

    const info = node.querySelector('.reply-info, .sub-reply-info');
    if (!info) return;

    const span = document.createElement('span');
    span.className = 'bili-ip-location';
    span.textContent = location;
    span.style.cssText =
      'margin-left:8px;color:#9499a0;font-size:12px;white-space:nowrap;';
    info.appendChild(span);
  }

  // 递归遍历普通 DOM + shadow DOM，用于兜底扫描
  function deepWalk(node, visit) {
    if (!node || node.nodeType !== 1) return;
    visit(node);
    if (node.shadowRoot) deepWalk(node.shadowRoot, visit);
    if (node.children) {
      for (const child of node.children) deepWalk(child, visit);
    }
  }

  // 监听动态插入的评论节点（兼容 Vue3 / Lit 新评论区）
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!node || node.nodeType !== 1) continue;
        if (node.getAttribute && node.getAttribute('data-rpid')) inject(node);
        if (node.querySelectorAll) {
          node.querySelectorAll('.reply-item, .sub-reply-item').forEach(inject);
        }
        // 兜底：如果 Lit 组件已经插入但 hook 未生效，直接处理
        deepWalk(node, (el) => {
          if (el.localName === 'bili-comment-action-buttons-renderer') {
            updateLitLocation(el);
          }
        });
      }
    }
  });

  function start() {
    hookLit();
    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
    });
    document.querySelectorAll('.reply-item, .sub-reply-item').forEach(inject);
    deepWalk(document.documentElement || document, (el) => {
      if (el.localName === 'bili-comment-action-buttons-renderer') {
        updateLitLocation(el);
      }
    });

    // 兜底：评论组件重渲染（点赞/展开等）可能移除已注入节点
    setInterval(() => {
      document.querySelectorAll('.reply-item, .sub-reply-item').forEach(inject);
      deepWalk(document.documentElement || document, (el) => {
        if (el.localName === 'bili-comment-action-buttons-renderer') {
          updateLitLocation(el);
        }
      });
    }, 2000);
  }

  if (document.documentElement) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
