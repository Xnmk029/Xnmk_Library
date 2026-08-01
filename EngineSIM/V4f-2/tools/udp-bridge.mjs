// tools/udp-bridge.mjs — UDP(4001) + HTTP(8081 WebSocket) 桥
// 供外部驾驶模拟软件推送 rpm/throttle 驱动声音：
//   UDP：`rpm,throttle,load`（CSV，每包一行）→ 转发 WebSocket 客户端
//   HTTP：浏览器页面连 ws://localhost:8081 订阅
// 用法：node tools/udp-bridge.mjs [udpPort=4001] [wsPort=8081]

import { createServer } from 'node:http';
import dgram from 'node:dgram';

const udpPort = Number(process.argv[2] || 4001);
const wsPort = Number(process.argv[3] || 8081);

// —— WebSocket 服务器（原生实现，无依赖） ——
const clients = new Set();
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('EngineSIM udp-bridge ws server');
});
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = require('node:crypto').createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  clients.add(socket);
  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
});
server.listen(wsPort, () => console.log(`WS bridge: ws://localhost:${wsPort}`));

// 简单帧编码（text frame，无掩码——服务端→客户端）
function sendWs(socket, text) {
  const payload = Buffer.from(text);
  const head = Buffer.alloc(payload.length < 126 ? 2 : 4);
  head[0] = 0x81;
  if (payload.length < 126) {
    head[1] = payload.length;
  } else {
    head[1] = 126;
    head.writeUInt16BE(payload.length, 2);
  }
  socket.write(Buffer.concat([head, payload]));
}

// —— UDP 接收 ——
const udp = dgram.createSocket('udp4');
udp.on('message', (msg) => {
  const text = msg.toString().trim();
  const parts = text.split(/[,;\s]+/).map(Number);
  if (parts.length < 2 || parts.some((x) => !Number.isFinite(x))) return;
  const state = {
    rpm: Math.round(parts[0]),
    throttle: Math.max(0, Math.min(1, parts[1])),
    load: parts.length > 2 ? Math.max(0, Math.min(1.5, parts[2])) : parts[1],
  };
  const json = JSON.stringify(state);
  for (const c of clients) {
    try { sendWs(c, json); } catch { clients.delete(c); }
  }
});
udp.bind(udpPort, () => console.log(`UDP bridge: udp://localhost:${udpPort}  (CSV: rpm,throttle,load)`));
