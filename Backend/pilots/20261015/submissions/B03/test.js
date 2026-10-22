'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { createHash } = require('node:crypto');
const { Script } = require('node:vm');

test('真实文件扫描、边界、隔离、并发、更新及持久化', { timeout: 60000 }, async t => {
  const workspace = await fs.mkdtemp(path.join(__dirname, '.test-'));
  const root = path.join(workspace, 'root');
  const data = path.join(workspace, 'data');
  const outside = path.join(workspace, 'outside');
  let child;
  async function stop() {
    if (!child || child.exitCode !== null) return;
    const closed = once(child, 'exit');
    child.kill();
    await closed;
    child = null;
  }
  t.after(async () => {
    await stop();
    await fs.rm(workspace, { recursive: true, force: true });
  });
  await fs.mkdir(path.join(root, 'a'), { recursive: true });
  await fs.mkdir(path.join(root, 'b'));
  await fs.mkdir(outside);
  const shared = Buffer.from('相同内容\nwith binary\0bytes');
  const edge = Buffer.alloc(8 * 1024 * 1024, 0x5a);
  const fixtures = [
    ['a/same.txt', 'first'], ['b/same.txt', 'second'],
    ['copy.bin', shared], ['中文文件.txt', shared],
    ['empty', ''], ['空文件', ''],
    ['edge-a.bin', edge], ['edge-b.bin', edge],
    ['too-large.bin', Buffer.alloc(edge.length + 1)],
  ];
  for (const [name, bytes] of fixtures) await fs.writeFile(path.join(root, name), bytes);
  await fs.writeFile(path.join(outside, 'secret.txt'), shared);
  await fs.symlink(outside, path.join(root, 'outside-link'), process.platform === 'win32' ? 'junction' : 'dir');
  await fs.symlink(root, path.join(root, 'cycle'), process.platform === 'win32' ? 'junction' : 'dir');
  if (process.platform !== 'win32') await fs.symlink(path.join(outside, 'secret.txt'), path.join(root, 'linked-file'));

  const reservation = net.createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  async function start() {
    let logs = '';
    child = spawn(process.execPath, [path.join(__dirname, 'server.js'), '--port', String(port), '--data', data, '--root', root], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => { logs += chunk; });
    child.stderr.on('data', chunk => { logs += chunk; });
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(logs);
      try { if ((await fetch(base + '/health')).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('启动超时：' + logs);
  }
  async function json(route, options) {
    const response = await fetch(base + route, options);
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  }
  await start();
  assert.deepEqual(await json('/health'), { ok: true });
  assert.deepEqual(await json('/api/result'), { groups: [], scanned: 0, skipped: 0 });
  const html = await (await fetch(base)).text();
  assert.match(html, /开始扫描/);
  new Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);

  const scans = Array.from({ length: 3 }, () => json('/api/scan', { method: 'POST' }));
  let observedRunning = false;
  for (let i = 0; i < 20; i++) {
    const status = await json('/api/status');
    if (status.running) {
      observedRunning = true;
      const old = await json('/api/result');
      assert.ok(old.scanned === 0 || old.scanned === 8, '仅发布完整结果');
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  const [first, ...concurrent] = await Promise.all(scans);
  for (const value of concurrent) assert.deepEqual(value, first);
  assert.ok(observedRunning, '可以查询运行中的进度');
  assert.equal(first.scanned, 8);
  assert.equal(first.skipped, 1);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.deepEqual(first.groups, [
    { sha256: hash(shared), size: shared.length, paths: ['copy.bin', '中文文件.txt'] },
    { sha256: hash(edge), size: edge.length, paths: ['edge-a.bin', 'edge-b.bin'] },
    { sha256: hash(''), size: 0, paths: ['empty', '空文件'] },
  ]);
  assert.deepEqual(await json('/api/result'), first);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(data, 'result.json'), 'utf8')), first);
  assert.deepEqual(await fs.readdir(data), ['result.json'], '清理临时快照');

  await stop();
  await start();
  assert.deepEqual(await json('/api/result'), first, '重启后恢复');
  await fs.writeFile(path.join(root, '中文文件.txt'), 'modified');
  const second = await json('/api/scan', { method: 'POST' });
  assert.equal(second.groups.length, 2);
  assert.ok(second.groups.every(group => !group.paths.includes('copy.bin')));
  assert.deepEqual(await json('/api/result'), second);
  assert.equal((await fetch(base + '/api/scan?root=..', { method: 'POST' })).status, 400);
  assert.equal((await fetch(base + '/api/scan', { method: 'POST', headers: { Origin: 'https://example.com' } })).status, 403);
  for (const route of ['/missing', '/api/scan', '/server.js', '/api/files?path=../outside/secret.txt']) {
    const response = await fetch(base + route);
    assert.ok(response.status >= 400);
    assert.equal(typeof (await response.json()).error, 'string');
  }
  // Replacing the whole root with an out-of-root junction must fail without overwriting history.
  const moved = path.join(workspace, 'original-root');
  await fs.rename(root, moved);
  await fs.symlink(outside, root, process.platform === 'win32' ? 'junction' : 'dir');
  const failed = await fetch(base + '/api/scan', { method: 'POST' });
  assert.equal(failed.status, 500);
  assert.equal(typeof (await failed.json()).error, 'string');
  assert.deepEqual(await json('/api/result'), second);
  assert.equal((await json('/api/status')).running, false);
  await stop();
  await fs.unlink(root);
  await fs.rename(moved, root);
  await start();
  assert.deepEqual(await json('/api/result'), second);
});
