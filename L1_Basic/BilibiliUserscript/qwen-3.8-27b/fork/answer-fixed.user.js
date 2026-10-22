// ==UserScript==
// @name         B站 IP 归属地提示（shadow DOM 修复版）
// @namespace    https://example.org/bili-ip-geo-badge-fixed
// @version      1.1.0
// @description  修复版（fork，不替代原交付物）：视频页评论区经 hook bili-comment-action-buttons-renderer 就地显示每条评论的 IP 归属地（读取页面数据 reply_control.location，符合"只展示已经返回的归属地信息"）；space/live 等页面降级为全局徽章（递归 shadow DOM 文本扫描）。修掉了原版两条失效数据路径：①light DOM 扫描进不了 shadowRoot ②x/web-interface/view 无 ip_info 字段。不收集、不上传、不持久化任何用户数据。
// @author       qwen3.8-27b (fork fix)
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/list/watchlater*
// @match        https://space.bilibili.com/*
// @match        https://live.bilibili.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';

  /* ================= 常量 ================= */

  var IP_NODE_ID = 'bili-ip-geo-badge-fixed';      // 就地注入节点（每个评论组件自持一份）
  var GLOBAL_ID = 'bili-ip-geo-badge-fixed-global'; // 全局徽章（无评论区场景兜底）
  var GLOBAL_STYLE_ID = 'bili-ip-geo-badge-fixed-style';

  /* ================= 归属地判定 ================= */

  function normalizeLocation(l) {
    if (typeof l !== 'string') return '';
    return l.trim();
  }

  var BANNED = ['未提供', '未知', '无', '—', '-', '--', 'N/A', 'null', 'undefined', '加载中', '获取中', 'IP属地', 'IP属地：'];

  function looksLikeLocation(v) {
    v = normalizeLocation(v);
    if (!v) return false;
    if (v.length < 2 || v.length > 12) return false;
    // 归属地应为中文省份/地区（可能含“海外”等），拒绝数字、URL、坐标
    if (!/^[\u4E00-\u9FFF\u3400-\u4DBF]+$/.test(v)) return false;
    for (var i = 0; i < BANNED.length; i++) if (v === BANNED[i]) return false;
    return true;
  }

  /* ================= 从组件实例读取归属地（参照参考实现：页面已返回的 reply_control.location） =================
   * 参考脚本（bilibili-查看IP和历史评论 2.0.1）的 getLocationFromAny 机制：
   *   source.reply_control.location
   *   source.data/reply/subReply.reply_control.location
   *   source.__vueParentComponent.props / source.__vue__.vnode.props 中的 reply/subReply.reply_control.location
   * 以及遍历 props 各值兜底。这里保持同构实现。
   */

  function getLocationFromAny(source) {
    if (!source) return '';
    var direct = normalizeLocation(source.reply_control && source.reply_control.location);
    if (direct) return direct;

    var data = source.data || source.reply || source.subReply || null;
    if (data) {
      var dl = normalizeLocation(data.reply_control && data.reply_control.location);
      if (dl) return dl;
    }

    var props = null;
    try {
      props = (source.__vueParentComponent && source.__vueParentComponent.props) ||
              (source.__vue__ && source.__vue__.vnode && source.__vue__.vnode.props) || null;
      if (!props && source.$props) props = source.$props;
    } catch (e) { props = null; }

    if (props && typeof props === 'object') {
      var rl = normalizeLocation(props.reply && props.reply.reply_control && props.reply.reply_control.location);
      if (rl) return rl;
      var sl = normalizeLocation(props.subReply && props.subReply.reply_control && props.subReply.reply_control.location);
      if (sl) return sl;
      for (var k in props) {
        if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
        var v = props[k];
        if (v && typeof v === 'object' && v.reply_control && typeof v.reply_control.location === 'string') {
          var loc = normalizeLocation(v.reply_control.location);
          if (loc) return loc;
        }
      }
    }

    if (data && typeof data === 'object') {
      for (var dk in data) {
        if (!Object.prototype.hasOwnProperty.call(data, dk)) continue;
        var dv = data[dk];
        if (dv && typeof dv === 'object' && dv.reply_control && typeof dv.reply_control.location === 'string') {
          var dloc = normalizeLocation(dv.reply_control.location);
          if (dloc) return dloc;
        }
      }
    }
    return '';
  }

  /* ================= 就地注入 / 移除（写入各评论组件的 shadowRoot，与参考实现同位置策略） ================= */

  function upsertLocation(actionButtons, location) {
    var root = actionButtons && actionButtons.shadowRoot;
    if (!root) return;
    var ipNode = root.getElementById(IP_NODE_ID);
    if (!ipNode) {
      ipNode = document.createElement('span');
      ipNode.id = IP_NODE_ID;
      ipNode.textContent = location;
      // 贴合评论区原布局：小号灰色文本，随操作按钮行内排布
      ipNode.style.cssText = 'font-size:12px;color:#9499a0;margin-left:8px;user-select:none;white-space:nowrap;';
      var pubdate = root.querySelector('#pubdate') || root.querySelector('.pubdate');
      if (pubdate && pubdate.parentNode === root) {
        pubdate.after(ipNode);
        return;
      }
      var like = root.querySelector('#like') || root.querySelector('.like');
      if (like && like.parentNode === root) {
        like.before(ipNode);
        return;
      }
      root.appendChild(ipNode);
    } else if (ipNode.textContent !== location) {
      ipNode.textContent = location; // 值变化只更新文本，不重建节点（不重复插入）
    }
  }

  function removeLocation(actionButtons) {
    var root = actionButtons && actionButtons.shadowRoot;
    if (!root) return;
    var n = root.getElementById(IP_NODE_ID);
    if (n) n.remove();
  }

  function applyToInstance(inst, force) {
    if (!inst || !inst.shadowRoot) return;
    var text = getLocationFromAny(inst);
    if (text && looksLikeLocation(text)) upsertLocation(inst, text);
    else if (force) removeLocation(inst);
  }

  /* ================= 评论区 hook（核心修复） =================
   * 参考实现机制：customElements.whenDefined('bili-comment-action-buttons-renderer')
   * 后包装其 prototype.update()，在渲染完成后把归属地注入其 shadowRoot。
   */

  function scanExistingButtons() {
    var nodes = document.querySelectorAll('bili-comment-action-buttons-renderer');
    for (var i = 0; i < nodes.length; i++) applyToInstance(nodes[i], false);
  }

  function hookActionButtons() {
    if (!window.customElements || typeof customElements.whenDefined !== 'function') return;
    customElements.whenDefined('bili-comment-action-buttons-renderer').then(function () {
      var Ctor = customElements.get('bili-comment-action-buttons-renderer');
      var proto = Ctor && Ctor.prototype;
      if (!proto || proto.__biliIpHooked) return;
      proto.__biliIpHooked = true;
      var originalUpdate = proto.update;
      if (typeof originalUpdate !== 'function') {
        scanExistingButtons(); // 无 update 方法时退化为一次性扫描
        return;
      }
      proto.update = function () {
        var ret = originalUpdate.apply(this, arguments);
        var self = this;
        var doInject = function () {
          try {
            var text = getLocationFromAny(self);
            if (text && looksLikeLocation(text)) upsertLocation(self, text);
            else removeLocation(self);
          } catch (e) { /* 静默 */ }
        };
        var uc = this.updateComplete;
        if (uc && typeof uc.then === 'function') {
          try { uc.then(doInject); } catch (e) { setTimeout(doInject, 0); }
        } else {
          requestAnimationFrame(doInject);
        }
        return ret;
      };
      // 兜底：hook 安装前已渲染的首屏评论
      scanExistingButtons();
    }).catch(function () { /* 元素未定义则跳过 */ });
  }

  /* ================= 全局徽章兜底（space/live/无评论区页面；递归 shadow DOM 文本扫描） ================= */

  function findIpTextInShadows(root, depth) {
    if (!root || depth > 8) return null;
    var re = /IP属地[：:]\s*([^\s<，,。.；;]{2,12})/;
    if (root.nodeType === 3) {
      var m = re.exec(root.data || '');
      if (m) return m[1].trim();
      return null;
    }
    if (root.nodeType !== 1) return null;
    if (root.shadowRoot) {
      var sr = findIpTextInShadows(root.shadowRoot, depth + 1);
      if (sr) return sr;
    }
    var kids = root.childNodes || [];
    for (var i = 0; i < kids.length; i++) {
      var r = findIpTextInShadows(kids[i], depth + 1);
      if (r) return r;
    }
    return null;
  }

  function ensureGlobalStyle() {
    if (document.getElementById(GLOBAL_STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = GLOBAL_STYLE_ID;
    st.textContent = '#' + GLOBAL_ID +
      '{display:inline-flex;align-items:center;max-width:320px;overflow:hidden;text-overflow:ellipsis;' +
      'margin:2px 0;padding:1px 8px;font-size:12px;line-height:1.7;border-radius:10px;' +
      'white-space:nowrap;vertical-align:middle;user-select:none;background:#f4f5f7;color:#61666d;border:1px solid #e3e5e7;}' +
      '#' + GLOBAL_ID + '.ip-geo--empty{background:#fafafa;color:#b2b5ba;border-color:#efefef;}' +
      '#' + GLOBAL_ID + '.ip-geo--fixed{position:fixed;right:16px;bottom:132px;z-index:9999;box-shadow:0 1px 4px rgba(0,0,0,.10);}';
    (document.head || document.documentElement).appendChild(st);
  }

  var gState = { badge: null, routeKey: '', location: '', timer: null };

  function ensureGlobalBadge() {
    if (gState.badge) return gState.badge;
    var old = null;
    try { old = document.getElementById(GLOBAL_ID); } catch (e) { old = null; }
    if (old) { try { old.remove(); } catch (e) {} }
    var b = document.createElement('div');
    b.id = GLOBAL_ID;
    b.className = 'ip-geo ip-geo--empty';
    b.textContent = 'IP属地：—';
    b.style.display = 'none';
    (document.body || document.documentElement).appendChild(b);
    gState.badge = b;
    return b;
  }

  function placeGlobalBadge(b) {
    // 有评论区组件的页面由就地注入负责；全局徽章仅作兜底，无锚点时固定右下角
    var fixed = document.querySelector('bili-comments');
    b.classList.toggle('ip-geo--fixed', !fixed);
    b.style.display = '';
  }

  function renderGlobal() {
    var b = ensureGlobalBadge();
    placeGlobalBadge(b);
    if (gState.location && looksLikeLocation(gState.location)) {
      b.textContent = 'IP属地：' + gState.location;
      b.classList.remove('ip-geo--empty');
    } else {
      b.textContent = 'IP属地：—';
      b.classList.add('ip-geo--empty');
    }
  }

  function scanGlobal() {
    var key = location.pathname || '';
    if (key !== gState.routeKey) {
      gState.routeKey = key;
      gState.location = '';
    }
    if (!gState.location) {
      var found = findIpTextInShadows(document.body, 0);
      if (found && looksLikeLocation(found)) gState.location = found;
    }
    // 视频页有评论区时隐藏全局徽章（避免与就地注入重复），其余页面显示
    var hasComments = !!document.querySelector('bili-comments');
    var b = ensureGlobalBadge();
    b.style.display = hasComments ? 'none' : '';
    if (!hasComments) renderGlobal();
  }

  function scheduleGlobal(delay) {
    if (gState.timer) return;
    gState.timer = setTimeout(function () {
      gState.timer = null;
      try { scanGlobal(); } catch (e) {}
    }, typeof delay === 'number' && delay >= 0 ? delay : 300);
  }

  /* ================= SPA / DOM 变化适配 ================= */

  function startObserver() {
    if (typeof MutationObserver !== 'function') return;
    var root = document.body || document.documentElement;
    if (!root) return;
    try {
      new MutationObserver(function (records) {
        var relevant = false;
        for (var i = 0; i < records.length && !relevant; i++) {
          var rec = records[i];
          for (var j = 0; j < rec.addedNodes.length; j++) {
            var n = rec.addedNodes[j];
            if (n.nodeType === 1) {
              if (n.nodeName === 'BILI-COMMENT-ACTION-BUTTONS-RENDERER') {
                applyToInstance(n, false);
              } else if (n.nodeName === 'BILI-COMMENTS' ||
                         (n.querySelector && n.querySelector('bili-comment-action-buttons-renderer'))) {
                relevant = true; // 评论区整体/局部重建：补扫既有按钮实例
              }
            }
          }
        }
        if (relevant) {
          scanExistingButtons();
          scheduleGlobal(150);
        } else {
          scheduleGlobal(500); // 轻量：正文变化时低频重扫全局徽章
        }
      }).observe(root, { childList: true, subtree: true });
    } catch (e) { /* 忽略 */ }
  }

  function watchUrlChange() {
    window.addEventListener('popstate', function () { scheduleGlobal(0); }, false);
    window.addEventListener('hashchange', function () { scheduleGlobal(0); }, false);
    var names = ['pushState', 'replaceState'];
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var orig = window.history && window.history[name];
      if (typeof orig !== 'function') continue;
      (function (origFn, n) {
        window.history[n] = function () {
          var r = origFn.apply(this, arguments);
          try { window.dispatchEvent(new Event('bili-ip-geo-fixed:urlchange')); } catch (e) {}
          return r;
        };
      })(orig, name);
    }
    window.addEventListener('bili-ip-geo-fixed:urlchange', function () { scheduleGlobal(0); }, false);
  }

  /* ================= 初始化 ================= */

  function init() {
    ensureGlobalStyle();
    ensureGlobalBadge();
    hookActionButtons();
    startObserver();
    watchUrlChange();
    scanExistingButtons();
    scheduleGlobal(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); }, { once: true });
  } else {
    init();
  }
})();