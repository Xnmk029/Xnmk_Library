// ==UserScript==
// @name         哔哩哔哩评论 IP 属地（Lit / Vue 3 / bbComment）
// @namespace    https://www.bilibili.com/userscripts/bili-comment-ip-location
// @version      1.0.0
// @description  在 B 站电脑端每条主评论与每条楼中楼评论的发布时间旁，展示该条评论 reply_control.location 返回的公开 IP 属地。仅被动观察页面已有的 DOM 与响应；不发起任何网络请求，不写入任何本地存储。
// @author       bili-comment-ip-location
// @match        https://www.bilibili.com/*
// @match        https://bilibili.com/*
// @run-at       document-start
// @grant        none
// @note         本脚本不发起任何额外网络请求：不使用 GM_xmlhttpRequest / fetch / XMLHttpRequest /
//               sendBeacon / WebSocket / EventSource / new Image 等主动请求手段。仅通过 Response.clone()
//               被动读取页面自身已经取回的 GET 响应（不吞掉页面响应、不改变其异常语义）。
// @note         不写入 cookie / localStorage / sessionStorage / IndexedDB / GM 存储，不申请剪贴板等无关权限。
// ==/UserScript==

/*
 * 设计说明（对应题面 / 契约）
 * ---------------------------------------------------------------------------
 * 1. 数据来源：只读取单条评论自身的 reply_control.location。
 *    不使用用户名、UID、member.location（资料城市）、评论正文里的属地字样，
 *    也不使用评论顶层的通用 location 字段；不显示完整 IP、经纬度或实时位置。
 * 2. 标识：需要跨对象关联时一律使用完整 rpid_str 字符串做键，绝不把大整数 ID 转成
 *    Number（避免 9007199254740992 这类 ID 被舍入）。
 * 3. 网络：脚本自身不发起任何请求（不使用 fetch / XMLHttpRequest / sendBeacon /
 *    new Image / WebSocket 等）。仅以 Response.clone() 被动读取页面自身已经取回的
 *    GET 响应做兜底关联；页面的 Promise 原样返回，既不吞掉响应也不改变异常语义。
 * 4. 存储：不写 cookie / localStorage / sessionStorage / IndexedDB / GM 存储，
 *    不申请剪贴板等任何额外权限；@grant none 只用于在页面上下文里观察 window.bbComment。
 * 5. 输出：属地字符串一律以 textContent 写入，绝不拼接 HTML，因此含 < > 也只当纯文本。
 * 6. 生命周期：document-start 注入；观察 document 与每个 Open Shadow Root（含稍后附加的、
 *    以及通过 attachShadow 钩子新建的），并提供低频兜底巡检，保证异步渲染、重复渲染、
 *    DOM 复用、SPA 路由切换后展示仍然正确。
 */

