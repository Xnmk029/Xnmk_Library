// ==UserScript==
// @name         Bilibili 评论 IP 属地展示（受控回放 v2）
// @namespace    https://www.bilibili.com/
// @version      1.0.0
// @description  在 B 站电脑端每条主评论和楼中楼评论的发布时间旁展示该条评论已返回的公开 IP 属地。仅读取页面已有的 reply_control.location；不发起任何网络请求，不写入任何存储，不记录用户隐私数据。
// @match        *://www.bilibili.com/*
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';

  var WIN = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  var DOC = WIN.document;

  // ---------- 注入样式：纯文本标签，内联流式布局，不浮动、不绝对定位，不遮挡回复/更多控件 ----------
  (function() {
    try {
      var css =
        '.b4ip-tag{display:inline-flex;align-items:center;gap:4px;margin-left:6px;font-size:12px;line-height:1.4;vertical-align:middle;min-width:0;}' +
        '.b4ip-text{color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;min-width:0;}' +
        '.b4ip-text.b4ip-empty{color:#999;}';
      var el = DOC.createElement('style');
      el.textContent = css;
      var root = DOC.documentElement;
      if (root) root.insertBefore(el, root.firstChild || null);
    } catch (e) {}
  })();

  // ---------- 共享状态 ----------
  var fetchCache = new Map(); // rpid_str -> { location: string }
  var processed = new WeakMap(); // DOM 元素 -> { tag, rpid, loc }
  var watchEls = []; // { el, poll }，轮询捕获“数据在节点之后才到达”的情况

  function rpidOf(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.rpid_str != null) return String(data.rpid_str);
    if (data.rpid != null) return String(data.rpid);
    return null;
  }

  function getLocationFromData(data) {
    // 仅使用该条评论的 reply_control.location；member.location、正文、通用 location 不作为证据
    if (!data || typeof data !== 'object') return undefined;
    var rc = data.reply_control;
    if (rc && typeof rc === 'object' && Object.prototype.hasOwnProperty.call(rc, 'location')) {
      return rc.location;
    }
    return undefined;
  }

  function makeTag() {
    var tag = DOC.createElement('span');
    tag.className = 'b4ip-tag';
    var inner = DOC.createElement('span');
    inner.className = 'b4ip-text';
    tag.appendChild(inner);
    return tag;
  }

  function updateTag(el, rpid, loc, placer) {
    var prev = processed.get(el);
    if (!prev) { prev = {}; processed.set(el, prev); }
    var tag = prev.tag;
    if (!tag) { tag = makeTag(); prev.tag = tag; }
    var inner = tag.firstChild;
    var shown, empty;
    if (loc != null && String(loc).length > 0) {
      shown = String(loc);
      empty = false;
    } else {
      shown = '\u2014'; // 轻量状态：属地未获取
      empty = true;
    }
    inner.textContent = shown; // 始终作为纯文本写入，never innerHTML
    inner.className = empty ? 'b4ip-text b4ip-empty' : 'b4ip-text';
    prev.rpid = rpid;
    prev.loc = loc;
    placer(tag);
  }

  function removeTag(el) {
    var prev = processed.get(el);
    if (prev && prev.tag) {
      try { prev.tag.remove(); } catch (e) {}
      prev.tag = null;
    }
  }

  // 把标签贴在时间节点后面（流式布局，回复/更多控件仍在其后并可点击）
  function placeAfter(refEl, tag) {
    var parent = refEl.parentNode;
    if (!parent) return;
    parent.insertBefore(tag, refEl.nextSibling);
  }

  // 控件在时间栏内部：插到第一个按钮之前，没有按钮则追加到时间栏末尾
  function placeInside(timeEl, tag) {
    for (var i = 0; i < timeEl.childNodes.length; i++) {
      if (timeEl.childNodes[i].tagName === 'BUTTON') {
        timeEl.insertBefore(tag, timeEl.childNodes[i]);
        return;
      }
    }
    timeEl.appendChild(tag);
  }

  // ---------- 被动观察页面自己的接口响应（只读、克隆、不吞掉响应、不自己请求） ----------
  (function wrapFetch() {
    var origFetch = WIN.fetch;
    if (!origFetch || origFetch.__b4ip_wrapped) return;
    WIN.fetch = function(input, init) {
      var p = origFetch.apply(WIN, arguments);
      var url;
      try {
        url = input && input.url != null ? input.url : input;
      } catch (e) { url = input; }
      url = String(url || '');
      Promise.resolve(p).then(function(res) {
        if (url.indexOf('/x/v2/reply/main') === -1) return;
        try {
          var clone = res.clone();
          clone.text().then(function(text) {
            try {
              var json = JSON.parse(text);
              if (!json || json.code !== 0) return;
              var data = json.data;
              if (!data || typeof data !== 'object') return;
              var replies = data.replies;
              if (!Array.isArray(replies)) return;
              for (var i = 0; i < replies.length; i++) {
                var item = replies[i];
                if (!item || typeof item !== 'object') continue;
                var rpid = rpidOf(item);
                if (!rpid) continue;
                var rc = item.reply_control;
                var loc = rc && typeof rc === 'object' ? rc.location : undefined;
                if (loc == null || String(loc).length === 0) continue;
                fetchCache.set(rpid, { location: String(loc) });
              }
            } catch (e) {}
          }, function() {});
        } catch (e) {}
      }, function() {});
      return p;
    };
    WIN.fetch.__b4ip_wrapped = true;
  })();

  // ---------- SPA 路由切换后重新扫描 ----------
  function scheduleRescan() {
    WIN.setTimeout(scanAll, 300);
  }
  (function wrapHistory() {
    var h = WIN.history;
    if (!h || h.__b4ip_hw) return;
    var origPush = h.pushState;
    var origReplace = h.replaceState;
    h.pushState = function() { origPush.apply(h, arguments); scheduleRescan(); };
    h.replaceState = function() { origReplace.apply(h, arguments); scheduleRescan(); };
    h.__b4ip_hw = true;
    WIN.addEventListener('popstate', scheduleRescan);
  })();

  // ---------- Lit / Open Shadow DOM ----------
  var shadowHostsSeen = new WeakSet();

  function ensureShadowRoot(host, cb) {
    try {
      if (host && host.shadowRoot) { cb(host.shadowRoot); return; }
    } catch (e) {}
    if (!host || shadowHostsSeen.has(host)) return;
    shadowHostsSeen.add(host);
    var attempts = 0;
    var timer = WIN.setInterval(function() {
      try {
        if (host.shadowRoot) { WIN.clearInterval(timer); cb(host.shadowRoot); }
      } catch (e) {}
      attempts += 1;
      if (attempts > 60) WIN.clearInterval(timer);
    }, 100);
  }

  function hasNativeLocation(footer) {
    try {
      var loc = footer.querySelector('#location');
      if (!loc) return false;
      if (loc.hidden) return false;
      var st = WIN.getComputedStyle(loc);
      if (st && (st.display === 'none' || st.visibility === 'hidden')) return false;
      return true;
    } catch (e) { return false; }
  }

  function wrapUpdate(el, cb) {
    try {
      if (el.__b4ip_upd_iv) return;
      var orig = el.update;
      if (typeof orig !== 'function') return;
      el.update = function() {
        var ret = orig.apply(this, arguments);
        try { cb(); } catch (e) {}
        return ret;
      };
      el.__b4ip_upd_iv = true;
    } catch (e) {}
  }

  function processLitButtons(el) {
    try {
      ensureShadowRoot(el, function(sr) {
        var footer = sr.querySelector('#footer');
        if (!footer) return;
        var pubdate = sr.querySelector('#pubdate');
        if (!pubdate) {
          var mo = new WIN.MutationObserver(function() {
            if (sr.querySelector('#pubdate')) { mo.disconnect(); processLitButtons(el); }
          });
          mo.observe(footer, { childList: true, subtree: true });
          return;
        }
        if (hasNativeLocation(footer)) { removeTag(el); return; }
        function placer(tag) {
          if (!tag.isConnected || tag.parentNode !== footer) {
            placeAfter(pubdate, tag);
          }
        }
        function renderFrom(data) {
          try {
            if (!data) return;
            if (hasNativeLocation(footer)) { removeTag(el); return; }
            var rpid = rpidOf(data);
            if (!rpid) return;
            var loc = getLocationFromData(data);
            if (loc === undefined) {
              var c = fetchCache.get(rpid);
              loc = c ? c.location : undefined;
            }
            updateTag(el, rpid, loc, placer);
          } catch (e) {}
        }
        wrapUpdate(el, function() { renderFrom(el.data); });
        renderFrom(el.data);
        watchEls.push({ el: el, poll: function() { renderFrom(el.data); } });
        var natMo = new WIN.MutationObserver(function(muts) {
          if (hasNativeLocation(footer)) { removeTag(el); natMo.disconnect(); }
        });
        natMo.observe(footer, { childList: true, subtree: true });
        observeRoot(sr);
      });
    } catch (e) {}
  }

  // ---------- Vue 3 ----------
  function getVueData(el) {
    try {
      var ppc = el.__vueParentComponent;
      if (ppc) {
        var props = ppc.props;
        if (props) {
          if (props.subReply) return props.subReply; // 楼中楼必须用 subReply，不能用 rootReply
          if (props.reply) return props.reply;
        }
        var vnode = ppc.vnode;
        if (vnode && vnode.props) {
          if (vnode.props.subReply) return vnode.props.subReply;
          if (vnode.props.reply) return vnode.props.reply;
        }
      }
      var vue = el.__vue__;
      if (vue) {
        if (vue.subReply) return vue.subReply;
        if (vue.reply) return vue.reply;
      }
    } catch (e) {}
    return null;
  }

  function processVueItem(el) {
    try {
      var info = el.querySelector('.sub-reply-info') || el.querySelector('.reply-info');
      if (!info) return;
      var time = el.querySelector('.sub-reply-time') || el.querySelector('.reply-time');
      if (!time) return;
      function placer(tag) {
        if (!tag.isConnected || tag.parentNode !== info) {
          placeAfter(time, tag);
        }
      }
      function render() {
        var data = getVueData(el);
        if (!data) return;
        var rpid = rpidOf(data);
        if (!rpid) return;
        var loc = getLocationFromData(data);
        if (loc === undefined) {
          var c = fetchCache.get(rpid);
          loc = c ? c.location : undefined;
        }
        updateTag(el, rpid, loc, placer);
      }
      render();
      watchEls.push({ el: el, poll: render });
    } catch (e) {}
  }

  // ---------- bbComment 旧形态 ----------
  var bbCache = new Map(); // rpid_str -> item
  var bbPollAttempts = 0;
  (function pollBbComment() {
    try {
      var bc = WIN.bbComment;
      if (bc && bc.prototype) {
        var proto = bc.prototype;
        ['_createListCon', '_createSubReplyItem'].forEach(function(name) {
          var orig = proto[name];
          if (!orig || orig.__b4ip_wrapped) return;
          proto[name] = function(item) {
            try {
              if (item && typeof item === 'object') {
                var rpid = rpidOf(item);
                if (rpid) bbCache.set(rpid, item);
              }
            } catch (e) {}
            return orig.apply(this, arguments);
          };
          proto[name].__b4ip_wrapped = true;
        });
      } else if (bbPollAttempts < 200) {
        bbPollAttempts += 1;
        WIN.setTimeout(pollBbComment, 150);
      }
    } catch (e) {
      if (bbPollAttempts < 200) {
        bbPollAttempts += 1;
        WIN.setTimeout(pollBbComment, 150);
      }
    }
  })();

  function processBbNode(el) {
    try {
      var id = el.getAttribute('data-id');
      if (!id) return;
      var info = el.querySelector('.info');
      var time = el.querySelector('.reply-time');
      if (!info || !time) return;
      var item = bbCache.get(String(id));
      if (!item) {
        WIN.setTimeout(function() { processBbNode(el, false); }, 400);
        return;
      }
      function placer(tag) {
        if (!tag.isConnected || tag.parentNode !== time) {
          placeInside(time, tag);
        }
      }
      var rpid = String(id);
      var loc = getLocationFromData(item);
      if (loc === undefined) {
        var c = fetchCache.get(rpid);
        loc = c ? c.location : undefined;
      }
      updateTag(el, rpid, loc, placer);
    } catch (e) {}
  }

  // ---------- DOM 扫描与影子 DOM 观察 ----------
  function handleAddedNode(node) {
    try {
      if (!node || node.nodeType !== 1) return;
      var upper = (node.tagName || '').toUpperCase();
      if (upper === 'BILI-COMMENTS') {
        ensureShadowRoot(node, function(sr) { observeRoot(sr); });
      } else if (upper === 'BILI-COMMENT-ACTION-BUTTONS-RENDERER') {
        ensureShadowRoot(node, function(sr) { processLitButtons(node); observeRoot(sr); });
      } else if (upper === 'BILI-COMMENT-THREAD-RENDERER' ||
                 upper === 'BILI-COMMENT-RENDERER' ||
                 upper === 'BILI-COMMENT-REPLY-RENDERER') {
        ensureShadowRoot(node, function(sr) { observeRoot(sr); });
      }
      if (node.shadowRoot) {
        observeRoot(node.shadowRoot);
      }
      if (node.classList) {
        if (node.classList.contains('reply-item') || node.classList.contains('sub-reply-item')) {
          processVueItem(node);
        }
        if (node.getAttribute && node.getAttribute('data-id') &&
            (node.classList.contains('reply-wrap') || node.classList.contains('sub-reply-item'))) {
          processBbNode(node);
        }
      }
      var q = node.querySelectorAll ? node.querySelectorAll('.reply-item, .sub-reply-item, .reply-wrap[data-id], .sub-reply-item[data-id]') : [];
      for (var i = 0; i < q.length; i++) {
        var n = q[i];
        if (n.classList && (n.classList.contains('reply-item') || n.classList.contains('sub-reply-item'))) {
          processVueItem(n);
        } else if (n.getAttribute && n.getAttribute('data-id')) {
          processBbNode(n);
        }
      }
    } catch (e) {}
  }

  var rootsObserved = new WeakSet();
  function observeRoot(root) {
    try {
      if (rootsObserved.has(root)) return;
      rootsObserved.add(root);
      var mo = new WIN.MutationObserver(function(mutations) {
        for (var m = 0; m < mutations.length; m++) {
          var adds = mutations[m].addedNodes;
          for (var a = 0; a < adds.length; a++) handleAddedNode(adds[a]);
        }
      });
      mo.observe(root, { childList: true, subtree: true });
    } catch (e) {}
  }

  function scanAll() {
    try {
      var hosts = DOC.querySelectorAll('bili-comments');
      for (var i = 0; i < hosts.length; i++) {
        ensureShadowRoot(hosts[i], function(sr) { observeRoot(sr); });
      }
      var buttons = DOC.querySelectorAll('bili-comment-action-buttons-renderer');
      for (var i = 0; i < buttons.length; i++) processLitButtons(buttons[i]);
      var vs = DOC.querySelectorAll('.reply-item, .sub-reply-item');
      for (var i = 0; i < vs.length; i++) processVueItem(vs[i]);
      var bs = DOC.querySelectorAll('.reply-wrap[data-id], .sub-reply-item[data-id]');
      for (var i = 0; i < bs.length; i++) processBbNode(bs[i]);
    } catch (e) {}
  }

  // 定期轮询：捕获“数据在节点之后到达”以及组件复用后属地变更的情况
  WIN.setInterval(function() {
    for (var i = watchEls.length - 1; i >= 0; i--) {
      var entry = watchEls[i];
      try {
        if (!DOC.contains(entry.el)) { watchEls.splice(i, 1); continue; }
        entry.poll();
      } catch (e) {}
    }
  }, 1000);

  // ---------- 启动 ----------
  function start() {
    pollBbComment();
    wrapFetch();
    wrapHistory();
    try { observeRoot(DOC.documentElement); } catch (e) {}
    scanAll();
    WIN.setTimeout(scanAll, 400);
    WIN.setTimeout(scanAll, 2000);
    if (DOC.readyState === 'loading') {
      WIN.addEventListener('DOMContentLoaded', function() {
        scanAll();
        WIN.setTimeout(scanAll, 400);
      });
      WIN.addEventListener('load', scanAll);
    }
  }
  try { start(); } catch (e) {}
})();
