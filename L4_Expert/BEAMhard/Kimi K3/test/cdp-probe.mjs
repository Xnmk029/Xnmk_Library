// CDP probe: loads the app in headless Chrome and captures console/exceptions.
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PAGE = process.env.PAGE_URL || 'http://127.0.0.1:8931/index.html';
const WAIT_MS = Number(process.env.WAIT_MS || 25000);

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9222', '--user-data-dir=C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\opencode\\chromeprof2',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9222/json');
      const list = await r.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* retry */ }
    await sleep(500);
  }
  throw new Error('CDP endpoint not reachable');
}

const ws = new WebSocket(await getWsUrl());
let mid = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res) => {
  const id = ++mid;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});

const lines = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); return; }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const args = msg.params.args.map((a) => a.value ?? a.description ?? JSON.stringify(a.preview?.properties?.slice(0, 3) ?? '')).join(' ');
    lines.push(`[console.${msg.params.type}] ${args}`);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    lines.push(`[EXCEPTION] ${d.text} ${d.exception?.description || ''} @${d.url}:${d.lineNumber}`);
  } else if (msg.method === 'Log.entryAdded') {
    const e = msg.params.entry;
    lines.push(`[log.${e.level}] ${e.text} @${e.url || ''}:${e.lineNumber ?? ''}`);
  }
};

await new Promise((res) => { ws.onopen = res; });
await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Page.navigate', { url: PAGE });
await sleep(WAIT_MS);

// read the loading status text
const evalRes = await send('Runtime.evaluate', {
  expression: `JSON.stringify({loadText: document.getElementById('load-text')?.textContent, loadingClass: document.getElementById('loading')?.className, diag: document.getElementById('diag-log')?.textContent})`,
  returnByValue: true,
});
console.log('PAGE STATE:', evalRes?.result?.value);
console.log(lines.join('\n') || '(no console output)');

// optional screenshot for visual confirmation
if (process.env.SHOT) {
  // simulate a keypress to close any overlays & let a few frames render
  await sleep(2500);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot?.data) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(process.env.SHOT, Buffer.from(shot.data, 'base64'));
    console.log('screenshot saved:', process.env.SHOT);
  }
}

// optional end-to-end drive test: hold W, screenshot, then map mode
if (process.env.DRIVE) {
  const key = async (type, code, keyName, vk) => send('Input.dispatchKeyEvent', {
    type, code, key: keyName, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
  });
  await key('keyDown', 'KeyW', 'w', 87);
  await sleep(5000);
  await key('keyUp', 'KeyW', 'w', 87);
  const st = await send('Runtime.evaluate', {
    expression: `document.getElementById('speed-value').textContent + '|' + document.getElementById('rpm-value').textContent`,
    returnByValue: true,
  });
  console.log('DRIVE STATE (speed|rpm):', st?.result?.value);
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(process.env.DRIVE, Buffer.from(shot2.data, 'base64'));
  // switch to vector map mode (3) and screenshot
  await key('keyDown', 'Digit3', '3', 51);
  await key('keyUp', 'Digit3', '3', 51);
  await sleep(4000);
  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(process.env.DRIVE.replace('.png', '_map.png'), Buffer.from(shot3.data, 'base64'));
  console.log('drive+map screenshots saved');
}
chrome.kill();
process.exit(0);
