'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

test('本地短链接端到端验收', { timeout: 30000 }, async t => {
  const directory = await fs.mkdtemp(path.join(__dirname, '.test-data-'));
  const data = path.join(directory, 'nested', 'data');
  let child;
  let base;
  let targetRequests = 0;
  const target = http.createServer((req, res) => { targetRequests++; res.end('local receiver'); });
  await new Promise(resolve => target.listen(0, '127.0.0.1', resolve));
  const targetUrl = `http://127.0.0.1:${target.address().port}/received`;
  async function stop() {
    if (!child || child.exitCode !== null) return;
    const ended = once(child, 'exit');
    child.kill();
    await ended;
  }
  t.after(async () => {
    await stop();
    await new Promise(resolve => target.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  });
  async function start() {
    child = spawn(process.execPath, [path.join(__dirname, 'server.js'), '--port', '0', '--data', data], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    base = await new Promise((resolve, reject) => {
      let output = '';
      let errors = '';
      const timer = setTimeout(() => reject(new Error(`启动超时：${errors}`)), 5000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`提前退出 ${code}: ${errors}`)); });
      child.stderr.on('data', chunk => { errors += chunk; });
      child.stdout.on('data', chunk => {
        output += chunk;
        const match = output.match(/Listening on (http:\/\/127\.0\.0\.1:\d+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
  }
  async function create(body, status = 201) {
    const res = await fetch(`${base}/api/links`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(res.status, status, JSON.stringify(body));
    const result = await res.json();
    if (status >= 400) assert.equal(typeof result.error, 'string');
    return result;
  }
  async function list() { return (await (await fetch(`${base}/api/links`)).json()).links; }
  async function disk() { return JSON.parse(await fs.readFile(path.join(data, 'links.json'), 'utf8')).links; }

  await start();
  await t.test('健康检查、原生表单与空列表', async () => {
    assert.deepEqual(await (await fetch(`${base}/health`)).json(), { ok: true });
    assert.deepEqual(await list(), []);
    const page = await (await fetch(base)).text();
    assert.match(page, /action="\/create" method="post"/);
    assert.match(page, /暂无链接/);
    assert.match(await (await fetch(`${base}/demo`)).text(), /已到达本地测试接收页/);
  });
  await t.test('URL、slug 校验及错误响应', async () => {
    for (const url of ['https://127.0.0.1:123/x', 'http://localhost:123/x', 'http://127.0.0.2:123/x', 'http://127.0.0.1/x', 'http://user:pass@127.0.0.1:123/x', 'http://127.0.0.1:123@evil.test/x', 'http://127.0.0.1:99999/x', 'http://2130706433:123/x', 'garbage', null]) {
      await create({ url }, 422);
    }
    for (const slug of ['', 'ab', 'x'.repeat(25), 'a b', 'abc/', 'abc\n', 'abc\r\n', '中文名', null, 123]) await create({ url: targetUrl, slug }, 422);
    for (const body of [null, [], {}, { slug: 'abc' }]) await create(body, 422);
    const malformed = await fetch(`${base}/api/links`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
    assert.equal(typeof (await malformed.json()).error, 'string');
    const oversized = await fetch(`${base}/api/links`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(17000) });
    assert.equal(oversized.status, 413);
    assert.equal(typeof (await oversized.json()).error, 'string');
  });
  await t.test('规范化、幂等、冲突、大小写和生成唯一 slug', async () => {
    const record = await create({ url: targetUrl.replace('/received', '/one/../received'), slug: 'Case_1' });
    assert.deepEqual(record, { slug: 'Case_1', url: targetUrl, visits: 0 });
    assert.deepEqual((await disk())[0], record);
    assert.deepEqual(await create({ url: targetUrl, slug: 'Case_1' }, 200), record);
    await create({ url: targetUrl + '?different', slug: 'Case_1' }, 409);
    await create({ url: targetUrl, slug: 'case_1' });
    const generated = await Promise.all(Array.from({ length: 12 }, () => create({ url: targetUrl })));
    assert.equal(new Set(generated.map(x => x.slug)).size, 12);
    generated.forEach(x => assert.match(x.slug, /^[A-Za-z0-9_-]{3,24}$/));
    const simultaneous = await Promise.all(Array.from({ length: 8 }, async () => {
      const res = await fetch(`${base}/api/links`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: targetUrl, slug: 'racing' }) });
      await res.json();
      return res.status;
    }));
    assert.equal(simultaneous.filter(code => code === 201).length, 1);
    assert.equal(simultaneous.filter(code => code === 200).length, 7);
    const links = await list();
    assert.deepEqual(links.map(x => x.slug), links.map(x => x.slug).sort());
    assert.equal(links.find(x => x.slug === 'Case_1').url, targetUrl);
    await create({ url: 'http://127.0.0.1:80/demo', slug: 'port80' });
  });
  await t.test('HEAD 不计数，20 次并发 GET 落盘且不请求目标', async () => {
    const head = await fetch(`${base}/s/Case_1`, { method: 'HEAD', redirect: 'manual' });
    assert.equal(head.status, 302);
    assert.equal(head.headers.get('location'), targetUrl);
    assert.equal(await head.text(), '');
    assert.equal((await list()).find(x => x.slug === 'Case_1').visits, 0);
    const responses = await Promise.all(Array.from({ length: 20 }, () => fetch(`${base}/s/Case_1`, { redirect: 'manual' })));
    for (const res of responses) { assert.equal(res.status, 302); assert.equal(res.headers.get('location'), targetUrl); await res.text(); }
    assert.equal((await list()).find(x => x.slug === 'Case_1').visits, 20);
    assert.equal((await disk()).find(x => x.slug === 'Case_1').visits, 20);
    assert.equal((await create({ url: targetUrl, slug: 'Case_1' }, 200)).visits, 20);
    assert.equal(targetRequests, 0);
    for (const method of ['GET', 'HEAD']) {
      const res = await fetch(`${base}/s/missing`, { method, redirect: 'manual' });
      assert.equal(res.status, 404);
      await res.text();
    }
    const followed = await fetch(`${base}/s/case_1`);
    assert.equal(await followed.text(), 'local receiver');
    assert.equal(targetRequests, 1);
  });
  await t.test('原生表单共享状态及纯文本展示', async () => {
    const unsafeUrl = targetUrl + '?text=<script>alert(1)</script>&quote="';
    const response = await fetch(`${base}/create`, { method: 'POST', body: new URLSearchParams({ url: unsafeUrl, slug: 'form_1' }), redirect: 'manual' });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), '/?created=form_1');
    await response.text();
    assert.equal((await list()).find(x => x.slug === 'form_1').url, new URL(unsafeUrl).href);
    const page = await (await fetch(`${base}/?created=%3Cscript%3Ebad%3C/script%3E`)).text();
    assert.ok(!page.includes('<script>'));
    assert.match(page, /&lt;script&gt;bad&lt;\/script&gt;/);
    assert.match(page, /form_1/);
    assert.match(page, /&amp;quote=/);
    const emptySlug = await fetch(`${base}/create`, { method: 'POST', body: new URLSearchParams({ url: targetUrl, slug: '' }), redirect: 'manual' });
    assert.equal(emptySlug.status, 303);
    await emptySlug.text();
  });
  await t.test('落盘失败不发布创建或计数，恢复后继续工作', async () => {
    const before = await list();
    const filename = path.join(data, 'links.json');
    const backup = path.join(data, 'backup.json');
    await fs.rename(filename, backup);
    await fs.mkdir(filename);
    try {
      await create({ url: targetUrl, slug: 'failed_write' }, 500);
      const response = await fetch(`${base}/s/Case_1`, { redirect: 'manual' });
      assert.equal(response.status, 500);
      assert.equal(typeof (await response.json()).error, 'string');
      assert.deepEqual(await list(), before);
    } finally {
      await fs.rmdir(filename);
      await fs.rename(backup, filename);
    }
    await create({ url: targetUrl, slug: 'recovered' });
    assert.equal((await disk()).find(x => x.slug === 'Case_1').visits, 20);
  });
  await t.test('进程停止并重启后完整恢复', async () => {
    const before = await list();
    await stop();
    await start();
    assert.deepEqual(await list(), before);
    assert.equal((await create({ url: 'http://127.0.0.1:80/demo', slug: 'port80' }, 200)).url, 'http://127.0.0.1/demo');
    const res = await fetch(`${base}/s/Case_1`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    await res.text();
    assert.equal((await disk()).find(x => x.slug === 'Case_1').visits, 21);
  });
});
