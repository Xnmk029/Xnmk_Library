import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const here = dirname(fileURLToPath(import.meta.url));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--remote-debugging-port=9344', '--user-data-dir=' + join(here, '.chrome-ft'),
  '--no-first-run', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--window-size=800,500', 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) {
  try { const tabs = await (await fetch('http://127.0.0.1:9344/json/list')).json(); const tab = tabs.find(t => t.type === 'page'); if (tab) wsUrl = tab.webSocketDebuggerUrl; } catch (e) {}
  await sleep(400);
}
const ws = new WebSocket(wsUrl);
let msgId = 0; const pending = new Map();
const errors = [];
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
const send = (method, params = {}) => new Promise(res => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evl = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.result && r.result.exceptionDetails) return { exc: (r.result.exceptionDetails.exception?.description || 'err').slice(0, 300) };
  return { val: r.result && r.result.result && r.result.result.value };
};
await new Promise(r => ws.onopen = r);
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: 'file:///' + join(here, 'dist', 'index.html').replace(/\\/g, '/') });
await sleep(6000);
await send('Runtime.evaluate', { expression: "document.getElementById('btn-new') && document.getElementById('btn-new').click()" });
await sleep(1000);
await send('Runtime.evaluate', { expression: "document.getElementById('cc-start') && document.getElementById('cc-start').click()" });
await sleep(8000);
await send('Runtime.evaluate', { expression: "(() => { const r = __game.renderer; r.renderer.setPixelRatio(0.5); r.renderer.setSize(800, 450); r.shadowMap.enabled = false; r.sun.castShadow = false; document.getElementById('screen').classList.add('hidden'); return 1; })()" });
await sleep(1500);
const out = {};
// 1) 存档→改状态→读档

out.pre = await evl("(() => { const g = __game; g.save(); g.player.giveItem('bandage', 5, { silent: true }); g.player.x = 77; g.player.z = 77; const inv = g.player.inv.length; g.continueSave(g.loadSaveData()); return JSON.stringify({ invAfter: g.player.inv.length, x: Math.round(g.player.x), z: Math.round(g.player.z), state: g.state }); })()");
// 2) 死亡流程

out.death = await evl("(() => { const g = __game; g.state = 'playing'; g.player.stats.parts.torso.hp = 0; g.player.stats.parts.head.hp = 0; g.events.emit('death', '测试死亡'); return JSON.stringify({ state: g.state, screen: document.getElementById('screen').innerHTML.slice(0, 60) }); })()");
// 3) 重开一局并走胜利流程

await send('Runtime.evaluate', { expression: "document.getElementById('death-main') && document.getElementById('death-main').click()" });
await sleep(800);
await send('Runtime.evaluate', { expression: "document.getElementById('btn-new') && document.getElementById('btn-new').click()" });
await sleep(800);
await send('Runtime.evaluate', { expression: "document.getElementById('cc-start') && document.getElementById('cc-start').click()" });
await sleep(6000);
const st2 = await evl("JSON.stringify({ state: __game.state, day: __game.env.day, marker: __game.charDef && __game.charDef.name })");
console.log('AFTER 2ND START:', st2.val);
const setup = await evl("(() => { const r = __game.renderer; r.renderer.setPixelRatio(0.5); r.renderer.setSize(800, 450); r.renderer.shadowMap.enabled = false; r.sun.castShadow = false; document.getElementById('screen').classList.add('hidden'); const g = __game; g.world.car.parts.battery = true; g.world.car.parts.fuel = true; g.world.car.parts.engine = true; g.player.x = g.world.extract.x; g.player.z = g.world.extract.z; g.ui.openCarPanel(); return 1; })()");
console.log('SETUP:', JSON.stringify(setup));
const lastErr = await evl('__game.lastError || null');
console.log('LASTERR:', JSON.stringify(lastErr));
await sleep(1500);
const winPre = await evl("JSON.stringify({ hasBtn: !!document.getElementById('car-go'), dist: Math.round(Math.hypot(__game.player.x - __game.world.extract.x, __game.player.z - __game.world.extract.z)), parts: JSON.stringify(__game.world.car.parts), screenLen: document.getElementById('screen').innerHTML.length })");
console.log('WIN PRE:', winPre.val);
out.win = await evl("(() => { const g = __game; const btn = document.getElementById('car-go'); if (btn) { btn.click(); } return JSON.stringify({ state: g.state, hasBtn: !!btn }); })()");
console.log('=== FLOW TEST ===');
console.log(JSON.stringify(out, null, 1));
console.log('ERRORS:', errors.slice(0, 12).join(' | ') || 'none');
chrome.kill(); process.exit(0);