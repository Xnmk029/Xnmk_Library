/* ============ Balatro Web — 启动 ============ */
'use strict';

window.addEventListener('DOMContentLoaded', () => {
  BG.init();
  Shake.init();
  if (!Settings.get('crt', true)) $('#crt').classList.add('off');
  // 首次交互解锁音频
  const unlock = () => { SFX.resume(); document.removeEventListener('pointerdown', unlock); };
  document.addEventListener('pointerdown', unlock);
  // 键盘快捷键
  document.addEventListener('keydown', e => {
    if (G && G.phase === 'round' && !UI.playing){
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doPlay(); }
      if (e.key === 'Backspace' || e.key.toLowerCase() === 'x') doDiscard();
    }
    if (e.key === 'Escape'){ $$('.overlay').forEach(o => o.remove()); closeActionMenu(); }
  });
  // 窗口缩放重排
  addEventListener('resize', () => { if (G && G.phase === 'round') layoutHand(true); });
  physicsLoop();
  screenMenu();
  // ---- QA 钩子: 脚本化场景便于自动化验证 ----
  const qa = new URLSearchParams(location.search).get('qa');
  if (qa) setTimeout(() => runQA(qa), 300);
});

function bestFive(hand){
  // 枚举 5 张(或更少)组合, 选牌型最优+估值最高
  let best = null;
  const combos = [];
  const n = hand.length;
  for (let mask = 1; mask < (1 << n); mask++){
    if (Number(mask.toString(2).split('').filter(x => x === '1').length) > 5) continue;
    combos.push(hand.filter((_, i) => mask & (1 << i)));
  }
  const order = HAND_ORDER;
  for (const cs of combos){
    const ev = evaluateHand(cs);
    const lv = G.handLevels[ev.type];
    const scoreEst = (lv.chips + ev.scoring.reduce((a, c) => a + (isStone(c) ? 50 : c.rank >= 11 && c.rank <= 13 ? 10 : c.rank === 14 ? 11 : c.rank), 0)) * lv.mult;
    const rank = order.indexOf(ev.type);
    const key = (12 - rank) * 1e7 + scoreEst;
    if (!best || key > best.key) best = { key, cards: cs };
  }
  return best;
}
function qaSelectBest(){
  const best = bestFive(G.hand);
  best.cards.forEach(c => UI.selected.add(c.uid));
  G.hand.forEach(c => { const e = Cards.get(c.uid); if (e) e.el.classList.toggle('selected', UI.selected.has(c.uid)); });
  updateHandPreview(); layoutHand();
  return best;
}
function runQA(qa){
  if (qa === 'game' || qa === 'play' || qa === 'score'){
    startRun('red'); startRound('small'); screenGame();
    setTimeout(() => {
      qaSelectBest();
      if (qa !== 'game') setTimeout(() => doPlay(), 700);
    }, 900);
  } else if (qa === 'shop'){
    startRun('red');
    G.money = 30;
    addJoker('joker'); addJoker('fibonacci'); addJoker('baron', 'holo');
    addConsumable('tarot', 'magician'); addConsumable('planet', 'jupiter');
    genShop(); screenShop();
  } else if (qa === 'blinds'){
    startRun('blue'); G.ante = 3; screenBlinds();
  } else if (qa === 'cashout'){
    startRun('red'); startRound('small'); G.score = 999; G.handsLeft = 2;
    addJoker('golden'); addJoker('rocket');
    screenCashout();
  } else if (qa === 'end'){
    startRun('red'); startRound('boss'); G.score = 123; gameOver();
  } else if (qa === 'full'){
    startRun('red'); startRound('small'); screenGame();
    setTimeout(async () => {
      let guard = 0;
      while (G.phase === 'round' && G.score < G.target && G.handsLeft > 0 && guard++ < 6){
        qaSelectBest();
        await sleep(500);
        await doPlay();
        await sleep(400);
      }
    }, 1000);
  } else if (qa === 'cons'){
    startRun('red'); startRound('small'); screenGame();
    addConsumable('planet', 'jupiter'); addConsumable('tarot', 'magician');
    renderCons();
    setTimeout(() => {
      useConsumable(G.consumables[0]); // 先用星球
      setTimeout(() => { const t = G.consumables[0]; if (t) useConsumable(t); }, 900); // 再开塔罗选牌
    }, 900);
  } else if (qa === 'boss'){
    startRun('red'); G.bossId = 'plant'; startRound('boss'); screenGame();
    setTimeout(() => { qaSelectBest(); }, 900);
  } else if (qa === 'jokers'){
    startRun('red'); startRound('small'); screenGame();
    ['joker','greedy','lusty','fibonacci','photograph'].forEach(id => addJoker(id));
    renderJokers();
    setTimeout(() => { qaSelectBest(); setTimeout(doPlay, 700); }, 900);
  }
}
