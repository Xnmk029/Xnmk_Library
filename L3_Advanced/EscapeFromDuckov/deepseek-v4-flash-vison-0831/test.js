import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
process.on('uncaughtException', e => { console.error('UNCAUGHT:', e.message); process.exit(2); });
const here = dirname(fileURLToPath(import.meta.url));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + join(here, '.chrome-test'),
  '--no-first-run', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
  '--window-size=1600,900', 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) {
  try { const tabs = await (await fetch('http://127.0.0.1:9333/json/list')).json(); const tab = tabs.find(t => t.type === 'page'); if (tab) wsUrl = tab.webSocketDebuggerUrl; } catch (e) {}
  await sleep(400);
}
const ws = new WebSocket(wsUrl);
let msgId = 0; const pending = new Map();
const errors = []; const logs = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push('[' + m.params.type + '] ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
};
const send = (method, params = {}) => new Promise(res => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evl = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.result && r.result.exceptionDetails) return { exc: (r.result.exceptionDetails.exception?.description || 'err').slice(0, 240) };
  return { val: r.result && r.result.result && r.result.result.value };
};
await new Promise(r => ws.onopen = r);
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: 'file:///' + join(here, 'dist', 'index.html').replace(/\\/g, '/') });
await sleep(6000);
await send('Runtime.evaluate', { expression: "document.getElementById('btn-new') && document.getElementById('btn-new').click()" });
await sleep(1200);
await send('Runtime.evaluate', { expression: "var n=document.getElementById('cc-name'); if(n){n.value='测试鸭';}" });
await sleep(300);
await send('Runtime.evaluate', { expression: "document.getElementById('cc-start') && document.getElementById('cc-start').click()" });
await sleep(12000);

// 独立纹理采样探针
const probe = await evl("(() => { const g = __game; const d = g.renderer.visData; const whites = []; for (let z = 0; z < 200; z++) for (let x = 0; x < 200; x++) if (d[(z*200+x)*4] > 0) whites.push(x+','+z); return JSON.stringify({ n: whites.length, sample: whites.slice(0, 12), has54_63: whites.includes('54,63'), has50_50: whites.includes('50,50') }); })()");
console.log('=== TEX SAMPLE PROBE ===');
console.log(JSON.stringify(probe));

