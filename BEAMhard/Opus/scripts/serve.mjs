#!/usr/bin/env node
/**
 * Zero-dependency static file server for the CCF WebGL vehicle lab.
 * Usage:  node scripts/serve.mjs [port]
 * Serves the repository root with correct MIME types for .dae/.dds/.jbeam.
 */
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.argv[2] || process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jbeam': 'application/json; charset=utf-8',
  '.pc': 'application/json; charset=utf-8',
  '.dae': 'model/vnd.collada+xml',
  '.dds': 'image/vnd-ms.dds',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.ini': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filePath = join(ROOT, normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
    let st;
    try { st = statSync(filePath); } catch { res.writeHead(404); res.end('not found: ' + pathname); return; }
    if (st.isDirectory()) { res.writeHead(302, { Location: pathname + '/' }); res.end(); return; }
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    });
    createReadStream(filePath).pipe(res);
  } catch (err) {
    res.writeHead(500); res.end(String(err));
  }
});

server.listen(PORT, () => {
  console.log(`[serve] CCF Vehicle Lab at http://localhost:${PORT}/  (root: ${ROOT})`);
});
