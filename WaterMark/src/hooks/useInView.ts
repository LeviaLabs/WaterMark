import { useEffect, useState, type RefObject } from 'react'

type Options = {
  rootMargin?: string
  threshold?: number
  /** Stop observing after the first time the element is seen (for reveal animations). */
  once?: boolean
}

/** Whether the element is on screen, via one IntersectionObserver (no scroll listener). */
export function useInView(ref: RefObject<Element | null>, { rootMargin = '0px', threshold = 0, once = false }: Options = {}): boolean {
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting)
        if (entry.isIntersecting && once) observer.disconnect()
      },
      { rootMargin, threshold },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, rootMargin, threshold, once])

  return inView
}
