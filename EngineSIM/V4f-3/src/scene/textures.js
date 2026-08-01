// ============================================================================
// textures.js — 程序化贴图（canvas 生成，零下载）
// 柏油路面 / 双色路肩 / 草地 / 发车格(棋盘) / 车漆 / 玻璃
// ============================================================================
import * as THREE from 'three'

function canvas2d(w, h) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return [c, c.getContext('2d')]
}

/** 柏油：深灰底 + 噪声斑 + 细裂缝 */
export function makeAsphaltTexture(size = 256) {
  const [c, g] = canvas2d(size, size)
  g.fillStyle = '#3a3d42'
  g.fillRect(0, 0, size, size)
  for (let i = 0; i < 900; i++) {
    const v = 40 + Math.random() * 40 | 0
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + Math.random() * 0.4})`
    const s = 1 + Math.random() * 3
    g.fillRect(Math.random() * size, Math.random() * size, s, s)
  }
  g.strokeStyle = 'rgba(20,20,22,0.5)'
  for (let i = 0; i < 5; i++) {
    g.beginPath()
    let x = Math.random() * size, y = 0
    g.moveTo(x, y)
    while (y < size) { x += (Math.random() - 0.5) * 30; y += 12 + Math.random() * 18; g.lineTo(x, y) }
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(24, 24)
  t.anisotropy = 4
  return t
}

/** 双色路肩（红/白交替），横向 1 格=一段 */
export function makeCurbTexture(segments = 12) {
  const [c, g] = canvas2d(segments * 32, 32)
  for (let i = 0; i < segments; i++) {
    g.fillStyle = i % 2 === 0 ? '#d8382e' : '#e8e8e8'
    g.fillRect(i * 32, 0, 32, 32)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(40, 1)
  return t
}

/** 草地：绿底 + 噪点 */
export function makeGrassTexture(size = 256) {
  const [c, g] = canvas2d(size, size)
  g.fillStyle = '#4a7c3a'
  g.fillRect(0, 0, size, size)
  for (let i = 0; i < 2000; i++) {
    const v = 60 + Math.random() * 60 | 0
    g.fillStyle = `rgba(${v * 0.5 | 0},${v},${v * 0.45 | 0},0.5)`
    g.fillRect(Math.random() * size, Math.random() * size, 2, 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(60, 60)
  return t
}

/** 发车格棋盘 */
export function makeCheckerTexture(n = 8) {
  const [c, g] = canvas2d(n * 16, n * 16)
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = (i + j) % 2 === 0 ? '#111' : '#eee'
    g.fillRect(i * 16, j * 16, 16, 16)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
