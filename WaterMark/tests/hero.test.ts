import { describe, expect, it } from 'vitest'
import { scrollForOffset, thumbGeometry } from '../src/scripting/scroll/thumb'
import { CHART, DEPTH_LEVELS, ISLANDS, LAND_LEVELS, closedPath, contourRadius, islandContours, pointOn } from '../src/scripting/tide/contours'
import { SCRAMBLE_GLYPHS, TITLE_SCRAMBLE, lockTime, scrambleDuration, scrambledChar } from '../src/scripting/text/scramble'

describe('tide chart contours', () => {
  it('nests every contour inside the one below it, so bands never cross', () => {
    for (const island of ISLANDS) {
      for (let level = -DEPTH_LEVELS; level < LAND_LEVELS - 1; level++) {
        for (let i = 0; i < 180; i++) {
          const theta = (i / 180) * Math.PI * 2
          expect(contourRadius(island, level + 1, theta)).toBeLessThan(contourRadius(island, level, theta))
        }
      }
    }
  })

  it('draws one closed, finite path per level', () => {
    for (const island of ISLANDS) {
      const contours = islandContours(island)
      expect(contours.map((c) => c.level)).toEqual(Array.from({ length: LAND_LEVELS + DEPTH_LEVELS }, (_, i) => i - DEPTH_LEVELS))
      for (const { d } of contours) {
        expect(d).toMatch(/^M.*Z$/)
        expect(d).not.toContain('NaN')
      }
    }
  })

  it('keeps the coastline of every island on the chart', () => {
    for (const island of ISLANDS) {
      for (let i = 0; i < 36; i++) {
        const { x, y } = pointOn(island, 0, (i / 36) * Math.PI * 2)
        expect(x).toBeGreaterThan(0)
        expect(x).toBeLessThan(CHART.width)
        expect(y).toBeGreaterThan(0)
        expect(y).toBeLessThan(CHART.height)
      }
    }
  })

  it('needs at least three points for a path', () => {
    expect(closedPath([[0, 0], [1, 1]])).toBe('')
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
