import { describe, expect, it } from 'vitest'
import { buildingPath, beaconPoint } from '../src/scripting/city/buildingPath'
import { HERO_FLOOD, isSettled, stepFlood, storyLevel } from '../src/scripting/city/floodLevel'
import { createRandom } from '../src/scripting/city/random'
import { LAYER_HEIGHT, SKYLINE_LAYERS, WORLD_WIDTH, generateLayer, viewBoxFor } from '../src/scripting/city/skyline'
import { WAVE_BOX, WAVE_PATHS, waveHeight, wavePath } from '../src/scripting/city/wave'

describe('createRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRandom(42)
    const b = createRandom(42)
    const first = Array.from({ length: 5 }, a)
    expect(Array.from({ length: 5 }, b)).toEqual(first)
    for (const value of first) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('skyline', () => {
  it('fills the whole world width with grounded, non-overlapping buildings', () => {
    for (const layer of SKYLINE_LAYERS) {
      const last = layer.buildings[layer.buildings.length - 1]
      expect(last.x + last.width).toBeGreaterThanOrEqual(WORLD_WIDTH)
      layer.buildings.forEach((building, i) => {
        expect(building.y + building.height).toBe(LAYER_HEIGHT)
        if (i > 0) {
          const previous = layer.buildings[i - 1]
          expect(building.x).toBeGreaterThanOrEqual(previous.x + previous.width)
        }
      })
    }
  })

  it('snaps buildings and lit windows to the layer grid', () => {
    for (const layer of SKYLINE_LAYERS) {
      for (const building of layer.buildings) {
        expect(building.width % layer.cell).toBe(0)
        expect(building.height % layer.cell).toBe(0)
        for (const lit of building.lit) {
          expect(lit.x).toBeGreaterThanOrEqual(building.x)
          expect(lit.x + layer.windowWidth).toBeLessThanOrEqual(building.x + building.width)
          expect(lit.y).toBeGreaterThanOrEqual(building.y)
        }
      }
    }
  })

  it('keeps the far layer a silhouette and the DOM small', () => {
    const [far, mid, near] = SKYLINE_LAYERS
    expect(far.buildings.every((b) => b.windows === null && b.lit.length === 0)).toBe(true)
    const litCount = [mid, near].reduce((sum, layer) => sum + layer.buildings.reduce((n, b) => n + b.lit.length, 0), 0)
    expect(litCount).toBeGreaterThan(50)
    expect(litCount).toBeLessThan(1500)
  })

  it('is deterministic', () => {
    const options = {
      id: 't',
      seed: 3,
      cell: 10,
      windowWidth: 4,
      windowHeight: 5,
      widthCells: [4, 6] as const,
      heightShare: [0.2, 0.5] as const,
      gapCells: [0, 1] as const,
      windows: true,
      litShare: 0.3,
      flickerShare: 0,
      roofs: ['flat'] as const,
    }
    expect(generateLayer(options)).toEqual(generateLayer(options))
  })

  it('shows a centered slice, never narrower than the minimum or wider than the world', () => {
    const parse = (box: string) => box.split(' ').map(Number)
    const [x, , width, height] = parse(viewBoxFor(16 / 9))
    expect(height).toBe(LAYER_HEIGHT)
    expect(x + width / 2).toBeCloseTo(WORLD_WIDTH / 2, 0)
    expect(parse(viewBoxFor(0.4))[2]).toBe(680)
    expect(parse(viewBoxFor(20))[2]).toBe(WORLD_WIDTH)
    expect(parse(viewBoxFor(Number.NaN))[2]).toBeGreaterThan(0)
  })
})

describe('buildingPath', () => {
  it('draws every roof style as closed shapes', () => {
    const base = { x: 100, y: 300, width: 120, height: 300, windows: null, lit: [] }
    for (const roof of ['flat', 'antenna', 'spire', 'stepped', 'tank', 'dome'] as const) {
      const d = buildingPath({ ...base, roof }, 12)
      expect(d.startsWith('M100 300')).toBe(true)
      expect(d).toMatch(/Z$/)
      expect(d).not.toContain('NaN')
    }
  })

  it('puts beacons only on antennas', () => {
    const base = { x: 0, y: 200, width: 60, height: 400, windows: null, lit: [] }
    expect(beaconPoint({ ...base, roof: 'antenna' }, 10)).toEqual({ x: 30, y: 160 })
    expect(beaconPoint({ ...base, roof: 'flat' }, 10)).toBeNull()
  })
})

describe('wave', () => {
  it('repeats exactly every period, so the drift loops seamlessly', () => {
    const options = { ...WAVE_BOX, components: [{ amplitude: 10, cycles: 3, phase: 0.7 }] }
    for (const x of [0, 137, 512]) {
      expect(waveHeight(x, options)).toBeCloseTo(waveHeight(x + WAVE_BOX.period, options), 6)
    }
  })

  it('closes the path at the bottom of the box', () => {
    const d = wavePath({ ...WAVE_BOX, components: [{ amplitude: 5, cycles: 2, phase: 0 }] })
    expect(d.startsWith('M0 ')).toBe(true)
    expect(d.endsWith(`L2000 ${WAVE_BOX.height}L0 ${WAVE_BOX.height}Z`)).toBe(true)
  })

  it('keeps every preset surface inside its box', () => {
    for (const d of Object.values(WAVE_PATHS)) {
      const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number)
      const ys = numbers.filter((_, i) => i % 2 === 1)
      expect(Math.min(...ys)).toBeGreaterThan(0)
      expect(Math.max(...ys)).toBeLessThanOrEqual(WAVE_BOX.height)
    }
  })
})

describe('flood level', () => {
  it('rises while raining, but never past the maximum', () => {
    let level = HERO_FLOOD.rest
    for (let i = 0; i < 600; i++) level = stepFlood(level, true, 1 / 60)
    expect(level).toBeCloseTo(HERO_FLOOD.max, 3)
    expect(isSettled(level, true)).toBe(true)
  })

  it('drains back to rest and then stops', () => {
    let level = HERO_FLOOD.max
    let frames = 0
    while (!isSettled(level, false) && frames < 10_000) {
      level = stepFlood(level, false, 1 / 60)
      frames++
    }
    expect(level).toBe(HERO_FLOOD.rest)
    expect(frames).toBeLessThan(10_000)
  })

  it('ignores huge frame gaps (a background tab) instead of jumping', () => {
    expect(stepFlood(HERO_FLOOD.rest, true, 30)).toBeLessThan(HERO_FLOOD.rest + 0.02)
  })

  it('rises steadily through the story', () => {
    const levels = Array.from({ length: 8 }, (_, step) => storyLevel(step, 8))
    expect(levels[0]).toBeCloseTo(0.1)
    expect(levels[7]).toBeCloseTo(0.5)
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThan(levels[i - 1])
    expect(storyLevel(3, 1)).toBe(0.1)
  })
})
