'use strict';
/* 真实快照回放自测：用 reference/ 内实抓数据与按渲染器模板重建的 DOM 片段，
 * 驱动 answer.user.js 的通用节点核心（processItemNode/absorbPayload/decide），
 * 断言插入/幂等/降级/闩锁行为。运行：node _selftest/replay.test.js */
var fs = require('fs');
var path = require('path');
var impl = require(path.join(__dirname, '..', 'answer.user.js'));
var md = require(path.join(__dirname, 'minidom.js'));

var realApi = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'reference', 'api-reply-av170001.json'), 'utf8'));

var passCount = 0, failCount = 0;
var failures = [];
function T(name, cond, evidence) {
  if (cond) { passCount++; console.log('PASS  ' + name); }
  else { failCount++; failures.push(name); console.log('FAIL  ' + name + (evidence ? ' | ' + evidence : '')); }
}

/* ---------- 真实样本准备 ---------- */
if (realApi.code !== 0 || !Array.isArray(realApi.data.replies)) throw new Error('snapshot invalid');
var realTop = realApi.data.replies.slice(0, 3);           // 一级评论（真实对象，仅浅拷贝）
(function () {
  var flat = [];
  (function walk(list) {
    (list || []).forEach(function (r) {
      flat.push(r);
      if (Array.isArray(r.replies)) walk(r.replies);
    });
  })(realApi.data.replies);
  exports_realFlat = flat;
})();
var exports_realFlat = typeof exports_realFlat !== 'undefined' ? exports_realFlat : null;

/** 字段路径 reply_control.location 依据渲染器模板（offset 283542）；
 *  province 为合成值——真实快照为未登录响应、服务端未下发该字段（NOTES.md 已披露）。 */
function withLoc(entry, province) {
  return Object.assign({}, entry, {
    reply_control: Object.assign({}, entry.reply_control || {}, { location: province })
  });
}
/** 深拷贝真实条目并剥离嵌套 replies（用于“该条目存在但无 IP 字段”的已知缺失语义）。 */
function bare(entry) {
  return Object.assign({}, entry, { replies: undefined });
}

/* ---------- DOM 片段构造（结构逐字依据 comp-new-comment.min.js 模板字符串） ---------- */
var docShim = md.createDocumentShim();
impl.setTestEnv(docShim, docShim);

function spaceHref(mid) { return '//space.bilibili.com/' + mid; }
function attachUserBlock(con, mid, userInfoStyle) {
  var user = md.make('div', { 'class': 'user' });
  con.appendChild(user);
  if (userInfoStyle) {
    var ui = md.make('span', { 'class': 'userInfo' });   // 楼中楼模板原文片段
    user.appendChild(ui);
    ui.appendChild(md.make('a', { href: spaceHref(mid) }));
  } else {
    user.appendChild(md.make('a', { href: spaceHref(mid) }));
  }
  return user;
}
function attachInfoTime(con) {
  var info = md.make('div', { 'class': 'info' });        // 模板原文 '<div class="info">'
  con.appendChild(info);
  var tl = md.make('span', { 'class': 'time-location' }); // 模板原文（原生 IP 属地挂点）
  info.appendChild(tl);
  tl.appendChild(md.make('span', { 'class': 'reply-time' }, '2761天前发布'));
  return tl;
}
function topItemDom(rpid, mid) {                          // 'list-item reply-wrap' + data-id=rpid
  var item = md.make('div', { 'class': 'list-item reply-wrap', 'data-id': rpid, 'data-index': '0' });
  var con = md.make('div', { 'class': 'reply-con' });
  item.appendChild(con);
  attachUserBlock(con, mid, false);
  attachInfoTime(con);
  return { item: item, host: con };
}
function subItemDom(rpid, mid) {                          // 'reply-item reply-wrap' + data-id=rpid
  var item = md.make('div', { 'class': 'reply-item reply-wrap', 'data-id': rpid, 'data-index': '1' });
  var con = md.make('div', { 'class': 'reply-con' });
  item.appendChild(con);
  var user = attachUserBlock(con, mid, true);
  var replyBoxInner = md.make('span', { 'class': 'text-con' });
  con.appendChild(replyBoxInner);
  void replyBoxInner;
  void user;
  return { item: item, host: con };
}
function countBadges(node) {
  var n = 0;
  (function rec(x) {
    if (!x || !x.childNodes) return;
    if (x.classList && x.classList.contains('bili-iploc-tag')) n++;
    (x.childNodes || []).forEach(rec);
  })(node);
  return n;
}

