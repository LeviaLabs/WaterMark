import { useEffect, type RefObject } from 'react'

/** Subtle CSS 3D tilt. Skips touch screens and reduced motion. One rAF at a time. */
export function useTilt(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    let tiltX = 0
    let tiltY = 0
    let glareX = 50
    let glareY = 0

    const paint = () => {
      frame = 0
      el.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`)
      el.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`)
      el.style.setProperty('--glare-x', `${glareX.toFixed(1)}%`)
      el.style.setProperty('--glare-y', `${glareY.toFixed(1)}%`)
    }

    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(paint)
    }

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const nx = (event.clientX - rect.left) / rect.width - 0.5
      const ny = (event.clientY - rect.top) / rect.height - 0.5
      tiltY = Math.max(-1, Math.min(1, nx)) * 4
      tiltX = Math.max(-1, Math.min(1, -ny)) * 3
      glareX = (nx + 0.5) * 100
      glareY = (ny + 0.5) * 100
      schedule()
    }

    const onLeave = () => {
      tiltX = 0
      tiltY = 0
      glareX = 20
      glareY = 0
      schedule()
    }

    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [ref])
}
