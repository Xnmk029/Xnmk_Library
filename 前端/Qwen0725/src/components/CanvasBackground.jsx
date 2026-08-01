import { useRef, useEffect, useCallback } from 'react'

/**
 * CanvasBackground - 高性能交互式 Canvas 贝塞尔扰动背景
 * 
 * 特性：
 * - 250 条发光贝塞尔曲线
 * - 鼠标位置排斥扰动
 * - 滚轮滚动产生波浪振幅
 * - 根据选中职业过渡变换发光颜色
 */

const CURVE_COUNT = 250
const MOUSE_RADIUS = 200
const MOUSE_FORCE = 80

// 职业颜色配置
const CAREER_COLORS = {
  ai: { r: 35, g: 255, b: 0 },      // #23ff00
  bike: { r: 255, g: 170, b: 0 },   // #ffaa00
  it: { r: 0, g: 240, b: 255 },     // #00f0ff
  '3d': { r: 255, g: 0, b: 85 },    // #ff0055
  default: { r: 0, g: 240, b: 255 } // 默认青色
}

class Curve {
  constructor(width, height) {
    this.width = width
    this.height = height
    this.reset()
  }

  reset() {
    const w = this.width
    const h = this.height
    
    // 起始点
    this.x1 = Math.random() * w
    this.y1 = Math.random() * h
    
    // 控制点偏移
    this.cx1 = this.x1 + (Math.random() - 0.5) * 300
    this.cy1 = this.y1 + (Math.random() - 0.5) * 200
    this.cx2 = this.x1 + (Math.random() - 0.5) * 400
    this.cy2 = this.y1 + (Math.random() - 0.5) * 300
    
    // 终点
    this.x2 = this.x1 + (Math.random() - 0.5) * 500
    this.y2 = this.y1 + (Math.random() - 0.5) * 400
    
    // 动画参数
    this.phase = Math.random() * Math.PI * 2
    this.speed = 0.002 + Math.random() * 0.008
    this.amplitude = 20 + Math.random() * 60
    this.baseOpacity = 0.05 + Math.random() * 0.15
    this.lineWidth = 0.5 + Math.random() * 1.5
    
    // 当前偏移（用于鼠标排斥）
    this.offsetX = 0
    this.offsetY = 0
    this.targetOffsetX = 0
    this.targetOffsetY = 0
  }

  update(time, mouseX, mouseY, scrollWave) {
    // 基础波动
    const wave = Math.sin(time * this.speed + this.phase) * this.amplitude
    const wave2 = Math.cos(time * this.speed * 0.7 + this.phase) * this.amplitude * 0.5
    
    // 鼠标排斥计算
    const centerX = (this.x1 + this.x2) / 2
    const centerY = (this.y1 + this.y2) / 2
    const dx = centerX - mouseX
    const dy = centerY - mouseY
    const dist = Math.sqrt(dx * dx + dy * dy)
    
    if (dist < MOUSE_RADIUS && dist > 0) {
      const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE
      this.targetOffsetX = (dx / dist) * force
      this.targetOffsetY = (dy / dist) * force
    } else {
      this.targetOffsetX = 0
      this.targetOffsetY = 0
    }
    
    // 平滑过渡偏移
    this.offsetX += (this.targetOffsetX - this.offsetX) * 0.08
    this.offsetY += (this.targetOffsetY - this.offsetY) * 0.08
    
    // 滚轮波浪影响
    this.scrollOffset = scrollWave * 30
    
    return { wave, wave2 }
  }

  draw(ctx, color, opacity) {
    const { wave, wave2 } = this.currentAnim || { wave: 0, wave2: 0 }
    
    ctx.beginPath()
    ctx.moveTo(
      this.x1 + this.offsetX,
      this.y1 + this.offsetY + wave + this.scrollOffset
    )
    ctx.bezierCurveTo(
      this.cx1 + this.offsetX * 0.8 + wave2,
      this.cy1 + this.offsetY * 0.8 + wave,
      this.cx2 + this.offsetX * 0.6 - wave2,
      this.cy2 + this.offsetY * 0.6 - wave,
      this.x2 + this.offsetX * 0.4,
      this.y2 + this.offsetY * 0.4 + wave2 + this.scrollOffset
    )
    
    const finalOpacity = this.baseOpacity * opacity
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${finalOpacity})`
    ctx.lineWidth = this.lineWidth
    ctx.stroke()
  }
}

export default function CanvasBackground({ activeCareer = 'default' }) {
  const canvasRef = useRef(null)
  const curvesRef = useRef([])
  const animationRef = useRef(null)
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const scrollWaveRef = useRef(0)
  const currentColorRef = useRef({ ...CAREER_COLORS.default })
  const targetColorRef = useRef({ ...CAREER_COLORS.default })
  const opacityRef = useRef(1)

  // 更新目标颜色
  useEffect(() => {
    const colorKey = activeCareer || 'default'
    targetColorRef.current = CAREER_COLORS[colorKey] || CAREER_COLORS.default
  }, [activeCareer])

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const dpr = window.devicePixelRatio || 1
    const width = window.innerWidth
    const height = window.innerHeight
    
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    
    // 重新初始化曲线
    curvesRef.current = Array.from({ length: CURVE_COUNT }, () => 
      new Curve(width, height)
    )
  }, [])

  const handleMouseMove = useCallback((e) => {
    mouseRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleWheel = useCallback((e) => {
    scrollWaveRef.current += e.deltaY * 0.001
    // 衰减
    setTimeout(() => {
      scrollWaveRef.current *= 0.95
    }, 100)
  }, [])

  useEffect(() => {
    handleResize()
    
    window.addEventListener('resize', handleResize)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('wheel', handleWheel, { passive: true })
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    let time = 0
    
    const animate = () => {
      time++
      
      const width = window.innerWidth
      const height = window.innerHeight
      
      // 清空画布
      ctx.clearRect(0, 0, width, height)
      
      // 颜色过渡
      const current = currentColorRef.current
      const target = targetColorRef.current
      current.r += (target.r - current.r) * 0.02
      current.g += (target.g - current.g) * 0.02
      current.b += (target.b - current.b) * 0.02
      
      // 滚轮波浪衰减
      scrollWaveRef.current *= 0.98
      
      // 更新并绘制所有曲线
      const curves = curvesRef.current
      for (let i = 0; i < curves.length; i++) {
        const curve = curves[i]
        curve.currentAnim = curve.update(
          time,
          mouseRef.current.x,
          mouseRef.current.y,
          scrollWaveRef.current
        )
        curve.draw(ctx, current, opacityRef.current)
      }
      
      // 添加发光效果（每隔几条线添加阴影）
      ctx.shadowBlur = 0
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animate()
    
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('wheel', handleWheel)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [handleResize, handleMouseMove, handleWheel])

  return (
    <canvas
      ref={canvasRef}
      className="canvas-background"
      style={{ position: 'fixed', top: 0, left: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  )
}
