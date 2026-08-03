/* ═══════════════════════════════════════════════════════════
   CanvasBackground — 250 Interactive Bezier Streamlines
   · Mouse proximity → repulsion displacement field
   · Scroll velocity → wave amplitude surge (decays over time)
   · Profession switch → RGB lerp color transition
   · Zero React re-renders: pure rAF loop reading refs
   ═══════════════════════════════════════════════════════════ */

import { useEffect, useRef } from 'react'

const LINE_COUNT = 250
const SAMPLES = 7            // sample points per curve
const MOUSE_RADIUS = 240     // repulsion field radius (px)
const MOUSE_FORCE = 90       // max displacement (px)
const TAU = Math.PI * 2

const rand = (min, max) => min + Math.random() * (max - min)

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function createLine(w, h) {
  return {
    baseY: rand(-80, h + 80),
    x0: rand(-w * 0.15, w * 0.25),
    x1: rand(w * 0.75, w * 1.15),
    speed: rand(0.25, 1.1),          // temporal wave speed
    freq: rand(0.0012, 0.0042),      // spatial frequency
    phase: rand(0, TAU),
    ampBase: rand(5, 26),
    driftSpeed: rand(0.04, 0.22),    // slow vertical wander
    driftPhase: rand(0, TAU),
    driftAmp: rand(8, 40),
    alpha: rand(0.035, 0.16),
    width: rand(0.4, 1.5),
    depth: rand(0.3, 1),             // parallax depth factor
    highlight: Math.random() < 0.07  // occasional bright filament
  }
}

export default function CanvasBackground({ color = '#00f0ff', intensity = 0.5 }) {
  const canvasRef = useRef(null)
  const propsRef = useRef({ color, intensity })

  // Keep latest props accessible inside the rAF loop without re-mounting
  useEffect(() => {
    propsRef.current = { color, intensity }
  }, [color, intensity])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let w = 0, h = 0, dpr = 1
    let lines = []
    let raf = 0
    let time = rand(0, 100)
    let lastT = performance.now()

    // Interaction state
    const mouse = { x: -9999, y: -9999 }
    let waveEnergy = 0
    let scrollLast = window.scrollY

    // Color state (lerped)
    let cur = hexToRgb(propsRef.current.color)
    let target = { ...cur }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.75)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Rebuild lines to cover new viewport
      lines = Array.from({ length: LINE_COUNT }, () => createLine(w, h))
    }

    function onPointerMove(e) {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }

    function onPointerLeave() {
      mouse.x = -9999
      mouse.y = -9999
    }

    function onScroll() {
      const y = window.scrollY
      const delta = Math.abs(y - scrollLast)
      scrollLast = y
      waveEnergy = Math.min(waveEnergy + delta * 0.012, 3.2)
    }

    function frame(now) {
      const dt = Math.min((now - lastT) / 1000, 0.05)
      lastT = now
      time += dt * (reducedMotion ? 0.25 : 1)

      // Decay scroll wave energy
      waveEnergy *= 0.955
      if (waveEnergy < 0.001) waveEnergy = 0

      // Lerp color toward target
      const { color: hex, intensity: boost } = propsRef.current
      const t = hexToRgb(hex)
      if (t.r !== target.r || t.g !== target.g || t.b !== target.b) target = t
      const k = 1 - Math.pow(0.032, dt) // frame-rate independent lerp
      cur.r += (target.r - cur.r) * k
      cur.g += (target.g - cur.g) * k
      cur.b += (target.b - cur.b) * k

      const cr = Math.round(cur.r)
      const cg = Math.round(cur.g)
      const cb = Math.round(cur.b)

      // Global parallax shift from mouse
      const px = (mouse.x - w / 2) * 0.008
      const py = (mouse.y - h / 2) * 0.006

      ctx.clearRect(0, 0, w, h)

      const ampSurge = 1 + waveEnergy * 1.6 + boost * 0.5
      const alphaBoost = 0.7 + boost * 0.8 + waveEnergy * 0.25

      for (let i = 0; i < lines.length; i++) {
        const L = lines[i]
        const amp = L.ampBase * ampSurge
        const drift = Math.sin(L.driftPhase + time * L.driftSpeed) * L.driftAmp
        const parX = px * L.depth
        const parY = py * L.depth

        ctx.beginPath()

        let prevX = 0, prevY = 0

        for (let s = 0; s < SAMPLES; s++) {
          const st = s / (SAMPLES - 1)
          let x = L.x0 + (L.x1 - L.x0) * st
          let y = L.baseY + drift
            + Math.sin(L.phase + time * L.speed + x * L.freq) * amp
            + Math.sin(L.phase * 1.7 + time * L.speed * 0.6 + x * L.freq * 2.3) * amp * 0.3

          // Mouse repulsion field
          const dx = x - mouse.x
          const dy = y - mouse.y
          const distSq = dx * dx + dy * dy
          if (distSq < MOUSE_RADIUS * MOUSE_RADIUS && distSq > 1) {
            const dist = Math.sqrt(distSq)
            const falloff = (1 - dist / MOUSE_RADIUS)
            const force = falloff * falloff * MOUSE_FORCE
            x += (dx / dist) * force * 0.4
            y += (dy / dist) * force
          }

          x += parX
          y += parY

          if (s === 0) {
            ctx.moveTo(x, y)
          } else {
            // Smooth via midpoint quadratic
            const mx = (prevX + x) / 2
            const my = (prevY + y) / 2
            ctx.quadraticCurveTo(prevX, prevY, mx, my)
          }
          prevX = x
          prevY = y
        }
        ctx.lineTo(prevX, prevY)

        const a = (L.highlight ? L.alpha * 2.6 : L.alpha) * alphaBoost
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${Math.min(a, 0.85)})`
        ctx.lineWidth = L.highlight ? L.width + 0.6 : L.width
        ctx.stroke()
      }

      raf = requestAnimationFrame(frame)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onPointerLeave)
    window.addEventListener('scroll', onScroll, { passive: true })
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="canvas-bg"
      aria-hidden="true"
    />
  )
}
