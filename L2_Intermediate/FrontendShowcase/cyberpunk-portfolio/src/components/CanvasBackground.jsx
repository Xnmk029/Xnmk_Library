import { useEffect, useRef } from 'react'

// 职业对应的霓虹色
const CAREER_COLORS = {
  ai: { r: 35, g: 255, b: 0 },      // #23ff00
  bicycle: { r: 255, g: 170, b: 0 }, // #ffaa00
  it: { r: 0, g: 240, b: 255 },      // #00f0ff
  '3d': { r: 255, g: 0, b: 85 },     // #ff0055
  default: { r: 255, g: 255, b: 255 } // 白色
}

const LINE_COUNT = 250

/**
 * 高性能交互式 Canvas 贝塞尔扰动背景线组件
 * - 250 条发光贝塞尔曲线
 * - 根据鼠标位置产生排斥扰动
 * - 随滚轮滚动产生波浪振幅
 * - 悬停/选中不同职业时过渡变换发光颜色
 */
export default function CanvasBackground({ activeCareer = null }) {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const scrollRef = useRef(0)
  const targetColorRef = useRef(CAREER_COLORS.default)
  const currentColorRef = useRef({ ...CAREER_COLORS.default })
  const linesRef = useRef([])
  const timeRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let width = window.innerWidth
    let height = window.innerHeight

    // 设置 Canvas 尺寸
    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * window.devicePixelRatio
      canvas.height = height * window.devicePixelRatio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      initLines()
    }

    // 初始化线条
    const initLines = () => {
      linesRef.current = []
      for (let i = 0; i < LINE_COUNT; i++) {
        linesRef.current.push({
          // 起始点 (左侧区域)
          startX: Math.random() * width * 0.3,
          startY: Math.random() * height,
          // 控制点偏移
          cp1OffsetX: width * 0.2 + Math.random() * width * 0.2,
          cp1OffsetY: (Math.random() - 0.5) * height * 0.5,
          cp2OffsetX: width * 0.4 + Math.random() * width * 0.2,
          cp2OffsetY: (Math.random() - 0.5) * height * 0.5,
          // 结束点 (右侧区域)
          endX: width * 0.7 + Math.random() * width * 0.3,
          endY: Math.random() * height,
          // 动画参数
          speed: 0.5 + Math.random() * 1.5,
          phase: Math.random() * Math.PI * 2,
          amplitude: 20 + Math.random() * 40,
          opacity: 0.02 + Math.random() * 0.08,
          width: 0.5 + Math.random() * 1
        })
      }
    }

    resize()
    window.addEventListener('resize', resize)

    // 鼠标移动监听
    const handleMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }

    // 滚轮监听
    const handleWheel = (e) => {
      scrollRef.current += e.deltaY * 0.01
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('wheel', handleWheel, { passive: true })

    // 动画循环
    const animate = () => {
      timeRef.current += 0.016
      const time = timeRef.current

      // 颜色过渡插值
      const target = targetColorRef.current
      const current = currentColorRef.current
      current.r += (target.r - current.r) * 0.02
      current.g += (target.g - current.g) * 0.02
      current.b += (target.b - current.b) * 0.02

      // 清空画布
      ctx.clearRect(0, 0, width, height)

      const mouse = mouseRef.current
      const scroll = scrollRef.current

      // 绘制每条贝塞尔曲线
      linesRef.current.forEach((line, index) => {
        const {
          startX, startY,
          cp1OffsetX, cp1OffsetY,
          cp2OffsetX, cp2OffsetY,
          endX, endY,
          speed, phase, amplitude, opacity, width: lineWidth
        } = line

        // 计算波浪偏移
        const waveOffset = Math.sin(time * speed + phase + scroll * 0.1) * amplitude
        const scrollWave = Math.sin(scroll * 0.05 + index * 0.1) * 30

        // 计算控制点
        const cp1x = startX + cp1OffsetX
        const cp1y = startY + cp1OffsetY + waveOffset + scrollWave
        const cp2x = startX + cp2OffsetX
        const cp2y = endY + cp2OffsetY - waveOffset * 0.5 + scrollWave

        // 鼠标排斥力
        const midX = (startX + endX) / 2
        const midY = (startY + endY) / 2
        const dx = midX - mouse.x
        const dy = midY - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const repelRadius = 200
        let repelX = 0
        let repelY = 0

        if (dist < repelRadius && dist > 0) {
          const force = (1 - dist / repelRadius) * 50
          repelX = (dx / dist) * force
          repelY = (dy / dist) * force
        }

        // 计算动态透明度 (靠近鼠标时更亮)
        const mouseProximity = dist < 300 ? (1 - dist / 300) * 0.15 : 0
        const finalOpacity = Math.min(opacity + mouseProximity, 0.25)

        // 绘制曲线
        ctx.beginPath()
        ctx.moveTo(startX + repelX * 0.3, startY + repelY * 0.3)
        ctx.bezierCurveTo(
          cp1x + repelX, cp1y + repelY,
          cp2x + repelX * 0.5, cp2y + repelY * 0.5,
          endX, endY
        )

        const { r, g, b } = currentColorRef.current
        ctx.strokeStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${finalOpacity})`
        ctx.lineWidth = lineWidth
        ctx.stroke()
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('wheel', handleWheel)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  // 更新目标颜色
  useEffect(() => {
    if (activeCareer && CAREER_COLORS[activeCareer]) {
      targetColorRef.current = CAREER_COLORS[activeCareer]
    } else {
      targetColorRef.current = CAREER_COLORS.default
    }
  }, [activeCareer])

  return (
    <canvas
      ref={canvasRef}
      className="canvas-background"
      aria-hidden="true"
    />
  )
}
