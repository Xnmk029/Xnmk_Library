// scripts/screenshot.mjs — CDP 截图（等真实时间渲染后截取，效果更真实）
// 用法: node scripts/screenshot.mjs [输出路径] [等待秒数]
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync, statSync, writeFileSync } from 'node:fs'

const ROOT = dirname(fileURLToPath(import.meta.url)) + '/..'
const OUT = process.argv[2] || 'docs/scene-shot.png'
const WAIT_S = Number(process.argv[3] || 6)
const PORT = 8091
const CDP_PORT = 9555
const PROFILE = join(ROOT, 'docs/chrome-profile')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const browser = existsSync(CHROME) ? CHROME : EDGE
const wait = ms => new Promise(r => setTimeout(r, ms))

import { mkdirSync } from 'node:fs'
mkdirSync(PROFILE, { recursive: true })

const server = spawn(process.execPath, [join(ROOT, 'scripts/serve.mjs'), String(PORT)], { stdio: 'ignore' })
await wait(1200)
const chrome = spawn(browser, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--autoplay-policy=no-user-gesture-required',
  `--user-data-dir=${PROFILE}`,
  '--window-size=1280,720', `--remote-debugging-port=${CDP_PORT}`,
  `http://localhost:${PORT}/sim.html?autostart=1&autodrive=1`
], { stdio: 'ignore' })

let target = null
for (let i = 0; i < 40 && !target; i++) {
  await wait(400)
  try {
    const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()
    target = list.find(t => t.url.includes('sim.html'))
  } catch { /* retry */ }
}
if (!target) { console.error('CDP target missing'); process.exit(1) }

const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let msgId = 0
const pending = new Map()
ws.onmessage = ev => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
}
const send = (method, params = {}) => new Promise(res => {
  const id = ++msgId
  pending.set(id, res)
  ws.send(JSON.stringify({ id, method, params }))
})

await wait(WAIT_S * 1000)
const shot = await send('Page.captureScreenshot', { format: 'png' })
const abs = join(ROOT, OUT)
writeFileSync(abs, Buffer.from(shot.result.data, 'base64'))
const speed = await send('Runtime.evaluate', {
  expression: `document.getElementById('hud-speed')?.textContent ?? '?'`, returnByValue: true
})
console.log(`screenshot saved: ${abs} (${statSync(abs).size}B) 车速=${speed.result?.result?.value} km/h`)
ws.close(); chrome.kill(); server.kill()
