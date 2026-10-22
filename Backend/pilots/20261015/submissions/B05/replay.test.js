'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseBatch, replay, stringify, renderHtml } = require('./replay');

const event = (eventId, orderId, version, type, amount = 100) => ({
  eventId, orderId, version, type, payload: type === 'CREATE' ? { amount } : {},
});
const encode = events => Buffer.from(events.map(e => JSON.stringify(e)).join('\n'));
const run = events => replay(parseBatch(encode(events)));

test('gap stays ABSENT; full replay after filling gap applies PAY', () => {
  const pay = event('pay', 'A', 2, 'PAY');
  assert.deepEqual(run([pay]).orders, [{ orderId: 'A', status: 'ABSENT', amount: 0, lastVersion: 0 }]);
  assert.equal(run([pay]).receipts[0].result, 'PENDING_GAP');
  const report = run([pay, event('create', 'A', 1, 'CREATE', 1250)]);
  assert.deepEqual(report.orders, [{ orderId: 'A', status: 'PAID', amount: 1250, lastVersion: 2 }]);
  assert.equal(report.summary.paidAmount, 1250n);
});

test('rejections consume versions; all events beyond a gap stay pending', () => {
  const report = run([
    event('a1', 'A', 1, 'CREATE'), event('a2', 'A', 2, 'CANCEL'),
    event('a3', 'A', 3, 'PAY'), event('a5', 'A', 5, 'PAY'), event('a6', 'A', 6, 'REFUND'),
    event('b1', 'B', 1, 'PAY'), event('b2', 'B', 2, 'CREATE'), event('b3', 'B', 3, 'CANCEL'),
  ]);
  assert.deepEqual(report.orders, [
    { orderId: 'A', status: 'CANCELLED', amount: 100, lastVersion: 3 },
    { orderId: 'B', status: 'ABSENT', amount: 0, lastVersion: 3 },
  ]);
  assert.deepEqual(report.receipts.map(r => r.result), [
    'APPLIED', 'APPLIED', 'REJECTED_TRANSITION', 'PENDING_GAP', 'PENDING_GAP',
    'REJECTED_TRANSITION', 'REJECTED_TRANSITION', 'REJECTED_TRANSITION',
  ]);
  assert.equal(report.summary.rejected, 4);
  assert.equal(report.summary.pending, 2);
});

test('every state and current paid/refunded amounts are counted', () => {
  const report = run([
    event('a', 'A', 2, 'PAY'), event('b', 'B', 1, 'CREATE'),
    event('c1', 'C', 1, 'CREATE', 200), event('c2', 'C', 2, 'PAY'),
    event('d1', 'D', 1, 'CREATE', 300), event('d2', 'D', 2, 'CANCEL'),
    event('e1', 'E', 1, 'CREATE', 400), event('e2', 'E', 2, 'PAY'), event('e3', 'E', 3, 'REFUND'),
  ]);
  assert.deepEqual(report.summary, {
    orders: 5, statusCounts: { ABSENT: 1, PENDING: 1, PAID: 1, CANCELLED: 1, REFUNDED: 1 },
    paidAmount: 200n, refundedAmount: 400n, applied: 8, rejected: 0, pending: 1, duplicates: 0,
  });
});

test('field order independent deduplication, exact string IDs, code point sorting', () => {
  const a = event('900719925474099312345', '\u{10000}', 1, 'CREATE');
  const reordered = { payload: { amount: 100 }, type: 'CREATE', version: 1, orderId: a.orderId, eventId: a.eventId };
  const report = run([a, reordered, event('x', '\uE000', 1, 'CREATE'), event('y', '900719925474099312345', 1, 'PAY')]);
  assert.equal(report.summary.duplicates, 1);
  assert.deepEqual(report.orders.map(o => o.orderId), ['900719925474099312345', '\uE000', '\u{10000}']);
  assert.equal(report.receipts.at(-1).eventId, '900719925474099312345');
});

test('all permutations of a small batch produce byte-identical output', () => {
  const a = event('a', 'A', 1, 'CREATE');
  const events = [a, event('b', 'A', 2, 'PAY'), event('c', 'B', 2, 'REFUND'), a];
  function* permutations(items) {
    if (!items.length) { yield []; return; }
    for (let i = 0; i < items.length; i++) {
      for (const rest of permutations(items.filter((_, j) => j !== i))) yield [items[i], ...rest];
    }
  }
  const expected = run(events);
  for (const shuffled of permutations(events)) {
    assert.equal(stringify(run(shuffled)), stringify(expected));
    assert.equal(renderHtml(run(shuffled)), renderHtml(expected));
  }
});

