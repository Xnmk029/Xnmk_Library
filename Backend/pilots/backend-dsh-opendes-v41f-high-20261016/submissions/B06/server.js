#!/usr/bin/env node
'use strict';

/**
 * Resilient upstream relay: fixed-window rate limiting + circuit breaker.
 *
 * Node.js 24 native modules only, no third-party dependencies.
 *
 *   node server.js --port <port> --data <dir> --upstream <http://host:port>
 *                  [--limit 3] [--window-ms 1000] [--timeout-ms 150]
 *                  [--failure-threshold 2] [--open-ms 500]
 *
 * Routes:
 *   GET /health      -> {"ok":true}
 *   GET /            -> operator web UI
 *   GET /api/stats   -> {state,requests,upstreamCalls,rateRejected,circuitRejected}
 *   GET /api/events  -> {"events":[...]} recent relay outcomes (in memory)
 *   GET /relay?path= -> relays the real bytes/status from the fixed upstream
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const APP_DIR = typeof __dirname === 'string' && __dirname ? __dirname : process.cwd();
const INDEX_FILE = path.join(APP_DIR, 'index.html');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULTS = {
  port: null,
  data: null,
  upstream: null,
  limit: 3,
  windowMs: 1000,
  timeoutMs: 150,
  failureThreshold: 2,
  openMs: 500,
};

const USAGE = [
  'Usage: node server.js --port <port> --data <dir> --upstream <http://host:port>',
  '                       [--limit N] [--window-ms MS] [--timeout-ms MS]',
  '                       [--failure-threshold N] [--open-ms MS]',
].join('\n');

class ConfigError extends Error {}

function parseArgs(argv) {
  const cfg = { ...DEFAULTS };
  const str = new Set(['data', 'upstream', 'port']);
  const num = new Set(['limit', 'window-ms', 'timeout-ms', 'failure-threshold', 'open-ms']);
  const keyToProp = {
    port: 'port',
    data: 'data',
    upstream: 'upstream',
    limit: 'limit',
    'window-ms': 'windowMs',
    'timeout-ms': 'timeoutMs',
    'failure-threshold': 'failureThreshold',
    'open-ms': 'openMs',
  };

  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (raw === '--help' || raw === '-h') {
      process.stdout.write(USAGE + '\n');
      process.exit(0);
    }
    if (!raw.startsWith('--')) throw new ConfigError(`unexpected argument: ${raw}`);

    let name;
    let value;
    const eq = raw.indexOf('=');
    if (eq !== -1) {
      name = raw.slice(2, eq);
      value = raw.slice(eq + 1);
    } else {
      name = raw.slice(2);
      if (i + 1 >= argv.length) throw new ConfigError(`missing value for --${name}`);
      value = argv[++i];
    }

    if (str.has(name)) {
      cfg[keyToProp[name]] = value;
    } else if (num.has(name)) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        throw new ConfigError(`--${name} expects a non-negative integer, got "${value}"`);
      }
      cfg[keyToProp[name]] = n;
    } else {
      throw new ConfigError(`unknown option: --${name}`);
    }
  }

  if (cfg.port === null) throw new ConfigError('--port is required');
  const port = Number(cfg.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new ConfigError(`--port must be an integer in 0..65535, got "${cfg.port}"`);
  }
  cfg.port = port;
  if (!cfg.data) throw new ConfigError('--data is required');

  if (!cfg.upstream) throw new ConfigError('--upstream is required');
  let upstreamUrl;
  try {
    upstreamUrl = new URL(cfg.upstream);
  } catch {
    throw new ConfigError(`--upstream is not a valid URL: "${cfg.upstream}"`);
  }
  if (upstreamUrl.protocol !== 'http:' && upstreamUrl.protocol !== 'https:') {
    throw new ConfigError('--upstream must be an http:// or https:// URL');
  }
  cfg.upstreamUrl = upstreamUrl;
  // Fixed origin: scheme + host + port. The caller cannot change the host,
  // and the protocol is pinned by configuration.
  cfg.upstreamOrigin = upstreamUrl.origin;

  if (cfg.limit < 1) throw new ConfigError('--limit must be >= 1');
  if (cfg.windowMs < 1) throw new ConfigError('--window-ms must be >= 1');
  if (cfg.timeoutMs < 1) throw new ConfigError('--timeout-ms must be >= 1');
  if (cfg.failureThreshold < 1) throw new ConfigError('--failure-threshold must be >= 1');
  if (cfg.openMs < 1) throw new ConfigError('--open-ms must be >= 1');

  return cfg;
}

// ---------------------------------------------------------------------------
// State (all counts/state are in memory; a restart resets everything)
// ---------------------------------------------------------------------------

const config = {}; // filled in main()
let indexHtml = null;
const startedAt = new Date().toISOString();

const counters = {
  requests: 0,
  upstreamCalls: 0,
  rateRejected: 0,
  circuitRejected: 0,
};

const limiter = {
  windowStart: null,
  admitted: 0,
};

const breaker = {
  state: 'CLOSED', // CLOSED | OPEN | HALF_OPEN
  consecutiveFailures: 0,
  openUntil: 0,
  probeInFlight: false,
};

const EVENT_LIMIT = 100;
const events = []; // newest first, in memory only

function logEvent(entry) {
  events.unshift(entry);
  if (events.length > EVENT_LIMIT) events.length = EVENT_LIMIT;
}

// ---------------------------------------------------------------------------
// Fixed-window limiter
// ---------------------------------------------------------------------------

/** @returns {boolean} true when the request is admitted. */
function limitAdmit(now) {
  if (limiter.windowStart === null) limiter.windowStart = now;
  if (now - limiter.windowStart >= config.windowMs) {
    limiter.windowStart = now;
    limiter.admitted = 0;
  }
  if (limiter.admitted >= config.limit) return false;
  limiter.admitted += 1;
  return true;
}

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