/* ==================== 场景一：主楼插入 + 幂等 ==================== */
impl.resetForTest();
var r0 = realTop[0], r1 = realTop[1];
var st = impl.absorbPayload({ code: 0, data: { replies: [withLoc(r0, '浙江'), withLoc(r1, '湖南')] } });
T('S1 吸收真实样本+合成 location 后映射就位', st === true && impl.stateSnapshot().byRpidSize >= 2);
var pair0 = topItemDom(String(r0.rpid), String(r0.member.mid));
var firstRun = impl.processItemNode(pair0.item);
T('S1 主楼首次处理状态 done', firstRun === 'done');
var badge = impl.findByIdClass(pair0.item, 'bili-iploc-tag');
T('S1 徽标注入到原生位置邻近宿主（time-location 链）', !!badge && !!impl.findByIdClass(attachHostOf(pair0), 'bili-iploc-tag'));
function attachHostOf(p) { return p.host; }
void badge;
var badgeText = badge ? badge.textContent : '';
T('S1 文案「IP属地：浙江」透传', badgeText === 'IP属地：浙江', JSON.stringify(badgeText));
var cntAfterFirst = countBadges(pair0.item);
var secondRun = impl.processItemNode(pair0.item);
T('S1 二次处理不重复插入（计数稳定且为 1）', cntAfterFirst === 1 && countBadges(pair0.item) === 1 && secondRun === 'done');

/* ==================== 场景二：楼中楼展开后插入 ==================== */
impl.resetForTest();
var flatReal = exports_realFlat || [];
var subReal = null;
for (var i = 0; i < flatReal.length; i++) {
  if (Number(flatReal[i].root) !== 0 && !subReal) subReal = flatReal[i];
}
T('S2 真实快照含楼中楼条目(root!=0)', !!subReal);
var parentReal = realApi.data.replies.filter(function (r) { return Array.isArray(r.replies) && r.replies.length; })[0] || realTop[0];
var pairP = topItemDom(String(parentReal.rpid), String(parentReal.member.mid));
impl.absorbPayload({ code: 0, data: { replies: [withLoc(Object.assign({}, parentReal, { replies: undefined }), '广东')] } }); // 仅主楼映射
impl.processItemNode(pairP.item);
var pairS = subItemDom(String(subReal.rpid_str), String((subReal.member || {}).mid)); // 楼中楼用自身真实 mid，避免父楼 byMid 兜底命中干扰两阶段断言
// 楼中楼挂载进父条目的 .reply-box（渲染器 CSS 选择器原文路径）
var replyBox = md.make('div', { 'class': 'reply-box' });
replyBox.appendChild(pairS.item);
pairP.item.appendChild(replyBox);
var phase1 = impl.processItemNode(pairS.item);
T('S2 展开瞬间未映射 → 不动节点（defer/wait）', phase1 === 'defer' && countBadges(pairS.item) === 0);
impl.absorbPayload({ code: 0, data: { replies: [withLoc(bare(subReal), '四川')] } });
var phase2 = impl.processItemNode(pairS.item);
T('S2 映射就位后展开项插入成功', phase2 === 'done' && countBadges(pairS.item) === 1);
var hostClsFound = !!impl.findByIdClass(pairS.item, 'userInfo') || !!impl.findByIdClass(pairS.item, 'user');
T('S2 楼中楼徽标落在候选宿主链内', hostClsFound && countBadges(pairS.item) === 1);

