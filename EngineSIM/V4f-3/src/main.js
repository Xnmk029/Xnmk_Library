// ============================================================================
// main.js — 启动流程：资源加载 → 用户点击（解锁音频）→ 驾驶场景
// 清单 #4/#5/#7 验收：不卡标题、加载失败有明确提示、点击即可发声
// ============================================================================
import { Simulation } from './core/simulation.js'

const overlay = document.getElementById('overlay')
const startBtn = document.getElementById('start-btn')
const msgEl = document.getElementById('overlay-msg')
const errEl = document.getElementById('overlay-err')

function showError(msg) {
  errEl.style.display = 'block'
  errEl.textContent = `⚠ 启动失败：${msg}\n请刷新页面重试。`
  msgEl.textContent = '启动失败，见下方错误信息'
  startBtn.disabled = true
}

let sim = null

startBtn.addEventListener('click', async () => {
  if (sim) { // 已启动：直接进入
    overlay.style.display = 'none'
    return
  }
  startBtn.disabled = true
  msgEl.textContent = '正在加载场景资源…'

  try {
    // 1) 音频上下文必须在用户手势内创建/恢复（清单 #7：Audio unavailable 根因）
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) throw new Error('当前浏览器不支持 Web Audio API')
    const audioCtx = new AudioCtx()
    if (audioCtx.state === 'suspended') await audioCtx.resume()

    // 2) 创建模拟器（音频图 + 场景 + 物理）
    sim = new Simulation(audioCtx, { onError: showError })

    // 3) 异步加载车辆模型（动态导入/资源失败均有捕获）
    msgEl.textContent = '正在加载车辆模型…'
    await sim.loadCar()

    // 4) 开始
    msgEl.textContent = '就绪！'
    sim.reset()
    sim.start()
    overlay.style.display = 'none'
  } catch (e) {
    console.error('[EngineSIM] boot failed', e)
    showError(e?.message ?? String(e))
    startBtn.disabled = false
  }
})

// 快捷键：回车也可开始
window.addEventListener('keydown', e => {
  if (e.code === 'Enter' && overlay.style.display !== 'none') startBtn.click()
})

// 自动化验证入口：?autostart=1 自动开始（供无头浏览器冒烟测试）
if (new URLSearchParams(location.search).get('autostart') === '1') {
  startBtn.click()
}
