// VOXY CRAFT — 零依赖本地静态服务器（文件夹版离线即玩）
// 浏览器对 file:// 下的 ES 模块 / Worker 有 CORS 拦截，故通过 http://127.0.0.1 提供。
// 用法：node serve.js  （双击 启动.bat 会自动调用本文件）
// 注：项目 package.json 为 type:module，本文件使用 ESM 语法。

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('403'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404 ' + urlPath); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function listen(port) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && port < 8800) { listen(port + 1); }
    else { console.error('[VOXY] 服务器启动失败:', e.message); process.exit(1); }
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log('==============================================');
    console.log('  VOXY CRAFT 本地服务器已启动');
    console.log('  访问地址: ' + url);
    console.log('  按 Ctrl+C 停止');
    console.log('==============================================');
    openBrowser(url);
  });
}

listen(8765);
