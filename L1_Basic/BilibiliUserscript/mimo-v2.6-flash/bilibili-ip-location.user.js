// ==UserScript==
// @name         B站 IP 归属地显示
// @namespace    https://benchmark.local/userscripts/bilibili-ip-location
// @version      1.0.0
// @description  在 B 站电脑端页面显示公开页面数据（页面已渲染的“IP属地”文本）与公开接口（api.bilibili.com/x/web-interface/zone）已返回的归属地信息；适配 SPA 路由与异步加载，重复注入受控，网络失败或字段缺失时灰色占位静默降级。不收集、不上传、不持久化任何数据。
// @author       benchmark
// @match        https://www.bilibili.com/*
// @match        https://space.bilibili.com/*
// @match        https://t.bilibili.com/*
// @match        https://live.bilibili.com/*
// @match        https://search.bilibili.com/*
// @connect      api.bilibili.com
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  var PANEL_ID = 'bilibili-ip-location-panel';
  var STYLE_ID = 'bilibili-ip-location-style';
  var ZONE_URL = 'https://api.bilibili.com/x/web-interface/zone';
  var LABEL_RE = /IP属地[:：]\s*([^\s，,。;；、]{1,12})/;

  // 本机出口归属地状态：idle -> loading -> ok / fail（fail 含网络失败与字段缺失两种，均灰色占位）
  var selfState = { status: 'idle', text: '', title: '正在获取公开接口数据…' };
  // 页面已渲染的 IP 属地文本（去重、保序）
  var pageLabels = [];
  var debounceTimer = 0;

  /* ---------- 样式（仅注入一次） ---------- */

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#' + PANEL_ID + '{font-size:12px;line-height:1.7;color:#61666d;box-sizing:border-box;max-width:100%;}',
      '#' + PANEL_ID + ' .bip-head{font-weight:600;color:#18191c;margin-bottom:2px;}',
      '#' + PANEL_ID + ' .bip-row{display:flex;gap:8px;align-items:baseline;}',
      '#' + PANEL_ID + ' .bip-label{flex:none;color:#99a2aa;}',
      '#' + PANEL_ID + ' .bip-value{color:#61666d;word-break:break-all;}',
      '#' + PANEL_ID + ' .bip-value.bip-missing{color:#99a2aa;}',
      '#' + PANEL_ID + '.bip-inline{display:block;margin:8px 0;padding:6px 10px;background:#f6f7f8;border-radius:8px;}',
      '#' + PANEL_ID + '.bip-fixed{position:fixed;left:16px;bottom:16px;z-index:1000;padding:6px 10px;' +
        'background:rgba(255,255,255,.94);border:1px solid rgba(0,0,0,.08);border-radius:10px;' +
        'box-shadow:0 2px 8px rgba(0,0,0,.08);}'
    ].join('');
    (document.head || document.documentElement).appendChild(style);
  }

  /* ---------- 面板创建与放置（幂等） ---------- */

  function createPanel() {
    var panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.setAttribute('title', '数据仅来自当前页面已渲染文本与 B 站公开接口返回字段，仅在本机展示，不收集、不上传、不持久化。');
    panel.innerHTML =
      '<div class="bip-head">IP 归属地</div>' +
      '<div class="bip-row"><span class="bip-label">本机出口</span><span class="bip-value bip-self">…</span></div>' +
      '<div class="bip-row"><span class="bip-label">本页显示</span><span class="bip-value bip-page">…</span></div>';
    return panel;
  }

  // 视频页锚点：实测 www.bilibili.com 视频页 SSR HTML 含 #viewbox_report；面板内联插到其后，不覆盖任何原控件。
  function findAnchor() {
    var el = document.querySelector('#viewbox_report');
    if (el && el.parentNode) return el;
    return null;
  }

  function isAfter(panel, anchor) {
    var node = anchor.nextSibling;
    var hops = 0;
    while (node && hops < 50) {
      if (node === panel) return true;
      node = node.nextSibling;
      hops++;
    }
    return false;
  }

  // 单实例：始终移动同一个 panel 元素，绝不创建第二个。
  function ensurePanel() {
    injectStyle();
    var panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = createPanel();
    }
    var anchor = findAnchor();
    if (anchor) {
      if (panel.parentNode !== anchor.parentNode || !isAfter(panel, anchor)) {
        panel.className = 'bip-inline';
        anchor.parentNode.insertBefore(panel, anchor.nextSibling);
      } else if (panel.className !== 'bip-inline') {
        panel.className = 'bip-inline';
      }
    } else {
      if (panel.parentNode !== document.body || panel.className !== 'bip-fixed') {
        panel.className = 'bip-fixed';
        document.body.appendChild(panel);
      }
    }
    return panel;
  }

  /* ---------- 渲染（仅在值变化时改 DOM，避免观察器回环） ---------- */

  function setValue(el, missing, text, title) {
    if (!el) return;
    if (missing) el.classList.add('bip-missing');
    else el.classList.remove('bip-missing');
    if (el.textContent !== text) el.textContent = text;
    if (el.title !== title) el.title = title;
  }

  function render() {
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    var selfEl = panel.querySelector('.bip-self');
    var pageEl = panel.querySelector('.bip-page');

    if (selfState.status === 'idle' || selfState.status === 'loading') {
      setValue(selfEl, true, '…', '正在获取公开接口数据…');
    } else if (selfState.status === 'ok') {
      setValue(selfEl, false, selfState.text, selfState.title);
    } else {
      setValue(selfEl, true, '—', '网络失败或接口未返回归属地字段，未做任何推断');
    }

    if (pageLabels.length > 0) {
      var shown = pageLabels.slice(0, 6);
      var text = shown.join('、') + (pageLabels.length > shown.length ? '…' : '');
      setValue(pageEl, false, text, '取自当前页面已渲染的“IP属地”文本');
    } else {
      setValue(pageEl, true, '—', '当前页面未渲染任何“IP属地”文本');
    }
  }

  /* ---------- 公开接口：本机出口归属地 ---------- */

  function loadSelfRegion() {
    if (selfState.status === 'loading') return;
    selfState = { status: 'loading', text: '', title: '正在获取公开接口数据…' };
    render();
    Promise.resolve()
      .then(function () {
        return fetch(ZONE_URL, {
          method: 'GET',
          credentials: 'omit',
          headers: { 'Accept': 'application/json' }
        });
      })
      .then(function (res) {
        if (!res || !res.ok) throw new Error('http status');
        return res.json();
      })
      .then(function (json) {
        var data = json && json.code === 0 && json.data ? json.data : null;
        if (!data) throw new Error('bad payload');
        var seen = Object.create(null);
        var parts = [];
        ['country', 'province', 'city'].forEach(function (key) {
          var v = String(data[key] == null ? '' : data[key]).trim();
          if (v && !seen[v]) {
            seen[v] = true;
            parts.push(v);
          }
        });
        if (parts.length === 0) throw new Error('no region fields');
        var isp = String(data.isp == null ? '' : data.isp).trim();
        selfState = {
          status: 'ok',
          text: parts.join(' ') + (isp ? ' · ' + isp : ''),
          title: '取自 api.bilibili.com 公开接口已返回字段'
        };
      })
      .catch(function () {
        // 网络失败或字段缺失：静默降级为灰色占位，不重试循环、不打扰用户
        selfState = { status: 'fail', text: '', title: '' };
      })
      .then(function () {
        render();
      });
  }

  /* ---------- 页面扫描：已渲染的“IP属地”文本 ---------- */

  function matchLabels(raw) {
    var m = LABEL_RE.exec(raw);
    return m ? m[1] : null;
  }

  function scanPageLabels() {
    var panel = document.getElementById(PANEL_ID);
    var found = [];
    var seen = Object.create(null);
    if (!document.body) {
      pageLabels = found;
      return;
    }
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        var tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        if (panel && parent.closest && parent.closest('#' + PANEL_ID)) return NodeFilter.FILTER_REJECT;
        var value = node.nodeValue || '';
        return value.indexOf('属地') === -1 ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while ((node = walker.nextNode())) {
      var label = matchLabels(node.nodeValue || '');
      if (!label) {
        // 兼容“IP属地：”与地名被拆到相邻节点的渲染：向上最多两级小容器内匹配
        var ancestor = node.parentElement;
        for (var i = 0; i < 2 && ancestor && !label; i++) {
          var text = ancestor.textContent || '';
          if (text.length <= 120) label = matchLabels(text);
          ancestor = ancestor.parentElement;
        }
      }
      if (label && !seen[label]) {
        seen[label] = true;
        found.push(label);
      }
    }
    pageLabels = found;
  }

  /* ---------- SPA 路由与异步加载 ---------- */

  function refresh() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      debounceTimer = 0;
      ensurePanel();
      scanPageLabels();
      render();
      // 上一次网络失败时，允许在后续路由切换后重试一次
      if (selfState.status === 'fail') loadSelfRegion();
    }, 300);
  }

  function hookHistory() {
    ['pushState', 'replaceState'].forEach(function (name) {
      var original = history[name];
      if (typeof original !== 'function') return;
      history[name] = function () {
        var result = original.apply(this, arguments);
        refresh();
        return result;
      };
    });
    window.addEventListener('popstate', refresh);
    window.addEventListener('hashchange', refresh);
  }

  function observeDom() {
    if (!document.body) return;
    var observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function init() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', init, { once: true });
      return;
    }
    ensurePanel();
    scanPageLabels();
    render();
    loadSelfRegion();
    hookHistory();
    observeDom();
  }

  init();
})();
