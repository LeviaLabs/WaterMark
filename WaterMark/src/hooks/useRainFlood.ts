import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { HERO_FLOOD, isSettled, stepFlood, type FloodRules } from '../scripting/city/floodLevel'
import { usePrefersReducedMotion } from './useMediaQuery'

/**
 * "Hold to make it rain." While `raining`, the water climbs; after release it
 * drains back to rest. The level is written straight to the `--level` CSS
 * variable on the element (no React re-render per frame), and the animation
 * frame loop runs only while the water is actually moving.
 *
 * Under reduced motion the water jumps between rest and high water instead.
 */
export function useRainFlood(ref: RefObject<HTMLElement | null>, rules: FloodRules = HERO_FLOOD) {
  const [raining, setRaining] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const level = useRef(rules.rest)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const write = () => element.style.setProperty('--level', level.current.toFixed(4))

    if (reducedMotion) {
      level.current = raining ? rules.max : rules.rest
      write()
      return
    }

    let frame = 0
    let last = 0
    const tick = (now: number) => {
      const seconds = last ? (now - last) / 1000 : 1 / 60
      last = now
      level.current = stepFlood(level.current, raining, seconds, rules)
      write()
      frame = isSettled(level.current, raining, rules) ? 0 : requestAnimationFrame(tick)
    }

    write()
    if (!isSettled(level.current, raining, rules)) frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [ref, raining, reducedMotion, rules])

  return {
    raining,
    startRain: useCallback(() => setRaining(true), []),
    stopRain: useCallback(() => setRaining(false), []),
  }
}
