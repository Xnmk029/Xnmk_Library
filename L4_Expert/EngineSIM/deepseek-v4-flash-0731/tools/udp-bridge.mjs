/**
 * udp-bridge.mjs -- external driving-simulator bridge.
 *
 * Listens for UDP JSON state packets from a driving simulator and serves the
 * latest state over HTTP for the V4f lab page to poll:
 *
 *   UDP 4001:  {"rpm":4200,"throttle":0.6,"load":0.7,"cut":false,"pop":0.2,"running":true,"cabin":0.8}
 *   HTTP 8081: GET /state  -> latest JSON
 *              GET /       -> instructions
 *
 * The lab page opens as http://localhost:8080/index.html?udp=1 to follow the
 * bridge instead of the sliders.
 *
 * Protocol: one JSON object per UDP datagram, ASCII/UTF-8, values clamped by
 * the audio module anyway. Missing fields keep their previous value.
 */

import { createSocket } from 'dgram';
import { createServer } from 'http';

const UDP_PORT = Number(process.env.UDP_PORT || 4001);
const HTTP_PORT = Number(process.env.HTTP_PORT || 8081);

const state = {
  rpm: 760,
  throttle: 0,
  load: 0.05,
  cut: false,
  pop: 0,
  running: true,
  cabin: 0.7,
  updated: null,
  packets: 0,
};

const udp = createSocket('udp4');
udp.on('message', (msg, rinfo) => {
  try {
    const j = JSON.parse(msg.toString('utf8'));
    if (typeof j.rpm === 'number') state.rpm = Math.max(0, Math.min(20000, j.rpm));
    if (typeof j.throttle === 'number') state.throttle = Math.max(0, Math.min(1, j.throttle));
    if (typeof j.load === 'number') state.load = Math.max(0, Math.min(1.4, j.load));
    if (typeof j.cut === 'boolean') state.cut = j.cut;
    if (typeof j.pop === 'number') state.pop = Math.max(0, Math.min(1, j.pop));
    if (typeof j.running === 'boolean') state.running = j.running;
    if (typeof j.cabin === 'number') state.cabin = Math.max(0, Math.min(1, j.cabin));
    state.updated = Date.now();
    state.packets++;
  } catch {
    /* ignore malformed datagrams */
  }
});
udp.bind(UDP_PORT, () => console.log(`UDP bridge listening on 0.0.0.0:${UDP_PORT}`));

const html = `<!DOCTYPE html><html lang="zh-CN"><meta charset="utf-8"><title>V4f UDP bridge</title>
<body style="font-family:system-ui;background:#101216;color:#dfe5ec;padding:32px">
<h1>V4f UDP 桥</h1>
<p>UDP <b>${UDP_PORT}</b> → HTTP <b>${HTTP_PORT}</b>/state（最新状态轮询）</p>
<p>发送示例：<code>{"rpm":4200,"throttle":0.6,"load":0.7,"cut":false,"pop":0.2,"running":true,"cabin":0.8}</code></p>
<p>然后打开 <a href="http://localhost:8080/index.html?udp=1" style="color:#e08a4f">音频实验室（UDP 跟随模式）</a></p>
</body>`;

createServer((req, res) => {
  if (req.url === '/state') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify(state));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}).listen(HTTP_PORT, () => console.log(`HTTP state endpoint: http://localhost:${HTTP_PORT}/state`));
