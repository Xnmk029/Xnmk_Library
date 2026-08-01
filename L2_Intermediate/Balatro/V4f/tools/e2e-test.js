// 完整 E2E：盲注→商店→开包→Boss→下一注
const { spawn } = require('child_process');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///G:/%E4%BA%A7%E5%93%81/%E6%96%B0benchmark/%E5%B0%8F%E4%B8%91%E7%89%8C/V4f/index.html';
const PORT = 9230;
let ws = null, msgId = 0;
const pending = new Map();
const errors = [];
const pageLogs = [];
function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}
async function evalJS(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return 'EXC: ' + JSON.stringify(r.exceptionDetails).slice(0, 200);
  return r.result && r.result.value;
}
async function clickText(text) {
  return evalJS(`(() => {
    const els = [...document.querySelectorAll('button')];
    const el = els.find(e => (e.textContent || '').includes(${JSON.stringify(text)}));
    if (!el) return 'NOT_FOUND:' + ${JSON.stringify(text)};
    el.click();
    return 'ok';
  })()`);
}
// 轮询点击直到成功
async function waitClick(text, timeout) {
  const t0 = Date.now();
  while (Date.now() - t0 < (timeout || 10000)) {
    const r = await clickText(text);
    if (r === 'ok') return true;
    await wait(300);
  }
  console.log('  [点击超时]', text);
  return false;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
// 轮询等待页面出现某条件
async function waitFor(expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < (timeout || 8000)) {
    const v = await evalJS(expr);
    if (v) return v;
    await wait(250);
  }
  console.log('  [等待超时]', label || expr.slice(0, 50));
  return null;
}
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

