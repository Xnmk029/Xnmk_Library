import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const here = dirname(fileURLToPath(import.meta.url));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--remote-debugging-port=9342', '--user-data-dir=' + join(here, '.chrome-fc'),
  '--no-first-run', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--window-size=1600,900', 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) {
  try { const tabs = await (await fetch('http://127.0.0.1:9342/json/list')).json(); const tab = tabs.find(t => t.type === 'page'); if (tab) wsUrl = tab.webSocketDebuggerUrl; } catch (e) {}
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
await sleep(9000);
await send('Runtime.evaluate', { expression: "document.getElementById('screen').classList.add('hidden')" });
await sleep(2500);
const cap = await evl("(() => { const g = __game; const r = g.renderer; const gl = r.renderer.getContext(); g.env.applyToRenderer(r); r.renderer.setRenderTarget(r.targetA); r.renderer.clear(); r.renderer.render(r.scene, r.camera); r.renderer.setRenderTarget(r.targetB); g.postfx.render(r); const w = r.targetB.width, h = r.targetB.height; const buf = new Uint8Array(w*h*4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf); r.renderer.setRenderTarget(null); const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const cctx = c2.getContext('2d'); const img = cctx.createImageData(w, h); for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) { const o = (y*w+x)*4; const o2 = ((h-1-y)*w+x)*4; img.data[o2] = buf[o]; img.data[o2+1] = buf[o+1]; img.data[o2+2] = buf[o+2]; img.data[o2+3] = 255; } } cctx.putImageData(img, 0, 0); window.__frame = c2.toDataURL('image/png'); return JSON.stringify({ w, h, len: window.__frame.length }); })()");
const tA = await evl("(() => { const g = __game; const r = g.renderer; const gl = r.renderer.getContext(); const px = new Uint8Array(4); const read = (x, y) => { gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return Array.from(px).slice(0,3).join('/'); }; g.env.applyToRenderer(r); r.renderer.setRenderTarget(r.targetA); r.renderer.clear(); r.renderer.render(r.scene, r.camera); const out = { c: read(800, 450), b: read(800, 700), t: read(800, 150), l: read(300, 400), tris: r.renderer.info.render.triangles, calls: r.renderer.info.render.calls, err: gl.getError() }; r.renderer.setRenderTarget(null); return JSON.stringify(out); })()");
console.log('TARGETA:', JSON.stringify(tA));
const minV = await evl("(() => { const g = __game; const r = g.renderer; const gl = r.renderer.getContext(); const px = new Uint8Array(4); const read = (x, y) => { gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return Array.from(px).slice(0,3).join('/'); }; r.mats.forEach(m => { if (m.userData.shader) { m.userData.shader.uniforms.uMinVis.value = 1.0; m.userData.shader.uniforms.uFogDensity.value = 0.0; } }); r.renderer.setRenderTarget(r.targetA); r.renderer.render(r.scene, r.camera); const out = { c: read(800, 450), b: read(800, 700), t: read(800, 150) }; r.renderer.setRenderTarget(null); return JSON.stringify({ out, hour: g.env.hour, dayNight: g.env.dayNight, ambient: g.env.ambientLight, sunI: r.sun.intensity, hemiI: r.hemi.intensity }); })()");
console.log('MINVIS1:', JSON.stringify(minV));
const noop = await evl("(() => { const g = __game; const r = g.renderer; const gl = r.renderer.getContext(); const px = new Uint8Array(4); const read = (x, y) => { gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return Array.from(px).slice(0,3).join('/'); }; r.ground.material.onBeforeCompile = () => {}; r.ground.material.needsUpdate = true; r.renderer.setRenderTarget(r.targetA); r.renderer.render(r.scene, r.camera); const out = { c: read(800, 450), b: read(800, 700) }; r.renderer.setRenderTarget(null); return JSON.stringify(out); })()");
console.log('NOOP INJECTION:', JSON.stringify(noop));
const box = await evl("(() => { const g = __game; const r = g.renderer; const gl = r.renderer.getContext(); const px = new Uint8Array(4); const read = (x, y) => { gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return Array.from(px).slice(0,3).join('/'); }; const box = new THREE.Mesh(new THREE.BoxGeometry(3,3,3), new THREE.MeshLambertMaterial({ color: 0xff2020 })); box.position.set(g.player.x - 100, 1.5, g.player.z - 100); r.scene.add(box); r.renderer.setRenderTarget(r.targetA); r.renderer.render(r.scene, r.camera); const out = { c: read(800, 450), lights: r.scene.children.filter(c => c.isLight).map(l => l.type + ':' + l.intensity) }; r.renderer.setRenderTarget(null); r.scene.remove(box); return JSON.stringify(out); })()");
console.log('BOX TEST:', JSON.stringify(box));
const shTest = await evl("(() => { const g = __game; const r = g.renderer; const gl = r.renderer.getContext(); const px = new Uint8Array(4); const read = (x, y) => { gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return Array.from(px).slice(0,3).join('/'); }; g.env.applyToRenderer(r); r.renderer.shadowMap.enabled = false; r.renderer.setRenderTarget(r.targetA); r.renderer.render(r.scene, r.camera); const out = { c: read(800, 450), b: read(800, 700) }; r.renderer.setRenderTarget(null); return JSON.stringify(out); })()");
console.log('SHADOWS OFF:', JSON.stringify(shTest));
console.log('CAP:', JSON.stringify(cap));
console.log('CAP:', JSON.stringify(cap));
console.log('CAP:', JSON.stringify(cap));
console.log('CAP:', JSON.stringify(cap));
console.log('CAP:', JSON.stringify(cap));
console.log('CAP:', JSON.stringify(cap));
if (cap.val) { const b64 = await evl('window.__frame'); writeFileSync(join(here, 'preview.png'), Buffer.from(b64.val.split(',')[1], 'base64')); console.log('PREVIEW SAVED'); }
console.log('ERRORS:', errors.slice(0, 10).join(' | ') || 'none');
chrome.kill(); process.exit(0);