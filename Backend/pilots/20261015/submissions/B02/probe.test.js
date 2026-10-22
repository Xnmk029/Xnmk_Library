'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const executable = path.join(__dirname, 'probe.js');

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [executable, ...args], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('HTTP probe integration', { timeout: 30000 }, async (t) => {
  const directory = await fs.mkdtemp(path.join(__dirname, '.probe-test-'));
  let active = 0;
  let peak = 0;
  let hits = 0;
  let redirectHits = 0;
  const server = http.createServer((req, res) => {
    hits++;
    active++;
    peak = Math.max(peak, active);
    let timer;
    res.on('close', () => { active--; clearTimeout(timer); clearInterval(timer); });
    const route = new URL(req.url, 'http://127.0.0.1').pathname;
    if (route === '/redirect') {
      res.writeHead(302, { Location: '/destination' });
      res.end();
    } else if (route === '/destination') {
      redirectHits++;
      res.end('redirect was followed');
    } else if (route === '/fail') {
      res.writeHead(503);
      res.end('unavailable');
    } else if (route === '/hang') {
      // Leave both headers and body pending until the client's deadline.
    } else if (route === '/stream') {
      res.writeHead(200);
      res.write('first chunk');
      timer = setInterval(() => res.write('more'), 10);
    } else if (route === '/drop') {
      res.writeHead(200, { 'Content-Length': '1000' });
      res.write('partial');
      timer = setTimeout(() => res.destroy(), 15);
    } else if (route === '/delay') {
      timer = setTimeout(() => res.end('ok'), 60);
    } else if (route === '/no-content') {
      res.writeHead(204);
      res.end();
    } else {
      res.end('ok');
    }
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const configPath = path.join(directory, 'targets with spaces.json');
  const htmlPath = path.join(directory, 'report.html');
  const jsonPath = path.join(directory, 'report.json');
  const args = ['--config', configPath, '--out', htmlPath];
  const readReport = async () => JSON.parse(await fs.readFile(jsonPath, 'utf8'));
  const configure = async (value) => fs.writeFile(configPath, JSON.stringify(value));

  await t.test('mixed results, input order, no redirects, timeout and escaping', async () => {
    const closedServer = http.createServer();
    await new Promise((resolve) => closedServer.listen(0, '127.0.0.1', resolve));
    const closedPort = closedServer.address().port;
    await new Promise((resolve) => closedServer.close(resolve));
    const targets = [
      { id: '<script>alert("x")</script>&\'', url: `${base}/delay` },
      { id: 'markup-url', url: `${base}/ok?<svg/onload=alert(1)>&x=1` },
      { id: 'unavailable', url: `${base}/fail` },
      { id: 'redirect', url: `${base}/redirect` },
      { id: 'hang', url: `${base}/hang` },
      { id: 'refused', url: `http://127.0.0.1:${closedPort}/` },
      { id: 'stream', url: `${base}/stream` },
      { id: 'drop', url: `${base}/drop` },
      { id: 'last', url: `${base}/no-content` },
    ];
    await configure(targets);
    const result = await run([...args, '--timeout-ms', '150', '--concurrency', '2']);
    assert.equal(result.code, 1, result.stderr);
    const report = await readReport();
    assert.deepEqual(report.summary, { total: 9, healthy: 3, failed: 6 });
    assert.deepEqual(report.results.map(({ id, url }) => ({ id, url })), targets);
    assert.deepEqual(report.results.map(({ status }) => status), [200, 200, 503, 302, null, null, null, null, 204]);
    for (const row of report.results) {
      assert.deepEqual(Object.keys(row).sort(), ['error', 'id', 'ok', 'status', 'url']);
      if (row.ok) assert.equal(row.error, null);
      else assert.ok(typeof row.error === 'string' && row.error.length > 0);
    }
    assert.equal(redirectHits, 0);
    const html = await fs.readFile(htmlPath, 'utf8');
    assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;'));
    assert.ok(html.includes('&lt;svg/onload=alert(1)&gt;&amp;x=1'));
    assert.ok(!html.includes('<script>') && !html.includes('<svg'));
    assert.equal((html.match(/<details>/g) || []).length, targets.length);
  });

  await t.test('bounded concurrency and all healthy exit zero', async () => {
    peak = 0;
    await configure(Array.from({ length: 7 }, (_, i) => ({ id: String(i), url: `${base}/delay` })));
    const result = await run([...args, '--timeout-ms', '1000', '--concurrency', '2']);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(peak, 2);
    assert.deepEqual((await readReport()).summary, { total: 7, healthy: 7, failed: 0 });
  });

  await t.test('queued targets receive separate deadlines and continue after failure', async () => {
    await configure([
      { id: 'one', url: `${base}/hang` },
      { id: 'two', url: `${base}/hang` },
      { id: 'three', url: `${base}/no-content` },
    ]);
    const start = performance.now();
    const result = await run([...args, '--timeout-ms', '150', '--concurrency', '1']);
    assert.equal(result.code, 1, result.stderr);
    assert.ok(performance.now() - start >= 280);
    assert.deepEqual((await readReport()).results.map((row) => row.ok), [false, false, true]);
  });

  await t.test('invalid configuration leaves both existing outputs unchanged and makes no requests', async () => {
    const invalidUrls = [
      'https://127.0.0.1:8080/', 'http://localhost:8080/', 'http://127.0.0.2:8080/',
      'http://[::1]:8080/', 'http://127.0.0.1/', 'http://127.1:8080/',
      'http://2130706433:8080/', 'http://0x7f000001:8080/',
      'http://user:pass@127.0.0.1:8080/', 'http://@127.0.0.1:8080/',
      'http://127.0.0.1:8080@evil.example/', 'http://127.0.0.1:65536/',
      'http://127.0.0.1:0/', 'http://127.0.0.1:abc/',
      ' http://127.0.0.1:8080/', 'http://127.0.0.1:8080/\n',
      'http://127.0.0.1:8080\\@evil.example/', 'not a URL', 123,
    ];
    const invalidConfigs = [null, {}, [null], [[]], [{ id: '', url: base }],
      [{ id: '   ', url: base }], [{ id: 3, url: base }], [{ id: 'missing-url' }],
      ...invalidUrls.map((url) => [{ id: 'valid-first', url: `${base}/ok` }, { id: 'bad', url }])];
    await fs.writeFile(htmlPath, 'existing HTML');
    await fs.writeFile(jsonPath, 'existing JSON');
    const previousHits = hits;
    for (const value of invalidConfigs) {
      await configure(value);
      const result = await run(args);
      assert.equal(result.code, 2, JSON.stringify(value));
      assert.ok(result.stderr);
      assert.equal(await fs.readFile(htmlPath, 'utf8'), 'existing HTML');
      assert.equal(await fs.readFile(jsonPath, 'utf8'), 'existing JSON');
    }
    await fs.writeFile(configPath, '{invalid JSON');
    assert.equal((await run(args)).code, 2);
    assert.equal(await fs.readFile(htmlPath, 'utf8'), 'existing HTML');
    assert.equal(await fs.readFile(jsonPath, 'utf8'), 'existing JSON');
    assert.equal(hits, previousHits);
  });

  await t.test('argument errors and empty configuration', async () => {
    await configure([]);
    for (const extra of [['--concurrency', '0'], ['--timeout-ms', '-1'], ['--timeout-ms', '1.5'],
      ['--timeout-ms', '2147483648'], ['--unknown', 'x'], ['--out', htmlPath], ['--concurrency']]) {
      assert.equal((await run([...args, ...extra])).code, 2, JSON.stringify(extra));
    }
    assert.equal((await run([])).code, 2);
    assert.equal((await run(['--config', configPath, '--out', jsonPath])).code, 2);
    assert.equal((await run(args)).code, 0);
    assert.deepEqual(await readReport(), { results: [], summary: { total: 0, healthy: 0, failed: 0 } });
  });
});
