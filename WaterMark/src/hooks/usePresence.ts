// Keeps an element mounted while it plays its exit animation. Pass `isOpen`; render while
// `isMounted`, add the closing class while `isClosing`, and spread `bind` onto the element so it
// unmounts when its own exit animation ends (no timers, so CSS alone sets the timing).
//
// If no exit animation actually runs (a browser, extension or user stylesheet that turns animations
// off), the element unmounts at once instead of waiting for an `animationend` that never comes.
import { useEffect, useRef, useState, type AnimationEvent } from 'react'

export interface PresenceBind {
  ref: (el: HTMLElement | null) => void
  onAnimationEnd: (e: AnimationEvent<HTMLElement>) => void
}

export function usePresence(isOpen: boolean): { isMounted: boolean; isClosing: boolean; bind: PresenceBind } {
  const [isMounted, setIsMounted] = useState(isOpen)
  const ref = useRef<HTMLElement | null>(null)
  // Mount immediately on open (adjusting state during render is React's pattern for derived state).
  if (isOpen && !isMounted) setIsMounted(true)
  const isClosing = !isOpen && isMounted

  useEffect(() => {
    if (!isClosing) return
    const el = ref.current
    // getAnimations() also flushes styles, so the closing animation has started if it exists.
    const running = el?.getAnimations?.().some((a) => a.playState === 'running' || a.pending)
    // Synchronizing with the DOM: nothing is animating, so there is no end event to wait for.
    if (!running) setIsMounted(false)
  }, [isClosing])

  const done = (e: AnimationEvent<HTMLElement>) => {
    if (e.target === e.currentTarget && !isOpen) setIsMounted(false)
  }
  return {
    isMounted: isOpen || isMounted,
    isClosing,
    bind: {
      ref: (el: HTMLElement | null) => { ref.current = el },
      onAnimationEnd: done,
    },
  }
}
