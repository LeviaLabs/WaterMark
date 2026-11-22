import { describe, expect, it } from 'vitest'
import { scrollForOffset, thumbGeometry } from '../src/scripting/scroll/thumb'
import { createRandom } from '../src/scripting/city/random'
import {
  BLIPS,
  BUILD_SECONDS,
  ECHO_BANDS,
  SWEEP_SECONDS,
  TAP_INTENSITY,
  bandFor,
  bearingOf,
  blobPath,
  echoShape,
  heldIntensity,
  polar,
  scopeFor,
  sweepDelay,
} from '../src/scripting/radar/scope'
import { SCRAMBLE_GLYPHS, TITLE_SCRAMBLE, lockTime, scrambleDuration, scrambledChar } from '../src/scripting/text/scramble'

describe('storm scope', () => {
  it('reads bearings clockwise from north', () => {
    expect(bearingOf(0, -1)).toBeCloseTo(0)
    expect(bearingOf(1, 0)).toBeCloseTo(90)
    expect(bearingOf(0, 1)).toBeCloseTo(180)
    expect(bearingOf(-1, 0)).toBeCloseTo(270)
    const east = polar(90, 0.5)
    expect(east.x).toBeCloseTo(0.5)
    expect(east.y).toBeCloseTo(0)
  })

  it('flashes each blip as the sweep reaches its bearing', () => {
    for (const blip of BLIPS) {
      const delay = sweepDelay(blip.bearing)
      expect(delay).toBeLessThanOrEqual(0)
      expect(delay).toBeGreaterThan(-SWEEP_SECONDS)
      // The sweep is at angle (t / period) * 360; the flash plays at t = delay + period.
      expect(((delay + SWEEP_SECONDS) / SWEEP_SECONDS) * 360).toBeCloseTo(blip.bearing)
      expect(blip.range).toBeLessThan(1)
    }
  })

  it('builds a held cell from light rain to extreme, then stops', () => {
    expect(heldIntensity(0)).toBe(TAP_INTENSITY)
    expect(bandFor(heldIntensity(0))).toBe('light')
    expect(bandFor(heldIntensity(BUILD_SECONDS * 0.5))).toBe('heavy')
    expect(heldIntensity(BUILD_SECONDS)).toBe(1)
    expect(heldIntensity(BUILD_SECONDS * 4)).toBe(1)
    expect(bandFor(1)).toBe('extreme')
  })

  it('keeps the dial inside the hero at desktop and phone sizes', () => {
    for (const [width, height] of [
      [1440, 900],
      [1024, 700],
      [375, 780],
    ]) {
      const { cx, cy, radius } = scopeFor(width, height)
      expect(radius).toBeGreaterThan(100)
      expect(cy - radius).toBeGreaterThan(0)
      // On phones the dial may dip below the fold; most of it stays on screen.
      expect(cy + radius * 0.72).toBeLessThanOrEqual(height)
      expect(cx + radius).toBeLessThanOrEqual(width + radius * 0.5)
    }
  })

  it('draws the same closed echo for the same seed', () => {
    const a = echoShape(7)
    expect(echoShape(7)).toEqual(a)
    expect(echoShape(8).light).not.toBe(a.light)
    for (const band of ECHO_BANDS) {
      expect(a[band.id]).toMatch(/^M[-\d. ]+(C[-\d. ]+)+Z$/)
    }
    expect(blobPath(createRandom(1), 50).match(/C/g)).toHaveLength(9)
  })
})

describe('title scramble', () => {
  it('shows glyphs first, then locks each letter in order', () => {
    expect(SCRAMBLE_GLYPHS).toContain(scrambledChar('y', 0, 10))
    expect(scrambledChar('y', 0, lockTime(0))).toBe('y')
    expect(lockTime(1)).toBeGreaterThan(lockTime(0))
    expect(scrambledChar('u', 2, lockTime(1))).not.toBe('u')
    expect(scrambleDuration(6)).toBe(lockTime(5))
    expect(scrambleDuration(0)).toBe(0)
  })

  it('never scrambles spaces and is stable within one tick', () => {
    expect(scrambledChar(' ', 0, 0)).toBe(' ')
    expect(scrambledChar('o', 1, 120)).toBe(scrambledChar('o', 1, 120 + TITLE_SCRAMBLE.tick / 4))
  })
})

describe('scrollbar thumb', () => {
  const base = { scrollHeight: 4000, viewportHeight: 1000, trackHeight: 980 }

  it('sizes the thumb to the share of the page on screen and moves it with the scroll', () => {
    const top = thumbGeometry({ ...base, scrollTop: 0 })!
    expect(top.size).toBeCloseTo(245)
    expect(top.offset).toBe(0)
    const bottom = thumbGeometry({ ...base, scrollTop: 3000 })!
    expect(bottom.offset).toBeCloseTo(980 - 245)
    expect(bottom.progress).toBe(1)
  })

  it('keeps a grabbable minimum size and hides when nothing scrolls', () => {
    expect(thumbGeometry({ ...base, scrollHeight: 200_000, scrollTop: 0 })!.size).toBe(44)
    expect(thumbGeometry({ ...base, scrollHeight: 1000, scrollTop: 0 })).toBeNull()
  })

  it('maps a thumb position back to the page', () => {
    expect(scrollForOffset(367.5, 980, 245, 3000)).toBeCloseTo(1500)
    expect(scrollForOffset(-50, 980, 245, 3000)).toBe(0)
    expect(scrollForOffset(5000, 980, 245, 3000)).toBe(3000)
  })
})
