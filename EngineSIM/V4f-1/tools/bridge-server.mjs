// 外部模拟器桥接：UDP 4001 接收状态，HTTP 8081 提供 /state 与 /poll 供浏览器轮询。
// 用法：node tools/bridge-server.mjs [udpPort] [httpPort]
import dgram from 'node:dgram';
import http from 'node:http';

const UDP_PORT = Number(process.argv[2] || 4001);
const HTTP_PORT = Number(process.argv[3] || 8081);

const state = {
  rpm: 800,
  throttle: 0,
  ignition: true,
  cutoff: false,
  preset: 'hall',
  updatedAt: Date.now()
};

let waiters = [];
function notify() {
  state.updatedAt = Date.now();
  const w = waiters;
  waiters = [];
  for (const res of w) res.end(JSON.stringify(state));
}

const udp = dgram.createSocket('udp4');
udp.on('message', (msg) => {
  const text = msg.toString('utf8').trim();
  try {
    let parsed;
    if (text.startsWith('{')) {
      parsed = JSON.parse(text);
    } else {
      const [rpm, throttle] = text.split(/[\s,;]+/).map(Number);
      parsed = { rpm, throttle };
    }
    if (typeof parsed.rpm === 'number') state.rpm = Math.max(0, Math.min(9000, parsed.rpm));
    if (typeof parsed.throttle === 'number') state.throttle = Math.max(0, Math.min(1, parsed.throttle));
    if (typeof parsed.ignition === 'boolean') state.ignition = parsed.ignition;
    if (typeof parsed.cutoff === 'boolean') state.cutoff = parsed.cutoff;
    if (typeof parsed.preset === 'string') state.preset = parsed.preset;
    notify();
  } catch (err) {
    // 忽略无法解析的数据报
  }
});

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${HTTP_PORT}`);
  if (url.pathname === '/state' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(state));
    return;
  }
  if (url.pathname === '/state' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 65536) req.destroy(); });
    req.on('end', () => {
      try {
        const p = JSON.parse(body);
        if (typeof p.rpm === 'number') state.rpm = Math.max(0, Math.min(9000, p.rpm));
        if (typeof p.throttle === 'number') state.throttle = Math.max(0, Math.min(1, p.throttle));
        if (typeof p.ignition === 'boolean') state.ignition = p.ignition;
        if (typeof p.cutoff === 'boolean') state.cutoff = p.cutoff;
        if (typeof p.preset === 'string') state.preset = p.preset;
        notify();
      } catch { /* 忽略坏请求 */ }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(state));
    });
    return;
  }
  if (url.pathname === '/poll') {
    const timeout = setTimeout(() => {
      waiters = waiters.filter((w) => w !== res);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(state));
    }, 10000);
    res.on('close', () => clearTimeout(timeout));
    waiters.push(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('V4f engine bridge: UDP 4001 -> state; GET/POST /state; GET /poll (long-poll)\n');
});

udp.bind(UDP_PORT, () => console.log(`UDP 桥接监听 :${UDP_PORT}`));
server.listen(HTTP_PORT, () => console.log(`HTTP 桥接监听 :${HTTP_PORT}（/state、/poll）`));

process.on('SIGINT', () => { udp.close(); server.close(); process.exit(0); });
