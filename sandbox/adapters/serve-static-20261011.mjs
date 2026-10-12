/**
 * Static review server for the Sokoban deliverable (orchestrator-side tool).
 *
 * Serves the tested workdir read-only so a human can open the app in a browser.
 * ES modules and the .hdr fetch require a real http origin, so file:// will not
 * work. The workdir is never modified; this file lives outside it.
 *
 * Usage: node serve-static-20261011.mjs <root> <port>
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const port = Number(process.argv[3] ?? 8137);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.hdr': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.svg': 'image/svg+xml',
  '.ktx2': 'image/ktx2',
};

http
  .createServer((req, res) => {
    let rel;
    try {
      rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end('bad request');
      return;
    }
    if (rel === '/') rel = '/index.html';

    const file = path.resolve(root, `.${rel}`);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
        return;
      }
      res.writeHead(200, {
        'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(data);
    });
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`SERVE_URL=http://127.0.0.1:${port}/index.html`);
    console.log(`SERVE_ROOT=${root}`);
  });
