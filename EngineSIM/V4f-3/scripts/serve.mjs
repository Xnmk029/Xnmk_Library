// 极简静态服务器：端口 8080 直达驾驶场景
// 模式：若存在 dist/（生产构建产物）则服务 dist；否则服务源码树（/models/* 映射到 public/models/）
// 用法: node scripts/serve.mjs [port]
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(SRC, 'dist')
const PORT = Number(process.argv[2] || process.env.PORT || 8080)

let ROOT = SRC
let hasDist = false
try { hasDist = (await stat(DIST)).isDirectory() } catch { /* 无构建产物 */ }
if (hasDist) ROOT = DIST

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.hdr': 'image/vnd.radiance', '.exr': 'image/x-exr',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wasm': 'application/wasm', '.map': 'application/json'
}

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    // 根路径直接返回 sim.html（驾驶场景），不经过重定向页
    if (urlPath === '/' || urlPath === '') { urlPath = '/sim.html' }
    // 源码模式下 /models/* → public/models/*
    if (!hasDist && urlPath.startsWith('/models/')) {
      urlPath = '/public' + urlPath
    }
    const filePath = normalize(join(ROOT, urlPath))
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return }
    const st = await stat(filePath).catch(() => null)
    if (!st || st.isDirectory()) { res.writeHead(404); res.end('not found'); return }
    const body = await readFile(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    })
    res.end(body)
  } catch (e) {
    res.writeHead(500); res.end(String(e))
  }
})

server.listen(PORT, () => {
  console.log(`[EngineSIM] 驾驶场景已就绪: http://localhost:${PORT}/  (→ sim.html, root=${ROOT})`)
})
