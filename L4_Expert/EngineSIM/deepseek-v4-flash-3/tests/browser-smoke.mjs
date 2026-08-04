// ============================================================================
// tests/browser-smoke.mjs — 无头 Chrome 冒烟测试
// 验证：8080 根路径→sim.html、自动启动不报错、HUD 出现、无 Audio unavailable
// 运行：node tests/browser-smoke.mjs
// ============================================================================
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = dirname(fileURLToPath(import.meta.url)) + '/..'
const PORT = 8091
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  // 0) 先构建生产产物（保证浏览器端裸导入被打包，避免 ESM 导入失败）
  const build = spawn(process.execPath, [
    'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js', 'run', 'build'
  ], { stdio: ['ignore', 'pipe', 'pipe'], cwd: ROOT })
  await new Promise((resolve, reject) => {
    build.on('close', code => code === 0 ? resolve() : reject(new Error(`build failed: ${code}`)))
    build.on('error', reject)
  })

  // 1) 启动静态服务器
  const server = spawn(process.execPath, [join(ROOT, 'scripts/serve.mjs'), String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe']
  })
  await wait(1200)

  // 2) 无头 Chrome 加载（启动冒烟）
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--autoplay-policy=no-user-gesture-required',
    '--virtual-time-budget=10000',
    '--dump-dom',
    `http://localhost:${PORT}/sim.html?autostart=1`
  ]
  const chrome = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  chrome.stdout.on('data', d => { out += d })
  chrome.stderr.on('data', d => { out += d })

  const timeout = setTimeout(() => { console.error('SMOKE TIMEOUT'); chrome.kill(); server.kill(); process.exit(1) }, 60000)
  chrome.on('close', async () => {
    clearTimeout(timeout)
    server.kill()

    const checks = {
      '页面加载（无 fatal 错误）': !/Uncaught|boot failed|启动失败/.test(out) || null,
      'HUD 已挂载（hud-rpm 存在）': out.includes('hud-rpm'),
      '开始按钮已隐藏（overlay 关闭）': !out.includes('start-btn') || out.includes('display: none'),
      '无 Audio 错误': !/Audio unavailable|AudioContext.*error/i.test(out),
      '渲染器初始化（webgl canvas）': out.includes('canvas')
    }
    let ok = true
    for (const [name, pass] of Object.entries(checks)) {
      const p = pass === null ? false : pass
      console.log(`${p ? '✔' : '✖'} ${name}`)
      if (!p) ok = false
    }
    if (!ok) {
      console.error('--- 页面输出片段 ---')
      console.error(out.slice(-3000))
      process.exit(1)
    }

    // 3) 自动驾驶回路验证：CDP 等待真实时间，读取 HUD 车速应 > 5 km/h
    const server2 = spawn(process.execPath, [join(ROOT, 'scripts/serve.mjs'), String(PORT)], { stdio: 'ignore' })
    await wait(1200)
    const CDP_PORT = 9333
    const drive = spawn(CHROME, [
      '--headless=new', '--disable-gpu', '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      `--remote-debugging-port=${CDP_PORT}`,
      `http://localhost:${PORT}/sim.html?autostart=1&autodrive=1`
    ], { stdio: 'ignore' })

    // 等目标出现
    let target = null
    for (let i = 0; i < 40 && !target; i++) {
      await wait(500)
      try {
        const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()
        target = list.find(t => t.url.includes('sim.html'))
      } catch { /* chrome 未就绪 */ }
    }
    if (!target) { console.error('CDP 目标未出现'); drive.kill(); server2.kill(); process.exit(1) }

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

    // 等真实时间驱动车辆（6 秒自动驾驶）
    await wait(6000)
    const res = await send('Runtime.evaluate', {
      expression: `(() => {
        const speed = document.getElementById('hud-speed')?.textContent ?? '?'
        const rpm = document.getElementById('hud-rpm')?.textContent ?? '?'
        const gear = document.getElementById('hud-gear')?.textContent ?? '?'
        const title = document.title
        return JSON.stringify({ speed, rpm, gear, title })
      })()`,
      returnByValue: true
    })
    const data = JSON.parse(res.result?.result?.value ?? '{}')
    const speed = Number(data.speed)
    const drove = Number.isFinite(speed) && speed > 5
    console.log(`✔/✖ 自动驾驶回路：${drove ? '✔' : '✖'} HUD 车速=${data.speed} km/h 挡位=${data.gear} 转速=${data.rpm} (>5)`)
    console.log('   ', data.title)
    ws.close(); drive.kill(); server2.kill()
    if (!drove) process.exit(1)
    console.log('SMOKE PASS')
    process.exit(0)
  })
}

main().catch(e => { console.error(e); process.exit(1) })
