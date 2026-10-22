#!/usr/bin/env node
'use strict';

const { DatabaseSync } = require('node:sqlite');
const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MAX = Number.MAX_SAFE_INTEGER;
const ZERO_HASH = '0'.repeat(64);
const FORMAT = 'ledger-audit-v1';
const sleepBuffer = new Int32Array(new SharedArrayBuffer(4));

class CliError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

function invalid(message) {
  throw new CliError(message, 2);
}

function integer(text, positive = false) {
  if (typeof text !== 'string' || !/^\d+$/.test(text)) invalid('Expected an unsigned integer');
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    invalid(positive ? 'Amount must be a positive safe integer' : 'Balance must be a nonnegative safe integer');
  }
  return value;
}

function accountId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_]+$/.test(value)) invalid('Invalid account ID');
  return value;
}

function parseArgs(args) {
  const options = Object.create(null);
  let command;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      if (Object.hasOwn(options, arg) || i + 1 === args.length) invalid(`Invalid option: ${arg}`);
      options[arg] = args[++i];
    } else if (!command && ['init', 'transfer', 'report'].includes(arg)) {
      command = arg;
    } else {
      invalid(`Unexpected argument: ${arg}`);
    }
  }
  const required = {
    init: ['--db', '--accounts'],
    transfer: ['--db', '--id', '--from', '--to', '--amount'],
    report: ['--db', '--out'],
  }[command];
  if (!required) invalid('Expected init, transfer or report');
  for (const key of required) if (!options[key]) invalid(`Missing option: ${key}`);
  for (const key of Object.keys(options)) if (!required.includes(key)) invalid(`Unknown option: ${key}`);
  if (options['--db'] === ':memory:') invalid('--db must name a persistent file');

  const input = { command, dbPath: path.resolve(options['--db']) };
  if (command === 'init') {
    const seen = new Set();
    input.accounts = options['--accounts'].split(',').map((entry) => {
      const parts = entry.split(':');
      if (parts.length !== 2) invalid('Expected accounts in the form a:100,b:100');
      const id = accountId(parts[0]);
      if (seen.has(id)) invalid(`Duplicate account: ${id}`);
      seen.add(id);
      return { id, balance: integer(parts[1]) };
    });
  } else if (command === 'transfer') {
    input.requestId = options['--id'];
    input.from = accountId(options['--from']);
    input.to = accountId(options['--to']);
    input.amount = integer(options['--amount'], true);
    if (input.from === input.to) invalid('Cannot transfer to the same account');
  } else {
    input.outPath = path.resolve(options['--out']);
    const normalize = (name) => process.platform === 'win32' ? name.toLowerCase() : name;
    const output = normalize(input.outPath);
    if (['', '-wal', '-shm', '-journal'].some((suffix) => output === normalize(input.dbPath + suffix))) {
      invalid('Report output must not overwrite the database or its sidecar files');
    }
    // Also reject an existing hard link or symlink to the database.
    if (fs.existsSync(input.outPath) && fs.existsSync(input.dbPath)) {
      const a = fs.statSync(input.outPath, { bigint: true });
      const b = fs.statSync(input.dbPath, { bigint: true });
      if (a.dev === b.dev && a.ino === b.ino) invalid('Report output points to the database');
    }
  }
  return input;
}

function retryBusy(operation) {
  for (;;) {
    try {
      return operation();
    } catch (error) {
      // SQLite extended result codes retain the primary code in the low byte.
      if (![5, 6].includes(error.errcode & 255)) throw error;
      Atomics.wait(sleepBuffer, 0, 0, 25 + Math.floor(Math.random() * 50));
    }
  }
}

function transaction(db, write, operation) {
  retryBusy(() => db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN'));
  try {
    const result = operation();
    retryBusy(() => db.exec('COMMIT'));
    return result;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* Preserve the original error. */ }
    throw error;
  }
}

function checkInitialized(db) {
  const exists = db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'metadata'").get();
  if (!exists || db.prepare("SELECT value FROM metadata WHERE key = 'format'").get()?.value !== FORMAT) {
    throw new CliError('Database is not initialized by this ledger');
  }
}

