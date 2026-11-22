import { afterEach, describe, expect, it, vi } from 'vitest'
import { bboxesOverlap, mayBeUS, touchesNYC, unitsForLocale } from '../src/scripting/region'
import { makeCircle } from '../src/scripting/geo'
import { fmtDepthIn, fmtDistance, fmtRadius, fmtRain } from '../src/scripting/format'
import { parseCountry } from '../src/services/geocoding/photon'
import { shared } from '../src/services/shared'
import type { LngLat } from '../src/scripting/types'

describe('coverage', () => {
  it('rules out the US only where it is certainly not the US', () => {
    const us: LngLat[] = [[-73.99, 40.58], [-149.9, 61.2], [-157.86, 21.31], [-66.1, 18.47], [144.79, 13.44], [-170.7, -14.28]]
    for (const p of us) expect(mayBeUS(p)).toBe(true)
    const abroad: LngLat[] = [[3.39, 6.45], [139.69, 35.69], [-0.13, 51.51], [106.85, -6.21], [-46.63, -23.55]]
    for (const p of abroad) expect(mayBeUS(p)).toBe(false)
  })
  it('knows when a circle touches New York City', () => {
    expect(touchesNYC(makeCircle([-73.986, 40.5755], 1))).toBe(true)
    expect(touchesNYC(makeCircle([-79.38, 43.65], 5))).toBe(false)
    expect(bboxesOverlap([0, 0, 1, 1], [1, 1, 2, 2])).toBe(true)
    expect(bboxesOverlap([0, 0, 1, 1], [1.1, 0, 2, 1])).toBe(false)
  })
})

describe('units', () => {
  it('follows the browser language', () => {
    expect(unitsForLocale('en-US')).toBe('imperial')
    expect(unitsForLocale('en')).toBe('imperial')
    expect(unitsForLocale('en-GB')).toBe('metric')
    expect(unitsForLocale('fr')).toBe('metric')
    expect(unitsForLocale('ja-JP')).toBe('metric')
    expect(unitsForLocale('not a locale!')).toBe('imperial')
  })
  it('formats rain, distance, radius and depth in either system', () => {
    expect(fmtRain(25.4)).toBe('1.00 in')
    expect(fmtRain(12.34, 'metric')).toBe('12.3 mm')
    expect(fmtDistance(100, 'metric')).toBe('100 km')
    expect(fmtDistance(5, 'metric')).toBe('5.0 km')
    expect(fmtRadius(0.3, 'metric')).toBe('300 m')
    expect(fmtRadius(2, 'metric')).toBe('2.00 km')
    expect(fmtDepthIn(10, 'metric')).toBe('25 cm')
    expect(fmtDepthIn(10)).toBe('10.0 in')
  })
})

describe('parseCountry', () => {
  it('reads the country code, and says none over open water', () => {
    expect(parseCountry({ type: 'FeatureCollection', features: [{ properties: { countrycode: 'ca' } }] })).toBe('CA')
    expect(parseCountry({ type: 'FeatureCollection', features: [] })).toBe('none')
    expect(parseCountry({ type: 'FeatureCollection', features: [{ properties: { countrycode: 'Canada' } }] })).toBe('none')
    expect(() => parseCountry({ nope: true })).toThrow()
  })
})

describe('shared request cache', () => {
  afterEach(() => vi.useRealTimers())

  it('shares one download, reuses it until it expires, and never keeps a failure', async () => {
    vi.useFakeTimers()
    const run = vi.fn(async () => 42)
    await expect(Promise.all([shared('t:a', 1000, run), shared('t:a', 1000, run)])).resolves.toEqual([42, 42])
    expect(run).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1001)
    await shared('t:a', 1000, run)
    expect(run).toHaveBeenCalledTimes(2)

    const fail = vi.fn(async () => { throw new Error('busy') })
    await expect(shared('t:b', 1000, fail)).rejects.toThrow('busy')
    await expect(shared('t:b', 1000, fail)).rejects.toThrow('busy')
    expect(fail).toHaveBeenCalledTimes(2)
  })

  it('lets a caller stop waiting without cancelling the shared download', async () => {
    let finish: (v: number) => void = () => {}
    const run = vi.fn(() => new Promise<number>((r) => { finish = r }))
    const ctl = new AbortController()
    const first = shared('t:c', 1000, run, ctl.signal)
    ctl.abort()
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    finish(7)
    await expect(shared('t:c', 1000, run)).resolves.toBe(7)
    expect(run).toHaveBeenCalledTimes(1)
  })
})