// 关键测试：强制 minVis=1 渲染，读中心像素
const minVisTest = await evl("(() => { const g = __game; const r = g.renderer; g.renderer.mats.forEach(m => { if (m.userData.shader) { m.userData.shader.uniforms.uMinVis.value = 1.0; m.userData.shader.uniforms.uFogDensity.value = 0.0; } }); r.renderer.setRenderTarget(null); r.renderer.render(r.scene, r.camera); const gl = r.renderer.getContext(); const px = new Uint8Array(4); const out = {}; for (const [fx,fy] of [[0.5,0.5],[0.5,0.45],[0.5,0.6],[0.3,0.5],[0.7,0.5]]) { gl.readPixels(Math.floor(gl.drawingBufferWidth*fx), Math.floor(gl.drawingBufferHeight*fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); out[fx+','+fy] = Array.from(px); } return JSON.stringify(out); })()");
console.log('=== MINVIS=1 CENTER TEST ===');
console.log(JSON.stringify(minVisTest));
// 阴影测试：关闭阴影再读中心
const shadowTest = await evl("(() => { const g = __game; const r = g.renderer; r.renderer.shadowMap.enabled = false; r.sun.castShadow = false; r.renderer.setRenderTarget(null); r.renderer.render(r.scene, r.camera); const gl = r.renderer.getContext(); const px = new Uint8Array(4); const out = {}; for (const [fx,fy] of [[0.5,0.5],[0.5,0.45],[0.5,0.6],[0.5,0.7],[0.4,0.5],[0.6,0.5]]) { gl.readPixels(Math.floor(gl.drawingBufferWidth*fx), Math.floor(gl.drawingBufferHeight*fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); out[fx+','+fy] = Array.from(px); } return JSON.stringify(out); })()");
console.log('=== SHADOWS OFF TEST ===');
console.log(JSON.stringify(shadowTest));
const dbgTest = await evl("(() => { const g = __game; const r = g.renderer; g.renderer.mats.forEach(m => { if (m.userData.shader) m.userData.shader.uniforms.uDbg.value = 1.0; }); r.renderer.setRenderTarget(null); r.renderer.render(r.scene, r.camera); const gl = r.renderer.getContext(); const px = new Uint8Array(4); const out = {}; for (const [fx,fy] of [[0.5,0.5],[0.5,0.45],[0.5,0.6],[0.5,0.7],[0.4,0.5],[0.6,0.5]]) { gl.readPixels(Math.floor(gl.drawingBufferWidth*fx), Math.floor(gl.drawingBufferHeight*fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); out[fx+','+fy] = Array.from(px); } return JSON.stringify(out); })()");
console.log('=== DGB VIS TEST ===');
console.log(JSON.stringify(dbgTest));
// 逐对象渲染，找 GL 错误源
const perObj = await evl("(() => { const g = __game; const r = g.renderer; const gl = r.renderer.getContext(); const bad = []; const ok = []; g.renderer.scene.traverse(o => { if (!o.isMesh || !o.geometry) return; gl.getError(); r.renderer.setRenderTarget(null); r.renderer.render(o, r.camera); const err = gl.getError(); const tris = r.renderer.info.render.triangles; const label = (o.material && o.material.type) + ':' + (o.geometry.type) + ' tris=' + tris; if (err) bad.push(label + ' err=' + err); else ok.push(label); }); return JSON.stringify({ bad: bad.slice(0, 12), okCount: ok.length, badCount: bad.length }); })()");
console.log('=== PER-OBJECT GL TEST ===');
console.log(JSON.stringify(perObj));
// 地面材质 A/B 测试：no-op 注入 vs 原生 toon
const groundTest = await evl("(() => { const g = __game; const r = g.renderer; const gl = r.renderer.getContext(); const px = new Uint8Array(4); const read = (fx, fy) => { gl.readPixels(Math.floor(gl.drawingBufferWidth*fx), Math.floor(gl.drawingBufferHeight*fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return Array.from(px).slice(0,3).join('/'); }; const out = {}; const gr = r.ground; gr.material.onBeforeCompile = () => {}; gr.material.needsUpdate = true; r.renderer.setRenderTarget(null); r.renderer.render(r.scene, r.camera); out.noopInjection = [read(0.5,0.5), read(0.5,0.45), read(0.4,0.5)]; gr.material.fog = false; gr.material.needsUpdate = true; r.renderer.render(r.scene, r.camera); out.noFog = [read(0.5,0.5), read(0.5,0.45), read(0.4,0.5)]; const basic = new THREE.MeshBasicMaterial({ vertexColors: true }); gr.material = basic; r.renderer.render(r.scene, r.camera); out.basic = [read(0.5,0.5), read(0.5,0.45), read(0.4,0.5)]; return JSON.stringify(out); })()");
console.log('=== GROUND A/B TEST ===');
console.log(JSON.stringify(groundTest));
// ASCII 帧dump
const ascii = await evl("(() => { const g = __game; const r = g.renderer; const gl = r.renderer.getContext(); const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight; const buf = new Uint8Array(w*h*4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf); const W = 90, H = 24; let out = ''; for (let gy = 0; gy < H; gy++) { let line = ''; for (let gx = 0; gx < W; gx++) { const x = Math.floor(gx*w/W), y = Math.floor(gy*h/H); const o = (y*w+x)*4; const R = buf[o], G = buf[o+1], B = buf[o+2]; const lum = (R+G+B)/3; if (lum > 200) line += (B > R + 10 ? '~' : '.'); else if (lum > 120) line += '+'; else if (lum > 50) line += '*'; else if (lum > 20) line += 'o'; else line += '#'; } out += line + '\\n'; } return out; })()");
console.log('=== FRAME ASCII ===');
console.log(ascii.val);
// 后处理直通测试
await evl("(() => { const g = __game; g.postfx.mat.fragmentShader = 'precision highp float; uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }'; g.postfx.mat.needsUpdate = true; return 1; })()");
await sleep(2500);
const ascii2 = await evl("(() => { const g = __game; const r = g.renderer; const gl = r.renderer.getContext(); const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight; const buf = new Uint8Array(w*h*4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf); const W = 90, H = 24; let out = ''; for (let gy = 0; gy < H; gy++) { let line = ''; for (let gx = 0; gx < W; gx++) { const x = Math.floor(gx*w/W), y = Math.floor(gy*h/H); const o = (y*w+x)*4; const R = buf[o], G = buf[o+1], B = buf[o+2]; const lum = (R+G+B)/3; if (lum > 200) line += (B > R + 10 ? '~' : '.'); else if (lum > 120) line += '+'; else if (lum > 50) line += '*'; else if (lum > 20) line += 'o'; else line += '#'; } out += line + '\\n'; } return out; })()");
console.log('=== FRAME AFTER POSTFX PASSTHROUGH ===');
console.log(ascii2.val);
// 直接读 targetA 内容
const tA = await evl("(() => { const g = __game; const r = g.renderer; const gl = r.renderer.getContext(); const px = new Uint8Array(4); const read = (fx, fy) => { gl.readPixels(Math.floor(gl.drawingBufferWidth*fx), Math.floor(gl.drawingBufferHeight*fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return Array.from(px).slice(0,3).join('/'); }; r.renderer.setRenderTarget(r.targetA); r.renderer.clear(); r.renderer.render(r.scene, r.camera); const out = { center: read(0.5,0.5), up: read(0.5,0.4), down: read(0.5,0.65), left: read(0.35,0.5), tris: r.renderer.info.render.triangles }; r.renderer.setRenderTarget(null); return JSON.stringify(out); })()");
console.log('=== TARGET A CONTENT ===');
console.log(JSON.stringify(tA));
const state = await evl("JSON.stringify({state: __game.state, err: __game.lastError, px: __game.player.x, hudHidden: document.getElementById('hud').className})");
console.log('=== STATE ===', state.val);
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(here, 'shot.png'), Buffer.from(shot.result.data, 'base64'));
console.log('=== ERRORS ===');
console.log(logs.slice(0, 20).join('\n') || '(none)');
console.log(errors.slice(0, 20).join('\n') || '(none)');
chrome.kill();
process.exit(0);