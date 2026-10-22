// ==UserScript==
// @name         Bilibili IP Location Reveal
// @namespace    local.bilibili.ip-location
// @version      1.0.0
// @description  在 B 站电脑端页面展示公开数据中已返回的 IP 归属地信息，支持 SPA 路由与异步内容加载。
// @author       local
// @license      MIT
// @icon         https://www.bilibili.com/favicon.ico
// @match        *://*.bilibili.com/*
// @match        *://manga.bilibili.com/*
// @grant        none
// @run-at       document-start
// @connect      api.bilibili.com
// ==/UserScript==

(function () {
  'use strict';

  const W = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

  let ipInjectCount = 0;
  const logger = {
    log(level, ...args) {
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      fn('[BilibiliIPLocation]', ...args);
    },
    debug: (...args) => logger.log('debug', ...args),
    info: (...args) => logger.log('info', ...args),
    warn: (...args) => logger.log('warn', ...args),
    error: (...args) => logger.log('error', ...args),
    incrementIpCount() {
      if (ipInjectCount === 0) logger.info('首次成功解析并插入 IP 属地');
      ipInjectCount++;
    }
  };

  const isElementLoaded = async (selector, root = document) => {
    const getElement = () => (root === document ? document : root).querySelector(selector);
    return new Promise((resolve) => {
      const element = getElement();
      if (element) {
        logger.debug(`[DOM] 元素就绪 (瞬时): ${selector}`);
        return resolve(element);
      }
      logger.debug(`[DOM] 等待元素渲染: ${selector}`);
      const observer = new MutationObserver(() => {
        const element = getElement();
        if (!element) return;
        logger.debug(`[DOM] 元素就绪 (异步): ${selector}`);
        resolve(element);
        observer.disconnect();
      });
      const target = root === document ? (document.documentElement || document) : root;
      observer.observe(target, { childList: true, subtree: true });
    });
  };

  const getLocationString = (replyItem) => {
    const locationString = replyItem?.reply_control?.location;
    if (!locationString) return undefined;
    return String(locationString).trim() || undefined;
  };

  const MissingPlaceholder = 'IP属地：—';

  class Router {
    constructor() { this.routes = []; }
    serve(prefix, action, constraint = {}) {
      if (Array.isArray(prefix)) {
        prefix.forEach((p) => this.routes.push({ prefix: p, action, constraint }));
        return;
      }
      this.routes.push({ prefix, action, constraint });
    }
    match(url) {
      for (const { prefix, action, constraint } of this.routes) {
        if (!url.startsWith(prefix)) continue;
        if (constraint.endsWith && !url.endsWith(constraint.endsWith)) continue;
        logger.info(`[Router] 匹配到路由: ${prefix}`);
        try { action(url); } catch (error) { logger.error('[Router] 路由处理失败:', error); }
        break;
      }
    }
  }

  const fetchArticleViewInfo = async (cv) => {
    try {
      const response = await fetch(`https://api.bilibili.com/x/article/viewinfo?id=${cv}`, { credentials: 'include' });
      const json = await response.json();
      return json?.data;
    } catch (error) {
      logger.error('获取文章 IP 属地失败：', error);
      return undefined;
    }
  };

  const serveNewOpusArticle = async (initialState) => {
    const basic = initialState?.detail?.basic;
    if (!basic?.rid_str || basic.article_type !== 0) return;
    const viewinfo = await fetchArticleViewInfo(basic.rid_str);
    const authorPub = await isElementLoaded('.opus-module-author__pub');
    if (!authorPub) {
      logger.warn('[article] 未找到 .opus-module-author__pub');
      return;
    }
    if (authorPub.querySelector('.opus-module-author__pub__bilireveal')) return;
    if (!viewinfo?.location) {
      logger.warn(`[IP属地解析] 新版专栏 (opus) 未携带 IP 数据 (cv: ${basic.rid_str})`);
      const locationEl = document.createElement('span');
      locationEl.innerHTML = `${MissingPlaceholder} &middot;&nbsp;`;
      locationEl.className = 'opus-module-author__pub__bilireveal';
      locationEl.style.color = '#999';
      authorPub.insertAdjacentElement('afterbegin', locationEl);
      return;
    }
    logger.incrementIpCount();
    const locationEl = document.createElement('span');
    locationEl.innerHTML = `${viewinfo.location} &middot;&nbsp;`;
    locationEl.className = 'opus-module-author__pub__bilireveal';
    authorPub.insertAdjacentElement('afterbegin', locationEl);
  };

  const injectArticleLocation = async (url) => {
    const match = url.match(/\/cv(\d+)/);
    const cv = match ? match[1] : undefined;
    if (!cv) {
      if (W.__INITIAL_STATE__) {
        serveNewOpusArticle(W.__INITIAL_STATE__);
        return;
      }
      let initialState;
      try {
        Object.defineProperty(W, '__INITIAL_STATE__', {
          get: () => initialState,
          set: (value) => {
            initialState = value;
            serveNewOpusArticle(initialState);
          },
          configurable: true
        });
      } catch (error) {
        logger.error('[article] 无法监听 __INITIAL_STATE__:', error);
      }
      return;
    }
    const viewinfo = await fetchArticleViewInfo(cv);
    const articleDetail = await isElementLoaded('.article-detail');
    const publishText = articleDetail?.querySelector('.publish-text');
    if (!publishText) return;
    if (publishText.parentElement?.querySelector('.article-location-bilireveal')) return;
    const locationEl = document.createElement('span');
    if (!viewinfo?.location) {
      logger.warn(`[IP属地解析] 专栏文章 未携带 IP 数据 (cv: ${cv})`);
      locationEl.textContent = `${MissingPlaceholder} · `;
      locationEl.style.color = '#999';
    } else {
      logger.incrementIpCount();
      locationEl.textContent = `${viewinfo.location} · `;
    }
    locationEl.className = 'article-location-bilireveal';
    publishText.insertAdjacentElement('afterend', locationEl);
  };

  let litHooked = false;
  const hookLit = () => {
    if (litHooked) return;
    litHooked = true;
    logger.info('[Strategy] 启用 hookLit (Web Components)');
    try {
      const originalDefine = W.customElements.define.bind(W.customElements);
      const applyHandler = (target, thisArg, args) => {
        const [name, classConstructor, ...rest] = args;
        if (typeof classConstructor !== 'function' || name !== 'bili-comment-action-buttons-renderer') {
          return Reflect.apply(target, thisArg, args);
        }
        const PatchActionButtonsRender = createLitPatch(classConstructor);
        return Reflect.apply(target, thisArg, [name, PatchActionButtonsRender, ...rest]);
      };
      W.customElements.define = new Proxy(originalDefine, { apply: applyHandler });
    } catch (error) {
      logger.error('[Hook异常] hookLit 失败:', error);
    }
  };

  function createLitPatch(ActionButtonsRender) {
    const updateLocationElement = function (thisArg) {
      const shadowRoot = thisArg.shadowRoot;
      if (!shadowRoot) return;
      const pubDateEl = shadowRoot.querySelector('#pubdate');
      if (!pubDateEl) return;
      let locationEl = shadowRoot.querySelector('#location');
      const locationString = getLocationString(thisArg.data);
      if (!locationString) {
        logger.warn('[IP属地解析] lit-component 未携带 IP 数据 (解析为空)');
        if (!locationEl) {
          locationEl = document.createElement('div');
          locationEl.id = 'location';
          locationEl.textContent = MissingPlaceholder;
          locationEl.style.color = '#999';
          pubDateEl.insertAdjacentElement('afterend', locationEl);
        } else {
          locationEl.textContent = MissingPlaceholder;
          locationEl.style.color = '#999';
        }
        return;
      }
      if (locationEl) {
        locationEl.textContent = locationString;
        locationEl.style.color = '';
        return;
      }
      logger.incrementIpCount();
      locationEl = document.createElement('div');
      locationEl.id = 'location';
      locationEl.textContent = locationString;
      pubDateEl.insertAdjacentElement('afterend', locationEl);
    };
    const applyHandler = (target, thisArg, args) => {
      const result = Reflect.apply(target, thisArg, args);
      try { updateLocationElement(thisArg); } catch (error) { logger.error('[Hook异常] lit-component 处理失败:', error); }
      return result;
    };
    const patch = function () {};
    try { Object.setPrototypeOf(patch, ActionButtonsRender); } catch (error) {}
    try {
      ActionButtonsRender.prototype.update = new Proxy(ActionButtonsRender.prototype.update, { apply: applyHandler });
    } catch (error) {
      logger.error('[Hook异常] 无法 patch Lit update:', error);
    }
    return ActionButtonsRender;
  }

  const injectBBComment = (bbComment, options = {}) => {
    const { variation } = options;
    try {
      const { _createListCon: createListCon, _createSubReplyItem: createSubReplyItem } = bbComment.prototype;
      const applyHandler = (target, thisArg, args) => {
        const [item] = args;
        const result = Reflect.apply(target, thisArg, args);
        try {
          const location = getLocationString(item);
          const replyTimeRegex = /<span class="reply-time">(.*?)<\/span>/;
          const variationRegex = /<span class="time">(.*?)<\/span>/;
          if (!location) {
            logger.warn('[IP属地解析] vue-legacy 未携带 IP 数据 (解析为空)');
            if (variation) {
              return result.replace(variationRegex, `<span class="time">$1</span><span class="reply-location" style="color:#999">${MissingPlaceholder}</span>`);
            }
            return result.replace(replyTimeRegex, `<span class="reply-time">$1</span><span class="reply-location" style="color:#999">${MissingPlaceholder}</span>`);
          }
          logger.incrementIpCount();
          if (variation) {
            return result.replace(variationRegex, `<span class="time">$1&nbsp;&nbsp;${location}</span>`);
          }
          return result.replace(replyTimeRegex, `<span class="reply-time">$1</span><span class="reply-location">${location}</span>`);
        } catch (error) {
          logger.error('[Hook异常] vue-legacy 处理失败:', error);
          return result;
        }
      };
      bbComment.prototype._createListCon = new Proxy(createListCon, { apply: applyHandler });
      bbComment.prototype._createSubReplyItem = new Proxy(createSubReplyItem, { apply: applyHandler });
    } catch (error) {
      logger.error('[Hook异常] injectBBComment 失败:', error);
    }
  };

  let bbPropertyInstalled = false;
  const hookBBComment = (options = {}) => {
    logger.info('[Strategy] 启用 hookBBComment', options?.variation ? '(变体)' : '');
    if (W.bbComment) {
      injectBBComment(W.bbComment, options);
      return;
    }
    if (bbPropertyInstalled) return;
    bbPropertyInstalled = true;
    let bbCommentStore;
    try {
      Object.defineProperty(W, 'bbComment', {
        get: () => bbCommentStore,
        set: (value) => {
          bbCommentStore = value;
          injectBBComment(value, options);
        },
        configurable: true
      });
    } catch (error) {
      logger.error('[Hook异常] 无法监听 bbComment:', error);
    }
  };

  let vue3Hooked = false;
  const hookVue3App = () => {
    if (vue3Hooked) return;
    vue3Hooked = true;
    try {
      const realProxy = W.Proxy;
      const proxyInterceptor = new Proxy(realProxy, {
        construct(target, args, newTarget) {
          const app = args?.[0]?._;
          if (app && typeof app.uid === 'number' && app.uid >= 0 && app.vnode) handleVueApp(app);
          return Reflect.construct(target, args, newTarget);
        }
      });
      W.Proxy = proxyInterceptor;
    } catch (error) {
      logger.error('[Hook异常] hookVue3App 失败:', error);
    }
  };

  const vueUnhooked = new WeakSet();
  const vueHooked = new WeakMap();
  const watchedVNodes = new WeakSet();
  const watchedApps = new WeakSet();

  const isVueApp = (value) => !!value && typeof value === 'object' && typeof value.uid === 'number' && value.uid >= 0 && !!value.vnode;

  const handleVueApp = (app) => {
    const el = app.vnode?.el;
    if (el) {
      recordVue(el, app);
      recordDOM(el, app);
      watchIsUnmounted(app);
      return;
    }
    vueUnhooked.add(app);
    watchEl(app.vnode);
  };

  const watchEl = (vnode) => {
    if (!vnode || watchedVNodes.has(vnode)) return;
    watchedVNodes.add(vnode);
    let value = vnode.el;
    let hooked = false;
    try {
      Object.defineProperty(vnode, 'el', {
        configurable: true,
        enumerable: true,
        get() { return value; },
        set(newValue) {
          value = newValue;
          const component = this.component;
          if (!hooked && newValue && component) {
            hooked = true;
            recordVue(newValue, component);
            recordDOM(newValue, component);
            watchIsUnmounted(component);
          }
        }
      });
    } catch (error) {}
  };

  const watchIsUnmounted = (app) => {
    if (!app || watchedApps.has(app)) return;
    watchedApps.add(app);
    let value = app.isUnmounted;
    let unhooked = false;
    try {
      Object.defineProperty(app, 'isUnmounted', {
        configurable: true,
        enumerable: true,
        get() { return value; },
        set(newValue) {
          value = newValue;
          if (!unhooked && this.isUnmounted) {
            unhooked = true;
            cleanupAppReference(this);
          }
        }
      });
    } catch (error) {}
  };

  const cleanupAppReference = (app) => {
    const el = app?.vnode?.el;
    if (!el) return;
    const domValue = el.__vue__;
    const nextDomValue = removeAppFromRecord(domValue, app);
    el.__vue__ = nextDomValue;
    const nextMapValue = removeAppFromRecord(vueHooked.get(el), app);
    if (nextMapValue === undefined) vueHooked.delete(el); else vueHooked.set(el, nextMapValue);
  };

  const removeAppFromRecord = (record, app) => {
    if (!record) return undefined;
    if (!Array.isArray(record)) return record === app ? undefined : record;
    const next = record.filter((item) => item !== app);
    if (next.length === 0) return undefined;
    return next.length === 1 ? next[0] : next;
  };

  const appendAppToRecord = (record, app) => {
    if (!record) return app;
    if (!Array.isArray(record)) return record === app ? record : [record, app];
    return record.includes(app) ? record : [...record, app];
  };

  const recordVue = (el, app) => {
    vueUnhooked.delete(app);
    vueHooked.set(el, appendAppToRecord(vueHooked.get(el), app));
  };

  const recordDOM = (el, app) => {
    el.__vue__ = appendAppToRecord(el.__vue__, app);
  };

  const extractLocationFromReplyElement = (replyItemEl) => {
    let locationString;
    if (replyItemEl?.className?.startsWith('sub')) {
      locationString = getLocationString(replyItemEl?.__vue__?.vnode?.props?.subReply);
    } else {
      locationString = getLocationString(replyItemEl?.__vue__?.vnode?.props?.reply);
    }
    return locationString;
  };

  const hasLocationInjected = (replyInfo) => replyInfo?.children?.length && replyInfo.children[0].innerHTML.includes('IP属地');

  const isReplyItem = (el) => el instanceof HTMLDivElement && ['reply-item', 'sub-reply-item'].includes(el.className);

  const insertVue3Location = (replyItemEl) => {
    const replyInfo = replyItemEl.className.startsWith('sub')
      ? replyItemEl.querySelector('.sub-reply-info')
      : replyItemEl.querySelector('.reply-info');
    if (!replyInfo) throw new Error('Can not detect reply info');
    const locationString = extractLocationFromReplyElement(replyItemEl);
    if (!locationString) {
      logger.warn('[IP属地解析] vue3 未携带 IP 数据 (解析为空)');
      if (!hasLocationInjected(replyInfo)) {
        replyInfo.children[0].innerHTML += `&nbsp;&nbsp;<span class="reply-location" style="color:#999">${MissingPlaceholder}</span>`;
      }
      return;
    }
    if (hasLocationInjected(replyInfo)) return;
    logger.incrementIpCount();
    replyInfo.children[0].innerHTML += `&nbsp;&nbsp;${locationString}`;
  };

  const observedReplyLists = new WeakSet();
  const observeAndInjectComments = async (root) => {
    logger.info('[Strategy] 启用 observeAndInjectComments (Vue3)');
    hookVue3App();
    const attach = async () => {
      try {
        const targetNode = await isElementLoaded('.reply-list', root);
        if (observedReplyLists.has(targetNode)) return;
        observedReplyLists.add(targetNode);
        Array.from(targetNode.querySelectorAll('.reply-item, .sub-reply-item')).forEach((node) => {
          try { insertVue3Location(node); } catch (error) { logger.error('[Hook异常] vue3 初始评论处理失败:', error); }
        });
        const observer = new MutationObserver((mutationsList) => {
          for (const mutation of mutationsList) {
            if (mutation.type !== 'childList') continue;
            mutation.addedNodes.forEach((node) => {
              if (!isReplyItem(node)) return;
              try {
                insertVue3Location(node);
                if (node.className.startsWith('sub')) return;
                const subReplyListEl = node.querySelector('.sub-reply-list');
                if (!subReplyListEl) return;
                const subReplyList = Array.from(subReplyListEl.children);
                subReplyList.pop();
                subReplyList.forEach((child) => {
                  try { insertVue3Location(child); } catch (error) { logger.error('[Hook异常] vue3 子评论处理失败:', error); }
                });
              } catch (error) {
                logger.error('[Hook异常] observeAndInjectComments (Vue3) 处理失败:', error);
              }
            });
          }
        });
        observer.observe(targetNode, { childList: true, subtree: true });
      } catch (error) {
        logger.error('[Hook异常] 无法等待 .reply-list:', error);
      }
    };
    attach();
  };

  const handleOpusRoute = async (url) => {
    logger.info('[handleOpusRoute] 处理新版专栏:', url);
    hookLit();
    injectArticleLocation(url);
  };

  const handleSpaceHomeRoute = async () => {
    try {
      const biliMainHeader = await isElementLoaded('#biliMainHeader');
      const isFreshSpace = biliMainHeader?.tagName === 'HEADER';
      logger.info('[handleSpaceHomeRoute] 是否新版空间:', isFreshSpace);
      const dynamicTabSelector = isFreshSpace ? '.nav-tab__item:nth-child(2)' : '.n-dynamic';
      const dynamicTab = await isElementLoaded(dynamicTabSelector);
      dynamicTab.addEventListener('click', () => hookLit(), { once: true });
    } catch (error) {
      logger.error('[handleSpaceHomeRoute] 失败:', error);
    }
  };

  const handleDynamicHomeRoute = async () => {
    try {
      const dynHome = await isElementLoaded('.bili-dyn-home--member');
      const dynBtnText = dynHome.querySelector('.bili-dyn-sidebar__btn')?.textContent;
      const isNewDyn = dynBtnText ? !dynBtnText.includes('体验新版') : false;
      logger.info('[handleDynamicHomeRoute] 动态主页是否新版:', isNewDyn, '按钮文字:', dynBtnText);
      if (isNewDyn) hookLit(); else hookBBComment();
    } catch (error) {
      logger.error('[handleDynamicHomeRoute] 失败:', error);
    }
  };

  const handleDynamicItemRoute = async () => {
    try {
      const dynItem = await isElementLoaded('.bili-dyn-item');
      const isNewDyn = !dynItem.querySelector('.bili-dyn-item__footer');
      logger.info('[handleDynamicItemRoute] 动态详情页是否新版:', isNewDyn);
      if (isNewDyn) hookLit(); else hookBBComment();
    } catch (error) {
      logger.error('[handleDynamicItemRoute] 失败:', error);
    }
  };

  const registerRoutes = (router) => {
    router.serve([
      'https://www.bilibili.com/video/',
      'https://www.bilibili.com/list/',
      'https://www.bilibili.com/bangumi/play/',
      'https://www.bilibili.com/cheese/play/',
      'https://www.bilibili.com/v/topic/detail',
      'https://manga.bilibili.com/detail/',
      'https://www.bilibili.com/festival/',
      'https://live.bilibili.com/'
    ], hookLit);

    router.serve('https://www.bilibili.com/blackboard/feed-topic.html', () => hookBBComment());

    router.serve('https://www.bilibili.com/blackboard/', () => {
      hookBBComment({ variation: true });
      observeAndInjectComments();
    });

    router.serve(['https://www.bilibili.com/read/', 'https://www.bilibili.com/opus/'], handleOpusRoute);

    router.serve('https://space.bilibili.com/', hookLit, { endsWith: 'dynamic' });
    router.serve('https://space.bilibili.com/', handleSpaceHomeRoute);

    router.serve('https://t.bilibili.com/', handleDynamicHomeRoute, { endsWith: '/' });
    router.serve('https://t.bilibili.com/', handleDynamicItemRoute);

    router.serve('https://www.bilibili.com/blackroom/ban/', () => hookBBComment({ variation: true }));
  };

  const router = new Router();
  registerRoutes(router);

  const matchCurrent = () => {
    try {
      const { origin, pathname } = new URL(location.href);
      router.match(`${origin}${pathname}`);
    } catch (error) {
      logger.error('[SPA] 路由匹配失败:', error);
    }
  };

  // Initial route.
  matchCurrent();

  // SPA navigation handling.
  let lastHref = location.href;
  const scheduleRoute = () => {
    setTimeout(matchCurrent, 120);
    setTimeout(matchCurrent, 800);
  };

  try {
    const wrapHistory = (method) => {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        try { window.dispatchEvent(new Event('bilireveal:navigate')); } catch (e) {}
        return result;
      };
    };
    wrapHistory('pushState');
    wrapHistory('replaceState');
  } catch (error) {
    logger.error('[SPA] 无法劫持 History API:', error);
  }

  window.addEventListener('popstate', scheduleRoute);
  window.addEventListener('hashchange', scheduleRoute);
  window.addEventListener('bilireveal:navigate', scheduleRoute);

  const observer = new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      scheduleRoute();
    }
  });
  const observeRoot = document.documentElement || document;
  if (observeRoot) observer.observe(observeRoot, { childList: true, subtree: true });

})();