function initialize(db, accounts) {
  return transaction(db, true, () => {
    const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
    if (tables.length) {
      checkInitialized(db);
      return { exitCode: 0, body: { ok: true } };
    }
    db.exec(`
      CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        opening_balance INTEGER NOT NULL CHECK(opening_balance BETWEEN 0 AND ${MAX}),
        balance INTEGER NOT NULL CHECK(balance BETWEEN 0 AND ${MAX})
      ) STRICT;
      CREATE TABLE requests (
        request_id TEXT PRIMARY KEY,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND ${MAX}),
        exit_code INTEGER NOT NULL CHECK(exit_code IN (0, 1)),
        response_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE ledger (
        seq INTEGER PRIMARY KEY CHECK(seq BETWEEN 1 AND ${MAX}),
        request_id TEXT NOT NULL UNIQUE REFERENCES requests(request_id),
        from_id TEXT NOT NULL REFERENCES accounts(id),
        to_id TEXT NOT NULL REFERENCES accounts(id),
        amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND ${MAX}),
        prev_hash TEXT NOT NULL,
        hash TEXT NOT NULL,
        CHECK(from_id <> to_id)
      ) STRICT;
    `);
    const insert = db.prepare('INSERT INTO accounts(id, opening_balance, balance) VALUES (?, ?, ?)');
    for (const account of accounts) insert.run(account.id, account.balance, account.balance);
    const total = accounts.reduce((sum, account) => sum + BigInt(account.balance), 0n);
    const metadata = db.prepare('INSERT INTO metadata(key, value) VALUES (?, ?)');
    metadata.run('initial_total', total.toString());
    metadata.run('format', FORMAT);
    return { exitCode: 0, body: { ok: true } };
  });
}

function hashEntry(entry) {
  const { seq, requestId, from, to, amount } = entry;
  return createHash('sha256')
    .update(entry.prevHash + '\n' + JSON.stringify({ seq, requestId, from, to, amount }), 'utf8')
    .digest('hex');
}

