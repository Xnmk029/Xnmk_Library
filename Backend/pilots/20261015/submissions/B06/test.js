'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { options, createGateway } = require('./server');

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}
async function close(server) {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
function request(port, route) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path: route, agent: false }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    }).on('error', reject);
  });
}
async function fixture(t, handler, overrides = {}) {
  let calls = 0;
  const upstream = http.createServer((req, res) => { calls++; handler(req, res); });
  const upstreamPort = await listen(upstream);
  const config = options(['--upstream', `http://127.0.0.1:${upstreamPort}`, '--limit', '100',
    '--window-ms', '10000', '--timeout-ms', '500', '--open-ms', '100',
    ...Object.entries(overrides).flatMap(([key, value]) => [`--${key}`, String(value)])]);
  const gateway = createGateway(config, {});
  const port = await listen(gateway);
  t.after(async () => { await close(gateway); await close(upstream); });
  return { port, calls: () => calls,
    relay: value => request(port, `/relay?${new URLSearchParams({ path: value })}`),
    stats: async () => JSON.parse((await request(port, '/api/stats')).body) };
}

test('preserves status and binary bytes; fixes host; rejects unsafe targets', async t => {
  const binary = Buffer.from([0, 255, 128, 13, 10, 65]);
  let seen;
  const f = await fixture(t, (req, res) => {
    seen = req.url;
    res.writeHead(418, { 'content-type': 'application/octet-stream' });
    res.end(binary);
  });
  const result = await f.relay('/binary?x=hello%20world');
  assert.equal(result.status, 418);
  assert.deepEqual(result.body, binary);
  assert.equal(seen, '/binary?x=hello%20world');
  const invalid = ['https://example.com', '//example.com', '/\\example.com', '/%2fexample.com',
    '/%5cexample.com', '/path#fragment', '/%00', 'relative', '/%zz'];
  for (const value of invalid) assert.equal((await f.relay(value)).status, 400, value);
  assert.equal((await request(f.port, '/relay')).status, 400);
  assert.equal((await request(f.port, '/relay?path=/&path=/other')).status, 400);
  assert.equal(f.calls(), 1);
  assert.deepEqual(await f.stats(), { state: 'CLOSED', requests: 12, upstreamCalls: 1, rateRejected: 0, circuitRejected: 0 });
});

test('fixed window starts on first relay; rejected requests do not reach upstream', async t => {
  const f = await fixture(t, (_req, res) => res.end('ok'), { limit: 3, 'window-ms': 200 });
  await delay(100);
  for (let i = 0; i < 3; i++) assert.equal((await f.relay('/')).status, 200);
  assert.equal((await f.relay('/')).status, 429);
  assert.equal(f.calls(), 3);
  await delay(220);
  assert.equal((await f.relay('/')).status, 200);
  assert.deepEqual(await f.stats(), { state: 'CLOSED', requests: 5, upstreamCalls: 4, rateRejected: 1, circuitRejected: 0 });
});

test('4xx neither adds nor resets failures; 2xx and 3xx reset failures', async t => {
  const f = await fixture(t, (req, res) => { res.writeHead(Number(req.url.slice(1))); res.end('body'); });
  for (const status of [500, 200, 500, 302, 500, 404]) {
    assert.equal((await f.relay(`/${status}`)).status, status);
    assert.equal((await f.stats()).state, 'CLOSED');
  }
  assert.equal((await f.relay('/500')).status, 500);
  assert.equal((await f.stats()).state, 'OPEN');
  assert.equal((await f.relay('/200')).status, 503);
  assert.equal(f.calls(), 7);
});

test('limiter runs before circuit breaker and consumes rejected circuit quota', async t => {
  const f = await fixture(t, (_req, res) => { res.writeHead(500); res.end('fail'); }, { limit: 3 });
  for (const expected of [500, 500, 503, 429]) assert.equal((await f.relay('/')).status, expected);
  assert.equal(f.calls(), 2);
  assert.deepEqual(await f.stats(), { state: 'OPEN', requests: 4, upstreamCalls: 2, rateRejected: 1, circuitRejected: 1 });
});

