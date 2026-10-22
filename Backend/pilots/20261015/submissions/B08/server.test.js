'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdtemp, rm } = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

async function fixture(t, ttl = 1200) {
  const data = await mkdtemp(path.join(__dirname, '.test-data-'));
  let child;
  let base;
  async function stop() {
    if (child && child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    child = undefined;
  }
  async function start() {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, [path.join(__dirname, 'server.js'), '--port', String(port), '--data', data, '--capacity', '10', '--ttl-ms', String(ttl)], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    await new Promise((resolve, reject) => {
      let errors = '';
      const timeout = setTimeout(() => reject(new Error('服务启动超时：' + errors)), 10000);
      child.stderr.on('data', chunk => { errors += chunk; });
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`服务退出 ${code}：${errors}`)); });
      child.stdout.once('data', () => { clearTimeout(timeout); resolve(); });
    });
  }
  t.after(async () => { await stop(); await rm(data, { recursive: true, force: true }); });
  await start();
  async function request(route, body) {
    const response = await fetch(base + route, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  async function inventory(expected) {
    const result = await request('/api/inventory');
    assert.equal(result.status, 200);
    const { capacity, available, reserved, sold } = result.body;
    assert.equal(available + reserved + sold, capacity);
    assert.ok([available, reserved, sold].every(n => n >= 0));
    if (expected) assert.deepEqual(result.body, { capacity: 10, ...expected });
    return result.body;
  }
  return { request, inventory, stop, start, reserve: (quantity, requestId = randomUUID()) => request('/api/orders', { requestId, quantity }), url: () => base };
}

test('并发争抢不能超卖；相同请求同时重试只产生一笔订单', async t => {
  const f = await fixture(t, 10000);
  const shared = randomUUID();
  const repeats = await Promise.all(Array.from({ length: 20 }, () => f.reserve(3, shared)));
  for (const result of repeats) assert.deepEqual(result, repeats[0]);
  assert.equal(repeats[0].status, 201);
  const results = await Promise.all(Array.from({ length: 30 }, () => f.reserve(1)));
  assert.equal(results.filter(r => r.status === 201).length, 7);
  assert.equal(results.filter(r => r.status === 409).length, 23);
  await f.inventory({ available: 0, reserved: 10, sold: 0 });
  assert.equal((await f.request('/api/orders')).body.orders.length, 8);
});

test('校验、全局幂等冲突和失败响应持久化', async t => {
  const f = await fixture(t, 10000);
  for (const quantity of [0, -1, 1.2, '1', null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal((await f.reserve(quantity)).status, 422);
  }
  assert.equal((await f.request('/api/orders', { quantity: 1 })).status, 422);
  const invalidId = randomUUID();
  const invalid = await f.reserve(0, invalidId);
  const requestId = randomUUID();
  const created = await f.reserve(10, requestId);
  assert.equal((await f.reserve(9, requestId)).status, 409);
  assert.equal((await f.request(`/api/orders/${created.body.id}/pay`, { requestId })).status, 409);
  const deniedId = randomUUID();
  const denied = await f.reserve(1, deniedId);
  assert.equal(denied.status, 409);
  const cancelPath = `/api/orders/${created.body.id}/cancel`;
  const cancelId = randomUUID();
  const cancelled = await f.request(cancelPath, { requestId: cancelId });
  assert.equal(cancelled.body.status, 'cancelled');
  assert.deepEqual(await f.request(cancelPath, { requestId: randomUUID() }), cancelled);
  await f.stop();
  await f.start();
  assert.deepEqual(await f.reserve(0, invalidId), invalid);
  assert.deepEqual(await f.reserve(1, deniedId), denied);
  assert.deepEqual(await f.request('/api/orders', { quantity: 10, requestId }), created);
  assert.deepEqual(await f.request(cancelPath, { requestId: cancelId }), cancelled);
  assert.equal((await f.request(`/api/orders/${created.body.id}/pay`, { requestId: randomUUID() })).status, 409);
  await f.inventory({ available: 10, reserved: 0, sold: 0 });
});

test('支付和取消竞争仅有一个终态；已支付库存和幂等跨重启', async t => {
  const f = await fixture(t, 10000);
  const order = (await f.reserve(4)).body;
  const payId = randomUUID();
  const pay = await f.request(`/api/orders/${order.id}/pay`, { requestId: payId });
  assert.equal(pay.body.status, 'paid');
  const competing = (await f.reserve(3)).body;
  const results = await Promise.all(['pay', 'cancel'].map(action => f.request(`/api/orders/${competing.id}/${action}`, { requestId: randomUUID() })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const before = await f.inventory();
  const ordersBefore = await f.request('/api/orders');
  await f.stop();
  await f.start();
  assert.deepEqual(await f.inventory(), before);
  assert.deepEqual(await f.request('/api/orders'), ordersBefore);
  assert.deepEqual(await f.request(`/api/orders/${order.id}/pay`, { requestId: payId }), pay);
  assert.deepEqual(await f.request(`/api/orders/${order.id}/pay`, { requestId: randomUUID() }), pay);
  assert.equal((await f.request(`/api/orders/${order.id}/cancel`, { requestId: randomUUID() })).status, 409);
});

test('到期释放、拒绝过期支付；原始成功响应保持可重试', async t => {
  const f = await fixture(t, 350);
  const requestId = randomUUID();
  const created = await f.reserve(10, requestId);
  await delay(Math.max(0, created.body.expiresAt - Date.now()) + 40);
  assert.equal((await f.request(`/api/orders/${created.body.id}`)).body.status, 'expired');
  for (const action of ['pay', 'cancel']) {
    assert.equal((await f.request(`/api/orders/${created.body.id}/${action}`, { requestId: randomUUID() })).status, 409);
  }
  await f.inventory({ available: 10, reserved: 0, sold: 0 });
  assert.deepEqual(await f.reserve(10, requestId), created);
  await f.inventory({ available: 10, reserved: 0, sold: 0 });
  assert.equal((await f.reserve(10)).status, 201);
});

test('停机期间到期在重启后释放；支付与到期边界竞争保持守恒', async t => {
  const f = await fixture(t, 500);
  const offlineOrder = (await f.reserve(10)).body;
  await f.stop();
  await delay(Math.max(0, offlineOrder.expiresAt - Date.now()) + 20);
  await f.start();
  await f.inventory({ available: 10, reserved: 0, sold: 0 });
  assert.equal((await f.request(`/api/orders/${offlineOrder.id}`)).body.status, 'expired');
  const orders = await Promise.all(Array.from({ length: 10 }, () => f.reserve(1)));
  await delay(Math.max(0, Math.min(...orders.map(r => r.body.expiresAt)) - Date.now() - 8));
  const results = await Promise.all(orders.map(async ({ body: order }) => {
    const paid = await f.request(`/api/orders/${order.id}/pay`, { requestId: randomUUID() });
    assert.ok([200, 409].includes(paid.status));
    return paid;
  }));
  await delay(50);
  const sold = results.filter(r => r.status === 200).length;
  await f.inventory({ available: 10 - sold, reserved: 0, sold });
  for (let i = 0; i < orders.length; i++) {
    assert.equal((await f.request(`/api/orders/${orders[i].body.id}`)).body.status, results[i].status === 200 ? 'paid' : 'expired');
  }
});

test('健康检查、原生页面、错误 JSON 和未知订单', async t => {
  const f = await fixture(t);
  assert.deepEqual(await f.request('/health'), { status: 200, body: { ok: true } });
  for (const route of ['/', '/app.js', '/style.css']) {
    const response = await fetch(f.url() + route);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).length > 100);
  }
  const bad = await fetch(f.url() + '/api/orders', { method: 'POST', body: '{' });
  assert.equal(bad.status, 400);
  assert.equal(typeof (await bad.json()).error, 'string');
  const large = await fetch(f.url() + '/api/orders', { method: 'POST', body: JSON.stringify({ requestId: randomUUID(), data: 'x'.repeat(17000) }) });
  assert.equal(large.status, 413);
  assert.equal(typeof (await large.json()).error, 'string');
  assert.equal((await f.request('/api/orders/missing')).status, 404);
  assert.equal((await f.request('/api/orders/missing/pay', { requestId: randomUUID() })).status, 404);
});
