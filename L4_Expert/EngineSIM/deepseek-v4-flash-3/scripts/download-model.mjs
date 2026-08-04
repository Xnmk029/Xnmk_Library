// 下载 CC0 免费低模肌肉车模型（学习项目，来源记录于 public/models/SOURCES.md）
// 来源顺序: 1) poly.pizza 公共 API(CC0)  2) Kenney Car Kit(CC0)  3) 失败退出→回退程序化建模
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'public', 'models')
const GLB = join(OUT, 'muscle-car.glb')

async function fetchBuf(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (enginesim-v4f3 learning)', ...(opts.headers || {}) }, redirect: 'follow' })
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`)
  return Buffer.from(await r.arrayBuffer())
}

async function tryPolyPizza() {
  const queries = ['muscle car', 'musclecar', 'american muscle', 'classic car low poly']
  for (const q of queries) {
    try {
      const r = await fetch(`https://api.poly.pizza/v1.1/search/${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': 'enginesim-v4f3-learning' }
      })
      if (!r.ok) continue
      const data = await r.json()
      const results = data?.results || []
      // 优先 CC0，其次任何可下载模型
      const pick = results.find(m => m?.license?.toLowerCase().includes('cc0')) || results[0]
      if (!pick?.gltf?.url) continue
      const glb = await fetchBuf(pick.gltf.url)
      if (glb.length < 10_000) continue
      await writeFile(GLB, glb)
      return {
        source: `poly.pizza (${pick.name})`,
        author: pick.author || 'unknown',
        license: pick.license || 'unknown',
        url: pick.gltf.url,
        bytes: glb.length
      }
    } catch { /* try next query */ }
  }
  return null
}

async function tryKenney() {
  // Kenney Car Kit 页面，解析直链 zip（页面含版本化路径）
  try {
    const r = await fetch('https://kenney.nl/assets/car-kit', { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!r.ok) throw new Error(`page ${r.status}`)
    const html = await r.text()
    const m = html.match(/https:\/\/kenney\.nl\/media\/pages\/assets\/car-kit\/[^"']+\.zip/)
    if (!m) return null
    const zip = await fetchBuf(m[0])
    if (zip.length < 100_000) return null
    // 解压 zip 中所有 .gltf/.glb/.obj/.dae/.fbx，挑选车型
    const { inflateRawSync } = await import('node:zlib')
    const { crc32 } = await import('node:zlib').catch(() => ({ crc32: null }))
    // 简易 zip 解析（仅 deflate + stored）
    function* entries(buf) {
      let off = 0
      while (off + 46 <= buf.length) {
        if (buf.readUInt32LE(off) !== 0x04034b50) break
        const method = buf.readUInt16LE(off + 8)
        const csize = buf.readUInt32LE(off + 18)
        const usize = buf.readUInt32LE(off + 22)
        const nlen = buf.readUInt16LE(off + 26)
        const elen = buf.readUInt16LE(off + 28)
        const name = buf.toString('utf8', off + 30, off + 30 + nlen)
        const dataStart = off + 30 + nlen + elen
        let data = buf.subarray(dataStart, dataStart + csize)
        if (method === 8) data = inflateRawSync(data)
        yield { name, data }
        off = dataStart + csize
      }
    }
    const files = [...entries(zip)]
    const carExt = /\.(gltf|glb|obj|fbx|dae)$/i
    const carFiles = files.filter(f => carExt.test(f.name))
    if (!carFiles.length) return null
    // 排序：1) 格式优先级 gltf/glb > obj > fbx > dae；2) 车型偏好 muscle > coupe/sedan/sports
    const fmtRank = f => (/gltf/i.test(f.name) ? 3 : /\.glb$/i.test(f.name) ? 3 : /\.obj$/i.test(f.name) ? 2 : /\.fbx$/i.test(f.name) ? 1 : 0)
    const nameRank = f => (/muscle/i.test(f.name) ? 10 : /coupe|sedan/i.test(f.name) ? 5 : /sports|super/i.test(f.name) ? 3 : 0)
    const best = carFiles.slice().sort((a, b) => (nameRank(b) * 4 + fmtRank(b)) - (nameRank(a) * 4 + fmtRank(a)))[0]
    const ext = best.name.match(/\.(gltf|glb|obj|fbx|dae)$/i)[1].toLowerCase()
    const outFile = ext === 'glb' ? GLB : join(OUT, `muscle-car.${ext}`)
    await writeFile(outFile, best.data)
    return {
      source: `Kenney Car Kit (${best.name})`,
      author: 'Kenney',
      license: 'CC0',
      url: m[0],
      bytes: best.data.length,
      file: outFile
    }
  } catch { return null }
}

await mkdir(OUT, { recursive: true })

let info = await tryPolyPizza()
if (!info) info = await tryKenney()

if (info) {
  await writeFile(join(OUT, 'SOURCES.md'),
    `# 模型来源\n\n- 文件: ${info.file.split(/[\\/]/).pop()}\n- 来源: ${info.source}\n- 作者: ${info.author}\n- 许可: ${info.license}\n- 下载地址: ${info.url}\n- 大小: ${(info.bytes / 1024).toFixed(1)} KB\n- 用途: 驾驶模拟学习项目，仅作内部学习使用\n`)
  console.log(`[download-model] OK: ${info.source} -> ${info.file} (${info.bytes} bytes, ${info.license})`)
} else {
  console.error('[download-model] FAILED: 所有下载源均失败，将回退程序化建模')
  process.exit(2)
}