test('absolute timeout includes streaming response; network errors trip circuit', async t => {
  const f = await fixture(t, (req, res) => {
    if (req.url === '/disconnect') return req.socket.destroy();
    res.write('first byte');
    const timer = setInterval(() => res.write('more'), 10);
    res.on('close', () => clearInterval(timer));
  }, { 'timeout-ms': 60 });
  const timed = await f.relay('/stream');
  assert.equal(timed.status, 504);
  assert.ok(JSON.parse(timed.body).error);
  assert.equal((await f.relay('/disconnect')).status, 502);
  assert.equal((await f.stats()).state, 'OPEN');
  assert.equal((await f.relay('/')).status, 503);
  assert.equal(f.calls(), 2);
});

test('HALF_OPEN admits one probe, retries waiting after failure, recovers on 4xx', async t => {
  let probeResponse;
  const f = await fixture(t, (req, res) => {
    if (req.url === '/probe') probeResponse = res;
    else { res.writeHead(500); res.end('fail'); }
  });
  await f.relay('/fail');
  await f.relay('/fail');
  await delay(120);
  assert.equal((await f.stats()).state, 'HALF_OPEN');
  const firstProbe = f.relay('/probe');
  while (!probeResponse) await delay(2);
  const blocked = await Promise.all(Array.from({ length: 6 }, () => f.relay('/probe')));
  assert.ok(blocked.every(result => result.status === 503));
  assert.equal(f.calls(), 3);
  probeResponse.writeHead(500); probeResponse.end('failed probe');
  assert.equal((await firstProbe).status, 500);
  assert.equal((await f.stats()).state, 'OPEN');
  assert.equal((await f.relay('/probe')).status, 503);
  await delay(120);
  probeResponse = undefined;
  const secondProbe = f.relay('/probe');
  while (!probeResponse) await delay(2);
  probeResponse.writeHead(404); probeResponse.end('not found');
  assert.equal((await secondProbe).status, 404);
  assert.equal((await f.stats()).state, 'CLOSED');
});

test('late results cannot close a breaker opened by concurrent failures', async t => {
  let held;
  const f = await fixture(t, (req, res) => {
    if (req.url === '/held') held = res;
    else { res.writeHead(500); res.end(); }
  });
  const old = f.relay('/held');
  while (!held) await delay(2);
  await f.relay('/fail');
  await f.relay('/fail');
  held.end('ok');
  assert.equal((await old).status, 200);
  assert.equal((await f.stats()).state, 'OPEN');
});

test('CLI serves assets and health, creates/reuses data directory, resets on restart', async t => {
  const directory = await fs.mkdtemp(path.join(__dirname, '.test-data-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const reservation = http.createServer();
  const port = await listen(reservation);
  await close(reservation);
  async function start() {
    const child = spawn(process.execPath, ['server.js', '--port', String(port), '--data', path.join(directory, 'nested')],
      { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let errors = '';
    child.stderr.on('data', value => { errors += value; });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(new Error('startup timeout')); }, 5000);
      child.stdout.once('data', () => { clearTimeout(timer); resolve(); });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error(errors)); });
    });
    t.after(() => { if (child.exitCode === null) child.kill(); });
    return child;
  }
  const first = await start();
  assert.deepEqual(JSON.parse((await request(port, '/health')).body), { ok: true });
  for (const route of ['/', '/app.js', '/style.css']) assert.equal((await request(port, route)).status, 200);
  assert.equal((await request(port, '/unknown')).status, 404);
  assert.equal((await request(port, '/relay?path=invalid')).status, 400);
  assert.equal(JSON.parse((await request(port, '/api/stats')).body).requests, 1);
  await fs.writeFile(path.join(directory, 'nested', 'keep.txt'), 'preserved');
  const stopped = once(first, 'exit'); first.kill(); await stopped;
  const second = await start();
  assert.deepEqual(JSON.parse((await request(port, '/api/stats')).body),
    { state: 'CLOSED', requests: 0, upstreamCalls: 0, rateRejected: 0, circuitRejected: 0 });
  assert.equal(await fs.readFile(path.join(directory, 'nested', 'keep.txt'), 'utf8'), 'preserved');
  const stoppedAgain = once(second, 'exit'); second.kill(); await stoppedAgain;
});
