'use strict';
/* 轻量自测桩：静态断言（元数据/权限/纪律）+ 行为断言（纯逻辑函数）。
 * 运行：node _selftest/selftest.js    退出码非 0 表示存在失败。 */
var fs = require('fs');
var path = require('path');

var SRC = fs.readFileSync(path.join(__dirname, '..', 'answer.user.js'), 'utf8');
var impl = require(path.join(__dirname, '..', 'answer.user.js'));

var passCount = 0, failCount = 0;
var failures = [];
function T(name, cond, evidence) {
  if (cond) { passCount++; console.log('PASS  ' + name); }
  else { failCount++; failures.push(name); console.log('FAIL  ' + name + (evidence ? ' | ' + evidence : '')); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* ============================ 静态断言 ============================ */
(function statics() {
  var metaMatch = SRC.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
  T('meta: userscript 元数据块存在', !!metaMatch);
  var meta = metaMatch ? metaMatch[0] : '';

  T('meta: 含 @name', /^\/\/\s*@name\b/m.test(meta));
  T('meta: 含 @namespace', /^\/\/\s*@namespace\b/m.test(meta));
  T('meta: 含 @version', /^\/\/\s*@version\b/m.test(meta));
  T('meta: 含 @description', /^\/\/\s*@description\b/m.test(meta));
  T('meta: 含 @license', /^\/\/\s*@license\b/m.test(meta));
  T('meta: 含 @run-at', /^\/\/\s*@run-at\b/m.test(meta));

  var matchLines = [];
  var re = /^\/\/\s*@match\s+(\S+)/gm; var m;
  while ((m = re.exec(meta))) matchLines.push(m[1]);
  T('meta: @match 至少一条', matchLines.length >= 1);
  var allBili = matchLines.every(function (u) {
    return /^https:\/\/([^\/]*\.)?bilibili\.com(\/|$)/.test(u);
  });
  T('meta: @match 仅 bilibili.com 域（https）', allBili, JSON.stringify(matchLines));

  var grants = [];
  var rg = /^\/\/\s*@grant\s*(\S*)/gm;
  while ((m = rg.exec(meta))) grants.push(m[1]);
  T('meta: @grant 声明存在且仅为 none（权限最小化，零 GM_* 特权）',
    grants.length >= 1 && grants.every(function (g) { return g === 'none'; }),
    JSON.stringify(grants));

  T('meta: 外呼域已在 @connect 显式声明', /^\/\/\s*@connect\s+api\.bilibili\.com\b/m.test(meta));

  /* 代码区 = 原文去掉元数据块与块注释；用于检查实际调用点而非文档措辞 */
  var codeOnly = SRC.replace(meta, '').replace(/\/\*[\s\S]*?\*\//g, '');
  var codeNC = codeOnly.replace(/^\s*\/\/.*$/gm, '');

  var urls = codeOnly.match(/https?:\/\/[^'"\s)]+/g) || [];
  var urlHostOk = urls.length > 0 && urls.every(function (u) {
    try { return new URL(u).hostname === 'api.bilibili.com'; } catch (e) { return false; }
  });
  T('static: 代码区 http(s) 字面量仅 api.bilibili.com', urlHostOk, JSON.stringify(urls));

  T('static: fetch 只读 GET 为唯一外呼手段', /\bfetch\(/.test(codeNC) && !/XMLHttpRequest/.test(codeNC));
  T('static: 无 GM_* API 调用', !/\bGM_[A-Za-z]/.test(codeNC));
  T('static: 无 TODO/FIXME 未完成占位', !/\b(TODO|FIXME|XXX)\b/i.test(codeOnly));
  T('static: 零存储（无 localStorage/sessionStorage/indexedDB/document.cookie 调用点）',
    !/(localStorage|sessionStorage|indexedDB)|document\s*\.\s*cookie/.test(codeNC));
  T('static: 无弹窗打扰（alert/confirm/prompt 调用点）', !/\b(alert|confirm|prompt)\s*\(/.test(codeNC));
  T('static: 单文件零依赖（无 import 语句/<script src>/CDN 引用）',
    !/(^|\n)\s*import[\s("']|<script|\.(unpkg|jsdelivr|cdnjs)\./.test(SRC));

  T('spa: MutationObserver 存在', /new\s+MutationObserver/.test(SRC));
  T('spa: 扫描经防抖合并', /debounceSchedule/.test(SRC) && /clearTimeout\(scanTimer\)/.test(SRC));
  T('spa: 路由兜底（pushState/replaceState 包装 + popstate/hashchange 监听）',
    /pushState|replaceState/.test(SRC) && /addEventListener\('popstate'/.test(SRC)
      && /addEventListener\('hashchange'/.test(SRC));
  T('idempotent: WeakSet 幂等标记位（原生展示条目终态登记）', /nativeSeen\s*=\s*new\s+WeakSet/.test(SRC));
  T('idempotent: 徽标复用原地更新（existing.node 复用，绝不二次插入）',
    /function getExistingBadge/.test(SRC) && /existing \? existing\.node/.test(SRC));
  T('style: 内联小号灰字且 pointer-events:none 不遮挡控件',
    /font-size:12px/.test(SRC) && /pointer-events:none/.test(SRC));
  T('degrade: 连续失败闩锁静默降级（不再外呼）', /NET_FAIL_LIMIT/.test(SRC) && /inNetBlocked/.test(SRC));
})();

/* ============================ 行为断言 ============================ */
(function behaviors() {
  /* A 归一化：只剥离「IP属地」前缀，不推断内容 */
  T('act: normalize 「IP属地：广东」→「广东」', impl.normalizeLocation('IP属地：广东') === '广东');
  T('act: normalize 半角冒号与首尾空白', impl.normalizeLocation(' IP属地: 北京 ') === '北京');
  T('act: normalize 裸省份原样透传', impl.normalizeLocation('上海') === '上海');
  T('act: normalize 空值安全（空串/null/undefined）',
    impl.normalizeLocation('') === '' && impl.normalizeLocation(null) === '' && impl.normalizeLocation(undefined) === '');
  T('act: normalize 「IP属地：」（仅前缀）→ 空串', impl.normalizeLocation('IP属地：') === '');

  /* B 目标解析：不能确凿取得 oid 一律返回 null（零推断） */
  T('act: resolveTarget BV + __INITIAL_STATE__.aid', eq(impl.resolveTarget('/video/BV1GJ411x7h2/', 'www.bilibili.com', { aid: 170001 }), { type: 1, oid: '170001' }));
  T('act: resolveTarget BV 无 state → null（BV 不本地换算）', impl.resolveTarget('/video/BV1GJ411x7h2/', 'www.bilibili.com', null) === null);
  T('act: resolveTarget BV + videoData.aid', eq(impl.resolveTarget('/video/BV1abc12345', 'www.bilibili.com', { videoData: { aid: 999 } }), { type: 1, oid: '999' }));
  T('act: resolveTarget av 直链', eq(impl.resolveTarget('/video/av170001', 'www.bilibili.com', null), { type: 1, oid: '170001' }));
  T('act: resolveTarget 专栏 cv → type 12', eq(impl.resolveTarget('/read/cv2233/', 'www.bilibili.com', null), { type: 12, oid: '2233' }));
  T('act: resolveTarget 动态 t 域 → type 17', eq(impl.resolveTarget('/8888888', 't.bilibili.com', null), { type: 17, oid: '8888888' }));
  T('act: resolveTarget opus 图文 → type 17', eq(impl.resolveTarget('/opus/123456', 'www.bilibili.com', null), { type: 17, oid: '123456' }));
  T('act: resolveTarget 无法确定路径 → null', impl.resolveTarget('/dynamic/', 't.bilibili.com', null) === null);
  T('act: resolveTarget 个人空间主页 → null', impl.resolveTarget('/', 'space.bilibili.com', { mid: 5 }) === null);

  /* C 接口条目提取与映射构建（嵌套子回复 / 缺失字段 / 非法键） */
  var sample = [
    {
      rpid: '10001', member: { mid: '77' },
      reply_control: { location: 'IP属地：浙江' },
      replies: [{ rpid: '10002', member: { mid: '88' }, reply_control: { location: 'IP属地：湖南' } }]
    },
    { rpid: '10003', member: { mid: '99' }, reply_control: {} },
    { rpid: 'badkey' }
  ];
  var maps = impl.buildMaps(sample);
  T('act: buildMaps 一级评论归属地入表', maps.byRpid.get('10001') === '浙江');
  T('act: buildMaps 嵌套子回复一并吸收', maps.byRpid.get('10002') === '湖南');
  T('act: buildMaps 条目在但字段缺失 → 存空串（已知缺失≠未知）', maps.byRpid.has('10003') && maps.byRpid.get('10003') === '');
  T('act: buildMaps 非数字 rpid 不入表', !maps.byRpid.has('badkey'));
  T('act: buildMaps mid 兜底映射生效', maps.byMid.get('77') === '浙江');

  /* D 幂等/降级决策矩阵 */
  var d1 = impl.decide({ existing: null, resolved: '广东', netBlocked: false });
  T('decide: 有数据首次注入实值', d1.action === 'ensure' && d1.value === '广东' && d1.na === false);
  var d2 = impl.decide({ existing: null, resolved: '', netBlocked: false });
  T('decide: 已知字段缺失 → 灰占位 --（na 态）', d2.action === 'ensure' && d2.value === '--' && d2.na === true);
  var d3 = impl.decide({ existing: null, resolved: undefined, netBlocked: false });
  T('decide: 未知条目 wait（不动节点）', d3.action === 'wait');
  var d4 = impl.decide({ existing: null, resolved: undefined, netBlocked: true });
  T('decide: 网络失败 + 未知 → silent 静默不动无弹窗', d4.action === 'silent');
  var d5 = impl.decide({ existing: { value: '广东', na: false }, resolved: '广东', netBlocked: false });
  T('decide: 相同状态二次处理 → noop（幂等）', d5.action === 'noop');
  var d6 = impl.decide({ existing: { value: '--', na: true }, resolved: '', netBlocked: false });
  T('decide: 占位态二次处理 → noop（幂等）', d6.action === 'noop');
  var d7 = impl.decide({ existing: { value: '--', na: true }, resolved: '江苏', netBlocked: false });
  T('decide: 数据随后到位 → 原地更新实值（复用节点）', d7.action === 'ensure' && d7.value === '江苏' && d7.na === false);

  /* E 双轮扫描模拟：第二轮不得重复插入 */
  var first = impl.decide({ existing: null, resolved: '湖北' });
  var second = impl.decide({ existing: { value: first.value, na: false }, resolved: '湖北' });
  T('scenario: 同一条目两轮扫描 inject→noop，不重复插入', first.action === 'ensure' && second.action === 'noop');

  /* F 原生展示识别器 */
  T('act: IP_RE 识别原生「IP属地」文本以跳过原生条目', impl.IP_RE.test('用户名 IP属地：北京'));
})();

/* ============================ 汇总 ============================ */
console.log('\nSUMMARY pass=' + passCount + ' fail=' + failCount +
  (failures.length ? '\nFAILED: ' + failures.join('; ') : ' ALL_GREEN'));
process.exitCode = failCount ? 1 : 0;
