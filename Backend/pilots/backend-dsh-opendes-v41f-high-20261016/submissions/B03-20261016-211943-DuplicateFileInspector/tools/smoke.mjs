// Read-only smoke check against a running server; safe to keep in the repo.
// Usage: node tools/smoke.mjs <base-url>   (default http://127.0.0.1:8080)
const BASE = process.argv[2] || 'http://127.0.0.1:8080';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const health = await get('/health');
check('GET /health -> 200 {"ok":true}', health.status === 200 && health.body.ok === true);

const page = await fetch(`${BASE}/`);
const html = await page.text();
check('GET / serves the UI', page.status === 200 && html.includes('<title>'));

const scan = await get('/api/scan').catch(() => null);
check('GET /api/scan is rejected', scan === null || scan.status >= 400);

const post = await fetch(`${BASE}/api/scan`, { method: 'POST' });
const scanBody = await post.json();
check('POST /api/scan -> 200', post.status === 200 && Array.isArray(scanBody.groups));
check(
  'scan payload shape',
  typeof scanBody.scanned === 'number' && typeof scanBody.skipped === 'number',
  `scanned=${scanBody.scanned} skipped=${scanBody.skipped} groups=${scanBody.groups.length}`,
);

const sortedPaths = scanBody.groups.every((g) =>
  g.paths.every((p, i) => i === 0 || g.paths[i - 1] <= p),
);
check('each group paths sorted lexicographically', sortedPaths);
check(
  'groups sorted by first path',
  scanBody.groups.every((g, i) => i === 0 || scanBody.groups[i - 1].paths[0] <= g.paths[0]),
);
check(
  'every group has at least two paths and a 64-char sha256',
  scanBody.groups.every((g) => g.paths.length >= 2 && /^[0-9a-f]{64}$/.test(g.sha256)),
);

const result = await get('/api/result');
check('GET /api/result -> 200 after a scan', result.status === 200 && Array.isArray(result.body.groups));

const missing = await get(`/api/files?path=${encodeURIComponent('../secret.txt')}`);
check('path traversal is refused', missing.status === 400);

const bogus = await get('/api/does-not-exist');
check('unknown API path -> 404 with {"error"}', bogus.status === 404 && typeof bogus.body.error === 'string');

const failures = results.filter((r) => !r.ok);
console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
// Set the exit code instead of calling process.exit(), which can race with
// closing keep-alive sockets on Windows.
process.exitCode = failures.length === 0 ? 0 : 1;
