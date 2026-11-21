import { useEffect, type RefObject } from 'react'
import { useFinePointer, usePrefersReducedMotion } from './useMediaQuery'

/**
 * 3D tilt that follows the mouse. Sets `--tilt-x`, `--tilt-y` (degrees) and
 * `--glare-x`, `--glare-y` (percent) on the element; CSS turns them into a
 * transform and a moving highlight. Only runs on mouse/trackpad devices
 * without reduced motion, and writes at most once per animation frame.
 */
export function usePointerTilt(ref: RefObject<HTMLElement | null>, maxDegrees = 8): void {
  const finePointer = useFinePointer()
  const reducedMotion = usePrefersReducedMotion()
  const enabled = finePointer && !reducedMotion

  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) return
    let frame = 0
    let x = 0.5
    let y = 0.5

    const apply = () => {
      frame = 0
      element.style.setProperty('--tilt-x', `${((0.5 - y) * maxDegrees * 2).toFixed(2)}deg`)
      element.style.setProperty('--tilt-y', `${((x - 0.5) * maxDegrees * 2).toFixed(2)}deg`)
      element.style.setProperty('--glare-x', `${(x * 100).toFixed(1)}%`)
      element.style.setProperty('--glare-y', `${(y * 100).toFixed(1)}%`)
    }
    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect()
      x = (event.clientX - rect.left) / rect.width
      y = (event.clientY - rect.top) / rect.height
      if (!frame) frame = requestAnimationFrame(apply)
    }
    const onLeave = () => {
      x = 0.5
      y = 0.5
      if (!frame) frame = requestAnimationFrame(apply)
    }

    element.addEventListener('pointermove', onMove, { passive: true })
    element.addEventListener('pointerleave', onLeave, { passive: true })
    return () => {
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(frame)
    }
  }, [ref, enabled, maxDegrees])
}