function transfer(db, input) {
  return transaction(db, true, () => {
    checkInitialized(db);
    const { requestId, from, to, amount } = input;
    const previous = db.prepare('SELECT * FROM requests WHERE request_id = ?').get(requestId);
    if (previous) {
      if (previous.from_id !== from || previous.to_id !== to || previous.amount !== amount) {
        return { exitCode: 1, body: { ok: false, error: 'Request ID conflicts with different parameters' } };
      }
      return { exitCode: previous.exit_code, body: JSON.parse(previous.response_json) };
    }
    const findAccount = db.prepare('SELECT balance FROM accounts WHERE id = ?');
    const source = findAccount.get(from);
    const destination = findAccount.get(to);
    let error;
    if (!source || !destination) error = 'Unknown account';
    else if (source.balance < amount) error = 'Insufficient funds';
    else if (amount > MAX - destination.balance) error = 'Destination balance exceeds the safe integer limit';

    const saveResponse = db.prepare(`
      INSERT INTO requests(request_id, from_id, to_id, amount, exit_code, response_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    if (error) {
      const body = { ok: false, error };
      saveResponse.run(requestId, from, to, amount, 1, JSON.stringify(body));
      return { exitCode: 1, body };
    }

    const tail = db.prepare('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1').get();
    const seq = tail ? tail.seq + 1 : 1;
    if (!Number.isSafeInteger(seq)) throw new CliError('Ledger sequence limit reached');
    const entry = { seq, requestId, from, to, amount, prevHash: tail?.hash ?? ZERO_HASH };
    entry.hash = hashEntry(entry);
    const body = { ok: true, seq, requestId, from, to, amount };
    saveResponse.run(requestId, from, to, amount, 0, JSON.stringify(body));
    db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(amount, from);
    db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(amount, to);
    db.prepare(`
      INSERT INTO ledger(seq, request_id, from_id, to_id, amount, prev_hash, hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(seq, requestId, from, to, amount, entry.prevHash, entry.hash);
    return { exitCode: 0, body };
  });
}

function report(db) {
  // One read transaction: concurrent commits cannot mix balances and ledger versions.
  return transaction(db, false, () => {
    checkInitialized(db);
    const rows = db.prepare('SELECT id, opening_balance, balance FROM accounts ORDER BY id COLLATE BINARY').all();
    const ledger = db.prepare(`
      SELECT seq, request_id AS requestId, from_id AS "from", to_id AS "to",
             amount, prev_hash AS prevHash, hash FROM ledger ORDER BY seq
    `).all();
    const metadata = db.prepare("SELECT value FROM metadata WHERE key = 'initial_total'").get();
    const expected = new Map(rows.map((row) => [row.id, BigInt(row.opening_balance)]));
    const total = rows.reduce((sum, row) => sum + BigInt(row.balance), 0n);
    const openingTotal = rows.reduce((sum, row) => sum + BigInt(row.opening_balance), 0n);
    let auditOk = /^\d+$/.test(metadata?.value ?? '') &&
      total === BigInt(metadata.value) && openingTotal === total;
    for (const row of rows) {
      if (!/^[A-Za-z0-9_]+$/.test(row.id) || !Number.isSafeInteger(row.balance) || row.balance < 0 ||
          !Number.isSafeInteger(row.opening_balance) || row.opening_balance < 0) auditOk = false;
    }
    let prevHash = ZERO_HASH;
    const requestIds = new Set();
    const successResponses = new Map(db.prepare('SELECT * FROM requests WHERE exit_code = 0').all()
      .map((row) => [row.request_id, row]));
    if (successResponses.size !== ledger.length) auditOk = false;
    for (let index = 0; index < ledger.length; index++) {
      const entry = ledger[index];
      if (entry.seq !== index + 1 || entry.prevHash !== prevHash || entry.hash !== hashEntry(entry) ||
          requestIds.has(entry.requestId) || !entry.requestId || entry.from === entry.to ||
          !Number.isSafeInteger(entry.amount) || entry.amount <= 0) auditOk = false;
      requestIds.add(entry.requestId);
      prevHash = entry.hash;
      if (!expected.has(entry.from) || !expected.has(entry.to)) {
        auditOk = false;
      } else {
        expected.set(entry.from, expected.get(entry.from) - BigInt(entry.amount));
        expected.set(entry.to, expected.get(entry.to) + BigInt(entry.amount));
        if (expected.get(entry.from) < 0n || expected.get(entry.to) > BigInt(MAX)) auditOk = false;
      }
      const saved = successResponses.get(entry.requestId);
      const response = { ok: true, seq: entry.seq, requestId: entry.requestId,
        from: entry.from, to: entry.to, amount: entry.amount };
      if (!saved || saved.from_id !== entry.from || saved.to_id !== entry.to ||
          saved.amount !== entry.amount || saved.response_json !== JSON.stringify(response)) auditOk = false;
    }
    for (const row of rows) if (expected.get(row.id) !== BigInt(row.balance)) auditOk = false;
    return {
      accounts: rows.map(({ id, balance }) => ({ id, balance })),
      // A sum of valid balances can exceed JSON's exact numeric range.
      total: total <= BigInt(MAX) && total >= -BigInt(MAX) ? Number(total) : total.toString(),
      ledger,
      auditOk,
    };
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function writeReport(filename, data) {
  const cells = (values) => '<tr>' + values.map((value) => `<td>${escapeHtml(value)}</td>`).join('') + '</tr>';
  const html = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'">
<title>转账账本审计报告</title></head>
<body>
<h1>转账账本审计报告</h1>
<p>审计结果：${data.auditOk ? '通过（auditOk: true）' : '未通过（auditOk: false）'}</p>
<p>校验初始总额、各账户流水重建余额、连续序号、SHA-256 哈希链与成功请求响应。</p>
<h2>账户余额</h2>
<table border="1"><thead><tr><th>账户 ID</th><th>余额</th></tr></thead>
<tbody>${data.accounts.map((row) => cells([row.id, row.balance])).join('\n')}</tbody>
<tfoot><tr><th>总额</th><td>${escapeHtml(data.total)}</td></tr></tfoot></table>
<h2>成功转账</h2>
<table border="1"><thead><tr><th>seq</th><th>requestId</th><th>from</th><th>to</th><th>amount</th><th>prevHash</th><th>hash</th></tr></thead>
<tbody>${data.ledger.map((row) => cells([row.seq, row.requestId, row.from, row.to, row.amount, row.prevHash, row.hash])).join('\n')}</tbody></table>
</body></html>\n`;
  const temporary = filename + '.' + randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temporary, html, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, filename);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function main() {
  const input = parseArgs(process.argv.slice(2));
  if (input.command !== 'init' && !fs.existsSync(input.dbPath)) throw new CliError('Database does not exist; run init first');
  const db = new DatabaseSync(input.dbPath, { readOnly: input.command === 'report' });
  try {
    db.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
    if (input.command !== 'report') {
      if (input.command === 'init') retryBusy(() => db.exec('PRAGMA journal_mode = WAL'));
      db.exec('PRAGMA synchronous = FULL');
    }
    if (input.command === 'init') return initialize(db, input.accounts);
    if (input.command === 'transfer') return transfer(db, input);
    const body = report(db);
    writeReport(input.outPath, body);
    return { exitCode: 0, body };
  } finally {
    db.close();
  }
}

let result;
try {
  result = main();
} catch (error) {
  result = { exitCode: error.exitCode ?? 1, body: { ok: false, error: error.message || 'Unexpected error' } };
}
// Emit only after COMMIT (and FULL synchronous persistence) or report file completion.
process.exitCode = result.exitCode;
process.stdout.write(JSON.stringify(result.body) + '\n');
