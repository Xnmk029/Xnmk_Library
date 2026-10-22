import { useEffect, useRef, useState } from 'react'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!<>-_\\/[]{}—=+*^?#$█▓▒░'

function pick() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
}

export default function ScrambleText({
  text,
  as: Tag = 'span',
  className = '',
  delay = 0,
  duration = 900,
  trigger = 0,
  style,
}) {
  const [output, setOutput] = useState(text)
  const frameRef = useRef(0)
  const startRef = useRef(0)

  useEffect(() => {
    const chars = Array.from(String(text))
    let cancelled = false
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (reduce) {
      setOutput(text)
      return undefined
    }

    const timeout = window.setTimeout(() => {
      startRef.current = performance.now()
      const step = (now) => {
        if (cancelled) return
        const t = Math.min(1, (now - startRef.current) / duration)
        const reveal = Math.floor(t * chars.length)
        const next = chars.map((ch, i) => {
          if (ch === ' ') return ' '
          if (i < reveal - 1) return ch
          if (i <= reveal) return Math.random() > 0.35 ? ch : pick()
          return pick()
        })
        setOutput(next.join(''))
        if (t < 1) {
          frameRef.current = requestAnimationFrame(step)
        } else {
          setOutput(text)
        }
      }
      frameRef.current = requestAnimationFrame(step)
    }, delay)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      cancelAnimationFrame(frameRef.current)
    }
  }, [text, delay, duration, trigger])

  return (
    <Tag className={className} style={style} data-scramble="true">
      {output}
    </Tag>
  )
}