/**
 * The current state, promoting OPEN -> HALF_OPEN once the open window has
 * elapsed. The transition is time based, so even a request that only observes
 * the state (GET /api/stats) sees HALF_OPEN as soon as open-ms has passed.
 */
function effectiveState(now = Date.now()) {
  if (breaker.state === 'OPEN' && now >= breaker.openUntil) {
    // A half-open circuit admits exactly one probe; the slot is free again.
    breaker.state = 'HALF_OPEN';
    breaker.probeInFlight = false;
  }
  return breaker.state;
}

/**
 * Gate a request through the breaker. Returns true when the request must be
 * rejected with 503 (open, or a probe is already in flight).
 */
function breakerGate(now) {
  if (effectiveState(now) === 'OPEN') return true;
  if (breaker.state === 'HALF_OPEN') {
    if (breaker.probeInFlight) return true;
    breaker.probeInFlight = true;
    return false;
  }
  return false;
}

function breakerSuccess() {
  breaker.state = 'CLOSED';
  breaker.consecutiveFailures = 0;
  breaker.openUntil = 0;
  breaker.probeInFlight = false;
}

function breakerFailure(now) {
  breaker.consecutiveFailures += 1;
  breaker.probeInFlight = false;
  if (breaker.state === 'HALF_OPEN' || breaker.consecutiveFailures >= config.failureThreshold) {
    breaker.state = 'OPEN';
    breaker.openUntil = now + config.openMs;
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function sendJson(res, status, payload) {
  if (res.writableEnded || res.destroyed) return;
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendHtml(res, status, html) {
  if (res.writableEnded || res.destroyed) return;
  const body = Buffer.from(html, 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendText(res, status, text) {
  if (res.writableEnded || res.destroyed) return;
  const body = Buffer.from(text, 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

// ---------------------------------------------------------------------------
// /relay
// ---------------------------------------------------------------------------

const ABSOLUTE_URL_RE = /^[a-zA-Z][a-zA-Z0-9+.\-]*:/;

/**
 * Validate and normalise the caller supplied path.
 * Rejects absolute URLs, protocol-relative/network-path references,
 * backslashes, control characters and dot segments that could escape the
 * fixed upstream root. Returns {raw, pathname} or null when invalid.
 */
function validatePath(input) {
  if (typeof input !== 'string' || input.length === 0) return null;
  if (input.length > 8192) return null;
  if (input[0] !== '/') return null; // must start with "/"
  if (ABSOLUTE_URL_RE.test(input)) return null; // http:, https:, file:, ...
  if (input.startsWith('//')) return null; // //host/path (protocol relative)
  if (input.startsWith('/\\')) return null;
  if (input.includes('\\')) return null; // backslash may be normalised to "/"
  if (input.includes('#')) return null;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return null; // control chars
  }

  let parsed;
  try {
    parsed = new URL(input, config.upstreamOrigin);
  } catch {
    return null;
  }
  if (parsed.origin !== config.upstreamOrigin) return null; // host/scheme swap
  const pathname = parsed.pathname;
  if (!pathname.startsWith('/')) return null;
  if (pathname.startsWith('//')) return null;
  return { raw: input, pathname };
}

function handleRelay(req, res, url) {
  counters.requests += 1;
  const now = Date.now();
  const rawInput = url.searchParams.get('path');

  // --- syntactic validation: the target host can never be changed ---------
  const target = validatePath(rawInput);
  if (!target) {
    logEvent({ ts: now, path: rawInput === null ? '' : rawInput, status: 400, outcome: 'invalid_path' });
    sendJson(res, 400, { error: 'invalid path: must be a path starting with "/" on the fixed upstream (absolute URLs, //host and protocol changes are rejected)' });
    return;
  }

  // --- 1. fixed window rate limit -----------------------------------------
  if (!limitAdmit(now)) {
    counters.rateRejected += 1;
    logEvent({ ts: now, path: target.pathname, status: 429, outcome: 'rate_limited' });
    sendJson(res, 429, { error: `rate limit exceeded: at most ${config.limit} relay requests per ${config.windowMs}ms` });
    return;
  }

  // --- 2. circuit breaker --------------------------------------------------
  if (breakerGate(now)) {
    counters.circuitRejected += 1;
    logEvent({
      ts: now,
      path: target.pathname,
      status: 503,
      outcome: breaker.state === 'OPEN' ? 'circuit_open' : 'circuit_half_open',
    });
    sendJson(res, 503, {
      error: breaker.state === 'OPEN'
        ? `circuit is OPEN until ${new Date(breaker.openUntil).toISOString()}`
        : 'circuit is HALF_OPEN: a probe is already in flight',
    });
    return;
  }

  proxyToUpstream(req, res, target);
}

async function proxyToUpstream(req, res, target) {
  const controller = new AbortController();
  let timedOut = false;
  let clientGone = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);

  const onClose = () => {
    if (res.writableEnded) return;
    clientGone = true;
    controller.abort();
  };
  res.on('close', onClose);

  counters.upstreamCalls += 1;

  try {
    let upstreamRes;
    let body;
    try {
      upstreamRes = await fetch(config.upstreamOrigin + target.raw, {
        method: 'GET',
        headers: {
          accept: typeof req.headers.accept === 'string' ? req.headers.accept : '*/*',
          'user-agent': 'resilient-gateway/1.0',
        },
        redirect: 'manual',
        signal: controller.signal,
      });
      body = Buffer.from(await upstreamRes.arrayBuffer());
    } catch (err) {
      const settledAt = Date.now();
      if (clientGone) {
        // The caller went away; that is not an upstream fault, so the breaker
        // counter is left untouched (a half-open probe slot is still released,
        // otherwise the circuit could get stuck in HALF_OPEN forever).
        if (breaker.state === 'HALF_OPEN') breaker.probeInFlight = false;
        logEvent({ ts: settledAt, path: target.pathname, status: 0, outcome: 'client_aborted' });
        return; // nobody is listening anymore
      }
      const kind = timedOut ? 'timeout' : 'network';
      breakerFailure(settledAt);
      if (timedOut) {
        logEvent({ ts: settledAt, path: target.pathname, status: 504, outcome: 'timeout' });
        sendJson(res, 504, { error: `upstream timeout after ${config.timeoutMs}ms` });
        return;
      }
      logEvent({ ts: settledAt, path: target.pathname, status: 502, outcome: 'network_error', error: String(err && err.message) });
      sendJson(res, 502, { error: `upstream request failed (${kind}): ${err && err.message ? err.message : 'unknown error'}` });
      return;
    }

    const settledAt = Date.now();
    const status = upstreamRes.status;

    if (status >= 500) {
      breakerFailure(settledAt); // HTTP 5xx counts as a failure
    } else if (status >= 200 && status < 400) {
      breakerSuccess(); // 2xx/3xx resets the consecutive failure count
    } else if (breaker.state === 'HALF_OPEN') {
      // A 4xx is not a success and not a failure: keep the circuit HALF_OPEN
      // but release the probe slot so later requests may probe again.
      breaker.probeInFlight = false;
    } // 4xx (and 1xx) otherwise leave the state alone

    // Pass through the upstream status and raw bytes, untouched.
    if (!res.writableEnded && !res.destroyed) {
      res.statusCode = status;
      const contentType = upstreamRes.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      // The decoded body length can differ from the upstream header (e.g. when
      // the upstream used chunked encoding), so always send the real length.
      res.setHeader('Content-Length', String(body.length));
      const location = upstreamRes.headers.get('location');
      if (location) res.setHeader('Location', location);
      res.setHeader('X-Upstream-Status', String(status));
      res.setHeader('X-Circuit-State', breaker.state);
      res.setHeader('Cache-Control', 'no-store');
      res.end(body);
    }

    logEvent({ ts: settledAt, path: target.pathname, status, outcome: status >= 500 ? 'upstream_5xx' : status >= 400 ? 'upstream_4xx' : 'success' });
  } finally {
    clearTimeout(timer);
    res.removeListener('close', onClose);
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function handleRequest(req, res) {
  let url;
  try {
    url = new URL(req.url, 'http://127.0.0.1');
  } catch {
    sendJson(res, 400, { error: 'malformed request URL' });
    return;
  }

  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    sendJson(res, 405, { error: `method ${method} not allowed; this service only proxies GET` });
    return;
  }

  const route = url.pathname;

  if (route === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (route === '/' || route === '/index.html') {
    sendHtml(res, 200, indexHtml);
    return;
  }

  if (route === '/api/stats') {
    sendJson(res, 200, {
      state: effectiveState(),
      requests: counters.requests,
      upstreamCalls: counters.upstreamCalls,
      rateRejected: counters.rateRejected,
      circuitRejected: counters.circuitRejected,
    });
    return;
  }

  if (route === '/api/events') {
    sendJson(res, 200, {
      state: effectiveState(),
      events: events.slice(0, 50),
    });
    return;
  }

  if (route === '/api/config') {
    sendJson(res, 200, {
      listen: '127.0.0.1',
      upstream: config.upstreamOrigin,
      limit: config.limit,
      windowMs: config.windowMs,
      timeoutMs: config.timeoutMs,
      failureThreshold: config.failureThreshold,
      openMs: config.openMs,
      dataDir: path.resolve(config.data),
      startedAt: startedAt,
      note: 'counters and circuit state live in memory only and reset on restart',
    });
    return;
  }

  if (route === '/relay') {
    handleRelay(req, res, url);
    return;
  }

  if (route === '/favicon.ico') {
    sendJson(res, 404, { error: 'not found' });
    return;
  }

  sendJson(res, 404, { error: `not found: ${route}` });
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main() {
  let cfg;
  try {
    cfg = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n${USAGE}\n`);
    process.exit(2);
  }

  Object.assign(config, cfg);

  // Data directory: create when missing, reuse when present. Request counters
  // and breaker state deliberately live only in memory (restart resets them).
  const dataDir = path.resolve(config.data);
  try {
    await fs.promises.mkdir(dataDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(dataDir, 'instance.json'),
      JSON.stringify(
        {
          service: 'resilient-relay-gateway',
          startedAt: new Date().toISOString(),
          pid: process.pid,
          listen: '127.0.0.1',
          upstream: config.upstreamOrigin,
          limit: config.limit,
          windowMs: config.windowMs,
          timeoutMs: config.timeoutMs,
          failureThreshold: config.failureThreshold,
          openMs: config.openMs,
          note: 'Request counters and circuit state are in memory only and reset on every restart.',
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
  } catch (err) {
    process.stderr.write(`error: cannot prepare data directory ${dataDir}: ${err.message}\n`);
    process.exit(1);
  }

  try {
    indexHtml = await fs.promises.readFile(INDEX_FILE, 'utf8');
  } catch {
    indexHtml = '<!doctype html><meta charset="utf-8"><title>relay</title><h1>UI file missing</h1><p>index.html was not found next to server.js. The JSON API is still available.</p>';
  }

  const server = http.createServer((req, res) => {
    try {
      handleRequest(req, res);
    } catch (err) {
      sendJson(res, 500, { error: `internal error: ${err && err.message ? err.message : 'unknown'}` });
    }
  });

  server.on('clientError', (err, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  });

  server.on('error', (err) => {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(1);
  });

  server.listen(config.port, '127.0.0.1', () => {
    const addr = server.address();
    process.stdout.write(
      `resilient-relay-gateway listening on http://127.0.0.1:${addr.port} ` +
        `(upstream=${config.upstreamOrigin} data=${dataDir} limit=${config.limit}/${config.windowMs}ms ` +
        `timeout=${config.timeoutMs}ms failureThreshold=${config.failureThreshold} open=${config.openMs}ms)\n`
    );
  });

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 200).unref();
    });
  }
}

main();
