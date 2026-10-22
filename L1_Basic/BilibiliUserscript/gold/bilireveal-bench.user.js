// ==UserScript==
// @name         BiliReveal Benchmark Conformance Gold
// @namespace    http://zhangmaimai.com
// @version      2.3.0-bench.1
// @author       MaxChang3
// @description  我不喜欢 IP 属地，但是你手机都显示了，为什么电脑不显示呢？在哔哩哔哩网页版大部分场景中显示 IP 属地。
// @license      MIT
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
// Network: no requests initiated; public comment component data only.
// Benchmark derivative of BiliReveal v2.3.0 (MIT), MaxChang3 and contributors.
// ==/UserScript==

(function() {
  'use strict';
	var _unsafeWindow = (() => typeof unsafeWindow != "undefined" ? unsafeWindow : void 0)();
	var benchKey = Symbol.for("bilireveal.bench.v1");
	if (_unsafeWindow[benchKey]) return;
	_unsafeWindow[benchKey] = true;
// Benchmark conformance changes to BiliReveal v2.3.0; see PATCHES.md.
// This code is inserted inside the original upstream IIFE by build-gold.mjs.
var benchLocation = (reply) => {
  const value = reply?.reply_control?.location;
  if (typeof value !== 'string') return '';
  const text = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!text || text.length > 160) return '';
  const place = text.replace(/^IP\s*属地\s*[:：]?\s*/i, '').trim();
  return place ? 'IP属地：' + place : '';
};
var benchEscape = (text) => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
var benchLabel = (root, anchor, locationText) => {
  if (!anchor || !root) return;
  const own = '[data-bilireveal-bench]';
  for (const native of root.querySelectorAll('#location,.reply-location,.sub-reply-location,.ip-location')) {
    if (native.matches(own) || !native.textContent.trim() || !native.getClientRects().length) continue;
    const style = getComputedStyle(native);
    if (style.display !== 'none' && style.visibility !== 'hidden') {
      for (const label of root.querySelectorAll(own)) label.remove();
      return;
    }
  }
  let label = root.querySelector(own);
  if (!label) {
    label = document.createElement('span');
    label.setAttribute('data-bilireveal-bench', '');
    label.style.cssText = 'display:inline-block;position:static;margin-inline-start:6px;color:var(--text3,#9499a0);font:inherit;max-width:min(28ch,45vw);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 1 auto';
  }
  const text = locationText || 'IP属地：未提供';
  if (label.textContent !== text) label.textContent = text;
  label.title = locationText ? text + '（该条评论发布时的公开属地）' : '该条评论没有可展示的公开属地';
  if (anchor.nextSibling !== label) anchor.after(label);
  for (const other of root.querySelectorAll(own)) if (other !== label) other.remove();
};
var benchVueReply = (element) => {
  const sources = [element.__vueParentComponent, ...(Array.isArray(element.__vue__) ? element.__vue__ : [element.__vue__])];
  for (const app of sources) {
    const props = app?.props || app?.vnode?.props || app?.$props;
    const reply = element.classList.contains('sub-reply-item') ? props?.subReply : props?.reply;
    if (reply) return reply;
  }
};
var benchRenderVue = (element) => {
  const root = element.querySelector(element.classList.contains('sub-reply-item') ? '.sub-reply-info' : '.reply-info');
  if (!root) return;
  const anchor = root.querySelector('.reply-time,.sub-reply-time') || root.firstElementChild;
  benchLabel(root, anchor, benchLocation(benchVueReply(element)));
};
var benchRenderLit = (element) => {
  const root = element.shadowRoot;
  if (!root) return;
  benchLabel(root, root.querySelector('#pubdate'), benchLocation(element.data));
};
var benchObserveVue = () => {
  let pending = 0;
  const scan = () => {
    pending = 0;
    for (const element of document.querySelectorAll('.reply-item,.sub-reply-item')) {
      try { benchRenderVue(element); } catch {}
    }
  };
  const schedule = () => { if (!pending) pending = setTimeout(scan, 50); };
  new MutationObserver(schedule).observe(document, {childList:true,subtree:true});
  window.addEventListener('popstate', schedule);
  window.addEventListener('hashchange', schedule);
  setInterval(() => { if (!document.hidden) schedule(); }, 300);
  schedule();
};

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
	var updateLocationElement = benchRenderLit;
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
				const location = benchEscape(benchLocation(item) || "IP属地：未提供");
				if (!location) return result;
				if (variation) return result.replace(/<span class="time">(.*?)<\/span>/, `<span class="time">$1&nbsp;&nbsp;${location}</span>`);
				return result.replace(replyTimeRegex, `<span class="reply-time">$1</span><span class="reply-location" data-bilireveal-bench="" style="color:#9499a0">${location}</span>`);
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
	var insertLocation = benchRenderVue;
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
	// Install the original upstream component hooks once, across matched SPA routes.
	hookLit();
	hookBBComment();
	hookVue3App();
	benchObserveVue();
})();
