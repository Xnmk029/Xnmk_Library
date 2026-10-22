// ==UserScript==
// @name         BiliReveal - 哔哩哔哩网页版显示 IP 属地 (Lite)
// @namespace    http://zhangmaimai.com
// @version      2.3.0
// @author       MaxChang3
// @description  我不喜欢 IP 属地，但是你手机都显示了，为什么电脑不显示呢？在哔哩哔哩网页版大部分场景中显示 IP 属地。
// @license      MIT
// @icon         https://www.bilibili.com/favicon.ico
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/list/*
// @match        https://www.bilibili.com/bangumi/play/*
// @match        https://t.bilibili.com/*
// @match        https://www.bilibili.com/opus/*
// @match        https://space.bilibili.com/*
// @match        https://www.bilibili.com/v/topic/detail/*
// @match        https://www.bilibili.com/cheese/play/*
// @match        https://www.bilibili.com/festival/*
// @match        https://www.bilibili.com/blackboard/*
// @match        https://www.bilibili.com/blackroom/ban/*
// @match        https://www.bilibili.com/read/*
// @match        https://manga.bilibili.com/detail/*
// @match        https://www.bilibili.com/v/topic/detail*
// @match        https://live.bilibili.com/*
// @inject-into  page
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';
	var _unsafeWindow = (() => typeof unsafeWindow != "undefined" ? unsafeWindow : void 0)();
	var isElementLoaded = async (selector, root = document) => {
		const getElement = () => root.querySelector(selector);
		return new Promise((resolve) => {
			const element = getElement();
			if (element) return resolve(element);
			const observer = new MutationObserver((_) => {
				const element = getElement();
				if (!element) return;
				resolve(element);
				observer.disconnect();
			});
			const target = root === document ? root.documentElement ?? root : root;
			observer.observe(target, {
				childList: true,
				subtree: true
			});
		});
	};
	var getLocationString = (replyItem) => {
		return replyItem?.reply_control?.location;
	};
	var Router = class {
		routes = [];
		serve(prefix, action, constrait = {}) {
			if (Array.isArray(prefix)) {
				prefix.forEach((p) => {
					this.routes.push({
						prefix: p,
						action,
						constrait
					});
				});
				return;
			}
			this.routes.push({
				prefix,
				action,
				constrait
			});
		}
		match(url) {
			for (const { prefix, action, constrait } of this.routes) {
				if (!url.startsWith(prefix)) continue;
				if (constrait.endsWith && !url.endsWith(constrait.endsWith)) continue;
				action(url);
				break;
			}
		}
	};
	var fetchArticleViewInfo = async (cv) => {
		try {
			const { data } = await (await fetch(`https://api.bilibili.com/x/article/viewinfo?id=${cv}`, { credentials: "include" })).json();
			return data;
		} catch (error) {
			return;
		}
	};
	var serveNewOpusArticle = async (initialState) => {
		const basic = initialState?.detail?.basic;
		if (!basic?.rid_str || basic.article_type !== 0) return;
		const viewinfo = await fetchArticleViewInfo(basic.rid_str);
		if (!viewinfo?.location) return;
		const authorPub = await isElementLoaded(".opus-module-author__pub");
		if (!authorPub) return;
		if (authorPub.querySelector(".opus-module-author__pub__bilireveal")) return;
		const locationEl = document.createElement("span");
		locationEl.innerHTML = `${viewinfo.location} &middot;&nbsp;`;
		locationEl.className = "opus-module-author__pub__bilireveal";
		authorPub.insertAdjacentElement("afterbegin", locationEl);
	};
	var injectArticleLocation = async (url) => {
		const match = url.match(/\/cv(\d+)/);
		const cv = match ? match[1] : void 0;
		if (!cv) {
			if (_unsafeWindow.__INITIAL_STATE__) {
				serveNewOpusArticle(_unsafeWindow.__INITIAL_STATE__);
				return;
			}
			let initialState;
			Object.defineProperty(_unsafeWindow, "__INITIAL_STATE__", {
				get: () => initialState,
				set: (value) => {
					initialState = value;
					serveNewOpusArticle(initialState);
				},
				configurable: true
			});
			return;
		}
		const viewinfo = await fetchArticleViewInfo(cv);
		if (!viewinfo?.location) return;
		const publishText = (await isElementLoaded(".article-detail"))?.querySelector(".publish-text");
		if (!publishText) return;
		if (publishText.parentElement?.querySelector(".article-location-bilireveal")) return;
		const locationEl = document.createElement("span");
		locationEl.textContent = `${viewinfo.location} · `;
		locationEl.className = "article-location-bilireveal";
		publishText.insertAdjacentElement("afterend", locationEl);
	};
	var updateLocationElement = (thisArg) => {
		const pubDateEl = thisArg.shadowRoot.querySelector("#pubdate");
		if (!pubDateEl) return;
		let locationEl = thisArg.shadowRoot.querySelector("#location");
		const locationString = getLocationString(thisArg.data);
		if (!locationString) {
			if (locationEl) locationEl.remove();
			return;
		}
		if (locationEl) {
			locationEl.textContent = locationString;
			return;
		}
		locationEl = document.createElement("div");
		locationEl.id = "location";
		locationEl.textContent = locationString;
		pubDateEl.insertAdjacentElement("afterend", locationEl);
	};
	var createPatch = (ActionButtonsRender) => {
		const applyHandler = (target, thisArg, args) => {
			const result = Reflect.apply(target, thisArg, args);
			try {
				updateLocationElement(thisArg);
			} catch (error) {}
			return result;
		};
		ActionButtonsRender.prototype.update = new Proxy(ActionButtonsRender.prototype.update, { apply: applyHandler });
		return ActionButtonsRender;
	};
	var hookLit = () => {
		const { define: originalDefine } = _unsafeWindow.customElements;
		const applyHandler = (target, thisArg, args) => {
			const [name, classConstructor, ...rest] = args;
			if (typeof classConstructor !== "function" || name !== "bili-comment-action-buttons-renderer") return Reflect.apply(target, thisArg, args);
			const PatchActionButtonsRender = createPatch(classConstructor);
			return Reflect.apply(target, thisArg, [
				name,
				PatchActionButtonsRender,
				...rest
			]);
		};
		_unsafeWindow.customElements.define = new Proxy(originalDefine, { apply: applyHandler });
	};
	var injectBBComment = (bbComment, { variation } = { variation: false }) => {
		const { _createListCon: createListCon, _createSubReplyItem: createSubReplyItem } = bbComment.prototype;
		const applyHandler = (target, thisArg, args) => {
			const [item] = args;
			const result = Reflect.apply(target, thisArg, args);
			try {
				const replyTimeRegex = /<span class="reply-time">(.*?)<\/span>/;
				const location = getLocationString(item);
				if (!location) return result;
				if (variation) return result.replace(/<span class="time">(.*?)<\/span>/, `<span class="time">$1&nbsp;&nbsp;${location}</span>`);
				return result.replace(replyTimeRegex, `<span class="reply-time">$1</span><span class="reply-location">${location}</span>`);
			} catch (error) {
				return result;
			}
		};
		bbComment.prototype._createListCon = new Proxy(createListCon, { apply: applyHandler });
		bbComment.prototype._createSubReplyItem = new Proxy(createSubReplyItem, { apply: applyHandler });
	};
	var hookBBComment = ({ variation } = { variation: false }) => {
		if (_unsafeWindow.bbComment) {
			injectBBComment(_unsafeWindow.bbComment, { variation });
			return;
		}
		let bbComment;
		Object.defineProperty(_unsafeWindow, "bbComment", {
			get: () => bbComment,
			set: (value) => {
				bbComment = value;
				injectBBComment(value, { variation });
			},
			configurable: true
		});
	};
	var realProxy = _unsafeWindow.Proxy;
	var vueUnhooked = new WeakSet();
	var vueHooked = new WeakMap();
	var watchedVNodes = new WeakSet();
	var watchedApps = new WeakSet();
	var isProxyHookInstalled = false;
	var isVueApp = (value) => {
		if (!value || typeof value !== "object") return false;
		const app = value;
		return typeof app.uid === "number" && app.uid >= 0 && !!app.vnode;
	};
	var handleVueApp = (app) => {
		const el = app.vnode.el;
		if (el) {
			recordVue(el, app);
			recordDOM(el, app);
			watchIsUnmounted(app);
			return;
		}
		vueUnhooked.add(app);
		watchEl(app.vnode);
	};
	var watchEl = (vnode) => {
		if (watchedVNodes.has(vnode)) return;
		watchedVNodes.add(vnode);
		let value = vnode.el;
		let hooked = false;
		Object.defineProperty(vnode, "el", {
			configurable: true,
			enumerable: true,
			get() {
				return value;
			},
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
	};
	var watchIsUnmounted = (app) => {
		if (watchedApps.has(app)) return;
		watchedApps.add(app);
		let value = app.isUnmounted;
		let unhooked = false;
		Object.defineProperty(app, "isUnmounted", {
			configurable: true,
			enumerable: true,
			get() {
				return value;
			},
			set(newValue) {
				value = newValue;
				if (!unhooked && this.isUnmounted) {
					unhooked = true;
					cleanupAppReference(this);
				}
			}
		});
	};
	var cleanupAppReference = (app) => {
		const el = app.vnode.el;
		if (!el) return;
		const domValue = el.__vue__;
		const nextDomValue = removeAppFromRecord(domValue, app);
		if (nextDomValue === void 0) el.__vue__ = void 0;
		else el.__vue__ = nextDomValue;
		const nextMapValue = removeAppFromRecord(vueHooked.get(el), app);
		if (nextMapValue === void 0) vueHooked.delete(el);
		else vueHooked.set(el, nextMapValue);
	};
	var removeAppFromRecord = (record, app) => {
		if (!record) return void 0;
		if (!Array.isArray(record)) return record === app ? void 0 : record;
		const next = record.filter((item) => item !== app);
		if (next.length === 0) return void 0;
		return next.length === 1 ? next[0] : next;
	};
	var appendAppToRecord = (record, app) => {
		if (!record) return app;
		if (!Array.isArray(record)) return record === app ? record : [record, app];
		return record.includes(app) ? record : [...record, app];
	};
	var recordVue = (el, app) => {
		vueUnhooked.delete(app);
		vueHooked.set(el, appendAppToRecord(vueHooked.get(el), app));
	};
	var recordDOM = (el, app) => {
		el.__vue__ = appendAppToRecord(el.__vue__, app);
	};
	var proxyInterceptor = new Proxy(realProxy, { construct: (target, args, newTarget) => {
		const app = args[0]?._;
		if (isVueApp(app)) handleVueApp(app);
		return Reflect.construct(target, args, newTarget);
	} });
	var hookVue3App = () => {
		if (isProxyHookInstalled) return;
		_unsafeWindow.Proxy = proxyInterceptor;
		isProxyHookInstalled = true;
	};
	var extractLocationFromReplyElement = (replyItemEl) => {
		let replyElement;
		let locationString;
		if (replyItemEl.className.startsWith("sub")) {
			replyElement = replyItemEl;
			locationString = getLocationString(replyElement?.__vue__.vnode.props.subReply);
		} else {
			replyElement = replyItemEl;
			locationString = getLocationString(replyElement?.__vue__.vnode.props.reply);
		}
		return locationString;
	};
	var hasLocationInjected = (replyInfo) => replyInfo.children.length !== 0 && replyInfo.children[0].innerHTML.includes("IP属地");
	var insertLocation = (replyItemEl) => {
		const replyInfo = replyItemEl.className.startsWith("sub") ? replyItemEl.querySelector(".sub-reply-info") : replyItemEl.querySelector(".reply-info");
		if (!replyInfo) throw new Error("Can not detect reply info");
		const locationString = extractLocationFromReplyElement(replyItemEl);
		if (!locationString) return;
		if (hasLocationInjected(replyInfo)) return;
		replyInfo.children[0].innerHTML += `&nbsp;&nbsp;${locationString}`;
	};
	var isReplyItem = (el) => el instanceof HTMLDivElement && ["reply-item", "sub-reply-item"].includes(el.className);
	var observeAndInjectComments = async (root) => {
		hookVue3App();
		const targetNode = await isElementLoaded(".reply-list", root);
		new MutationObserver((mutationsList) => {
			for (const mutation of mutationsList) {
				if (mutation.type !== "childList") continue;
				mutation.addedNodes.forEach((node) => {
					if (!isReplyItem(node)) return;
					try {
						insertLocation(node);
						if (node.className.startsWith("sub")) return;
						const subReplyListEl = node.querySelector(".sub-reply-list");
						if (!subReplyListEl) return;
						const subReplyList = Array.from(subReplyListEl.children);
						subReplyList.pop();
						subReplyList.forEach(insertLocation);
					} catch (error) {}
				});
			}
		}).observe(targetNode, {
			childList: true,
			subtree: true
		});
	};
	var handleOpusRoute = async (url) => {
		hookLit();
		injectArticleLocation(url);
	};
	var handleSpaceHomeRoute = async () => {
		(await isElementLoaded((await isElementLoaded("#biliMainHeader"))?.tagName === "HEADER" ? ".nav-tab__item:nth-child(2)" : ".n-dynamic")).addEventListener("click", hookLit, { once: true });
	};
	var handleDynamicHomeRoute = async () => {
		const dynBtnText = (await isElementLoaded(".bili-dyn-home--member")).querySelector(".bili-dyn-sidebar__btn")?.textContent;
		if (dynBtnText ? !dynBtnText.includes("体验新版") : false) hookLit();
		else hookBBComment();
	};
	var handleDynamicItemRoute = async () => {
		if (!(await isElementLoaded(".bili-dyn-item")).querySelector(".bili-dyn-item__footer")) hookLit();
		else hookBBComment();
	};
	var registerRoutes = (router) => {
		router.serve([
			"https://www.bilibili.com/video/",
			"https://www.bilibili.com/list/",
			"https://www.bilibili.com/bangumi/play/",
			"https://www.bilibili.com/cheese/play/",
			"https://www.bilibili.com/v/topic/detail",
			"https://manga.bilibili.com/detail/",
			"https://www.bilibili.com/festival/",
			"https://live.bilibili.com/"
		], hookLit);
		router.serve("https://www.bilibili.com/blackboard/feed-topic.html", () => hookBBComment());
		router.serve("https://www.bilibili.com/blackboard/", () => {
			hookBBComment({ variation: true });
			observeAndInjectComments();
		});
		router.serve(["https://www.bilibili.com/read/", "https://www.bilibili.com/opus/"], handleOpusRoute);
		router.serve("https://space.bilibili.com/", hookLit, { endsWith: "dynamic" });
		router.serve("https://space.bilibili.com/", handleSpaceHomeRoute);
		router.serve("https://t.bilibili.com/", handleDynamicHomeRoute, { endsWith: "/" });
		router.serve("https://t.bilibili.com/", handleDynamicItemRoute);
		router.serve("https://www.bilibili.com/blackroom/ban/", () => hookBBComment({ variation: true }));
	};
	var router = new Router();
	registerRoutes(router);
	var { origin, pathname } = new URL(location.href);
	var urlWithoutQueryOrHash = `${origin}${pathname}`;
	router.match(urlWithoutQueryOrHash);
})();
