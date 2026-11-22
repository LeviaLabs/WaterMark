// Keeps an element mounted while it plays its exit animation. Pass `isOpen`; render while
// `isMounted`, add the closing class while `isClosing`, and put `onAnimationEnd` on the element so
// it unmounts when its own exit animation ends (no timers, so CSS alone sets the timing).
import { useState, type AnimationEvent } from 'react'

export function usePresence(isOpen: boolean) {
  const [isMounted, setIsMounted] = useState(isOpen)
  // Mount immediately on open (adjusting state during render is React's pattern for derived state).
  if (isOpen && !isMounted) setIsMounted(true)
  return {
    isMounted: isOpen || isMounted,
    isClosing: !isOpen && isMounted,
    onAnimationEnd: (e: AnimationEvent<HTMLElement>) => {
      if (e.target === e.currentTarget && !isOpen) setIsMounted(false)
    },
  }
}