/* ==================== 场景三：无 IP 字段 → 灰色占位降级 ==================== */
impl.resetForTest();
var realNoField = bare(realTop[2]);
impl.absorbPayload({ code: 0, data: { replies: [realNoField] } }); // 真实快照原样：rc 无 location
var pairN = topItemDom(String(realNoField.rpid), String(realNoField.member.mid));
var runN = impl.processItemNode(pairN.item);
var bN = impl.findByIdClass(pairN.item, 'bili-iploc-tag');
T('S3 已知缺失字段 → ensure 灰占位 --', runN === 'done' && !!bN && (bN.getAttribute ? bN.getAttribute('data-iploc-value') : '') === '--');
var styleVal = bN && bN.getAttribute ? String(bN.getAttribute('style')) : '';
T('S3 占位态更浅灰样式(#C9CDD4)且 title 为空', styleVal.indexOf('#C9CDD4') !== -1 &&
  (bN.getAttribute('title') === '' ));
var runN2 = impl.processItemNode(pairN.item);
T('S3 占位二次处理幂等（no-op 稳定）', runN2 === 'done' && countBadges(pairN.item) === 1);

/* ==================== 场景四：路由切换 → 新评论生效、旧节点不重复插入 ==================== */
impl.resetForTest();
var absorbBatchA = withLoc(realTop[0], '江苏');
impl.absorbPayload({ code: 0, data: { replies: [absorbBatchA] } });
var itemA = topItemDom(String(realTop[0].rpid), String(realTop[0].member.mid));
impl.processItemNode(itemA.item);
var badgesBeforeRoute = countBadges(itemA.item);
impl.resetForTest(); // 路由切换语义：清内存映射与闩锁（onRouteChange 的桩级等价物）
var rerunA = impl.processItemNode(itemA.item);
T('S4 清缓存后既有节点不被错误改写/重复插入',
  countBadges(itemA.item) === badgesBeforeRoute && badgesBeforeRoute === 1 && rerunA === 'defer');
var absorbBatchB = withLoc(realTop[1], '上海');
impl.absorbPayload({ code: 0, data: { replies: [absorbBatchB] } });
var itemB = topItemDom(String(realTop[1].rpid), String(realTop[1].member.mid));
T('S4 新路由新评论条目处理生效', impl.processItemNode(itemB.item) === 'done' && countBadges(itemB.item) === 1);
var allItems = [itemA.item, itemB.item];
for (var round = 0; round < 3; round++) allItems.forEach(function (n) { impl.processItemNode(n); });
T('S4 多轮混合重扫全局徽标数恒定（1+1，无重复）',
  countBadges(itemA.item) === 1 && countBadges(itemB.item) === 1);

/* ==================== 场景五：接口失败静默闩锁 ==================== */
impl.resetForTest();
var pairU = topItemDom('9999999999', '123456'); // 未在任何映射中的未知条目
var before = countBadges(pairU.item);
for (var f = 0; f < 5; f++) impl.markResult(false); // 连续失败（上限 3）
T('S5 连续失败触发静默闩锁', impl.inNetBlocked() === true);
var runU = impl.processItemNode(pairU.item);
T('S5 未知条目在闩锁期 silent 且零 DOM 变更', runU === 'silent' && countBadges(pairU.item) === before && before === 0);
impl.resetForTest();
var runU2 = impl.processItemNode(pairU.item);
T('S5 闩锁解除后恢复 wait 等待数据（不再 silent）', runU2 === 'defer' && countBadges(pairU.item) === 0);

/* ==================== 场景六（附加）：原生已展示则跳过 ==================== */
impl.resetForTest();
var natPair = topItemDom(String(realTop[0].rpid), String(realTop[0].member.mid));
var tlHost = impl.findByIdClass(natPair.item, 'time-location');
tlHost.appendChild(md.make('span', { 'class': 'reply-location' }, 'IP属地：北京')); // 原生气泡类
var runNat1 = impl.processItemNode(natPair.item);
var runNat2 = impl.processItemNode(natPair.item);
T('S6 原生 reply-location 存在 → native 跳过不插徽标',
  runNat1 === 'native' && runNat2 === 'native' && countBadges(natPair.item) === 0);

/* ---------- 汇总 ---------- */
console.log('\nREPLAY SUMMARY pass=' + passCount + ' fail=' + failCount +
  (failures.length ? '\nFAILED: ' + failures.join('; ') : ' ALL_GREEN'));
process.exitCode = failCount ? 1 : 0;
