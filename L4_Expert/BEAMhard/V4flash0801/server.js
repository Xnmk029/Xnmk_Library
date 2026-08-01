#!/usr/bin/env node
/**
 * server.js — zero-dependency static file server for BEAMGL
 * Usage: node server.js [port]   (default 8080)
 * Optionally auto-prepares vehicles_web/ assets on first run (requires Python + Pillow).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.dds': 'application/octet-stream',
  '.dae': 'application/xml; charset=utf-8',
  '.jbeam': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function prepareAssets() {
  if (fs.existsSync(path.join(ROOT, 'vehicles_web', 'manifest.json'))) return;
  console.log('vehicles_web/ not found — preparing assets (first run)…');
  try {
    execSync('node "' + path.join(ROOT, 'tools', 'prepare_assets.js') + '"', {
      cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
    });
  } catch (e) {
    console.error('Asset preparation failed. Requirements: Python 3 + Pillow (pip install pillow).');
    console.error('You can still run the app — the UI/loader will show an asset error.');
  }
}

prepareAssets();

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    fs.stat(filePath, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found: ' + urlPath);
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.js' || ext === '.html' ? 'no-cache' : 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (e) {
    res.writeHead(500); res.end('server error');
  }
});

server.listen(PORT, () => {
  console.log('=====================================================');
  console.log('  BEAMGL // CCF PROVING GROUND  —  WebGL Vehicle Sim');
  console.log('  http://localhost:' + PORT);
  console.log('=====================================================');
  console.log('  控件: W/S 油门/刹车  A/D 转向  SPACE 手刹  Q/E 换挡');
  console.log('        C 视角  F 自由相机  R 重置  1-6 场地  V 校验');
  console.log('        T 控制台  M 导出CSV  L 大灯  N 卡通渲染');
});
