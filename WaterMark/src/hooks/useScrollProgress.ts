import { useEffect, useRef, type RefObject } from 'react'

/**
 * Scroll progress through a tall section, 0 when its top reaches the top of
 * the viewport and 1 when its bottom reaches the bottom.
 *
 * Writes the value to the `--progress` CSS variable on the element so CSS
 * does the parallax, and calls `onProgress` (at most once per frame). The
 * scroll listener exists only while the section is on screen, guarded by an
 * IntersectionObserver, and is passive so it never blocks scrolling.
 */
export function useScrollProgress(ref: RefObject<HTMLElement | null>, onProgress?: (progress: number) => void): void {
  const callback = useRef(onProgress)
  useEffect(() => {
    callback.current = onProgress
  })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    let frame = 0

    const measure = () => {
      frame = 0
      const rect = element.getBoundingClientRect()
      const travel = rect.height - window.innerHeight
      const progress = travel > 0 ? Math.min(Math.max(-rect.top / travel, 0), 1) : 0
      element.style.setProperty('--progress', progress.toFixed(4))
      callback.current?.(progress)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    let listening = false
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !listening) {
        listening = true
        window.addEventListener('scroll', schedule, { passive: true })
        window.addEventListener('resize', schedule, { passive: true })
        schedule()
      } else if (!entry.isIntersecting && listening) {
        listening = false
        window.removeEventListener('scroll', schedule)
        window.removeEventListener('resize', schedule)
        measure() // settle at 0 or 1 when the section leaves the screen
      }
    })
    observer.observe(element)

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(frame)
    }
  }, [ref])
}
