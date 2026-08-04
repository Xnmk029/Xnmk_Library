// tools/serve.mjs — 本地服务器：8080 → sim.html（驾驶场景）
// 用法：node tools/serve.mjs [port=8080]
// MIME：.html/.js/.mjs/.glb/.obj/.mtl/.png/.wav/.json/.css

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.obj': 'text/plain',
  '.mtl': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    // 根路径 → sim.html（驾驶场景；不是音频实验室）
    if (urlPath === '/' || urlPath === '/index.html') urlPath = '/sim.html';
    // 工作集模块路径也映射到 src（audio-lab 用）
    if (urlPath.startsWith('/src/')) { /* 保持原样 */ }
    const filePath = normalize(join(root, urlPath));
    if (!filePath.startsWith(root)) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    const data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 not found: ' + req.url);
  }
});

server.listen(port, () => {
  console.log(`EngineSIM server: http://localhost:${port}/  (sim.html 驾驶场景)`);
  console.log(`  audio-lab: http://localhost:${port}/audio-lab.html`);
});
