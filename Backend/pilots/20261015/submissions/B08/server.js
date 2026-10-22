'use strict';

const http = require('node:http');
const { DatabaseSync } = require('node:sqlite');
const { mkdirSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function options(argv) {
  const result = { port: 3000, data: path.join(__dirname, 'data') };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help') {
      console.log('node server.js --port 3000 --data ./data --capacity 10 --ttl-ms 1200');
      process.exit(0);
    }
    if (!['--port', '--data', '--capacity', '--ttl-ms'].includes(key) || !argv[i + 1]) {
      throw new Error(`未知参数或缺少值：${key}`);
    }
    const value = argv[++i];
    if (key === '--data') result.data = path.resolve(value);
    else {
      const number = Number(value);
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1 ||
          (key === '--port' && number > 65535) || (key === '--ttl-ms' && number > 31536000000)) {
        throw new Error(`参数值不合法：${key}`);
      }
      result[key.slice(2)] = number;
    }
  }
  return result;
}

function main() {
  const config = options(process.argv.slice(2));
  mkdirSync(config.data, { recursive: true });
  const db = new DatabaseSync(path.join(config.data, 'inventory.sqlite'));
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;
    PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      capacity INTEGER NOT NULL CHECK (capacity >= 0),
      available INTEGER NOT NULL CHECK (available >= 0),
      reserved INTEGER NOT NULL CHECK (reserved >= 0),
      sold INTEGER NOT NULL CHECK (sold >= 0),
      ttl_ms INTEGER NOT NULL,
      CHECK (available + reserved + sold = capacity)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('reserved', 'paid', 'cancelled', 'expired')),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS orders_expiry ON orders(status, expires_at);
    CREATE TABLE IF NOT EXISTS requests (
      request_id TEXT PRIMARY KEY,
      pathname TEXT NOT NULL,
      payload TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response TEXT NOT NULL
    );`);

  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const value = work();
      db.exec('COMMIT');
      return value;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  transaction(() => {
    const existing = db.prepare('SELECT * FROM inventory WHERE id = 1').get();
    if (!existing) {
      const capacity = config.capacity ?? 10;
      db.prepare('INSERT INTO inventory VALUES (1, ?, ?, 0, 0, ?)')
        .run(capacity, capacity, config['ttl-ms'] ?? 1200);
    } else {
      if (config.capacity !== undefined && config.capacity !== existing.capacity) {
        throw new Error(`数据目录容量已固定为 ${existing.capacity}，不能改为 ${config.capacity}`);
      }
      if (config['ttl-ms'] !== undefined) {
        db.prepare('UPDATE inventory SET ttl_ms = ? WHERE id = 1').run(config['ttl-ms']);
      }
    }
  });

  const getOrder = db.prepare(`SELECT id, status, quantity, expires_at AS expiresAt,
    created_at AS createdAt, updated_at AS updatedAt FROM orders WHERE id = ?`);
  const getInventory = db.prepare('SELECT capacity, available, reserved, sold FROM inventory WHERE id = 1');
  function expire(now) {
    const { quantity } = db.prepare(`SELECT COALESCE(SUM(quantity), 0) AS quantity
      FROM orders WHERE status = 'reserved' AND expires_at <= ?`).get(now);
    if (quantity > 0) {
      db.prepare('UPDATE inventory SET available = available + ?, reserved = reserved - ? WHERE id = 1')
        .run(quantity, quantity);
      db.prepare("UPDATE orders SET status = 'expired', updated_at = ? WHERE status = 'reserved' AND expires_at <= ?")
        .run(now, now);
    }
  }
  transaction(() => expire(Date.now()));

  // Canonical JSON makes object key order irrelevant, but retains every payload field.
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value !== null && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    }
    return JSON.stringify(value);
  }
  const reply = (code, body) => ({ code, body: JSON.stringify(body) });
  const failure = (code, message) => reply(code, { error: message });

  function mutate(pathname, match, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        typeof body.requestId !== 'string' || !body.requestId.trim() || body.requestId.length > 256) {
      return failure(422, 'requestId 必须是 1–256 字符的非空字符串');
    }
    const payload = canonical(body);
    return transaction(() => {
      const now = Date.now();
      expire(now);
      const previous = db.prepare('SELECT * FROM requests WHERE request_id = ?').get(body.requestId);
      if (previous) {
        if (previous.pathname !== pathname || previous.payload !== payload) {
          return failure(409, 'requestId 已用于不同路径或载荷');
        }
        return { code: previous.status_code, body: previous.response };
      }
      let result;
      if (!match) {
        const quantity = body.quantity;
        if (!Number.isSafeInteger(quantity) || quantity <= 0) {
          result = failure(422, 'quantity 必须是安全范围内的正整数');
        } else {
          const updated = db.prepare(`UPDATE inventory SET available = available - ?, reserved = reserved + ?
            WHERE id = 1 AND available >= ?`).run(quantity, quantity, quantity);
          if (updated.changes === 0) result = failure(409, '可用库存不足');
          else {
            const id = randomUUID();
            const { ttl_ms } = db.prepare('SELECT ttl_ms FROM inventory WHERE id = 1').get();
            db.prepare("INSERT INTO orders VALUES (?, 'reserved', ?, ?, ?, ?)")
              .run(id, quantity, now + ttl_ms, now, now);
            result = reply(201, getOrder.get(id));
          }
        }
      } else {
        const [, id, action] = match;
        const order = getOrder.get(id);
        const destination = action === 'pay' ? 'paid' : 'cancelled';
        if (!order) result = failure(404, '订单不存在');
        else if (order.status === destination) result = reply(200, order);
        else if (order.status !== 'reserved') result = failure(409, `订单状态为 ${order.status}，不能${action === 'pay' ? '支付' : '取消'}`);
        else {
          const column = action === 'pay' ? 'sold' : 'available';
          db.prepare(`UPDATE inventory SET reserved = reserved - ?, ${column} = ${column} + ? WHERE id = 1`)
            .run(order.quantity, order.quantity);
          db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(destination, now, id);
          result = reply(200, getOrder.get(id));
        }
      }
      // Store the original response (including failures) before acknowledging it.
      db.prepare('INSERT INTO requests VALUES (?, ?, ?, ?, ?)')
        .run(body.requestId, pathname, payload, result.code, result.body);
      return result;
    });
  }

  const assets = new Map([
    ['/', ['text/html; charset=utf-8', readFileSync(path.join(__dirname, 'index.html'))]],
    ['/app.js', ['text/javascript; charset=utf-8', readFileSync(path.join(__dirname, 'app.js'))]],
    ['/style.css', ['text/css; charset=utf-8', readFileSync(path.join(__dirname, 'style.css'))]],
  ]);
  async function readBody(req) {
    let length = 0;
    const chunks = [];
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 16384) {
        const error = new Error('请求体不能超过 16 KiB');
        error.status = 413;
        throw error;
      }
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { const error = new Error('请求体必须是有效 JSON'); error.status = 400; throw error; }
  }
  const server = http.createServer(async (req, res) => {
    function send(result, type = 'application/json; charset=utf-8') {
      res.writeHead(result.code, {
        'Content-Type': type, 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'",
      });
      res.end(result.body);
    }
    try {
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
      if (req.method === 'GET' && pathname === '/health') return send(reply(200, { ok: true }));
      if (req.method === 'GET' && assets.has(pathname)) {
        const [type, body] = assets.get(pathname);
        return send({ code: 200, body }, type);
      }
      const orderMatch = /^\/api\/orders\/([A-Za-z0-9-]+)$/.exec(pathname);
      if (req.method === 'GET' && (pathname === '/api/inventory' || pathname === '/api/orders' || orderMatch)) {
        const result = transaction(() => {
          expire(Date.now());
          if (pathname === '/api/inventory') return reply(200, getInventory.get());
          if (pathname === '/api/orders') return reply(200, { orders: db.prepare(`SELECT id, status, quantity,
            expires_at AS expiresAt, created_at AS createdAt, updated_at AS updatedAt
            FROM orders ORDER BY created_at DESC, id`).all() });
          const order = getOrder.get(orderMatch[1]);
          return order ? reply(200, order) : failure(404, '订单不存在');
        });
        return send(result);
      }
      const actionMatch = /^\/api\/orders\/([A-Za-z0-9-]+)\/(pay|cancel)$/.exec(pathname);
      if (req.method === 'POST' && (pathname === '/api/orders' || actionMatch)) {
        const body = await readBody(req);
        return send(mutate(pathname, actionMatch, body));
      }
      send(failure(404, '接口不存在或请求方法不支持'));
    } catch (error) {
      if (!error.status) console.error(error);
      if (!res.headersSent) send(failure(error.status ?? 500, error.status ? error.message : '服务器内部错误'));
    }
  });
  server.requestTimeout = 10000;
  const timer = setInterval(() => {
    try { transaction(() => expire(Date.now())); }
    catch (error) { console.error('到期处理失败：', error); }
  }, 100);
  timer.unref();
  server.on('error', error => { console.error(error.message); clearInterval(timer); db.close(); process.exitCode = 1; });
  server.listen(config.port, '127.0.0.1', () => {
    console.log(`库存事务台：http://127.0.0.1:${config.port}  数据：${config.data}`);
  });
  let closing = false;
  function shutdown() {
    if (closing) return;
    closing = true;
    clearInterval(timer);
    server.close(() => { db.close(); });
    server.closeIdleConnections();
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

try { main(); }
catch (error) { console.error(error.message); process.exitCode = 1; }