test('reject invalid structures, values, and both conflict types', () => {
  const base = event('e', 'A', 1, 'CREATE');
  const invalid = [null, [], {}, { ...base, extra: true }, { ...base, eventId: '' },
    { ...base, orderId: 123 }, { ...base, version: 0 }, { ...base, version: 1.5 },
    { ...base, version: Number.MAX_SAFE_INTEGER + 1 }, { ...base, type: 'DELETE' },
    { ...base, payload: { amount: 0 } }, { ...base, payload: { amount: 1.1 } },
    { ...base, payload: { amount: Number.MAX_SAFE_INTEGER + 1 } },
    { ...base, payload: { amount: 100, extra: 1 } }, { ...base, payload: [] },
    { ...base, type: 'PAY' }, { ...base, payload: null }, { ...base, version: '1' }];
  for (const bad of invalid) assert.throws(() => run([bad]));
  assert.throws(() => run([base, { ...base, payload: { amount: 101 } }]), /内容冲突/);
  assert.throws(() => run([base, { ...base, eventId: 'different' }]), /version 冲突/);
  assert.throws(() => run([base, { ...base, orderId: 'B' }]), /内容冲突/);
});

test('UTF-8, byte/line limits, blanks, CRLF, and empty input', () => {
  assert.throws(() => parseBatch(Buffer.from([0xc3, 0x28])), /UTF-8/);
  assert.throws(() => parseBatch(Buffer.alloc(1024 * 1024 + 1, 32)), /1 MiB/);
  assert.throws(() => parseBatch(Buffer.from('\n'.repeat(10001))), /10,000/);
  assert.equal(replay(parseBatch(Buffer.from('\n'.repeat(10000)))).summary.orders, 0);
  assert.equal(replay(parseBatch(Buffer.alloc(1024 * 1024, 32))).summary.orders, 0);
  assert.equal(run([]).summary.orders, 0);
  assert.throws(() => parseBatch(Buffer.from('{invalid}\n')), /JSON/);
  const buffer = Buffer.from(' \r\n' + JSON.stringify(event('e', 'A', 1, 'CREATE')) + '\r\n\t\r\n');
  assert.equal(replay(parseBatch(buffer)).summary.orders, 1);
  const maxEvents = Array.from({ length: 10000 }, (_, i) => event(`e${i}`, 'A', i + 1, 'PAY'));
  assert.equal(run(maxEvents).summary.rejected, 10000);
});

test('aggregate amounts are serialized as exact JSON integer tokens', () => {
  const events = ['A', 'B', 'C'].flatMap(id => [
    event(`${id}1`, id, 1, 'CREATE', Number.MAX_SAFE_INTEGER), event(`${id}2`, id, 2, 'PAY'),
  ]);
  const report = run(events);
  assert.equal(report.summary.paidAmount, 27021597764222973n);
  assert.match(stringify(report), /"paidAmount":27021597764222973/);
  assert.doesNotThrow(() => JSON.parse(stringify(report)));
});

test('HTML treats malicious IDs as text and has no scripts or external resources', () => {
  const id = '<script>alert("x")</script><img src="https://example.com">&\'';
  const html = renderHtml(run([event(id, id, 1, 'CREATE')]));
  assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'));
  assert.ok(html.includes('&amp;&#39;'));
  assert.doesNotMatch(html, /<script|<img|<link|<iframe/i);
});

test('CLI writes paired reports and summary only; invalid batches preserve previous artifacts', () => {
  const dir = fs.mkdtempSync(path.join(__dirname, '.replay-test-'));
  try {
    const input = path.join(dir, 'input.jsonl');
    const html = path.join(dir, 'report.html');
    const json = path.join(dir, 'report.json');
    const cli = () => spawnSync(process.execPath, [path.join(__dirname, 'replay.js'), '--input', input, '--out', html], { encoding: 'utf8' });
    const base = event('a', 'A', 1, 'CREATE');
    fs.writeFileSync(input, encode([base, event('b', 'A', 2, 'CANCEL'), event('c', 'A', 3, 'PAY'), event('d', 'B', 2, 'PAY')]));
    const success = cli();
    assert.equal(success.status, 0, success.stderr);
    assert.equal(success.stderr, '');
    const saved = [fs.readFileSync(html), fs.readFileSync(json)];
    const report = JSON.parse(saved[1]);
    assert.deepEqual(Object.keys(report), ['orders', 'receipts', 'summary']);
    assert.deepEqual(JSON.parse(success.stdout), report.summary);
    assert.equal(success.stdout.trim().split('\n').length, 1);
    for (const invalid of [Buffer.from('{}'), encode([base, { ...base, eventId: 'x' }]),
      encode([base, { ...base, payload: { amount: 101 } }]), Buffer.from([255])]) {
      fs.writeFileSync(input, invalid);
      const failure = cli();
      assert.equal(failure.status, 2);
      assert.equal(failure.stdout, '');
      assert.ok(failure.stderr.length > 0);
      assert.deepEqual(fs.readFileSync(html), saved[0]);
      assert.deepEqual(fs.readFileSync(json), saved[1]);
    }
    fs.writeFileSync(input, encode([base]));
    assert.equal(cli().status, 0); // Existing reports can be replaced on Windows.
    assert.equal(JSON.parse(fs.readFileSync(json)).orders[0].status, 'PENDING');
    assert.deepEqual(fs.readdirSync(dir).sort(), ['input.jsonl', 'report.html', 'report.json']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
