/**
 * Geometry for the custom page scrollbar (components/layout/ScrollGlow.tsx).
 * Pure so it can be tested; the component runs it at most once per frame.
 */

export type ThumbInput = {
  scrollTop: number
  scrollHeight: number
  viewportHeight: number
  trackHeight: number
  /** Smallest thumb, in px, so it stays easy to grab on very long pages. */
  minThumb?: number
}

export type Thumb = {
  /** Thumb length in px. */
  size: number
  /** Distance from the top of the track in px. */
  offset: number
  /** 0 at the top of the page, 1 at the bottom. */
  progress: number
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)

/** Where to draw the thumb, or null when the page does not scroll. */
export function thumbGeometry({ scrollTop, scrollHeight, viewportHeight, trackHeight, minThumb = 44 }: ThumbInput): Thumb | null {
  const scrollable = scrollHeight - viewportHeight
  if (scrollable <= 1 || trackHeight <= 0) return null
  const size = Math.min(trackHeight, Math.max(minThumb, (trackHeight * viewportHeight) / scrollHeight))
  const progress = clamp01(scrollTop / scrollable)
  return { size, offset: progress * (trackHeight - size), progress }
}

/** The page scroll position that puts the thumb's top at `offset`. */
export function scrollForOffset(offset: number, trackHeight: number, size: number, scrollable: number): number {
  const room = trackHeight - size
  return room > 0 ? clamp01(offset / room) * scrollable : 0
}