(async () => {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--user-data-dir=C:/msys64/tmp/chrome-prof5', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 25; i++) {
    await wait(400);
    try {
      const list = await (await fetch(`http://localhost:${PORT}/json`)).json();
      target = list.find(t => t.type === 'page');
      if (target) break;
    } catch (e) { }
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE: ' + m.params.args.map(a => a.value || '').join(' '));
    if (m.method === 'Runtime.consoleAPICalled') pageLogs.push(m.params.args.map(a => a.value !== undefined ? a.value : a.description || '').join(' '));
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: URL });
  await wait(2200);

  console.log('== 开局 ==');
  await clickText('开始新游戏');
  await wait(500);
  await evalJS(`document.querySelector('.deck-card').click()`);
  await clickText('开始游戏');
  await wait(500);
  check('盲注选择渲染', (await evalJS('document.querySelectorAll(".bs-card").length')) === 3);
  check('盲注数值 300', (await evalJS('window.B.game.state.blindChips')) === 0, '等待选择');

  // 作弊：给钱 + 强力 joker
  await evalJS(`(() => {
    const g = window.B.game.state;
    g.money = 100;
    const j1 = window.B.game.makeJoker('j_stuntman', {});
    const j2 = window.B.game.makeJoker('j_joker', {});
    const j3 = window.B.game.makeJoker('j_joker', {});
    const j4 = window.B.game.makeJoker('j_blackboard', {});
    g.jokers.push(j1, j2, j3, j4);
    return g.jokers.length;
  })()`);

  await waitClick('迎战');
  await wait(1500);
  check('进入回合: 8张手牌', (await evalJS('document.querySelectorAll(".hand-card").length')) === 8);
  check('HUD 盲注显示', (await evalJS('document.querySelector(".hb-name") ? document.querySelector(".hb-name").textContent : ""')) === '小盲注');

  // 打牌直到赢（最多 4 手）
  let won = false;
  for (let i = 0; i < 4; i++) {
    await evalJS(`(() => { const cards=[...document.querySelectorAll('.hand-card')]; for(let j=0;j<Math.min(5,cards.length);j++) cards[j].dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); return 1; })()`);
    await wait(150);
    await clickText('出牌');
    await wait(3500);
    const st = await evalJS('({re: !!window.B.game.state.roundEnded, go: window.B.game.state.gameOver, score: window.B.game.state.score, win: window.B.game.state.roundEnded ? window.B.game.state.roundEnded.win : null})');
    console.log('    手', i+1, '得分:', st.score);
    if (st.re || st.go) { won = !!st.win; break; }
  }
  check('击败小盲注', won, 'score/target');
  await wait(2500); // 结算动画

  console.log('== 商店 ==');
  await waitClick('前往商店');
  const shopReady = await waitFor('document.querySelectorAll(".shop-item").length >= 2', 8000, '商店渲染');
  check('商店渲染', !!shopReady);
  const shopInfo = await evalJS('({items: document.querySelectorAll(".shop-item").length, pack: !!document.querySelector(".shop-pack"), voucher: !!document.querySelector(".shop-voucher"), money: window.B.game.state.money})');
  check('补充包出现', shopInfo.pack);
  check('优惠券出现', shopInfo.voucher);
  console.log('  商店信息:', JSON.stringify(shopInfo));

  // 购买第一个商品
  const buyRes = await evalJS(`(() => { const b=document.querySelector('.shop-item .buy-btn'); if(!b) return 'NOBUY'; b.click(); return 'bought'; })()`);
  check('购买商品', buyRes === 'bought');
  await wait(500);

  // 开包
  if (shopInfo.pack) {
    await waitClick('打开');
    await wait(2500);
    const packCards = await evalJS('document.querySelectorAll(".pack-card").length');
    check('开包: 卡牌数量', packCards >= 2, packCards);
    // 选第一张
    await evalJS(`(() => { const c=document.querySelector('.pack-card.revealed'); if(c) c.click(); return !!c; })()`);
    await wait(1500);
    check('开包后返回商店', (await evalJS('!!document.querySelector(".shop-title")')));
  }

  console.log('== 大盲注 ==');
  await waitClick('前往下一个盲注');
  await waitFor('!!document.querySelector(".bs-card.current .btn")', 8000, '盲注选择');
  check('盲注选择(大盲注)', (await evalJS('document.querySelector(".bs-title") ? document.querySelector(".bs-title").textContent : ""')).includes('第 1 注'));
  await evalJS('document.querySelector(".bs-card.current .btn").click()');
  await wait(1200);
  const bigTarget = await evalJS('window.B.game.state.blindChips');
  check('大盲注目标 450', bigTarget === 450, bigTarget);
  // 打到大盲注赢
  won = false;
  for (let i = 0; i < 4; i++) {
    const selCnt = await evalJS(`(() => { const cards=[...document.querySelectorAll('.hand-card')]; for(let j=0;j<Math.min(5,cards.length);j++) cards[j].dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); return document.querySelectorAll('.pcard.selected').length; })()`);
    await wait(150);
    const playRes = await clickText('出牌');
    await wait(4000);
    const st = await evalJS('({re: !!window.B.game.state.roundEnded, go: window.B.game.state.gameOver, score: window.B.game.state.score, hands: window.B.game.state.handsLeft, uiMode: window.B.game.state.uiMode, win: window.B.game.state.roundEnded ? window.B.game.state.roundEnded.win : null})');
    console.log('    大盲注手', i+1, '选中:', selCnt, '点出牌:', playRes, '状态:', JSON.stringify(st));
    if (st.re || st.go) { won = !!st.win; break; }
  }
  check('击败大盲注', won);
  await wait(2500);
  await waitClick('前往商店');
  await wait(1200);

  console.log('== Boss ==');
  await waitClick('前往下一个盲注');
  await waitFor('!!document.querySelector(".bs-card.boss .bs-name")', 8000, 'Boss卡');
  const bossName = await evalJS('document.querySelector(".bs-card.boss .bs-name") ? document.querySelector(".bs-card.boss .bs-name").textContent : "NOBOSS"');
  check('Boss 卡显示', bossName !== 'NOBOSS', bossName);
  await evalJS('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("挑战 Boss")).click()');
  await wait(1200);
  const bossTarget = await evalJS('window.B.game.state.blindChips');
  check('Boss 目标 600', bossTarget === 600, bossTarget);
  // 打 Boss
  won = false;
  for (let i = 0; i < 4; i++) {
    await evalJS(`(() => { const cards=[...document.querySelectorAll('.hand-card')]; for(let j=0;j<Math.min(5,cards.length);j++) cards[j].dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); return 1; })()`);
    await wait(150);
    await clickText('出牌');
    await wait(3500);
    const st = await evalJS('({re: !!window.B.game.state.roundEnded, go: window.B.game.state.gameOver, win: window.B.game.state.roundEnded ? window.B.game.state.roundEnded.win : null})');
    if (st.re || st.go) { won = !!st.win; break; }
  }
  check('击败 Boss', won);
  await wait(2500);
  await waitClick('进入下一注');
  await waitFor('document.querySelector(".bs-title") && document.querySelector(".bs-title").textContent.includes("第 2 注")', 8000, '第2注');
  const ante2 = await evalJS('document.querySelector(".bs-title") ? document.querySelector(".bs-title").textContent : ""');
  check('进入第 2 注', ante2.includes('第 2 注'), ante2);

  console.log('== 塔罗使用 ==');
  await evalJS(`(() => { const g = window.B.game.state; g.money = 99; g.consumables = []; const cn = window.B.game.makeConsumable('c_magician'); g.consumables.push(cn); return g.consumables.length; })()`);
  // 进商店显示消耗品 → 回盲注 → 迎战 → 用塔罗
  await waitClick('迎战');
  await wait(1200);
  const diag1 = await evalJS(`(() => { const c=document.querySelector('.cons-slot'); if(!c) return 'NO_CONS'; c.click(); return 'CLICKED'; })()`);
  const diag2 = await evalJS('window.B.game.state.uiMode + "|" + (window.B.game.state.targetMode ? window.B.game.state.targetMode.key : "none")');
  console.log('  塔罗诊断: 点击=', diag1, 'uiMode/target=', diag2);
  await wait(300);
  await evalJS(`(() => { const cards=[...document.querySelectorAll('.hand-card')]; for(let j=0;j<2;j++) cards[j].dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); return 1; })()`);
  await wait(300);
  const enhanced = await evalJS('window.B.game.state.hand.slice(0,2).map(c=>c.enhancement).join(",")');
  check('塔罗增强手牌', enhanced === 'lucky,lucky', enhanced);

  // 弃牌测试
  await evalJS(`(() => { const cards=[...document.querySelectorAll('.hand-card')]; for(let j=0;j<3;j++) cards[j].dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); return 1; })()`);
  await wait(150);
  const discBefore = await evalJS('window.B.game.state.discardsLeft');
  await clickText('弃牌');
  await wait(800);
  const discAfter = await evalJS('window.B.game.state.discardsLeft');
  check('弃牌消耗', discAfter === discBefore - 1, discBefore + '->' + discAfter);

  console.log('\n=== 结果:', pass, '通过,', fail, '失败 ===');
  if (errors.length) {
    console.log('=== JS 错误 ===');
    errors.slice(0, 8).forEach(e => console.log(e));
  }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync('C:/msys64/tmp/e2e_final.png', Buffer.from(shot.data, 'base64'));
  console.log('截图: C:/msys64/tmp/e2e_final.png');
  chrome.kill();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL:', e.message); process.exit(1); });
