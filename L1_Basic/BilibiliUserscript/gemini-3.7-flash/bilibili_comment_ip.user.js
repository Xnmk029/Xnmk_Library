// ==UserScript==
// @name         Bilibili Comment IP Location Displayer (Gemini 3.7 Flash)
// @namespace    https://github.com/bilibili-userscript-benchmark
// @version      1.0.0
// @description  Display public IP location info on Bilibili video/dynamic comment sections seamlessly with SPA dynamic routing support.
// @author       Gemini 3.7 Flash
// @match        *://*.bilibili.com/video/*
// @match        *://*.bilibili.com/list/*
// @match        *://*.bilibili.com/opus/*
// @match        *://*.bilibili.com/read/*
// @match        *://t.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const INJECTED_FLAG = 'data-bili-ip-injected';
  const IP_BADGE_CLASS = 'bili-comment-ip-badge';

  // Inject minimalist CSS for the IP location badge (matching Bilibili dark/light native theme)
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .${IP_BADGE_CLASS} {
      display: inline-flex;
      align-items: center;
      font-size: 12px;
      color: #9499a0;
      margin-left: 8px;
      padding: 1px 6px;
      background: rgba(148, 153, 160, 0.12);
      border-radius: 4px;
      line-height: 1.4;
      user-select: none;
      vertical-align: middle;
      font-family: inherit;
    }
    .${IP_BADGE_CLASS}.fallback {
      color: #71767d;
      opacity: 0.65;
    }
    /* Dark mode styling support */
    @media (prefers-color-scheme: dark) {
      .${IP_BADGE_CLASS} {
        background: rgba(255, 255, 255, 0.08);
        color: #858992;
      }
    }
  `;
  document.head.appendChild(styleEl);

  /**
   * Parse IP Location from public reply item element or its React/Vue internal instance
   */
  function extractIpLocation(commentNode) {
    // 1. Try public DOM attribute or dataset
    if (commentNode.dataset && commentNode.dataset.location) {
      return commentNode.dataset.location;
    }

    // 2. Check Vue / React internal component state
    const fiberKey = Object.keys(commentNode).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$') || k.startsWith('__vue_app__') || k.startsWith('__vue__'));
    if (fiberKey && commentNode[fiberKey]) {
      let fiber = commentNode[fiberKey];
      let depth = 0;
      while (fiber && depth < 8) {
        if (fiber.memoizedProps && fiber.memoizedProps.reply) {
          const loc = fiber.memoizedProps.reply.reply_control?.location || fiber.memoizedProps.reply.location;
          if (loc) return loc.replace(/^IP属地[:：]\s*/, '');
        }
        if (fiber.props && fiber.props.reply) {
          const loc = fiber.props.reply.reply_control?.location || fiber.props.reply.location;
          if (loc) return loc.replace(/^IP属地[:：]\s*/, '');
        }
        fiber = fiber.return || fiber.parent;
        depth++;
      }
    }

    // 3. Check existing sub-text / info bar
    const infoBar = commentNode.querySelector('.reply-info, .info, .sub-reply-info, .bili-comment-info');
    if (infoBar) {
      const match = infoBar.textContent.match(/IP属地[:：]\s*([^\s·\n]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Process and inject IP location badges
   */
  function processComments() {
    // Target both standard video replies, sub-replies, and new Vue/WebComponent comment items
    const commentNodes = document.querySelectorAll(
      '.reply-item:not([' + INJECTED_FLAG + ']), ' +
      '.sub-reply-item:not([' + INJECTED_FLAG + ']), ' +
      '.bili-comment-item:not([' + INJECTED_FLAG + ']), ' +
      'bili-comment-reply-renderer:not([' + INJECTED_FLAG + '])'
    );

    commentNodes.forEach(node => {
      node.setAttribute(INJECTED_FLAG, 'true');

      // Find the target anchor (usually next to timestamp or user name)
      const targetAnchor = node.querySelector('.reply-time, .time, .pubdate, .reply-info .reply-time');
      if (!targetAnchor) return;

      // Prevent duplicate badges
      if (targetAnchor.parentElement.querySelector(`.${IP_BADGE_CLASS}`)) return;

      const ipText = extractIpLocation(node);
      const badge = document.createElement('span');
      badge.className = IP_BADGE_CLASS;

      if (ipText) {
        badge.textContent = `IP: ${ipText}`;
      } else {
        badge.textContent = 'IP: 未知';
        badge.classList.add('fallback');
      }

      targetAnchor.insertAdjacentElement('afterend', badge);
    });
  }

  // Use MutationObserver for seamless SPA reactivity & infinite scroll
  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processComments, 150);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Handle SPA History state transitions (popstate & pushState interception)
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    const res = originalPushState.apply(this, args);
    setTimeout(processComments, 400);
    return res;
  };

  window.addEventListener('popstate', () => {
    setTimeout(processComments, 400);
  });

  // Initial execution
  processComments();
})();
