'use strict';
/*
 * 静态审计：捕获所有被静默吞掉的异常，暴露未定义引用等真实缺陷。
 * 该文件仅用于验证，不属于交付物。
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(__dirname, 'harness', 'node_modules', 'jsdom'));

const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'answer.user.js'), 'utf8');

/* 把脚本里所有静默 catch 改成记录，再跑一遍完整回放 */
const instrumented = SRC
  .split('catch (e) { /* 单个条目失败不影响其它 */ }').join('catch (e) { window.__SWALLOWED.push("refreshTrackers: " + e.message); }')
  .split('catch (e) { /* 单条失败不影响其它 */ }').join('catch (e) { window.__SWALLOWED.push("handleLightTime: " + e.message); }')
  .split('catch (e) { /* 忽略 */ }').join('catch (e) { window.__SWALLOWED.push("silent: " + (e && e.message)); }')
  .split('catch (e) { /* 兜底逻辑静默失败 */ }').join('catch (e) { window.__SWALLOWED.push("harvest: " + e.message); }')
  .split('catch (e) { /* 兜底巡检仍可工作 */ }').join('catch (e) { window.__SWALLOWED.push("bbWrap: " + e.message); }')
  .split('catch (e) { /* 观察器回调不得抛出 */ }').join('catch (e) { window.__SWALLOWED.push("onMutations: " + e.message); }');

const PAGE = fs.readFileSync(path.join(__dirname, 'replay.html'), 'utf8');
const virtualConsole = new VirtualConsole();
const pageErrors = [];
virtualConsole.on('jsdomError', (e) => pageErrors.push('jsdomError: ' + (e && e.message)));

const dom = new JSDOM(PAGE, {
  url: 'http://127.0.0.1/video/BV1xx411c7mD',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole
});
const w = dom.window;
w.__SWALLOWED = [];

/* 让页面的 fetch 返回与回放一致的夹具，使所有断言都走到真实分支 */
const FETCH_FIXTURE = {
  code: 0,
  data: {
    replies: [{
      rpid_str: '9007199254741015', rpid: 9007199254741015,
      reply_control: { location: 'IP属地：海南' },
      member: { mid: '10001', uname: '测试用户', location: '资料城市：北京' },
      content: { message: '我来自上海' }
    }]
  }
};
function fakeResponse(payload, status) {
  return {
    status: status,
    ok: status === 200,
    url: 'http://127.0.0.1/x/v2/reply/main',
    headers: { get: () => 'application/json' },
    clone: function () { return fakeResponse(payload, status); },
    json: () => Promise.resolve(payload)
  };
}
w.__FETCH_FIXTURE__ = FETCH_FIXTURE;
w.fetch = (input) => {
  const url = String(typeof input === 'string' ? input : (input && input.url) || '');
  if (url.indexOf('/fail') >= 0) return Promise.resolve(fakeResponse({ code: -412 }, 500));
  return Promise.resolve(fakeResponse(FETCH_FIXTURE, 200));
};

w.eval(instrumented);

const deadline = Date.now() + 90000;
(async () => {
  let result = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200));
    result = w.__RESULT__ || null;
    if (result) break;
  }
  if (!result) {
    console.error('回放未完成');
    process.exit(2);
  }
  const swallowed = Array.from(new Set(w.__SWALLOWED));
  const report = {
    pass: result.pass,
    fail: result.fail,
    failures: result.failures,
    pageErrors: Array.from(new Set(pageErrors)),
    swallowedErrors: swallowed
  };
  console.log(JSON.stringify(report, null, 2));
  const ok = result.fail === 0 && pageErrors.length === 0 && swallowed.length === 0;
  console.log('\n==== ' + (ok ? 'NO SWALLOWED ERRORS' : 'SWALLOWED ERRORS PRESENT') + ' ====');
  process.exit(ok ? 0 : 1);
})();
