// CDP 冒烟测试：加载页面 → 检查错误 → 模拟完整游戏流程
const { execSync, spawn } = require('child_process');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///G:/%E4%BA%A7%E5%93%81/%E6%96%B0benchmark/%E5%B0%8F%E4%B8%91%E7%89%8C/V4f/index.html';
const PORT = 9225;

const errors = [];
let ws = null, msgId = 0;
const pending = new Map();

function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}

async function evalJS(expr) {
  let r;
  const timer = setTimeout(() => { throw new Error('EVAL TIMEOUT: ' + expr.slice(0, 60)); }, 5000);
  try {
    r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('JS error: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  } finally { clearTimeout(timer); }
  return r.result && r.result.value;
}

async function click(selector) {
  const r = await evalJS(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return 'NOT_FOUND:' + ${JSON.stringify(selector)};
    el.click();
    return 'clicked';
  })()`);
  return r;
}

async function clickText(text) {
  return evalJS(`(() => {
    const els = [...document.querySelectorAll('button, .deck-card, .bs-card, .shop-item, .cons-slot, .pcard')].sort((a,b) => (a.tagName==='BUTTON'?0:1)-(b.tagName==='BUTTON'?0:1));
    const el = els.find(e => (e.textContent || '').includes(${JSON.stringify(text)}));
    if (!el) return 'NOT_FOUND:' + ${JSON.stringify(text)};
    el.click();
    return 'clicked:' + el.className;
  })()`);
}

async function wait(ms) { await new Promise(r => setTimeout(r, ms)); }

async function main() {
  // 启动 chrome
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--user-data-dir=C:/msys64/tmp/chrome-prof', '--allow-file-access-from-files', 'about:blank'
  ], { stdio: 'ignore' });

  // 等待调试端口
  let target = null;
  for (let i = 0; i < 30; i++) {
    await wait(500);
    try {
      const r = await fetch(`http://localhost:${PORT}/json`);
      const list = await r.json();
      target = list.find(t => t.type === 'page');
      if (target) break;
    } catch (e) { }
  }
  if (!target) { console.log('FAIL: no chrome target'); process.exit(1); }

  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const pageLogs = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.consoleAPICalled') pageLogs.push(m.params.args.map(a => a.value !== undefined ? a.value : a.description || '').join(' '));
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message));
      else p.resolve(m.result);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push('EXCEPTION: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text));
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push('CONSOLE: ' + m.params.args.map(a => a.value || a.description || '').join(' '));
    }
  };
  await send('Runtime.enable');
  await evalJS('window.addEventListener("unhandledrejection", e => console.log("UNHANDLED:", e.reason && (e.reason.stack || e.reason.message || String(e.reason))))');
  await send('Page.enable');

  // 导航
  await send('Page.navigate', { url: URL });
  await wait(3000);

  const t1 = await evalJS('document.querySelector(".tl-main") ? document.querySelector(".tl-main").textContent : "NO TITLE"');
  console.log('1. 标题页:', t1);

  // 开始新游戏
  await clickText('开始新游戏');
  await wait(800);
  const decks = await evalJS('document.querySelectorAll(".deck-card").length');
  console.log('2. 牌组数量:', decks);

  // 选红色牌组（默认）→ 开始游戏
  await clickText('开始游戏');
  await wait(800);
  const bs = await evalJS('document.querySelectorAll(".bs-card").length');
  console.log('3. 盲注选择卡数量:', bs);

  // 迎战小盲注
  await clickText('迎战');
  await wait(1500);
  const handCount = await evalJS('document.querySelectorAll(".hand-card").length');
  const overlayInfo = await evalJS('(() => { const o=document.querySelector(".overlay-layer"); return o ? o.innerHTML.slice(0,200) : "NO OVERLAY"; })()');
  console.log('  覆盖层内容:', overlayInfo);
  const banner = await evalJS('document.querySelector(".round-banner") ? document.querySelector(".round-banner").textContent : "NO BANNER"');
  console.log('  回合横幅:', banner);
  const hudBlind = await evalJS('document.querySelector(".hb-name") ? document.querySelector(".hb-name").textContent : "NO"');
  console.log('4. 手牌数量:', handCount, '| 盲注:', hudBlind);

  // 选择前几张牌并出牌
  await evalJS(`(() => {
    const cards = [...document.querySelectorAll('.hand-card')];
    for (let i = 0; i < Math.min(5, cards.length); i++) {
      cards[i].dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
    }
    return document.querySelectorAll('.pcard.selected').length;
  })()`);
  await wait(300);
  await clickText('出牌');
  await wait(3500);
  const labelSeen = await evalJS('window.__labelSeen = window.__labelSeen || (!!document.querySelector(".hl-name") || !!document.querySelector(".score-num")); window.__labelSeen');
  const handAfter1 = await evalJS('document.querySelectorAll(".hand-card").length');
  console.log('5. 出牌后: 计分元素出现过=', labelSeen, '| 手牌数=', handAfter1);
  // 再打 3 手直到回合结束
  for (let i = 0; i < 3; i++) {
    await evalJS(`(() => { const cards=[...document.querySelectorAll('.hand-card')]; for(let j=0;j<Math.min(5,cards.length);j++) cards[j].dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); return cards.length; })()`);
    await wait(200);
    await clickText('出牌');
    await wait(3500);
    const ended = await evalJS('!!window.B.game.state.roundEnded || !!window.B.game.state.gameOver');
    if (ended) { await wait(1200); break; }
  }
  const st = await evalJS('({roundEnded: !!window.B.game.state.roundEnded, gameOver: window.B.game.state.gameOver, score: window.B.game.state.score, blind: window.B.game.state.blindChips, handsLeft: window.B.game.state.handsLeft})');
  console.log('6. 回合状态:', JSON.stringify(st));
  const roundEval = await evalJS('document.querySelector(".re-title") ? document.querySelector(".re-title").textContent : "NO EVAL"');
  console.log('7. 回合结算:', roundEval);
  // 如果赢了：进入商店
  if (st.roundEnded) {
    await clickText('前往商店');
    await wait(1500);
    const shopItems = await evalJS('document.querySelectorAll(".shop-item").length');
    const pack = await evalJS('document.querySelector(".shop-pack") ? 1 : 0');
    const voucher = await evalJS('document.querySelector(".shop-voucher") ? 1 : 0');
    console.log('8. 商店: 商品=', shopItems, '包=', pack, '券=', voucher);
    // 买第一个商品
    await evalJS('(() => { const b=document.querySelector(".shop-item .buy-btn"); if(b) b.click(); return !!b; })()');
    await wait(500);
    const money = await evalJS('window.B.game.state.money');
    console.log('9. 购买后金钱:', money);
  }

  console.log('=== 页面日志 ===');
  pageLogs.slice(0, 40).forEach(l => console.log(l));

  if (errors.length) {
    console.log('\n=== JS 错误 ===');
    errors.slice(0, 10).forEach(e => console.log(e));
  } else {
    console.log('\n=== 无 JS 错误 ===');
  }

  // 截图
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync('C:/msys64/tmp/cdp_shot.png', Buffer.from(shot.data, 'base64'));
  console.log('截图保存: C:/msys64/tmp/cdp_shot.png');

  chrome.kill();
  process.exit(errors.length ? 1 : 0);
}

main().catch(e => { console.log('FAIL:', e.message); process.exit(1); });
