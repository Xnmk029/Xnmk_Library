// tools/browser-smoke.mjs — 无头 Chrome 冒烟
import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const shot = 'C:/msys64/tmp/sim-shot.png';

const out = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--mute-audio',
  '--window-size=1280,720',
  '--virtual-time-budget=12000',
  '--enable-logging=stderr',
  `--screenshot=${shot}`,
  'http://localhost:8080/sim.html?autostart=1',
], { stdio: ['ignore', 'ignore', 'pipe'] });

let err = '';
out.stderr.on('data', (d) => { err += d.toString(); });
out.on('close', (code) => {
  console.log('chrome exit:', code);
  // 输出包含 CONSOLE/ERROR 的行
  const lines = err.split('\n').filter((l) => /CONSOLE|ERROR|Uncaught|TypeError|Failed to/.test(l));
  const seen = new Set();
  for (const l of lines.slice(0, 40)) {
    const key = l.slice(0, 160);
    if (!seen.has(key)) { seen.add(key); console.log(l.slice(0, 300)); }
  }
  if (existsSync(shot)) console.log('screenshot:', statSync(shot).size, 'bytes');
  process.exit(0);
});
