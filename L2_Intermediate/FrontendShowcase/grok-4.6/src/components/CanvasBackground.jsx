import { useEffect, useRef } from 'react'

const CURVE_COUNT = 250

function hexToRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function createField(w, h) {
  const curves = []
  for (let i = 0; i < CURVE_COUNT; i++) {
    const pts = []
    const x0 = Math.random() * w
    const y0 = Math.random() * h
    let x = x0
    let y = y0
    for (let j = 0; j < 4; j++) {
      const spread = 80 + Math.random() * 220
      x += (Math.random() - 0.48) * spread
      y += (Math.random() - 0.5) * spread * 0.85
      pts.push({
        ox: x,
        oy: y,
        x,
        y,
        vx: 0,
        vy: 0,
      })
    }
    curves.push({
      pts,
      phase: Math.random() * Math.PI * 2,
      speed: 0.25 + Math.random() * 0.9,
      width: 0.35 + Math.random() * 1.15,
      energy: 0.35 + Math.random() * 0.65,
    })
  }
  return curves
}

/**
 * Interactive HUD field: 250 glowing cubic Bézier filaments.
 * Mouse: radial repulsion. Wheel: wave amplitude. Career: color/alpha lerp.
 */
export default function CanvasBackground({ color = '#00f0ff', intensity = 0.7 }) {
  const canvasRef = useRef(null)
  const colorRef = useRef(color)
  const intensityRef = useRef(intensity)

  useEffect(() => {
    colorRef.current = color
  }, [color])

  useEffect(() => {
    intensityRef.current = intensity
  }, [intensity])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const mouse = { x: -9999, y: -9999, active: false }
    const rgb = { r: 0, g: 240, b: 255 }
    const targetRgb = hexToRgb(colorRef.current)
    rgb.r = targetRgb.r
    rgb.g = targetRgb.g
    rgb.b = targetRgb.b
    let alpha = 0.55
    let waveAmp = 18
    let waveTarget = 18
    let time = 0
    let curves = []
    let w = 0
    let h = 0
    let raf = 0
    let running = true

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      curves = createField(w, h)
    }

    const onMove = (e) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.active = true
    }

    const onLeave = () => {
      mouse.active = false
      mouse.x = -9999
      mouse.y = -9999
    }

    const onWheel = (e) => {
      waveTarget = Math.max(4, Math.min(92, waveTarget + e.deltaY * 0.045))
    }

    const tick = () => {
      if (!running) return
      time += 0.016
      const target = hexToRgb(colorRef.current)
      rgb.r = lerp(rgb.r, target.r, 0.045)
      rgb.g = lerp(rgb.g, target.g, 0.045)
      rgb.b = lerp(rgb.b, target.b, 0.045)
      const targetAlpha = 0.28 + intensityRef.current * 0.62
      alpha = lerp(alpha, targetAlpha, 0.05)
      waveTarget = lerp(waveTarget, 18, 0.018)
      waveAmp = lerp(waveAmp, waveTarget, 0.08)

      ctx.clearRect(0, 0, w, h)
      const glow = `rgba(${rgb.r | 0}, ${rgb.g | 0}, ${rgb.b | 0}, ${alpha * 0.16})`
      const core = `rgba(${rgb.r | 0}, ${rgb.g | 0}, ${rgb.b | 0}, ${alpha})`
      const radius = 160
      const strength = 2.8

      for (let i = 0; i < curves.length; i++) {
        const c = curves[i]
        const pts = c.pts
        for (let j = 0; j < 4; j++) {
          const p = pts[j]
          const wave = Math.sin(time * c.speed + c.phase + p.ox * 0.008 + j) * waveAmp * (0.45 + c.energy * 0.55)
          if (mouse.active) {
            const dx = p.x - mouse.x
            const dy = p.y - mouse.y
            const dist = Math.hypot(dx, dy) || 0.0001
            if (dist < radius) {
              const force = (1 - dist / radius) * strength
              p.vx += (dx / dist) * force
              p.vy += (dy / dist) * force
            }
          }
          p.vx += (p.ox - p.x) * 0.018
          p.vy += (p.oy + wave - p.y) * 0.018
          p.vx *= 0.9
          p.vy *= 0.9
          p.x += p.vx
          p.y += p.vy
        }

        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        ctx.bezierCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y)
        ctx.strokeStyle = glow
        ctx.lineWidth = c.width * 4.2
        ctx.lineCap = 'round'
        ctx.stroke()
        ctx.strokeStyle = core
        ctx.lineWidth = c.width
        ctx.stroke()
      }

      raf = requestAnimationFrame(tick)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mouseleave', onLeave)
    window.addEventListener('wheel', onWheel, { passive: true })
    document.addEventListener('mouseleave', onLeave)
    raf = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('wheel', onWheel)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className="hud-canvas" aria-hidden="true" />
}
