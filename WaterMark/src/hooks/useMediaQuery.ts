import { useSyncExternalStore } from 'react'

/**
 * Subscribes to a CSS media query. One `change` listener per query, removed
 * on unmount; no polling and no resize listeners.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** True on devices with a mouse or trackpad (hover tilt makes no sense on touch). */
export const useFinePointer = () => useMediaQuery('(hover: hover) and (pointer: fine)')