(function () {
  'use strict';

  /* ======================= 一、常量与工具 ======================= */

  var TAG_CLASS = 'bili-ip-region-tag';
  var TAG_ATTR = 'data-bili-ip-loc';
  var STATE_ATTR = 'data-bili-ip-state';
  var SLOT_ATTR = 'data-bili-ip-slot';
  var PREFIX = 'IP属地：';
  var PENDING_TEXT = 'IP属地：未获取';
  var BASE_STYLE =
    'display:inline-block;max-width:12em;min-width:0;overflow:hidden;' +
    'text-overflow:ellipsis;white-space:nowrap;vertical-align:baseline;' +
    'font-style:normal;font-weight:inherit;line-height:inherit;';
  var EMPTY_STYLE = 'color:#9499a0;';

  var MANAGED_TAGS = {
    'BILI-COMMENTS': 1,
    'BILI-COMMENT-THREAD-RENDERER': 1,
    'BILI-COMMENT-RENDERER': 1,
    'BILI-COMMENT-REPLY-RENDERER': 1,
    'BILI-COMMENT-ACTION-BUTTONS-RENDERER': 1
  };
  var RENDERER_TAGS = { 'BILI-COMMENT-RENDERER': 1, 'BILI-COMMENT-REPLY-RENDERER': 1 };
  var ACTION_TAGS = { 'BILI-COMMENT-ACTION-BUTTONS-RENDERER': 1 };
  var MANAGED_SELECTOR =
    'bili-comments,bili-comment-thread-renderer,bili-comment-renderer,' +
    'bili-comment-reply-renderer,bili-comment-action-buttons-renderer';
  /* 可取数据的组件：renderer 与操作栏 */
  var QUERY_MANAGED =
    'bili-comment-renderer,bili-comment-reply-renderer,bili-comment-action-buttons-renderer';

  /* Vue / bbComment 旧形态使用的选择器（契约中给出的结构） */
  var ITEM_SELECTOR = '.reply-item,.sub-reply-item,.reply-wrap';
  var INFO_SELECTOR = '.reply-info,.sub-reply-info,.info';
  var TIME_SELECTOR = '.reply-time,.sub-reply-time';
  var CONTENT_SELECTOR = '.comment-body,.reply-content,.content,.reply-content-container';
  var SUB_ITEM_SELECTOR = '.sub-reply-item,.sub-reply-time';
  var NATIVE_SELECTOR = '#location,.location,[class~="ip-location"],[data-location]';
  /* bbComment 的楼中楼判定：自身是子项或位于子项容器内部 */
  var SUB_CONTEXT_SELECTOR = '.sub-reply-item,.sub-reply-list,.sub-reply-container,' +
    '.sub-reply-content,[class*="sub-reply"]';

  /* 判定「已经是属地文本」的宽松模式，只用于识别原生标签，不用于取值 */
  var IP_TEXT_RE = /(IP\s*属地|归属地)/;
  /* 去掉接口值里自带的 “IP属地：” 前缀，避免出现 “IP属地：IP属地：广东” */
  var IP_PREFIX_RE = /^(?:IP\s*属地|IP\s*归属地|归属地|属地)\s*[:：]?\s*/i;

  var OBSERVE_OPTS = { childList: true, subtree: true, attributes: true };
  var SWEEP_INTERVAL_MIN = 600;    /* 兜底巡检的最短间隔（毫秒） */
  var SWEEP_INTERVAL_MAX = 5000;   /* 页面长时间无变化时放宽到的间隔（毫秒） */
  var REFRESH_INTERVAL = 250;      /* 已跟踪条目的数据刷新间隔（毫秒） */
  var SWEEP_DEBOUNCE = 60;         /* 变更后合并巡检的延迟（毫秒） */
  var MAX_OBSERVED_ROOTS = 400;
  var MAX_TRACKERS = 2000;

  function isElement(node) {
    return !!node && typeof node === 'object' && node.nodeType === 1;
  }
  function tagNameOf(node) {
    if (!isElement(node)) return '';
    var name = node.tagName;
    return typeof name === 'string' ? name.toUpperCase() : '';
  }
  function parentOrHost(node) {
    if (!node) return null;
    if (node.nodeType === 11) return node.host || null; /* ShadowRoot -> 宿主 */
    return node.parentNode || null;
  }
  function safeGet(obj, key) {
    if (obj === null || obj === undefined) return undefined;
    try { return obj[key]; } catch (e) { return undefined; }
  }
  /* 空白折叠 + trim：把位置字符串转成稳定的纯文本 */
  function normText(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/[\s\u00a0\u200b\u200c\u200d\ufeff]+/g, ' ').trim();
  }
  /* 只用字符串形态的完整 ID；number 仅在安全范围内转字符串，不做反向 Number 转换 */
  function idToString(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'number' && isFinite(value) && Math.abs(value) <= 9007199254740991) {
      return String(value);
    }
    return '';
  }
  function matchesSelector(el, selector) {
    if (!isElement(el) || typeof el.matches !== 'function') return false;
    try { return el.matches(selector); } catch (e) { return false; }
  }
  function queryAll(scope, selector) {
    if (!scope || typeof scope.querySelectorAll !== 'function') return [];
    try {
      var list = scope.querySelectorAll(selector);
      var out = [];
      for (var i = 0; i < list.length; i++) out.push(list[i]);
      return out;
    } catch (e) { return []; }
  }
  function queryOne(scope, selector) {
    if (!scope || typeof scope.querySelector !== 'function') return null;
    try { return scope.querySelector(selector); } catch (e) { return null; }
  }
  function closestMatching(node, selector) {
    var current = node;
    var guard = 0;
    while (current && guard++ < 80) {
      if (isElement(current) && matchesSelector(current, selector)) return current;
      current = parentOrHost(current);
    }
    return null;
  }
  function safeRemove(node) {
    if (!isElement(node)) return;
    try { if (node.parentNode) node.parentNode.removeChild(node); } catch (e) { /* 忽略 */ }
  }
  /* 把标签放到锚点（时间元素）之后；已有标签位置不对时搬到正确位置 */
  function placeTag(tag, anchor, container) {
    if (!isElement(tag)) return;
    if (isElement(anchor) && isElement(anchor.parentNode)) {
      if (anchor.nextSibling !== tag || tag.parentNode !== anchor.parentNode) {
        try { anchor.parentNode.insertBefore(tag, anchor.nextSibling); } catch (e) { /* 忽略 */ }
      }
      return;
    }
    if (isElement(container) && tag.parentNode !== container) {
      try { container.appendChild(tag); } catch (e) { /* 忽略 */ }
    }
  }
  /* 移除容器内所有脚本标签，返回是否确实移除了内容（供自适应巡检判断变化） */
  function removeOurTagsReporting(container) {
    var had = ourTagsWithin(container).length > 0;
    removeOurTags(container);
    return had;
  }

  /* ======================= 二、属地文本处理 ======================= */

  function looksLikeReply(value) {
    if (!value || typeof value !== 'object') return false;
    try {
      return ('rpid_str' in value) || ('reply_control' in value) || ('rpid' in value) ||
        ('root_str' in value) || ('member' in value && 'content' in value);
    } catch (e) { return false; }
  }

  /* 只认 reply_control.location；其它任何字段都不作为证据 */
  function extractRawLocation(reply) {
    if (!reply || typeof reply !== 'object') return '';
    var control = safeGet(reply, 'reply_control');
    if (control && typeof control === 'object') {
      if (Array.isArray(control)) control = control.length ? control[0] : null;
      if (control && typeof control === 'object') control = safeGet(control, 'location');
    }
    if (Array.isArray(control)) control = control.length ? control[0] : '';
    return normText(control);
  }

  /* 去掉接口值自带前缀，得到纯属地主体 */
  function locationBody(raw) {
    var text = normText(raw);
    if (!text) return '';
    var matched = IP_PREFIX_RE.exec(text);
    return matched ? text.slice(matched[0].length).trim() : text;
  }

  /* ======================= 三、评论数据关联（仅用于兜底） ======================= */

  /* rpid_str -> reply 对象；键始终是完整字符串 ID */
  var registry = new Map();

  function rememberReply(reply) {
    if (!looksLikeReply(reply)) return;
    var id = idToString(safeGet(reply, 'rpid_str'));
    if (!id) id = idToString(safeGet(reply, 'rpid'));
    if (!id) return;
    if (registry.size > 5000) registry.clear();
    if (registry.get(id) !== reply) registry.set(id, reply);
  }

  function harvestReplies(payload) {
    var budget = 20000;
    (function walk(node, depth) {
      if (!node || typeof node !== 'object' || depth > 14 || budget <= 0) return;
      budget--;
      if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) walk(node[i], depth + 1);
        return;
      }
      if (looksLikeReply(node)) rememberReply(node);
      var keys;
      try { keys = Object.keys(node); } catch (e) { return; }
      for (var k = 0; k < keys.length; k++) {
        var child;
        try { child = node[keys[k]]; } catch (e) { continue; }
        if (child && typeof child === 'object') walk(child, depth + 1);
      }
    })(payload, 0);
  }

  /* ======================= 四、标签节点 ======================= */

  function isOurTag(node) {
    return isElement(node) && typeof node.hasAttribute === 'function' &&
      node.hasAttribute(TAG_ATTR);
  }

  function createTag() {
    var tag = document.createElement('span');
    tag.className = TAG_CLASS;
    tag.setAttribute(TAG_ATTR, '1');
    return tag;
  }

  /* 标签内容始终走 textContent：属地字符串含 < > 也只是纯文本 */
  function updateTag(tag, reply) {
    if (!isElement(tag)) return;
    var raw = extractRawLocation(reply);
    var body = locationBody(raw);
    var text = body ? (PREFIX + body) : PENDING_TEXT;
    if (tag.textContent !== text) tag.textContent = text;
    var state = body ? 'ready' : 'empty';
    if (tag.getAttribute(STATE_ATTR) !== state) {
      tag.setAttribute(STATE_ATTR, state);
      tag.style.cssText = state === 'empty' ? (BASE_STYLE + EMPTY_STYLE) : BASE_STYLE;
    }
    if (tag.getAttribute('title') !== text) tag.setAttribute('title', text);
  }

  function ourTagsWithin(scope) {
    if (!isElement(scope)) return [];
    var list = queryAll(scope, '[' + TAG_ATTR + ']');
    var out = [];
    for (var i = 0; i < list.length; i++) {
      if (isOurTag(list[i])) out.push(list[i]);
    }
    return out;
  }

  function removeOurTags(scope) {
    var tags = ourTagsWithin(scope);
    for (var i = 0; i < tags.length; i++) safeRemove(tags[i]);
  }

  /* ======================= 五、原生属地标签识别 ======================= */

  function isRendered(el) {
    if (!isElement(el)) return false;
    if (el.isConnected === false) return false;
    var win = el.ownerDocument && el.ownerDocument.defaultView;
    if (!win || typeof win.getComputedStyle !== 'function') return true;
    var style = null;
    try { style = win.getComputedStyle(el); } catch (e) { style = null; }
    if (!style) return true;
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  }

  function looksLikeNativeTag(el) {
    if (!isElement(el) || isOurTag(el)) return false;
    if (!isRendered(el)) return false;
    var text = normText(el.textContent);
    if (!text) return false;
    return IP_TEXT_RE.test(text);
  }

  /* 在给定容器（时间栏）里找页面自带的原生属地标签 */
  function findNativeTag(scope) {
    if (!isElement(scope)) return null;
    if (matchesSelector(scope, NATIVE_SELECTOR) && looksLikeNativeTag(scope)) return scope;
    var candidates = queryAll(scope, NATIVE_SELECTOR);
    for (var i = 0; i < candidates.length; i++) {
      if (looksLikeNativeTag(candidates[i])) return candidates[i];
    }
    return null;
  }

  /* 在评论条目范围内找原生标签：排除嵌套的其它评论，也排除正文里的同名节点 */
  function findNativeTagInItem(item, info) {
    var found = findNativeTag(info);
    if (found) return found;
    if (!isElement(item) || item === info) return null;
    var candidates = queryAll(item, NATIVE_SELECTOR);
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (isOurTag(el)) continue;
      if (closestMatching(el, ITEM_SELECTOR) !== item) continue;
      if (closestMatching(el, CONTENT_SELECTOR)) continue;
      if (looksLikeNativeTag(el)) return el;
    }
    return null;
  }

  /* 把标签放到锚点（时间元素）之后；已有标签位置不对时搬到正确位置 */
  function placeTag(tag, anchor, container) {
    if (!isElement(tag)) return;
    if (isElement(anchor) && isElement(anchor.parentNode)) {
      if (anchor.nextSibling !== tag || tag.parentNode !== anchor.parentNode) {
        try { anchor.parentNode.insertBefore(tag, anchor.nextSibling); } catch (e) { /* 忽略 */ }
      }
      return;
    }
    if (isElement(container) && tag.parentNode !== container) {
      try { container.appendChild(tag); } catch (e) { /* 忽略 */ }
    }
  }

  /* 把标签放进容器：有原生标签则让位，否则保证「恰好一个」脚本标签。
   * 返回 true 表示本次发生了新建/更新，供自适应巡检使用。 */
  function ensureTag(container, anchor, reply) {
    if (!isElement(container)) return false;
    if (findNativeTag(container)) return removeOurTagsReporting(container);
    var tags = ourTagsWithin(container);
    var changed = false;
    for (var i = 1; i < tags.length; i++) { safeRemove(tags[i]); changed = true; }
    var tag = tags.length ? tags[0] : null;
    if (!tag) {
      tag = createTag();
      changed = true;
      var parent = isElement(anchor) ? anchor.parentNode : null;
      if (isElement(parent)) parent.insertBefore(tag, anchor.nextSibling);
      else container.appendChild(tag);
    }
    var before = tag.textContent;
    placeTag(tag, anchor, container);
    updateTag(tag, reply);
    if (tag.textContent !== before) changed = true;
    return changed;
  }

  /* ======================= 五之二、已跟踪条目 =======================
   * 组件的数据变化不一定伴随 DOM 变更（例如只更新 .data 后调用 update()），
   * 因此对已处理过的条目做低成本的周期性重算，保证复用、换值与清空都能及时反映。 */

  var trackers = new Map();
  var MAX_TRACKERS = 2000;
  var TRACKER_FAST_LIMIT = 80;   /* 条目数不超过该值时不做降频 */
  var refreshTick = 0;

  function trackEntry(target, container, anchor, read, isSub) {
    if (!isElement(target) || !isElement(container)) return;
    if (trackers.size > MAX_TRACKERS) trackers.clear();
    var existing = trackers.get(target);
    if (existing && existing.container === container) {
      existing.anchor = anchor;
      existing.read = read;
      return;
    }
    trackers.set(target, {
      container: container, anchor: anchor, read: read, isSub: !!isSub, stable: 0
    });
  }

  /* DOM 发生变化时让所有跟踪项恢复全速刷新（例如 Vue 复用了列表项） */
  function resetTrackerStability() {
    trackers.forEach(function (entry) { entry.stable = 0; });
  }

  function refreshTrackers() {
    if (!trackers.size) return false;
    refreshTick++;
    var stale = [];
    var changed = false;
    /* 条目不多时（常见页面）始终全速刷新，保证数据变更能立刻反映；
     * 只有超长列表才让稳定下来的条目降频，避免长期占用主线程。 */
    var throttle = trackers.size > TRACKER_FAST_LIMIT;
    trackers.forEach(function (entry, target) {
      if (!target.isConnected || !entry.container.isConnected) {
        stale.push(target);
        return;
      }
      if (throttle && entry.stable >= 4 && (refreshTick + entry.stable) % 2 !== 0) return;
      try {
        var reply = typeof entry.read === 'function' ? entry.read() : null;
        var entryChanged = syncTag(entry.container, entry.anchor, reply);
        entry.stable = entryChanged ? 0 : (entry.stable + 1);
        if (entryChanged) changed = true;
      } catch (e) { /* 单个条目失败不影响其它 */ }
    });
    for (var i = 0; i < stale.length; i++) { trackers.delete(stale[i]); changed = true; }
    return changed;
  }

  /* 同步一个容器的标签：保留原生标签、保证恰好一个脚本标签、按最新数据更新文字。
   * 返回 true 表示本次发生了新建/移除/文本变化，供自适应巡检判断页面是否仍在变化。 */
  function syncTag(container, anchor, reply) {
    if (!isElement(container)) return false;
    if (findNativeTag(container)) return removeOurTagsReporting(container);
    var tags = ourTagsWithin(container);
    var tag = tags.length ? tags[0] : null;
    var changed = false;
    for (var i = 1; i < tags.length; i++) { safeRemove(tags[i]); changed = true; }
    if (!tag) {
      tag = createTag();
      changed = true;
      if (isElement(anchor) && isElement(anchor.parentNode)) {
        anchor.parentNode.insertBefore(tag, anchor.nextSibling);
      } else {
        container.appendChild(tag);
      }
    }
    var before = tag.textContent;
    placeTag(tag, anchor, container);
    updateTag(tag, reply);
    if (tag.textContent !== before) changed = true;
    return changed;
  }

  /* ======================= 六、组件数据查找 ======================= */

  /* 读取元素自身挂载的数据：renderer.__data、操作栏 .data 等 */
  function ownData(el) {
    if (!isElement(el)) return undefined;
    var data = safeGet(el, '__data');
    if (data && typeof data === 'object') {
      if (looksLikeReply(data)) return data;
      var inner = safeGet(data, 'value');
      if (looksLikeReply(inner)) return inner;
    }
    var direct = safeGet(el, 'data');
    if (looksLikeReply(direct)) return direct;
    return undefined;
  }

  function nearestManaged(node) {
    var current = node;
    var guard = 0;
    while (current && guard++ < 80) {
      if (isElement(current) && MANAGED_TAGS[tagNameOf(current)]) return current;
      current = parentOrHost(current);
    }
    return null;
  }

  function nearestRenderer(node) {
    var current = node;
    var guard = 0;
    while (current && guard++ < 40) {
      if (isElement(current) && RENDERER_TAGS[tagNameOf(current)]) return current;
      if (isElement(current) && tagNameOf(current) === 'BILI-COMMENT-THREAD-RENDERER') return null;
      current = parentOrHost(current);
    }
    return null;
  }

  /* 组件形态的数据查找：操作栏 -> 所属 renderer -> renderer 内其它组件
   * 不向 thread renderer 之上取数，避免把主评论属地当作楼中楼属地。 */
  function findComponentReply(el) {
    var data = ownData(el);
    if (data) return data;
    var renderer = nearestRenderer(el);
    if (renderer) {
      data = ownData(renderer);
      if (data) return data;
      var root = renderer.shadowRoot;
      if (root) {
        var inside = queryAll(root, QUERY_MANAGED);
        for (var i = 0; i < inside.length; i++) {
          data = ownData(inside[i]);
          if (data) return data;
        }
      }
    }
    return undefined;
  }

  /* ======================= 七、Open Shadow DOM 形态 ======================= */

  var observedRootSet = new WeakSet();
  var observedRoots = [];
  var observer = null;

  function observeRoot(root) {
    if (!root || !observer || observedRootSet.has(root)) return;
    observedRootSet.add(root);
    /* 始终监听；只对前若干个根做兜底重扫，避免无限增长 */
    try { observer.observe(root, OBSERVE_OPTS); } catch (e) { /* 忽略 */ }
    if (observedRoots.length < MAX_OBSERVED_ROOTS) observedRoots.push(root);
  }

  function ensureObservedHost(el) {
    if (!isElement(el)) return null;
    var root = el.shadowRoot;
    if (!root) return null;
    observeRoot(root);
    return root;
  }

  function findShadowPubdate(host) {
    var root = host && host.shadowRoot;
    if (!root) return null;
    var footer = queryOne(root, '#footer');
    if (footer) {
      var inside = queryOne(footer, '#pubdate');
      if (inside) return { pubdate: inside, container: footer };
    }
    var loose = queryOne(root, '#pubdate');
    if (loose) {
      var container = isElement(loose.parentNode) ? loose.parentNode : root;
      return { pubdate: loose, container: container };
    }
    return null;
  }

  function handleActionBar(host) {
    var found = findShadowPubdate(host);
    var container = null;
    var pubdate = null;
    if (found) {
      container = found.container;
      pubdate = found.pubdate;
    } else {
      /* 变体：时间栏直接位于宿主 light DOM */
      var light = queryOne(host, '#pubdate');
      if (!light) return false;
      pubdate = light;
      container = isElement(light.parentNode) ? light.parentNode : host;
    }
    /* 原生属地可能出现在操作栏 shadow root 的其它位置 */
    if (!findNativeTag(container)) {
      var root = host.shadowRoot;
      if (root && findNativeTag(root)) {
        return removeOurTagsReporting(container);
      }
    }
    var changed = ensureTag(container, pubdate, findComponentReply(host));
    trackEntry(host, container, pubdate, function () { return findComponentReply(host); }, false);
    return changed;
  }

  /* 少数变体把 #pubdate 直接放在 renderer 的 shadow root 里 */
  function handleRendererPubdate(host) {
    var root = host.shadowRoot;
    if (!root) return false;
    var pubdate = queryOne(root, '#pubdate');
    if (!pubdate) return false;
    var container = isElement(pubdate.parentNode) ? pubdate.parentNode : null;
    if (!container) return false;
    var changed = ensureTag(container, pubdate, findComponentReply(host));
    trackEntry(host, container, pubdate, function () { return findComponentReply(host); }, false);
    return changed;
  }

  function handleManagedElement(el) {
    if (!isElement(el)) return false;
    ensureObservedHost(el);
    var name = tagNameOf(el);
    var changed = false;
    if (ACTION_TAGS[name]) changed = handleActionBar(el) || changed;
    if (RENDERER_TAGS[name]) changed = handleRendererPubdate(el) || changed;
    return changed;
  }

  /* ======================= 八、Vue 3 / Vue 2 数据查找 ======================= */

  function vuePropsOf(instance) {
    if (!instance || typeof instance !== 'object') return null;
    var props = null;
    var collected = null;
    var sources = [safeGet(instance, 'props'), safeGet(safeGet(instance, 'vnode'), 'props'),
      safeGet(instance, '$props'), safeGet(safeGet(instance, 'proxy'), '$props')];
    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];
      if (!source || typeof source !== 'object') continue;
      if (!collected) collected = {};
      var names = ['reply', 'subReply', 'rootReply'];
      for (var k = 0; k < names.length; k++) {
        if (collected[names[k]]) continue;
        var value = safeGet(source, names[k]);
        if (value && typeof value === 'object') collected[names[k]] = value;
      }
    }
    props = collected;
    return props;
  }

  /* 元素上的 Vue 实例：Vue 3 __vueParentComponent、兼容钩子 __vue__（含 Proxy({_:c})）、Vue 2 实例 */
  function vueInstanceOn(el) {
    if (!isElement(el)) return null;
    var instance = safeGet(el, '__vueParentComponent');
    if (instance && typeof instance === 'object') return instance;
    var hook = safeGet(el, '__vue__');
    if (hook && typeof hook === 'object') {
      var inner = safeGet(hook, '_');
      return (inner && typeof inner === 'object') ? inner : hook;
    }
    var legacy = safeGet(el, '__data');
    if (legacy && typeof legacy === 'object' &&
      (safeGet(legacy, '$options') || safeGet(legacy, 'proxy'))) return legacy;
    return null;
  }

  /* 兜底：从 __vue_app__ 的应用实例树里按 vnode.el 反查组件 */
  function vueInstanceByTree(el) {
    var node = el;
    var app = null;
    var guard = 0;
    while (node && guard++ < 60) {
      var candidate = safeGet(node, '__vue_app__');
      if (candidate) { app = candidate; break; }
      node = isElement(node.parentNode) ? node.parentNode : null;
    }
    if (!app) return null;
    var rootInstance = safeGet(app, '_instance');
    if (!rootInstance) return null;
    var best = null;
    var bestDepth = -1;
    var budget = 4000;
    (function walk(instance, depth) {
      if (!instance || typeof instance !== 'object' || depth > 80 || budget <= 0) return;
      budget--;
      var subTree = safeGet(instance, 'subTree');
      if (!subTree || typeof subTree !== 'object') return;
      if (safeGet(subTree, 'el') === el && depth > bestDepth) {
        best = instance;
        bestDepth = depth;
      }
      var component = safeGet(subTree, 'component');
      if (component) walk(component, depth + 1);
      var children = safeGet(subTree, 'children');
      if (Array.isArray(children)) {
        for (var i = 0; i < children.length; i++) {
          var child = children[i];
          if (!child || typeof child !== 'object') continue;
          var childComponent = safeGet(child, 'component');
          if (childComponent) walk(childComponent, depth + 1);
        }
      }
      var dynamic = safeGet(subTree, 'dynamicChildren');
      if (Array.isArray(dynamic)) {
        for (var j = 0; j < dynamic.length; j++) {
          var dyn = dynamic[j];
          if (!dyn || typeof dyn !== 'object') continue;
          var dynComponent = safeGet(dyn, 'component');
          if (dynComponent) walk(dynComponent, depth + 1);
        }
      }
    })(rootInstance, 0);
    return best;
  }

  /* 楼中楼必须优先 subReply；主评论优先 reply，其次 rootReply */
  function pickReply(props, isSub) {
    if (!props || typeof props !== 'object') return null;
    var order = isSub ? ['subReply', 'reply'] : ['reply', 'rootReply', 'subReply'];
    for (var i = 0; i < order.length; i++) {
      var value = props[order[i]];
      if (value && typeof value === 'object') return value;
    }
    return null;
  }

  function pushProbe(list, el) {
    if (!isElement(el)) return;
    for (var i = 0; i < list.length; i++) {
      if (list[i] === el) return;
    }
    if (list.length < 40) list.push(el);
  }

  function collectProbes(item, timeEl) {
    var probes = [];
    pushProbe(probes, item);
    pushProbe(probes, timeEl);
    if (isElement(item) && item.children) {
      for (var i = 0; i < item.children.length && i < 12; i++) pushProbe(probes, item.children[i]);
    }
    var current = item;
    var guard = 0;
    while (current && guard++ < 30) {
      current = parentOrHost(current);
      if (!isElement(current)) break;
      /* 跨到另一条评论时停止：更外层的数据属于别的评论 */
      if (matchesSelector(current, ITEM_SELECTOR) && current !== item) break;
      pushProbe(probes, current);
    }
    return probes;
  }

  function replyFromVue(item, timeEl, isSub) {
    var probes = collectProbes(item, timeEl);
    var i;
    for (i = 0; i < probes.length; i++) {
      var picked = pickReply(vuePropsOf(vueInstanceOn(probes[i])), isSub);
      if (picked) return picked;
    }
    for (i = 0; i < probes.length && i < 6; i++) {
      var deep = pickReply(vuePropsOf(vueInstanceByTree(probes[i])), isSub);
      if (deep) return deep;
    }
    return null;
  }

  /* ======================= 九、Vue 3 / bbComment 的 light DOM 处理 ======================= */

  function isSubComment(item, timeEl) {
    if (matchesSelector(item, SUB_ITEM_SELECTOR)) return true;
    if (matchesSelector(timeEl, SUB_ITEM_SELECTOR)) return true;
    /* 位于楼中楼容器内部也算子评论（bbComment 的 .sub-reply-item / 子列表包裹层） */
    if (closestMatching(item, SUB_CONTEXT_SELECTOR)) return true;
    if (closestMatching(timeEl, SUB_CONTEXT_SELECTOR)) return true;
    return false;
  }

  /* 时间栏容器：优先 .reply-info/.sub-reply-info/.info，且其中只应有一条时间 */
  function infoContainerOf(timeEl) {
    var candidate = closestMatching(timeEl, INFO_SELECTOR);
    if (isElement(candidate) && queryAll(candidate, TIME_SELECTOR).length <= 1) return candidate;
    return isElement(timeEl.parentNode) ? timeEl.parentNode : null;
  }

  function itemOf(timeEl, info) {
    var item = closestMatching(timeEl, ITEM_SELECTOR);
    if (isElement(item)) return item;
    return isElement(info) ? info : null;
  }

  function commentIdOf(el) {
    var current = el;
    var guard = 0;
    while (current && guard++ < 12) {
      if (isElement(current) && matchesSelector(current, ITEM_SELECTOR)) {
        var id = safeGet(current, 'dataset') ? safeGet(safeGet(current, 'dataset'), 'id') : null;
        if (!id && typeof current.getAttribute === 'function') {
          id = current.getAttribute('data-id') || current.getAttribute('data-rpid');
        }
        if (id) return String(id).trim();
      }
      current = parentOrHost(current);
    }
    return '';
  }

  function replyFromElements(item, timeEl) {
    var probes = collectProbes(item, timeEl);
    for (var i = 0; i < probes.length; i++) {
      var data = ownData(probes[i]);
      if (data) return data;
    }
    return null;
  }

  function replyFromRegistry(item, timeEl) {
    var id = commentIdOf(item) || commentIdOf(timeEl);
    if (!id) return null;
    var found = registry.get(id);
    return found || null;
  }

  function handleLightTime(timeEl) {
    if (!isElement(timeEl)) return false;
    var info = infoContainerOf(timeEl);
    if (!isElement(info)) return false;
    var item = itemOf(timeEl, info);
    var isSub = isSubComment(item, timeEl);

    /* 页面已有可见原生属地标签时保留它，不再增加第二份 */
    if (findNativeTagInItem(item, info)) return removeOurTagsReporting(info);

    var tag = ourTagsWithin(info)[0] || null;
    var changed = false;
    if (!tag) {
      tag = createTag();
      changed = true;
      var parent = isElement(timeEl.parentNode) ? timeEl.parentNode : null;
      if (parent) parent.insertBefore(tag, timeEl.nextSibling);
      else info.appendChild(tag);
    }
    /* bbComment 的槽位标签已就位；其余情况把标签紧贴时间元素 */
    if (tag.getAttribute(SLOT_ATTR) === '1') tag.removeAttribute(SLOT_ATTR);
    else placeTag(tag, timeEl, info);

    var before = tag.textContent;
    var reply = replyFromVue(item, timeEl, isSub) || replyFromElements(item, timeEl) ||
      replyFromRegistry(item, timeEl);
    updateTag(tag, reply);
    if (tag.textContent !== before) changed = true;

    /* 记录读取方式，供低延迟刷新（组件换值不一定触发 DOM 变更） */
    var read = function () {
      return replyFromVue(item, timeEl, isSub) || replyFromElements(item, timeEl) ||
        replyFromRegistry(item, timeEl);
    };
    if (isElement(timeEl.parentNode)) trackEntry(timeEl, info, timeEl, read, isSub);
    else if (isElement(timeEl)) trackEntry(info, info, timeEl, read, isSub);
    return changed;
  }

  /* ======================= 十、bbComment 旧形态挂钩 ======================= */

  var SLOT_HTML = '<span class="' + TAG_CLASS + '" ' + TAG_ATTR + '="1" ' + SLOT_ATTR +
    '="1"></span>';
  var TIME_TAG_RE = /<[a-zA-Z][^>]*\breply-time\b[^>]*>/;

  /* 只在 HTML 字符串里追加一个静态空槽位；属地值随后用 textContent 写入 */
  function injectSlot(html) {
    if (typeof html !== 'string' || !html) return html;
    var matched = TIME_TAG_RE.exec(html);
    if (matched) {
      var at = matched.index + matched[0].length;
      return html.slice(0, at) + SLOT_HTML + html.slice(at);
    }
    var infoMatch = /<[a-zA-Z][^>]*\bclass\s*=\s*("[^"]*\b(?:reply-info|sub-reply-info|info)\b[^"]*"|'[^']*\b(?:reply-info|sub-reply-info|info)\b[^']*')[^>]*>/.exec(html);
    if (infoMatch) {
      var pos = infoMatch.index + infoMatch[0].length;
      return html.slice(0, pos) + SLOT_HTML + html.slice(pos);
    }
    return html;
  }

  function patchRenderResult(html, item) {
    if (item && typeof item === 'object') rememberReply(item);
    return injectSlot(html);
  }

  var BB_METHODS = ['_createListCon', '_createSubReplyItem'];
  var guardedPrototypes = new WeakSet();

  /* 包装单个原型方法；始终调用当时最新的原始实现，返回值照原样透传 */
  function wrapMethod(proto, name) {
    var original = proto[name];
    if (typeof original !== 'function' || original.__biliIpWrapped) return;
    var wrapped = function () {
      var result = original.apply(this, arguments);
      try {
        return patchRenderResult(result, arguments.length ? arguments[0] : null);
      } catch (e) {
        return result; /* 任何意外都退回页面原始返回值 */
      }
    };
    wrapped.__biliIpWrapped = true;
    try {
      Object.defineProperty(proto, name, {
        configurable: true, enumerable: true, writable: true, value: wrapped
      });
    } catch (e) {
      try { proto[name] = wrapped; } catch (err) { /* 兜底巡检仍可工作 */ }
    }
  }

  /* 页面可能在赋值构造函数之后才挂上原型方法：用访问器属性守卫，
   * 方法一旦被写入就立刻包装，无需等待下一轮巡检。
   * 写入过程中解除守卫，避免 wrapMethod 的赋值再次触发 setter。 */
  function guardBbPrototype(proto) {
    if (!proto || typeof proto !== 'object' || guardedPrototypes.has(proto)) return;
    guardedPrototypes.add(proto);
    for (var i = 0; i < BB_METHODS.length; i++) {
      (function (name) {
        var stored = proto[name];
        var descriptor = null;
        try { descriptor = Object.getOwnPropertyDescriptor(proto, name); } catch (e) { descriptor = null; }
        /* 页面自定义的不可配置访问器不动 */
        if (descriptor && !descriptor.configurable && descriptor.get) return;
        try {
          Object.defineProperty(proto, name, {
            configurable: true,
            enumerable: true,
            get: function () { return stored; },
            set: function (value) {
              stored = value;
              /* 先恢复为普通数据属性，再包装，避免递归触发本方 setter */
              try {
                Object.defineProperty(proto, name, {
                  configurable: true, enumerable: true, writable: true, value: value
                });
              } catch (err) { /* 保持守卫 */ }
              wrapMethod(proto, name);
            }
          });
        } catch (e) { /* 不可重定义：退回直接包装当前实现 */ }
        if (typeof stored === 'function') wrapMethod(proto, name);
      })(BB_METHODS[i]);
    }
  }

  function watchBbComment() {
    var current = null;
    try { current = window.bbComment; } catch (e) { current = null; }
    if (current && current.prototype) guardBbPrototype(current.prototype);

    try {
      Object.defineProperty(window, 'bbComment', {
        configurable: true,
        enumerable: true,
        get: function () { return current; },
        set: function (value) {
          current = value;
          if (value && value.prototype) guardBbPrototype(value.prototype);
        }
      });
    } catch (e) {
      /* 页面已用不可配置属性定义时，退回低频检查 */
      setInterval(refreshBbComment, 1000);
    }
  }

  /* 兜底检查：页面可能晚于注入才挂上构造函数或原型方法，
   * 也可能整体替换 prototype 对象；由定时器与巡检一并触发，缩短检测延迟。 */
  function refreshBbComment() {
    try {
      var ctor = window.bbComment;
      if (ctor && ctor.prototype) guardBbPrototype(ctor.prototype);
    } catch (e) { /* 忽略 */ }
  }

  /* 前 ~4 秒用 100ms 的较密节奏确认，之后永久退化为 1s，避免长期开销。 */
  function scheduleBbCommentCheck(initialDelay) {
    var fastRemaining = 40;
    var delay = initialDelay;
    var tick = function () {
      refreshBbComment();
      if (fastRemaining-- > 0) delay = 100;
      else delay = 1000;
      setTimeout(tick, delay);
    };
    setTimeout(tick, delay);
  }

  /* ======================= 十一、被动观察页面已有响应 ======================= */

  function observePageResponse(response, input) {
    if (!response || typeof response.clone !== 'function') return;
    var url = '';
    try {
      if (typeof input === 'string') url = input;
      else if (input && typeof input.url === 'string') url = input.url;
      else if (typeof response.url === 'string') url = response.url;
    } catch (e) { url = ''; }
    var type = '';
    try { type = response.headers.get('content-type') || ''; } catch (e) { type = ''; }
    var isJson = type.indexOf('json') >= 0;
    var isReplyApi = /\/x\/v2\/reply\//.test(url) || /reply/i.test(url);
    if (!isJson && !isReplyApi) return;
    var clone = null;
    try { clone = response.clone(); } catch (e) { return; }
    if (!clone || typeof clone.json !== 'function') return;
    try {
      clone.json().then(function (payload) {
        try { harvestReplies(payload); } catch (e) { /* 兜底逻辑静默失败 */ }
      }, function () { /* 非 JSON 或被中断：忽略 */ });
    } catch (e) { /* 忽略 */ }
  }

  function installFetchObserver() {
    if (typeof window.fetch !== 'function') return;
    var original = window.fetch;
    if (original.__biliIpWrapped) return;
    var wrapped = function () {
      var promise = original.apply(this, arguments);
      try {
        if (promise && typeof promise.then === 'function') {
          var input = arguments.length ? arguments[0] : null;
          /* 只旁挂观察链，页面拿到的是原始 Promise：不吞响应、不改异常语义 */
          promise.then(function (response) {
            try { observePageResponse(response, input); } catch (e) { /* 忽略 */ }
            return undefined;
          }, function () { return undefined; });
        }
      } catch (e) { /* 忽略 */ }
      return promise;
    };
    wrapped.__biliIpWrapped = true;
    try { window.fetch = wrapped; } catch (e) { /* 不可写则跳过 */ }
  }

  /* ======================= 十二、观察与巡检 ======================= */
  var sweepQueued = false;
  var sweepTimer = null;

  /* 扫描一个作用域（document 或某个 Shadow Root）里的时间栏 */
  function sweepLightIn(scope, budget) {
    var times = queryAll(scope, TIME_SELECTOR);
    for (var i = 0; i < times.length; i++) {
      try { if (handleLightTime(times[i]) === true) budget.changed = true; } catch (e) { /* 单条失败不影响其它 */ }
    }
  }

  /* 深度扫描：递归进入每个组件的 Open Shadow Root。
   * 不依赖 MutationObserver 是否能观察到 Shadow Root，作为可靠兜底。 */
  function sweepScope(scope, budget) {
    if (!scope || budget.left <= 0) return;
    try { sweepLightIn(scope, budget); } catch (e) { /* 忽略 */ }
    var hosts = queryAll(scope, MANAGED_SELECTOR);
    for (var i = 0; i < hosts.length; i++) {
      if (budget.left-- <= 0) return;
      var host = hosts[i];
      try { if (handleManagedElement(host) === true) budget.changed = true; } catch (e) { /* 忽略 */ }
      var root = host.shadowRoot;
      if (root) sweepScope(root, budget);
    }
  }

  function sweepAll() {
    var budget = { left: 3000, changed: false };
    try { sweepScope(document, budget); } catch (e) { /* 忽略 */ }
    try { if (refreshTrackers() === true) budget.changed = true; } catch (e) { /* 忽略 */ }
    return budget.changed;
  }

  /* 组件生命周期挂钩：自定义元素完成升级或 renderer 打开 shadow root 时立即处理，
   * 减少对轮询的依赖（不改变页面方法返回值与异常语义）。 */
  function hookCustomElementLifecycle() {
    /* 1) 升级完成：connectedCallback */
    if (window.HTMLElement && HTMLElement.prototype) {
      var originalConnected = HTMLElement.prototype.connectedCallback;
      if (typeof originalConnected === 'function' && !originalConnected.__biliIpWrapped) {
        var wrappedConnected = function () {
          var result = originalConnected.apply(this, arguments);
          try {
            if (MANAGED_TAGS[tagNameOf(this)]) {
              handleManagedElement(this);
              queueSweep();
            }
          } catch (e) { /* 忽略 */ }
          return result;
        };
        wrappedConnected.__biliIpWrapped = true;
        try {
          Object.defineProperty(HTMLElement.prototype, 'connectedCallback', {
            configurable: true, writable: true, value: wrappedConnected
          });
        } catch (e) { /* 忽略 */ }
      }
    }
    /* 2) Lit 的 update()/render() 生命周期 */
    var custom = window.customElements;
    if (custom && typeof custom.define === 'function' && !custom.define.__biliIpWrapped) {
      var originalDefine = custom.define;
      var wrappedDefine = function (name) {
        var result = originalDefine.apply(this, arguments);
        try { hookElementClass(custom.get(name)); } catch (e) { /* 忽略 */ }
        return result;
      };
      wrappedDefine.__biliIpWrapped = true;
      try { custom.define = wrappedDefine; } catch (e) { /* 忽略 */ }
    }
  }

  function hookElementClass(ctor) {
    if (!ctor || !ctor.prototype) return;
    var proto = ctor.prototype;
    var methods = ['update', 'render', 'willUpdate', 'updated', 'performUpdate'];
    for (var i = 0; i < methods.length; i++) {
      (function (name) {
        var original = proto[name];
        if (typeof original !== 'function' || original.__biliIpWrapped) return;
        var wrapped = function () {
          var result = original.apply(this, arguments);
          try {
            if (MANAGED_TAGS[tagNameOf(this)]) {
              handleManagedElement(this);
              queueSweep();
            }
          } catch (e) { /* 忽略 */ }
          return result;
        };
        wrapped.__biliIpWrapped = true;
        try { proto[name] = wrapped; } catch (e) { /* 忽略 */ }
      })(methods[i]);
    }
  }

  function queueSweep() {
    if (sweepQueued) return;
    sweepQueued = true;
    var run = function () {
      sweepQueued = false;
      sweepTimer = null;
      sweepAll();
    };
    try { sweepTimer = setTimeout(run, SWEEP_DEBOUNCE); } catch (e) { run(); }
    if (sweepTimer === null) sweepQueued = false;
  }

  function onMutations(records) {
    try {
      for (var i = 0; i < records.length; i++) {
        var record = records[i];
        var targets = [record.target];
        if (record.addedNodes && record.addedNodes.length) {
          for (var j = 0; j < record.addedNodes.length; j++) targets.push(record.addedNodes[j]);
        }
        for (var t = 0; t < targets.length; t++) {
          var node = targets[t];
          /* ShadowRoot 没有 parentNode，必须经 host 向上定位所属组件 */
          var start = isElement(node) ? node : parentOrHost(node);
          var managed = nearestManaged(start);
          if (managed) {
            try { handleManagedElement(managed); } catch (e) { /* 忽略 */ }
          }
          if (isElement(node)) {
            try { ensureObservedHost(node); } catch (e) { /* 忽略 */ }
          }
        }
      }
    } catch (e) { /* 观察器回调不得抛出 */ }
    try { resetTrackerStability(); } catch (e) { /* 忽略 */ }
    queueSweep();
  }

  function installShadowHook() {
    if (!window.Element || !Element.prototype || typeof Element.prototype.attachShadow !== 'function') return;
    var original = Element.prototype.attachShadow;
    if (original.__biliIpWrapped) return;
    var wrapped = function () {
      var root = original.apply(this, arguments); /* 异常语义原样保留 */
      try {
        if (root) {
          observeRoot(root);
          try { handleManagedElement(this); } catch (e) { /* 忽略 */ }
          queueSweep();
        }
      } catch (e) { /* 忽略 */ }
      return root;
    };
    wrapped.__biliIpWrapped = true;
    try { Element.prototype.attachShadow = wrapped; } catch (e) { /* 忽略 */ }
    /* 已存在的自定义元素类也补挂生命周期钩子 */
    try {
      var custom = window.customElements;
      if (custom && typeof custom.get === 'function') {
        var names = ['bili-comments', 'bili-comment-thread-renderer', 'bili-comment-renderer',
          'bili-comment-reply-renderer', 'bili-comment-action-buttons-renderer'];
        for (var i = 0; i < names.length; i++) hookElementClass(custom.get(names[i]));
      }
    } catch (e) { /* 忽略 */ }
  }

  function startObserving() {
    observer = new MutationObserver(onMutations);
    try { observer.observe(document, OBSERVE_OPTS); } catch (e) {
      if (document.documentElement) {
        try { observer.observe(document.documentElement, OBSERVE_OPTS); } catch (err) { /* 忽略 */ }
      }
    }
    observeRoot(document.documentElement || document);
  }

  /* 自适应兜底巡检：有变化时按最短间隔扫描，长时间空闲时逐步放宽，
   * 既保证正确性又不长期占用主线程。 */
  var idleRounds = 0;
  var sweepTimerHandle = null;

  function scheduleSweep() {
    var delay = Math.min(SWEEP_INTERVAL_MIN * Math.pow(2, Math.min(idleRounds, 4)),
      SWEEP_INTERVAL_MAX);
    sweepTimerHandle = setTimeout(function () {
      sweepTimerHandle = null;
      var changed = false;
      try { changed = sweepAll(); } catch (e) { changed = false; }
      idleRounds = changed ? 0 : idleRounds + 1;
      scheduleSweep();
    }, delay);
  }

  function bootstrap() {
    try { hookCustomElementLifecycle(); } catch (e) { /* 忽略 */ }
    try { installShadowHook(); } catch (e) { /* 忽略 */ }
    try { installFetchObserver(); } catch (e) { /* 忽略 */ }
    try { watchBbComment(); } catch (e) { /* 忽略 */ }
    try { startObserving(); } catch (e) { /* 忽略 */ }
    /* 自适应深度巡检：发现新条目 */
    try { scheduleSweep(); } catch (e) { /* 忽略 */ }
    /* 固定频率轻量刷新：让已跟踪条目及时反映数据变化（组件换值不一定触发 DOM 变更） */
    try { setInterval(refreshTrackers, REFRESH_INTERVAL); } catch (e) { /* 忽略 */ }
    /* bbComment 可能晚于 document-start 才挂上构造函数或原型方法：
     * 早期用较密节奏确认（此时原型方法通常刚被定义），之后转为低频。 */
    try { scheduleBbCommentCheck(100); } catch (e) { /* 忽略 */ }
    try {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          try { sweepAll(); } catch (e) { /* 忽略 */ }
        }, false);
      }
    } catch (e) { /* 忽略 */ }
    try { sweepAll(); } catch (e) { /* 忽略 */ }
  }

  bootstrap();
})();
