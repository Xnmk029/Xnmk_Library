import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const here = dirname(fileURLToPath(import.meta.url));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--remote-debugging-port=9335', '--user-data-dir=' + join(here, '.chrome-ana2'),
  '--no-first-run', '--enable-unsafe-swiftshader', '--window-size=1600,900', 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  try { const tabs = await (await fetch('http://127.0.0.1:9335/json/list')).json(); const tab = tabs.find(t => t.type === 'page') || tabs[0]; ws = tab.webSocketDebuggerUrl; } catch (e) {}
  await sleep(400);
}
const sock = new WebSocket(ws);
let msgId = 0; const pending = new Map();
sock.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const id = ++msgId; pending.set(id, res); sock.send(JSON.stringify({ id, method, params })); });
await new Promise(r => sock.onopen = r);
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: 'file:///' + join(here, 'analyze.html').replace(/\\/g, '/') });
let out = null;
for (let i = 0; i < 30; i++) {
  await sleep(500);
  const r = await send('Runtime.evaluate', { expression: 'document.title' });
  const v = r.result && r.result.result && r.result.result.value;
  if (v && v.startsWith('{')) { out = JSON.parse(v); break; }
}
console.log(JSON.stringify(out, null, 1));
chrome.kill(); process.exit(0);