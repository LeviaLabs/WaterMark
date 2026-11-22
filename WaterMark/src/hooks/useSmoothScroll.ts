import { useEffect } from 'react'
import Lenis from 'lenis'

/**
 * Smooth, eased wheel scrolling for the whole site (Lenis). Touch scrolling
 * stays native, and nothing changes under reduced motion.
 *
 * Lenis normally runs an animation frame forever; here the frame loop starts
 * on the first wheel input (or an in-page link click) and stops as soon as the
 * page comes to rest, so an idle page costs nothing.
 */
export function useSmoothScroll(): void {
  useEffect(() => {
    const lenis = new Lenis({ autoRaf: false, anchors: true, lerp: 0.1 })
    let frame = 0

    const loop = (time: number) => {
      lenis.raf(time)
      frame = lenis.isScrolling ? requestAnimationFrame(loop) : 0
    }
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(loop)
    }

    const stopListening = lenis.on('virtual-scroll', kick)
    document.addEventListener('click', kick, { capture: true, passive: true })

    return () => {
      stopListening()
      document.removeEventListener('click', kick, { capture: true })
      cancelAnimationFrame(frame)
      lenis.destroy()
    }
  }, [])
}
