'use strict';
// 校验套件：针对 bilibili-ip-location.user.js 的行为测试（jsdom 模拟 DOM / SPA / 网络）
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SCRIPT_PATH = path.join(__dirname, 'bilibili-ip-location.user.js');
const source = fs.readFileSync(SCRIPT_PATH, 'utf8');

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log('  PASS  ' + name);
  } else {
    fail++;
    failures.push(name + (detail ? ' | ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? ' | ' + detail : ''));
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---- 1. 静态检查 ----
console.log('[1] 静态检查');
check('语法检查 node --check 通过', (() => {
  try {
    require('child_process').execSync(`node --check "${SCRIPT_PATH}"`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
})());

const metaMatch = source.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
check('存在标准元数据块', !!metaMatch);
const meta = metaMatch ? metaMatch[0] : '';
for (const key of ['@name', '@namespace', '@match', '@grant', '@description', '@version', '@run-at']) {
  check(`元数据含 ${key}`, meta.includes(key));
}
check('元数据声明了适用域名（>=1 个 bilibili @match）', /@match\s+https:\/\/[a-z.]*bilibili\.com\//.test(meta));
check('网络请求已声明（@connect api.bilibili.com）', /@connect\s+api\.bilibili\.com/.test(meta));
check('权限最小化（@grant none）', /@grant\s+none/.test(meta));
check('无 GM_xmlhttpRequest 等广域授权', !/@grant\s+GM_/.test(meta));
check('无第三方依赖（无 @require/@import）', !/@require/.test(meta) && !/@import/.test(meta));
check('无 TODO/FIXME 占位', !/\bTODO\b|\bFIXME\b|\bXXX\b|待实现|未完成占位/.test(source));
check('单文件原生 JS（无外部 import/require 语句）', !/^\s*(import|require)\s/m.test(source));
check('声明了 @noframes 防止在 iframe 中重复运行', /@noframes/.test(meta));

// ---- 2. 构造 jsdom 页面 ----
function buildDom() {
  const html = `<!DOCTYPE html><html><head><title>t</title></head><body>
    <div id="viewbox_report" class="video-info-container">
      <div class="video-info-title"><h1 class="video-title">测试视频</h1></div>
    </div>
    <div id="comment-area">
      <div class="reply-item">用户A<span>IP属地：浙江</span></div>
      <div class="reply-item">用户B<span>IP属地：广东</span></div>
      <div class="reply-item">用户C<span>IP属地： 浙江</span></div>
    </div>
  </body></html>`;
  return new JSDOM(html, {
    url: 'https://www.bilibili.com/video/BV1xx/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
}

// ---- 3. 行为测试 ----
(async () => {
  console.log('[2] 正常路径（接口成功）');
  {
    const dom = buildDom();
    const w = dom.window;
    // 模拟 fetch 成功
    w.fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        code: 0,
        data: { addr: '1.2.3.4', country: '中国', province: '江西', city: '九江', isp: '电信', country_code: 86 }
      })
    });
    w.eval(source);
    await sleep(600); // 等 debounce(300ms) + fetch 微任务

    const doc = w.document;
    const panels = doc.querySelectorAll('#bilibili-ip-location-panel');
    check('面板被注入且唯一', panels.length === 1, 'count=' + panels.length);
    const panel = panels[0];
    check('面板使用内联模式（视频页锚点）', panel.className.includes('bip-inline'), 'class=' + panel.className);
    check('面板位于 #viewbox_report 之后', panel.previousElementSibling === doc.querySelector('#viewbox_report'));
    check('本机出口显示接口返回字段', panel.querySelector('.bip-self').textContent.includes('中国 江西 九江 · 电信'),
      'got=' + panel.querySelector('.bip-self').textContent);
    check('本机出口非灰色占位', !panel.querySelector('.bip-self').className.includes('bip-missing'));
    const pageText = panel.querySelector('.bip-page').textContent;
    check('本页显示聚合了页面 IP 属地且去重', pageText.includes('浙江') && pageText.includes('广东') && !pageText.includes('浙江、浙江'),
      'got=' + pageText);

    // ---- SPA 路由切换 + 异步 DOM 更新：不得重复插入 ----
    console.log('[3] SPA 路由切换与异步加载：幂等');
    for (let i = 0; i < 5; i++) {
      w.history.pushState({}, '', '/video/BV' + i);
      w.dispatchEvent(new w.PopStateEvent('popstate'));
    }
    await sleep(500);
    // 模拟异步插入新评论
    const area = doc.querySelector('#comment-area');
    const div = doc.createElement('div');
    div.className = 'reply-item';
    div.innerHTML = '用户D<span>IP属地：北京</span>';
    area.appendChild(div);
    await sleep(500);

    let count = doc.querySelectorAll('#bilibili-ip-location-panel').length;
    check('5次路由切换 + DOM 更新后面板仍唯一', count === 1, 'count=' + count);
    check('样式表仅一份', doc.querySelectorAll('#bilibili-ip-location-style').length === 1);
    check('异步新增评论的 IP 属地被扫描到', doc.querySelector('.bip-page').textContent.includes('北京'),
      'got=' + doc.querySelector('.bip-page').textContent);

    // ---- 锚点消失（路由切到无锚点页面）：降级为 fixed，仍唯一 ----
    console.log('[4] 锚点消失后降级放置');
    w.history.pushState({}, '', '/');
    w.dispatchEvent(new w.PopStateEvent('popstate'));
    doc.querySelector('#viewbox_report').remove();
    await sleep(500);
    count = doc.querySelectorAll('#bilibili-ip-location-panel').length;
    check('锚点移除后面板仍唯一', count === 1, 'count=' + count);
    const p2 = doc.querySelector('#bilibili-ip-location-panel');
    check('锚点缺失时切换为 fixed 模式', p2.className.includes('bip-fixed'), 'class=' + p2.className);
    check('fixed 模式挂在 body 下', p2.parentElement === doc.body);

    w.close();
  }

  console.log('[5] 网络失败降级（fetch reject）');
  {
    const dom = buildDom();
    const w = dom.window;
    w.fetch = () => Promise.reject(new Error('network down'));
    w.eval(source);
    await sleep(600);
    const doc = w.document;
    const panel = doc.querySelector('#bilibili-ip-location-panel');
    check('网络失败时面板仍注入', !!panel);
    const selfEl = panel.querySelector('.bip-self');
    check('网络失败时本机出口为灰色占位 —', selfEl.textContent === '—', 'got=' + selfEl.textContent);
    check('灰色占位带 bip-missing 类', selfEl.className.includes('bip-missing'));
    check('灰色占位有可识别 title', selfEl.title.length > 0);
    check('页面 IP 属地不受网络失败影响', panel.querySelector('.bip-page').textContent.includes('浙江'),
      'got=' + panel.querySelector('.bip-page').textContent);
    w.close();
  }

  console.log('[6] 字段缺失降级（接口返回空字段）');
  {
    const dom = buildDom();
    const w = dom.window;
    w.fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ code: 0, data: { addr: '1.2.3.4' } }) // 无 country/province/city
    });
    w.eval(source);
    await sleep(600);
    const selfEl = w.document.querySelector('.bip-self');
    check('字段缺失时灰色占位 —', selfEl.textContent === '—', 'got=' + selfEl.textContent);
    check('字段缺失时为 bip-missing', selfEl.className.includes('bip-missing'));
    w.close();
  }

  console.log('[7] 接口 code!=0 降级');
  {
    const dom = buildDom();
    const w = dom.window;
    w.fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ code: -404, message: 'not found' })
    });
    w.eval(source);
    await sleep(600);
    const selfEl = w.document.querySelector('.bip-self');
    check('code 非 0 时灰色占位 —', selfEl.textContent === '—', 'got=' + selfEl.textContent);
    w.close();
  }

  console.log('[8] 页面无 IP 属地文本时降级');
  {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="viewbox_report"></div><p>没有属地信息</p></body></html>', {
      url: 'https://space.bilibili.com/123',
      runScripts: 'outside-only',
      pretendToBeVisual: true
    });
    const w = dom.window;
    w.fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ code: 0, data: { country: '中国', province: '江西', city: '九江', isp: '电信' } })
    });
    w.eval(source);
    await sleep(600);
    const panel = w.document.querySelector('#bilibili-ip-location-panel');
    check('无属地文本时面板仍唯一注入', w.document.querySelectorAll('#bilibili-ip-location-panel').length === 1);
    const pageEl = panel.querySelector('.bip-page');
    check('本页显示为灰色占位 —', pageEl.textContent === '—', 'got=' + pageEl.textContent);
    check('本页占位有 title 说明', pageEl.title.length > 0);
    check('本机出口仍正常显示', panel.querySelector('.bip-self').textContent.includes('九江'),
      'got=' + panel.querySelector('.bip-self').textContent);
    w.close();
  }

  console.log('[9] fetch 参数检查（不携带凭据）');
  {
    const dom = buildDom();
    const w = dom.window;
    let captured = null;
    w.fetch = (url, opts) => {
      captured = { url, opts };
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ code: 0, data: { country: '中国', province: '江西', city: '九江', isp: '电信' } }) });
    };
    w.eval(source);
    await sleep(600);
    check('请求 URL 为已声明的 zone 接口', captured && captured.url === 'https://api.bilibili.com/x/web-interface/zone',
      captured && captured.url);
    check('请求 credentials 为 omit（不发送 cookie）', captured && captured.opts && captured.opts.credentials === 'omit',
      captured && JSON.stringify(captured.opts));
    check('无 localStorage 写入（除测试自身写入外无其他键）', (() => {
      try {
        const before = Object.keys(w.localStorage).length;
        w.localStorage.setItem('__bip_probe', '1');
        const during = Object.keys(w.localStorage).length;
        w.localStorage.removeItem('__bip_probe');
        return before === 0 && during === 1;
      } catch (e) { return false; }
    })());
    w.close();
  }

  console.log('');
  console.log(`结果: ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log('失败项:');
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  }
})();
