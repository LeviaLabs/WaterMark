import { useEffect, type RefObject } from 'react'
import { useFinePointer, usePrefersReducedMotion } from './useMediaQuery'

/**
 * Writes the pointer position over the element as `--px` and `--py`, each
 * from -1 to 1 (0 at the center). CSS multiplies them by a per-layer depth
 * to slide the city layers apart. Mouse/trackpad only, never under reduced
 * motion, and at most one style write per animation frame.
 */
export function usePointerParallax(ref: RefObject<HTMLElement | null>): void {
  const finePointer = useFinePointer()
  const reducedMotion = usePrefersReducedMotion()
  const enabled = finePointer && !reducedMotion

  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) return
    let frame = 0
    let x = 0
    let y = 0

    const apply = () => {
      frame = 0
      element.style.setProperty('--px', x.toFixed(3))
      element.style.setProperty('--py', y.toFixed(3))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply)
    }
    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect()
      x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      y = ((event.clientY - rect.top) / rect.height) * 2 - 1
      schedule()
    }
    const onLeave = () => {
      x = 0
      y = 0
      schedule()
    }

    element.addEventListener('pointermove', onMove, { passive: true })
    element.addEventListener('pointerleave', onLeave, { passive: true })
    return () => {
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(frame)
      element.style.removeProperty('--px')
      element.style.removeProperty('--py')
    }
  }, [ref, enabled])
}
