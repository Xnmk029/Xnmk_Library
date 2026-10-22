import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const here = dirname(fileURLToPath(import.meta.url));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--remote-debugging-port=9343', '--user-data-dir=' + join(here, '.chrome-gt'),
  '--no-first-run', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--window-size=1600,900', 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) {
  try { const tabs = await (await fetch('http://127.0.0.1:9343/json/list')).json(); const tab = tabs.find(t => t.type === 'page'); if (tab) wsUrl = tab.webSocketDebuggerUrl; } catch (e) {}
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
const key = (code, type = 'keydown') => send('Runtime.evaluate', { expression: "window.dispatchEvent(new KeyboardEvent('" + type + "', { code: '" + code + "', key: '" + code.replace('Key','').toLowerCase() + "' }))" });
const aimAt = (zExpr) => send('Runtime.evaluate', { expression: "(() => { const g = __game; const r = g.renderer; const z = " + zExpr + "; const v = new THREE.Vector3(z.x - 100, 0.9, z.z - 100).project(r.camera); const sx = (v.x * 0.5 + 0.5) * window.innerWidth; const sy = (-v.y * 0.5 + 0.5) * window.innerHeight; g.input.mouse.x = sx; g.input.mouse.y = sy; g.input.computeAim(); return Math.round(sx) + ',' + Math.round(sy); })()" });
await new Promise(r => ws.onopen = r);
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: 'file:///' + join(here, 'dist', 'index.html').replace(/\\/g, '/') });
await sleep(6000);
await send('Runtime.evaluate', { expression: "document.getElementById('btn-new') && document.getElementById('btn-new').click()" });
await sleep(1000);
await send('Runtime.evaluate', { expression: "document.getElementById('cc-start') && document.getElementById('cc-start').click()" });
await sleep(9000);
await send('Runtime.evaluate', { expression: "(() => { const r = __game.renderer; r.renderer.setPixelRatio(0.5); r.renderer.setSize(800, 450); r.shadowMap.enabled = false; r.sun.castShadow = false; return 1; })()" });
await send('Runtime.evaluate', { expression: "document.getElementById('screen').classList.add('hidden')" });
await sleep(500);
const out = {};
// 1) 移动测试

const p0 = await evl('JSON.stringify({ x: __game.player.x, z: __game.player.z })');
await key('KeyW'); await sleep(1200); await key('KeyW', 'keyUp');
const p1 = await evl('JSON.stringify({ x: __game.player.x, z: __game.player.z })');
out.move = { before: p0.val, after: p1.val };
// 2) 传送到容器旁并搜刮

await evl("(() => { const g = __game; g.input.keys.clear(); g.player.x = 18; g.player.z = 18; const c = g.world.containers[0]; c.x = 18; c.z = 18; return 1; })()");
await sleep(2000);
out.lootTarget = await evl("JSON.stringify({ t: __game.interact.targetType, px: __game.player.x, pz: __game.player.z })");
await key('KeyE'); await sleep(10000);
out.loot = await evl("JSON.stringify({ containerOpen: !!__game.ui.containerOpen, items: __game.ui.containerOpen ? __game.ui.containerOpen.items.length : -1, action: __game.interact.action && __game.interact.action.label })");
// 3) 关闭面板，给枪并射击丧尸

await send('Runtime.evaluate', { expression: "document.getElementById('panel-close') && document.getElementById('panel-close').click()" });
await evl("(() => { const g = __game; g.input.keys.clear(); g.player.x = 30; g.player.z = 30; g.player.giveItem('glock17', 1, { silent: true }); const stk = g.player.inv[g.player.inv.length - 1]; g.player.setHeld(stk, 'inv'); g.player.giveItem('9mm', 100, { silent: true }); stk.item.mag = 17; const z = g.zombies.spawn(g.player.x + 3, g.player.z, 'shambler'); window.__testZ = z; return 1; })()");
await sleep(300);
// 瞄准：把 aimAngle 指向丧尸

await aimAt('window.__testZ');
await sleep(500);
for (let i = 0; i < 3; i++) { await aimAt('window.__testZ'); await key('Space'); await sleep(2600); }
out.combat = await evl("JSON.stringify({ zDead: window.__testZ.dead, zHp: window.__testZ.hp, mag: __game.player.held ? __game.player.held.item.mag : -1, kills: __game.player.stats.kills })");
// 4) 近战测试

await evl("(() => { const g = __game; g.input.keys.clear(); g.player.x = 26; g.player.z = 30; g.player.giveItem('baseball_bat', 1, { silent: true }); const stk = g.player.inv[g.player.inv.length - 1]; g.player.setHeld(stk, 'inv'); const z = g.zombies.spawn(g.player.x + 1.2, g.player.z, 'shambler'); window.__testZ2 = z; g.player.aimAngle = Math.atan2(z.x - g.player.x, z.z - g.player.z); return 1; })()");
await sleep(300);
out.melee = await evl("(() => { const g = __game; const z = window.__testZ2; g.player.aimAngle = Math.atan2(z.x - g.player.x, z.z - g.player.z); g.player.attackT = 0; g.player.meleeSwing(); const hp1 = z.hp; g.player.attackT = 0; g.player.meleeSwing(); g.player.attackT = 0; g.player.meleeSwing(); return JSON.stringify({ hp0: 4.5, hp1, hp2: z.hp, dead: z.dead, kills: g.player.stats.kills }); })()");
// 5) 存档

out.save = await evl("JSON.stringify({ saved: __game.save(), len: (localStorage.getItem('zomduck_save') || '').length })");
// 6) FOV / HUD

out.fov = await evl("JSON.stringify({ vis: __game.renderer.visData.reduce((a, b) => a + (b > 0 ? 1 : 0), 0), moodles: document.getElementById('moodles').children.length, clock: document.getElementById('clock-time').textContent })");
console.log('=== GAMEPLAY TEST ===');
console.log(JSON.stringify(out, null, 1));
console.log('ERRORS:', errors.slice(0, 12).join(' | ') || 'none');
chrome.kill(); process.exit(0);