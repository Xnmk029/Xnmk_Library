// ==UserScript==
// @name         B站 IP 属地显示（公开数据版）
// @namespace    https://github.com/mimo-v2.6-pro/bilibili-ip-location
// @version      1.0.0
// @author       mimo-v2.6-pro
// @description  在 B 站电脑端页面（评论区、楼中楼、专栏与动态文章）显示公开数据中已返回的 IP 属地。只原样展示页面数据或 B 站公开接口返回的归属地字段，不推断、不猜测更精确的位置；不采集、不上传、不持久化任何个人数据；网络失败或字段缺失时以灰色占位静默降级。
// @icon         https://www.bilibili.com/favicon.ico
// @match        *://*.bilibili.com/*
// @exclude      *://m.bilibili.com/*
// @noframes
// @run-at       document-start
// @inject-into  page
// @grant        none
// @connect      api.bilibili.com
// ==/UserScript==

/*
 * ───────────────────────── 数据来源与权限说明 ─────────────────────────
 *
 * 一、展示内容的来源（仅两类，均为“已经返回”的数据，不做任何推断）
 *   A. 页面已加载的公开数据：
 *      1) B 站自己发起的接口响应（脚本在页面上下文只读捕获，不额外请求），
 *         读取其中原样返回的归属地字段：
 *           reply_control.location   例："IP属地：河北"（评论接口字段）
 *           reply_control.ip_location、ip_location（同义字段，若返回）
 *      2) 页面已渲染的文本（形如 "IP属地：XX" 的原生标签）——若页面已展示则脚本
 *         不再重复插入。
 *   B. B 站公开接口原样返回的字段（脚本主动发起，全部为 GET，仅携带公开 id）：
 *        https://api.bilibili.com/x/v2/reply?type=&oid=&pn=&ps=&sort=        评论列表
 *        https://api.bilibili.com/x/v2/reply/reply?type=&oid=&root=&pn=&ps=  楼中楼
 *        https://api.bilibili.com/x/article/viewinfo?id=                     专栏/动态文章
 *        https://api.bilibili.com/x/web-interface/view?bvid=                 视频 aid 解析
 *      以上仅在页面数据缺少归属地字段时作为补充；type/oid/root 优先取自页面自身
 *      请求参数，页面未给出时仅对视频页使用 type=1&oid=aid（aid 来自页面状态或
 *      view 接口），其余情况不猜测、不请求。
 *
 * 二、网络与权限
 *   - 外部请求：仅 api.bilibili.com（已在上方 @connect 声明），方法均为 GET，
 *     参数只有公开 id（aid / oid / root / cv id），失败一律静默降级为灰色占位。
 *   - @grant none：不使用任何 GM_* API，无 @connect 以外的域名访问。
 *   - 请求携带浏览器既有的 bilibili 会话（credentials: 'include'），与页面自身
 *     请求完全一致，用于读取同一接口对登录态返回的公开归属地字段；脚本不附加、
 *     不回传任何自行收集的数据。
 *
 * 三、隐私
 *   - 不读取/不写入 localStorage、sessionStorage、cookie，不使用 GM_setValue 等
 *     持久化能力；所有缓存仅存在于当前页面的内存中，随页面关闭消失。
 *   - 不向任何第三方域名发送任何数据；不采集点击、浏览、身份等用户行为。
 *   - 展示值 = 接口/页面原样返回的归属地字符串（省/市级，如 "IP属地：河北"），
 *     不做定位、不做地理推断、不猜测更精确的位置。
 *
 * 四、注入风格
 *   - 只在评论元信息行内、文章发布行内插入行内小标签（pointer-events:none），
 *     不使用悬浮层/固定定位，不遮挡原控件与弹层。
 *   - 所有插入点带 data-bili-iploc-chip 标记并按插入行去重：路由切换、DOM 更新、
 *     组件重渲染后重复扫描均不会重复插入。
 * ─────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  var MARK = 'data-bili-iploc-chip';
  var CHIP_SEL = '[' + MARK + ']';
  var NATIVE_LABEL_RE = /IP\s*属地\s*[：:]/;
  var SPECIFIC_ROW_SEL =
    'bili-comment-thread-renderer, bili-comment-reply-renderer, bili-comment-renderer, ' +
    '.reply-item, .sub-reply-item';
  var GENERIC_ROW_SEL = '[data-rpid]';
  var ROW_SEL = SPECIFIC_ROW_SEL + ', ' + GENERIC_ROW_SEL;
  var TIME_SEL = '.reply-time';
  var PUBDATE_SEL = '#pubdate';
  var USER_INFO_SEL = 'bili-comment-user-info';
  var AUTHOR_LINK_SEL = 'a[href*="space.bilibili.com"]';
  var ACTIONS_SEL = 'bili-comment-action-buttons-renderer';

  /* ------------------------------ 状态（仅内存） ------------------------------ */
  var locByMid = new Map();        // mid -> 归属地展示文本
  var rows = new Map();            // rowEl -> { chip, mid, resolved, skip }
  var articleLocByCv = new Map();  // cv -> 归属地展示文本
  var capturedTarget = null;       // 页面自身评论请求的 { type, oid }（不猜测）
  var fetchTried = new Set();      // 已尝试过的补充请求
  var articleChip = null;
  var observedRoots = new WeakSet();
  var scanTimer = 0;
  var commentFetchTimer = 0;
  var ownFetchUrls = new Set();    // 脚本自己发起的请求 URL，不重复解析

  /* --------------------------- 文本工具 --------------------------- */

  function noop() {}

  function cleanText(s) {
    return String(s == null ? '' : s)
      .replace(/[\u200b-\u200f\ufeff]/g, '') // 零宽字符
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 展示文本 = 返回值原样，仅规范化冒号/前缀，不改变语义、不做推断
  function formatLoc(raw) {
    var s = cleanText(raw);
    if (!s) return '';
    if (/属地/.test(s)) return s.replace(/^(IP\s*)?属地\s*[：:]\s*/, 'IP属地：');
    return 'IP属地：' + s;
  }

  function pickLoc(obj) {
    if (!obj || typeof obj !== 'object') return '';
    var rc = obj.reply_control || obj.replyControl || null;
    var cands = [rc && rc.location, rc && rc.ip_location, obj.ip_location];
    for (var i = 0; i < cands.length; i++) {
      if (typeof cands[i] === 'string' && cleanText(cands[i])) return cands[i];
    }
    // 顶层 location 字段噪音多（URL、坐标等），仅接受带“属地”字样的值
    if (typeof obj.location === 'string' && /属地/.test(obj.location)) return obj.location;
    return '';
  }

  function midOfObj(obj) {
    if (!obj || typeof obj !== 'object') return '';
    var m = obj.mid != null ? obj.mid
      : obj.member && obj.member.mid != null ? obj.member.mid
      : obj.author && obj.author.mid != null ? obj.author.mid
      : obj.uid != null ? obj.uid
      : '';
    return m == null || m === '' ? '' : String(m);
  }

  /* --------------------- 深度遍历（含 Shadow DOM） --------------------- */

  function walkDeep(root, fn) {
    if (!root) return;
    var stack = [root];
    while (stack.length) {
      var node = stack.pop();
      if (!node) continue;
      if (node.nodeType === 1) {
        fn(node);
        if (node.shadowRoot) stack.push(node.shadowRoot);
      }
      var kids = node.children;
      if (kids) {
        for (var i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
      }
    }
  }

  function deepQueryAll(root, sel) {
    var out = [];
    walkDeep(root, function (el) {
      try {
        if (el.matches(sel)) out.push(el);
      } catch (e) {}
    });
    return out;
  }

  function deepQuery(root, sel) {
    var found = null;
    walkDeep(root, function (el) {
      if (found) return;
      try {
        if (el.matches(sel)) found = el;
      } catch (e) {}
    });
    return found;
  }

  // 文本提取跳过脚本自己插入的标签（避免把灰色占位当成页面原生标签）；
  // 需要同时遍历 shadow DOM（Fragment/ShadowRoot 节点类型不是元素）。
  function deepTextNoChips(root) {
    var out = '';
    (function rec(n) {
      if (!n) return;
      if (n.nodeType === 3) { out += n.data; return; }
      if (n.getAttribute && n.getAttribute(MARK) != null) return;
      if (n.shadowRoot) rec(n.shadowRoot);
      var kids = n.childNodes;
      for (var i = 0; i < kids.length; i++) rec(kids[i]);
    })(root);
    return out;
  }

  function isRowElement(el) {
    try {
      return el.nodeType === 1 && el.matches(ROW_SEL);
    } catch (e) {
      return false;
    }
  }

  // 从 el 向上（含 shadow host）找所属评论行；若中途先遇到别的行则不属于 row
  function belongsToRow(el, row) {
    var n = el;
    for (var i = 0; i < 30 && n; i++) {
      if (n === row) return true;
      if (isRowElement(n)) return false;
      n = n.parentElement || (n.parentNode && n.parentNode.host) || null;
    }
    return false;
  }

  /* ----------------------- 数据层：归属地记忆 ----------------------- */

  function rememberLoc(mid, raw) {
    var loc = formatLoc(raw);
    if (!mid || !loc) return;
    if (locByMid.get(mid) === loc) return;
    locByMid.set(mid, loc);
    updatePendingRows();
  }

  // 递归扫描任意 JSON 载荷，收集 mid -> 归属地（容错字段位置变化）
  function scanPayload(root) {
    if (!root || typeof root !== 'object') return;
    var budget = 40000;
    var stack = [root];
    while (stack.length && budget-- > 0) {
      var n = stack.pop();
      if (!n || typeof n !== 'object') continue;
      if (Array.isArray(n)) {
        for (var i = 0; i < n.length; i++) stack.push(n[i]);
        continue;
      }
      var loc = pickLoc(n);
      if (loc) rememberLoc(midOfObj(n), loc);
      if (n.member && typeof n.member === 'object') {
        var lm = pickLoc(n.member);
        if (lm) rememberLoc(midOfObj(n.member) || midOfObj(n), lm);
      }
      for (var k in n) {
        if (Object.prototype.hasOwnProperty.call(n, k)) {
          var v = n[k];
          if (v && typeof v === 'object') stack.push(v);
        }
      }
    }
    updatePendingRows();
  }

  // 兜底数据源：组件实例挂载的评论数据对象（页面框架内部对象，只读）
  function pickProps(el) {
    if (!el || el.nodeType !== 1) return null;
    try {
      var cands = [el.data, el.reply, el.subReply];
      var vue = el.__vue__;
      if (vue && vue.vnode && vue.vnode.props) {
        var p = vue.vnode.props;
        cands.push(p.reply, p.subReply, p.data);
      }
      for (var i = 0; i < cands.length; i++) {
        if (cands[i] && typeof cands[i] === 'object') return cands[i];
      }
    } catch (e) {}
    return null;
  }

  // 行级数据：先看行元素本身，再看行内操作区组件（且必须确实属于本行）
  function rowProps(row, scope) {
    var p = pickProps(row);
    if (p) return p;
    try {
      var act = deepQuery(scope, ACTIONS_SEL);
      if (act && belongsToRow(act, row)) return pickProps(act);
    } catch (e) {}
    return null;
  }

  function locFromProps(row, scope) {
    var p = rowProps(row, scope);
    return p ? pickLoc(p) : '';
  }

  function midFromProps(row, scope) {
    var p = rowProps(row, scope);
    return p ? midOfObj(p) : '';
  }

  /* --------------------------- 芯片 UI --------------------------- */

  function createChip() {
    var el = document.createElement('span');
    el.setAttribute(MARK, '1');
    el.style.cssText =
      'display:inline-block;margin-left:8px;padding:0 6px;border-radius:2px;' +
      'font-size:12px;line-height:18px;white-space:nowrap;vertical-align:middle;' +
      'user-select:none;pointer-events:none;';
    return el;
  }

  function setChipValue(chip, loc) {
    if (loc) {
      chip.textContent = loc;
      chip.style.background = 'rgba(0,161,214,0.08)';
      chip.style.color = '#00A1D6';
    } else {
      // 静默降级：灰色占位，可识别但不打扰
      chip.textContent = 'IP属地：—';
      chip.style.background = 'rgba(145,149,161,0.10)';
      chip.style.color = '#919599';
    }
  }

  function hasMarkedChild(el) {
    if (!el || !el.getAttribute) return false;
    return el.getAttribute(MARK) != null;
  }

  // 在“插入行”范围内找已有芯片（只看锚点同级/容器直接子级，
  // 避免把楼中楼的芯片误认为楼主行的芯片）
  function findHostedChip(host, scope) {
    var lists = [];
    if (host) lists.push(host.children);
    if (scope && scope !== host) lists.push(scope.children);
    for (var li = 0; li < lists.length; li++) {
      var kids = lists[li];
      if (!kids) continue;
      for (var i = 0; i < kids.length; i++) {
        if (hasMarkedChild(kids[i])) return kids[i];
      }
    }
    return null;
  }

  /* ------------------------ 评论行增强 ------------------------ */

  function rowScope(row) {
    var sr = row.shadowRoot;
    if (sr) return sr.querySelector('#comment') || sr;
    return row;
  }

  function midOfScope(scope) {
    var a = deepQuery(scope, AUTHOR_LINK_SEL);
    var href = a ? a.getAttribute('href') || '' : '';
    var m = href.match(/space\.bilibili\.com\/(\d+)/);
    return m ? m[1] : '';
  }

  // 插入锚点：元信息行内的时间元素优先。
  // 搜索范围取行的整个 shadow root：现代评论行的 #pubdate 位于操作区组件的
  // shadow 内（#comment 作用域之外）；用户名兜底锚点则收窄在 #comment 作用域内。
  function anchorFor(row) {
    var root = row.shadowRoot || row;
    return (
      deepQuery(root, TIME_SEL) ||
      deepQuery(root, PUBDATE_SEL) ||
      deepQuery(rowScope(row), USER_INFO_SEL) ||
      null
    );
  }

  // 泛化行（仅 [data-rpid] 命中）若内部还有别的行，视为外层容器，跳过，
  // 避免与真实行重复处理；类名/自定义元素命中的行（含嵌套楼中楼）始终处理。
  function isSkippableWrapper(row) {
    if (row.matches(SPECIFIC_ROW_SEL)) return false;
    var nested = false;
    walkDeep(row, function (el) {
      if (nested || el === row) return;
      if (isRowElement(el)) nested = true;
    });
    return nested;
  }

  function enhanceRow(row) {
    var st = rows.get(row);
    if (st && st.skip) return;
    if (isSkippableWrapper(row)) {
      rows.set(row, { skip: true });
      return;
    }

    var scope = rowScope(row);
    if (!scope) return;

    if (!st) st = { chip: null, mid: '', resolved: false, skip: false };
    var anchor = anchorFor(row);
    var host = (anchor && anchor.parentElement) || scope;

    // 页面原生已展示 IP 属地 → 不重复插入
    if (NATIVE_LABEL_RE.test(deepTextNoChips(host))) {
      if (st.chip && st.chip.parentNode) st.chip.parentNode.removeChild(st.chip);
      rows.set(row, { skip: true });
      return;
    }

    // 去重：插入范围内已有芯片则复用（覆盖组件重渲染、脚本重复扫描）
    var existing = findHostedChip(host, scope);
    if (existing && existing !== st.chip) {
      if (st.chip && st.chip.parentNode) st.chip.parentNode.removeChild(st.chip);
      st.chip = existing;
    }

    if (!st.mid) st.mid = midOfScope(scope) || midFromProps(row, scope);
    var loc = (st.mid && locByMid.get(st.mid)) || locFromProps(row, scope) || '';

    if (!st.chip || !st.chip.isConnected) {
      if (!st.chip) st.chip = createChip();
      if (anchor && anchor.parentNode) {
        anchor.insertAdjacentElement('afterend', st.chip);
      } else {
        try { scope.appendChild(st.chip); } catch (e) { return; }
      }
    }
    setChipValue(st.chip, loc);
    st.resolved = !!loc;
    rows.set(row, st);

    if (!loc) scheduleCommentFetch();
  }

  function updatePendingRows() {
    var it = rows.entries();
    var step;
    while (!(step = it.next()).done) {
      var row = step.value[0];
      var st = step.value[1];
      if (st.skip || st.resolved || !st.chip || !st.chip.isConnected) continue;
      var scope = rowScope(row);
      var loc = (st.mid && locByMid.get(st.mid)) || locFromProps(row, scope) || '';
      if (loc) {
        setChipValue(st.chip, loc);
        st.resolved = true;
      }
    }
  }

  /* ------------------ 补充网络请求（仅声明域名） ------------------ */

  function fetchJSON(url) {
    if (typeof fetch !== 'function') return Promise.reject(new Error('fetch unavailable'));
    ownFetchUrls.add(url);
    return fetch(url, { method: 'GET', credentials: 'include' }).then(function (res) {
      if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status));
      return res.json();
    });
  }

  function parseQuery(url) {
    var out = {};
    try {
      var u = new URL(url, location.href);
      u.searchParams.forEach(function (v, k) { out[k] = v; });
    } catch (e) {}
    return out;
  }

  // 记录页面自身评论请求的 type/oid：补充请求沿用页面参数，绝不猜测
  function noteRequestURL(rawUrl) {
    var url = String(rawUrl || '');
    if (ownFetchUrls.has(url)) return;
    if (!/api\.bilibili\.com\/x\/v2\/reply(\/reply|\/wbi\/main)?\?/.test(url)) return;
    var q = parseQuery(url);
    if (q.type && q.oid) capturedTarget = { type: q.type, oid: q.oid };
  }

  function pageAid() {
    try {
      var s = window.__INITIAL_STATE__;
      var a = s && (s.aid || (s.videoData && s.videoData.aid) || (s.epInfo && s.epInfo.aid));
      if (a) return String(a);
    } catch (e) {}
    var m = location.search.match(/[?&](?:avid|aid)=(\d+)/);
    return m ? m[1] : '';
  }

  function pageBvid() {
    var m = location.pathname.match(/\/(BV[0-9A-Za-z]+)/);
    return m ? m[1] : '';
  }

  // 评论接口目标：优先页面自身请求参数（精确），其次视频页状态/URL，
  // 最后用公开 view 接口解析 aid；都不是则返回 null（不猜测）
  function resolveTarget() {
    if (capturedTarget) return Promise.resolve(capturedTarget);
    var aid = pageAid();
    if (aid) return Promise.resolve({ type: '1', oid: aid });
    var bvid = pageBvid();
    if (!bvid) return Promise.resolve(null);
    return fetchJSON('https://api.bilibili.com/x/web-interface/view?bvid=' + encodeURIComponent(bvid))
      .then(function (j) {
        var a = j && j.data && j.data.aid;
        return a ? { type: '1', oid: String(a) } : null;
      })
      .catch(function () { return null; });
  }

  function ingestRepliesPayload(j, target) {
    scanPayload(j);
    // 楼中楼：仅对带回复数的少量主评论补拉，网络失败静默
    try {
      if (!target) return;
      var data = (j && j.data) || {};
      var roots = [].concat(
        data.replies || [],
        data.top_replies || [],
        (data.top && data.top.replies) || [],
        (data.cursor && data.cursor.top_replies) || []
      );
      var queued = 0;
      for (var i = 0; i < roots.length && queued < 3; i++) {
        var r = roots[i];
        if (!r || !(Number(r.rcount) > 0)) continue;
        var rootId = r.rpid_str || r.rpid;
        if (!rootId) continue;
        var key = 'sub:' + target.type + ':' + target.oid + ':' + rootId;
        if (fetchTried.has(key)) continue;
        fetchTried.add(key);
        queued++;
        (function (type, oid, rid) {
          fetchJSON('https://api.bilibili.com/x/v2/reply/reply?type=' + encodeURIComponent(type) +
              '&oid=' + encodeURIComponent(oid) + '&root=' + encodeURIComponent(rid) + '&ps=10&pn=1')
            .then(function (sub) { scanPayload(sub); })
            .catch(noop);
        })(target.type, target.oid, rootId);
      }
    } catch (e) {}
  }

  function scheduleCommentFetch() {
    if (commentFetchTimer) return;
    commentFetchTimer = setTimeout(function () {
      commentFetchTimer = 0;
      tryCommentFetch();
    }, 600);
  }

  function tryCommentFetch() {
    var pending = false;
    var it = rows.values();
    var step;
    while (!(step = it.next()).done) {
      var st = step.value;
      if (!st.skip && !st.resolved && st.chip && st.chip.isConnected) { pending = true; break; }
    }
    if (!pending) return;
    resolveTarget().then(function (t) {
      if (!t) return;
      var key = 'main:' + t.type + ':' + t.oid;
      if (fetchTried.has(key)) return;
      fetchTried.add(key);
      return fetchJSON('https://api.bilibili.com/x/v2/reply?type=' + encodeURIComponent(t.type) +
          '&oid=' + encodeURIComponent(t.oid) + '&pn=1&ps=20&sort=2')
        .then(function (j) { ingestRepliesPayload(j, t); })
        .catch(noop);
    });
  }

  /* ------------------ 专栏 / 动态文章（cv）增强 ------------------ */

  function detectCv() {
    var m = location.pathname.match(/\/(?:read\/)?cv(\d+)/);
    if (m) return m[1];
    try {
      var s = window.__INITIAL_STATE__;
      var basic = s && s.detail && s.detail.basic;
      if (basic && basic.article_type === 0 && basic.rid_str) return String(basic.rid_str);
    } catch (e) {}
    return '';
  }

  function articleAnchor() {
    var publishText = deepQuery(document, '.article-detail .publish-text') || deepQuery(document, '.publish-text');
    if (publishText) return { el: publishText, pos: 'afterend' };
    var pub = deepQuery(document, '.opus-module-author__pub');
    if (pub) return { el: pub, pos: 'afterbegin' };
    return null;
  }

  function ensureArticle() {
    var cv = detectCv();
    if (!cv) return;
    var a = articleAnchor();
    if (!a) return; // 等待后续扫描（SPA / 异步渲染）

    var host = a.el;
    var existing = findHostedChip(host, host.parentElement) || deepQuery(host, CHIP_SEL);
    if (!articleChip || !articleChip.isConnected) articleChip = existing || createChip();
    if (!articleChip.parentNode) {
      try { a.el.insertAdjacentElement(a.pos, articleChip); } catch (e) { return; }
    }

    var loc = articleLocByCv.get(cv) || '';
    setChipValue(articleChip, loc); // 无数据时即灰色占位（静默降级）
    if (loc) return;

    var key = 'cv:' + cv;
    if (fetchTried.has(key)) return;
    fetchTried.add(key);
    fetchJSON('https://api.bilibili.com/x/article/viewinfo?id=' + encodeURIComponent(cv))
      .then(function (j) {
        var raw = j && j.data && j.data.location;
        var formatted = formatLoc(raw || '');
        if (formatted) {
          articleLocByCv.set(cv, formatted);
          if (articleChip && articleChip.isConnected && detectCv() === cv) setChipValue(articleChip, formatted);
        }
        // 字段为空（未公开）→ 保持灰色占位，静默降级
      })
      .catch(noop); // 网络失败 → 保持灰色占位，静默降级
  }

  /* ---------------------- 页面网络捕获（只读） ---------------------- */

  function handlePayloadText(text) {
    if (!text || text.length > 6000000) return;
    try {
      scanPayload(JSON.parse(text));
    } catch (e) {}
  }

  function installNetworkCapture() {
    try {
      if (typeof fetch === 'function') {
        var origFetch = fetch;
        window.fetch = function (input, init) {
          var url = '';
          try {
            url = typeof input === 'string' ? input : (input && input.url) || '';
          } catch (e) {}
          var isOwn = ownFetchUrls.has(url);
          if (url) noteRequestURL(url);
          var p = origFetch.apply(this, arguments);
          try {
            if (url && !isOwn && /bilibili\.com/.test(url)) {
              p.then(function (res) {
                try {
                  if (!res || !res.ok) return;
                  res.clone().json().then(scanPayload).catch(noop);
                } catch (e) {}
              }).catch(noop);
            }
          } catch (e) {}
          return p;
        };
      }
    } catch (e) {}

    try {
      var origOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (method, url) {
        try { this.__biliIplocUrl = url; } catch (e) {}
        return origOpen.apply(this, arguments);
      };
      var origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function () {
        try {
          this.addEventListener('load', function () {
            try {
              var url = String(this.__biliIplocUrl || '');
              if (!/bilibili\.com/.test(url)) return;
              noteRequestURL(url);
              if (this.responseType && this.responseType !== 'text' && this.responseType !== '') return;
              handlePayloadText(this.responseText);
            } catch (e) {}
          });
        } catch (e) {}
        return origSend.apply(this, arguments);
      };
    } catch (e) {}
  }

  /* ---------------------- 扫描调度与 SPA 适配 ---------------------- */

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(function () {
      scanTimer = 0;
      scan();
    }, 300);
  }

  function scan() {
    // 清理失效行，保持内存可控
    var it = rows.entries();
    var step;
    while (!(step = it.next()).done) {
      if (!step.value[0].isConnected) rows.delete(step.value[0]);
    }

    var found = deepQueryAll(document, ROW_SEL);
    for (var i = 0; i < found.length; i++) {
      try {
        enhanceRow(found[i]);
      } catch (e) {}
    }

    // 组件内部渲染对主文档观察器不可见：为新发现的 shadow root 挂观察器
    walkDeep(document, function (el) {
      if (el.shadowRoot) observeRoot(el.shadowRoot);
    });

    try { ensureArticle(); } catch (e) {}
  }

  function observeRoot(root) {
    if (!root || observedRoots.has(root)) return;
    observedRoots.add(root);
    try {
      new MutationObserver(function () { scheduleScan(); })
        .observe(root, { childList: true, subtree: true });
    } catch (e) {}
  }

  function installRouteHooks() {
    function onRoute() {
      // 路由切换后重置与页面绑定的解析状态并重新扫描；
      // 扫描/插入按标记去重，重复执行不会重复插入
      capturedTarget = null;
      articleChip = null;
      scheduleScan();
    }
    try {
      var origPush = history.pushState;
      history.pushState = function () {
        var r = origPush.apply(this, arguments);
        onRoute();
        return r;
      };
      var origReplace = history.replaceState;
      history.replaceState = function () {
        var r = origReplace.apply(this, arguments);
        onRoute();
        return r;
      };
    } catch (e) {}
    addEventListener('popstate', onRoute);
    addEventListener('hashchange', onRoute);
  }

  function installShadowHook() {
    try {
      var origAttach = Element.prototype.attachShadow;
      if (typeof origAttach !== 'function') return;
      Element.prototype.attachShadow = function (init) {
        var sr = origAttach.call(this, init);
        try { observeRoot(sr); } catch (e) {}
        scheduleScan();
        return sr;
      };
    } catch (e) {}
  }

  /* ---------------------------- 启动 ---------------------------- */

  installNetworkCapture(); // 尽早拦截，覆盖页面首屏接口响应
  installShadowHook();
  installRouteHooks();
  observeRoot(document);

  scheduleScan();
  setInterval(scheduleScan, 3000); // 低频兜底重扫（幂等，不会重复插入）
})();
