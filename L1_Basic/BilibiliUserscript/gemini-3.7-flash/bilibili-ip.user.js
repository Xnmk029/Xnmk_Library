// ==UserScript==
// @name         Bilibili 评论区 IP 归属地显示
// @name:en      Bilibili Comment IP Location Displayer
// @namespace    https://github.com/bilibili-userscript/bilibili-ip
// @version      1.1.0
// @description  在哔哩哔哩（Bilibili）电脑端评论区（视频、动态、专栏、剧集等）优雅展示公开数据中的 IP 归属地信息。支持 SPA 动态路由切换与异步加载，纯原生 JS 实现，零隐私收集。
// @description:en Seamlessly display public IP location info on Bilibili comments (videos, dynamics, articles, opus) with full SPA routing & async loading support.
// @author       gemini-3.7-flash
// @match        *://*.bilibili.com/*
// @match        *://t.bilibili.com/*
// @match        *://space.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // 运行上下文（@grant none 环境下适配主页面 window）
  const WIN = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  // 常量标识配置
  const BADGE_CLASS = 'bili-comment-ip-badge';
  const PROCESSED_ATTR = 'data-bili-ip-processed';
  const STYLE_ID = 'bili-comment-ip-style';
  const IP_PREFIX = 'IP属地：';
  const IP_UNKNOWN = 'IP属地：未知';

  // 全局响应缓存：rpid (string) -> location (string)
  const rpidLocationMap = new Map();

  // 评论容器与项目选择器列表（覆盖新旧版评论区、动态、专栏、Web Components 等）
  const COMMENT_SELECTORS = [
    '.reply-item',
    '.sub-reply-item',
    '.bili-comment-item',
    '.reply-wrap',
    '.list-item.reply-wrap',
    'bili-comment-reply-renderer',
    'bili-comment-thread-renderer',
    '.bili-dyn-item',
    '.comment-item'
  ].join(', ');

  /**
   * 1. 注入自适应 CSS 样式（贴合 B 站官方深浅色视觉规范）
   */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${BADGE_CLASS} {
        display: inline-flex;
        align-items: center;
        font-size: 12px;
        line-height: 16px;
        color: #9499a0;
        margin-left: 8px;
        padding: 0 4px;
        background: rgba(148, 153, 160, 0.08);
        border-radius: 4px;
        font-weight: normal;
        user-select: none;
        vertical-align: middle;
        white-space: nowrap;
        font-family: inherit;
        transition: opacity 0.2s ease, color 0.2s ease, background-color 0.2s ease;
      }
      .${BADGE_CLASS}.fallback {
        color: #c9ccd0;
        background: rgba(148, 153, 160, 0.04);
        opacity: 0.85;
      }
      .${BADGE_CLASS}:hover {
        opacity: 1;
      }
      /* 暗色模式适配 */
      @media (prefers-color-scheme: dark) {
        .${BADGE_CLASS} {
          color: #757a82;
          background: rgba(255, 255, 255, 0.06);
        }
        .${BADGE_CLASS}.fallback {
          color: #5b6068;
          background: rgba(255, 255, 255, 0.03);
        }
      }
      html.dark .${BADGE_CLASS},
      body.dark .${BADGE_CLASS},
      html[data-darkreader-scheme="dark"] .${BADGE_CLASS} {
        color: #757a82;
        background: rgba(255, 255, 255, 0.06);
      }
      html.dark .${BADGE_CLASS}.fallback,
      body.dark .${BADGE_CLASS}.fallback,
      html[data-darkreader-scheme="dark"] .${BADGE_CLASS}.fallback {
        color: #5b6068;
        background: rgba(255, 255, 255, 0.03);
      }
    `;
    const target = document.head || document.documentElement;
    if (target) {
      target.appendChild(style);
    }
  }

  /**
   * 2. 纯文本归一化与清洗（不推断、不猜测精确位置）
   */
  function cleanLocationText(text) {
    if (!text || typeof text !== 'string') return '';
    let cleaned = text.trim();
    if (!cleaned) return '';

    // 过滤已知未知关键词
    if (/^(未知|未知IP|未知归属地|未知地点|无)$/i.test(cleaned)) {
      return '';
    }

    // 匹配 "IP属地：北京" 或 "IP属地: 广东"
    const matchIp = cleaned.match(/IP\s*属地\s*[:：]?\s*([^\s·\n\r]+)/i);
    if (matchIp && matchIp[1]) {
      const val = matchIp[1].trim();
      return /^(未知|未知IP|未知归属地|无)$/i.test(val) ? '' : val;
    }

    // 匹配 "属地：上海"
    const matchLoc = cleaned.match(/属地\s*[:：]?\s*([^\s·\n\r]+)/i);
    if (matchLoc && matchLoc[1]) {
      const val = matchLoc[1].trim();
      return /^(未知|未知IP|未知归属地|无)$/i.test(val) ? '' : val;
    }

    // 裸省份/地区文本（如 "广东"、"中国香港"、"海外"）
    cleaned = cleaned.replace(/^IP\s*属地\s*[:：]?\s*/i, '').trim();
    if (cleaned && !/^(未知|未知IP|未知归属地|无)$/i.test(cleaned)) {
      return cleaned;
    }

    return '';
  }

  /**
   * 3. 递归解析并收集 API 响应中的 rpid -> location 映射
   */
  function harvestReplyData(data) {
    if (!data || typeof data !== 'object') return;

    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        harvestReplyData(data[i]);
      }
      return;
    }

    // 处理当前对象是否包含 rpid 及 location
    const rpid = data.rpid != null ? String(data.rpid) : (data.rpid_str ? String(data.rpid_str) : null);
    if (rpid) {
      let loc = null;
      if (data.reply_control && typeof data.reply_control === 'object') {
        loc = data.reply_control.location;
      }
      if (!loc && data.location) {
        loc = data.location;
      }
      if (loc) {
        const cleaned = cleanLocationText(loc);
        if (cleaned) {
          rpidLocationMap.set(rpid, cleaned);
        }
      }
    }

    // 递归遍历子属性（涵盖 replies, top_replies, upper, root 等）
    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
      const val = data[keys[i]];
      if (val && typeof val === 'object') {
        harvestReplyData(val);
      }
    }
  }

  /**
   * 4. 监听网络请求（Fetch & XHR 拦截钩子，纯只读透传，不发起新请求）
   */
  function hookNetworkRequests() {
    // A. 拦截 window.fetch
    const originalFetch = WIN.fetch;
    if (typeof originalFetch === 'function') {
      WIN.fetch = function (input, init) {
        const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        const promise = originalFetch.apply(this, arguments);

        if (url && (url.includes('/x/v2/reply') || url.includes('/reply/'))) {
          promise.then(response => {
            if (response && typeof response.clone === 'function') {
              try {
                response.clone().json().then(json => {
                  if (json && json.data) {
                    harvestReplyData(json.data);
                    scheduleDomProcess();
                  }
                }).catch(() => { /* 静默降级 */ });
              } catch (e) { /* 静默降级 */ }
            }
          }).catch(() => { /* 静默降级 */ });
        }

        return promise;
      };
    }

    // B. 拦截 XMLHttpRequest
    const XHR = WIN.XMLHttpRequest;
    if (XHR && XHR.prototype) {
      const origOpen = XHR.prototype.open;
      const origSend = XHR.prototype.send;

      XHR.prototype.open = function (method, url) {
        try {
          this.__biliReqUrl = String(url || '');
        } catch (e) { /* 忽略 */ }
        return origOpen.apply(this, arguments);
      };

      XHR.prototype.send = function () {
        try {
          if (this.__biliReqUrl && (this.__biliReqUrl.includes('/x/v2/reply') || this.__biliReqUrl.includes('/reply/'))) {
            this.addEventListener('load', () => {
              try {
                let resData = null;
                if (this.responseType === '' || this.responseType === 'text') {
                  resData = JSON.parse(this.responseText);
                } else if (this.responseType === 'json') {
                  resData = this.response;
                }
                if (resData && resData.data) {
                  harvestReplyData(resData.data);
                  scheduleDomProcess();
                }
              } catch (e) { /* 静默降级 */ }
            });
          }
        } catch (e) { /* 忽略 */ }
        return origSend.apply(this, arguments);
      };
    }
  }

  /**
   * 5. 从 DOM 元素多层级提取 rpid
   */
  function extractRpid(el) {
    if (!el || el.nodeType !== 1) return null;

    // 属性提取
    const candidateAttrs = ['data-rpid', 'data-id', 'data-reply-id', 'data-rid', 'rpid', 'id'];
    for (const attr of candidateAttrs) {
      const val = el.getAttribute(attr);
      if (val) {
        const numMatch = val.match(/\d{6,}/);
        if (numMatch) return numMatch[0];
      }
    }

    // 子链接提取
    const link = el.querySelector('a[href*="/reply/"], a[data-rpid], [data-rpid]');
    if (link) {
      const linkRpid = link.getAttribute('data-rpid');
      if (linkRpid) return linkRpid;
      const m = link.href ? link.href.match(/reply\/(\d+)/) : null;
      if (m) return m[1];
    }

    return null;
  }

  /**
   * 6. 从 React Fiber / Vue / WebComponent 实例中深层检索 location
   */
  function extractLocationFromInstance(el) {
    if (!el) return null;

    // 检查 Web Component 直接暴露的 property
    if (el.data && typeof el.data === 'object') {
      const loc = el.data.reply_control?.location || el.data.location;
      if (loc) return cleanLocationText(loc);
    }
    if (el.replyData && typeof el.replyData === 'object') {
      const loc = el.replyData.reply_control?.location || el.replyData.location;
      if (loc) return cleanLocationText(loc);
    }

    // 检查 React Fiber
    const reactKey = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    if (reactKey && el[reactKey]) {
      let fiber = el[reactKey];
      let depth = 0;
      while (fiber && depth < 10) {
        const reply = fiber.memoizedProps?.reply || fiber.memoizedProps?.data || fiber.props?.reply || fiber.props?.data;
        if (reply && typeof reply === 'object') {
          const loc = reply.reply_control?.location || reply.location;
          if (loc) return cleanLocationText(loc);
          if (reply.rpid) {
            const cached = rpidLocationMap.get(String(reply.rpid));
            if (cached) return cached;
          }
        }
        fiber = fiber.return;
        depth++;
      }
    }

    // 检查 Vue 实例
    const vueKey = Object.keys(el).find(k => k.startsWith('__vue__') || k.startsWith('__vue_app__'));
    if (vueKey && el[vueKey]) {
      const vue = el[vueKey];
      const reply = vue.reply || vue.data || vue.item;
      if (reply && typeof reply === 'object') {
        const loc = reply.reply_control?.location || reply.location;
        if (loc) return cleanLocationText(loc);
      }
    }

    return null;
  }

  /**
   * 7. 从 DOM 文本或子节点中提取已渲染的属地文本
   */
  function extractLocationFromDom(el) {
    if (!el || el.nodeType !== 1) return null;

    // 检查是否有直接包含 "IP属地" 的元素
    const candidateNodes = el.querySelectorAll('.reply-ip, [class*="ip-location"], .location, .reply-info span, .sub-reply-info span');
    for (const node of candidateNodes) {
      if (node.classList.contains(BADGE_CLASS)) continue;
      const text = node.textContent;
      if (text && text.includes('IP') && text.includes('属地')) {
        const loc = cleanLocationText(text);
        if (loc) return loc;
      }
    }

    // 兜底正则扫描
    const infoBar = el.querySelector('.reply-info, .info, .sub-reply-info, .bili-comment-info, .user-info');
    if (infoBar) {
      const match = infoBar.textContent.match(/IP\s*属地\s*[:：]?\s*([^\s·\n\r]+)/);
      if (match && match[1]) {
        const loc = cleanLocationText(match[1]);
        if (loc) return loc;
      }
    }

    return null;
  }

  /**
   * 8. 寻找最佳插入锚点（优先放在发布时间旁，次选用户名旁，避免遮挡控件与弹层）
   */
  function findInsertionAnchor(commentEl) {
    // 优先：发布时间节点后
    const timeSelectors = [
      '.reply-time',
      '.time',
      '.pubdate',
      '.pubdate-text',
      '.sub-reply-time',
      '#published-time-text',
      '.reply-info .reply-time',
      '.sub-reply-info .time'
    ];
    for (const sel of timeSelectors) {
      const anchor = commentEl.querySelector(sel);
      if (anchor && anchor.parentNode) {
        return { parent: anchor.parentNode, nextSibling: anchor.nextSibling };
      }
    }

    // 备选：操作栏或信息区
    const infoSelectors = [
      '.reply-info',
      '.sub-reply-info',
      '.user-info',
      '.bili-comment-info',
      'bili-comment-action-buttons-renderer'
    ];
    for (const sel of infoSelectors) {
      const info = commentEl.querySelector(sel);
      if (info) {
        return { parent: info, nextSibling: null };
      }
    }

    // 备选：用户名后
    const nameSelectors = ['.user-name', '.name', '.sub-user-name', '#user-name'];
    for (const sel of nameSelectors) {
      const name = commentEl.querySelector(sel);
      if (name && name.parentNode) {
        return { parent: name.parentNode, nextSibling: name.nextSibling };
      }
    }

    return null;
  }

  /**
   * 9. 创建或更新 IP 徽章节点
   */
  function createOrUpdateBadge(commentEl, locationText) {
    let badge = commentEl.querySelector(`.${BADGE_CLASS}`);

    if (!badge) {
      const anchor = findInsertionAnchor(commentEl);
      if (!anchor) return;

      badge = document.createElement('span');
      badge.className = BADGE_CLASS;
      badge.setAttribute('aria-label', 'IP 属地');

      if (anchor.nextSibling) {
        anchor.parent.insertBefore(badge, anchor.nextSibling);
      } else {
        anchor.parent.appendChild(badge);
      }
    }

    if (locationText) {
      badge.textContent = `${IP_PREFIX}${locationText}`;
      badge.title = `IP 归属地：${locationText}（公开数据）`;
      badge.classList.remove('fallback');
    } else {
      badge.textContent = IP_UNKNOWN;
      badge.title = 'IP 归属地：未知';
      badge.classList.add('fallback');
    }
  }

  /**
   * 10. 处理单个评论节点
   */
  function processCommentElement(el) {
    if (!el || el.nodeType !== 1) return;

    // 1. 尝试从网络缓存中按 rpid 获取
    const rpid = extractRpid(el);
    let location = null;
    if (rpid && rpidLocationMap.has(rpid)) {
      location = rpidLocationMap.get(rpid);
    }

    // 2. 尝试从 Fiber/Vue 组件实例中获取
    if (!location) {
      location = extractLocationFromInstance(el);
    }

    // 3. 尝试从 DOM 属性或文本中提取
    if (!location) {
      location = extractLocationFromDom(el);
    }

    // 标记已处理并更新/渲染徽章
    el.setAttribute(PROCESSED_ATTR, 'true');
    createOrUpdateBadge(el, location);
  }

  /**
   * 11. 批量处理所有评论节点（节流防抖处理）
   */
  function processAllComments() {
    injectStyles();

    const commentElements = document.querySelectorAll(COMMENT_SELECTORS);
    for (let i = 0; i < commentElements.length; i++) {
      processCommentElement(commentElements[i]);
    }
  }

  let scheduleTimer = null;
  function scheduleDomProcess() {
    if (scheduleTimer) return;
    scheduleTimer = setTimeout(() => {
      scheduleTimer = null;
      if (typeof WIN.requestAnimationFrame === 'function') {
        WIN.requestAnimationFrame(processAllComments);
      } else {
        processAllComments();
      }
    }, 60);
  }

  /**
   * 12. DOM MutationObserver 监听动态插入（支持无限滚动与异步加载）
   */
  function initMutationObserver() {
    const observer = new MutationObserver(mutations => {
      let shouldProcess = false;
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.addedNodes && m.addedNodes.length > 0) {
          for (let j = 0; j < m.addedNodes.length; j++) {
            const node = m.addedNodes[j];
            if (node.nodeType === 1) {
              shouldProcess = true;
              break;
            }
          }
        }
        if (shouldProcess) break;
      }
      if (shouldProcess) {
        scheduleDomProcess();
      }
    });

    const targetNode = document.documentElement || document.body || document;
    observer.observe(targetNode, {
      childList: true,
      subtree: true
    });
  }

  /**
   * 13. SPA 路由切换监听（支持 pushState, replaceState, popstate, hashchange）
   */
  function initSpaRouteListener() {
    const wrapHistoryMethod = function (type) {
      const orig = WIN.history[type];
      if (typeof orig !== 'function') return;
      WIN.history[type] = function () {
        const result = orig.apply(this, arguments);
        scheduleDomProcess();
        setTimeout(scheduleDomProcess, 300);
        setTimeout(scheduleDomProcess, 800);
        return result;
      };
    };

    wrapHistoryMethod('pushState');
    wrapHistoryMethod('replaceState');

    WIN.addEventListener('popstate', () => {
      scheduleDomProcess();
      setTimeout(scheduleDomProcess, 300);
    });

    WIN.addEventListener('hashchange', () => {
      scheduleDomProcess();
    });
  }

  /**
   * 14. 脚本主入口初始化
   */
  function bootstrap() {
    injectStyles();
    hookNetworkRequests();
    initSpaRouteListener();
    initMutationObserver();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        scheduleDomProcess();
      }, { once: true });
    } else {
      scheduleDomProcess();
    }

    // 页面完全加载后的延时补扫
    setTimeout(scheduleDomProcess, 1000);
    setTimeout(scheduleDomProcess, 2500);
  }

  bootstrap();
})();
