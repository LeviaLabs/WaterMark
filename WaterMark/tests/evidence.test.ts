import { describe, expect, it } from 'vitest'
import { radiusToSlider, sliderToRadius } from '../src/scripting/evidence/area'
import { AREA_RADIUS_LIMITS, buildAreaRequest, hasUsableData } from '../src/scripting/evidence/contract'
import { formatDistance, formatLocalTime, formatNumber, mapLink, peakOf, totalOf } from '../src/scripting/evidence/format'
import { niceMax, scaleLinear } from '../src/scripting/evidence/scale'
import { EXAMPLE_ALERTS } from '../src/scripting/content/featureExamples'
import { splitTitle } from '../src/scripting/text/splitTitle'

describe('buildAreaRequest', () => {
  it('clamps the radius to the API bounds and rounds coordinates', () => {
    expect(buildAreaRequest({ lat: 40.674512345, lon: -74.01 }, 5)).toEqual({
      center: { lat: 40.67451, lon: -74.01 },
      radiusMeters: AREA_RADIUS_LIMITS.min,
    })
    expect(buildAreaRequest({ lat: 95, lon: -200 }, 99_999)).toEqual({
      center: { lat: 90, lon: -180 },
      radiusMeters: AREA_RADIUS_LIMITS.max,
    })
  })
})

describe('radius slider', () => {
  it('covers the whole API range on a log scale', () => {
    expect(sliderToRadius(0)).toBe(100)
    expect(sliderToRadius(1000)).toBe(10_000)
    expect(sliderToRadius(500)).toBe(1000)
    expect(sliderToRadius(-5)).toBe(100)
    expect(radiusToSlider(sliderToRadius(320))).toBeCloseTo(320, -1)
  })
})

describe('hasUsableData', () => {
  it('only draws available or stale results that carry data', () => {
    expect(hasUsableData(EXAMPLE_ALERTS)).toBe(true)
    expect(hasUsableData({ ...EXAMPLE_ALERTS, status: 'stale' })).toBe(true)
    expect(hasUsableData({ ...EXAMPLE_ALERTS, status: 'error' })).toBe(false)
    expect(hasUsableData({ ...EXAMPLE_ALERTS, status: 'insufficient_data' })).toBe(false)
    expect(hasUsableData({ ...EXAMPLE_ALERTS, data: null })).toBe(false)
  })
})

describe('format', () => {
  it('shows times with an explicit time zone, and says when a source gave none', () => {
    expect(formatLocalTime('2026-11-21T21:00:00Z', { timeZone: 'America/New_York' })).toBe('Nov 21, 4:00 PM EST')
    expect(formatLocalTime(null)).toBe('Not provided by source')
    expect(formatLocalTime('not a date')).toBe('Invalid time from source')
  })

  it('treats missing values as unknown, not zero', () => {
    expect(totalOf([{ value: null }, { value: null }])).toBeNull()
    expect(totalOf([{ value: 1.5 }, { value: null }, { value: 2 }])).toBe(3.5)
    expect(formatNumber(null, 'mm')).toBe('Unknown')
    expect(peakOf([{ validFrom: 'a', validTo: 'b', value: null }])).toBeNull()
  })

  it('formats distances and map links', () => {
    expect(formatDistance(800)).toBe('800 m')
    expect(formatDistance(2500)).toBe('2.5 km')
    expect(formatDistance(10_000)).toBe('10 km')
    expect(mapLink({ lat: 40.67451, lon: -74.011, label: 'Red Hook' })).toBe('/map?lat=40.6745&lon=-74.0110&z=14&label=Red+Hook')
  })
})

describe('scale', () => {
  it('rounds chart tops up to friendly numbers', () => {
    expect(niceMax(8.9)).toBe(10)
    expect(niceMax(2.3)).toBe(2.5)
    expect(niceMax(0)).toBe(1)
    expect(niceMax(130)).toBe(200)
    expect(scaleLinear(5, [0, 10], [0, 100])).toBe(50)
    expect(scaleLinear(3, [3, 3], [0, 100])).toBe(50)
  })
})

describe('splitTitle', () => {
  it('numbers letters across lines and slices accent runs', () => {
    const { lines, plain } = splitTitle(['Know the water', '\n', { text: 'around you.', accent: true }])
    expect(plain).toBe('Know the water around you.')
    expect(lines).toHaveLength(2)
    const letters = lines.flat().flatMap((word) => word.chars)
    expect(letters.map((c) => c.index)).toEqual(letters.map((_, i) => i))
    const accent = lines[1].flatMap((word) => word.chars)
    expect(accent[0].accentIndex).toBe(0)
    expect(accent[accent.length - 1].accentIndex).toBe(accent.length - 1)
    expect(accent.every((c) => c.accentLength === accent.length)).toBe(true)
    expect(lines[0][0].chars[0].accentIndex).toBeNull()
  })
})
