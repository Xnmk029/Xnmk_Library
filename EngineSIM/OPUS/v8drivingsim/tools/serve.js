/**
 * Minimal static file server. No dependencies.
 *
 *   npm start            -> http://localhost:8080
 *   npm start -- 3000    -> a different port
 *
 * ES modules and AudioWorklet both need a real HTTP origin, so opening
 * index.html straight off the filesystem will not work. This exists so that
 * "clone, npm install, npm start" is the whole setup.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const initialPort = Number(process.argv[2]) || Number(process.env.PORT) || 8084;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

function startServer(port) {
  const server = http.createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end('Bad request');
      return;
    }
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = path.join(root, urlPath);
    // Never serve outside the project directory.
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end(`Not found: ${urlPath}`);
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Content-Length': st.size,
        'Cache-Control': 'no-cache',
        // Keeps AudioWorklet timing precise where the browser gates it behind
        // cross-origin isolation.
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is occupied, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error(err);
      process.exit(1);
    }
  });

  server.listen(port, () => {
    console.log(`serving ${root}`);
    console.log(`  simulator   http://localhost:${port}/`);
    console.log(`  audio lab   http://localhost:${port}/audio-lab.html`);
  });
}

startServer(initialPort);

