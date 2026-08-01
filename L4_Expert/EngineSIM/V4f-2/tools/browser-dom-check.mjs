// tools/browser-dom-check.mjs — 无头 Chrome：检查驾驶场景 DOM 状态
import { spawn } from 'node:child_process';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const out = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--mute-audio',
  '--virtual-time-budget=15000',
  '--dump-dom',
  'http://localhost:8080/sim.html?autostart=1',
], { stdio: ['ignore', 'pipe', 'pipe'] });

let dom = '';
let err = '';
out.stdout.on('data', (d) => { dom += d.toString(); });
out.stderr.on('data', (d) => { err += d.toString(); });
out.on('close', () => {
  console.log('✔ HUD speed element:', dom.includes('hud-speed-v'));
  console.log('✔ HUD tacho canvas:', dom.includes('hud-tacho'));
  console.log('✔ HUD gear element:', dom.includes('hud-gear'));
  console.log('✔ HUD lap element:', dom.includes('hud-lap'));
  const m = dom.match(/hud-speed-v">(\d+)</);
  console.log('   显示车速:', m ? m[1] + ' km/h' : 'N/A');
  const gear = dom.match(/hud-gear">([^<]+)</);
  console.log('   挡位:', gear ? gear[1] : 'N/A');
  const fatal = (err.match(/(Uncaught|TypeError|ReferenceError|SyntaxError)/g) || []);
  console.log('✔ 无致命错误:', fatal.length === 0, fatal.slice(0, 3));
  process.exit(0);
});
