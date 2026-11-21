import { describe, expect, it } from 'vitest'
import {
  CAMERA_HEIGHT,
  HORIZON,
  MAX_DISTANCE,
  RIPPLE_SLOTS,
  RippleRing,
  pixelToUv,
  uvToPlane,
} from '../src/scripting/graphics/waveCamera'
import { WAVE_PALETTES, easeInOut, mixPalettes } from '../src/scripting/graphics/wavePalettes'
import { FRAGMENT_SHADER } from '../src/scripting/graphics/waveShaders'

describe('pixelToUv', () => {
  it('centers the canvas and flips y so up is positive', () => {
    expect(pixelToUv(400, 300, 800, 600)).toEqual({ u: 0, v: 0 })
    const topLeft = pixelToUv(0, 0, 800, 600)
    expect(topLeft.u).toBeCloseTo(-400 / 600)
    expect(topLeft.v).toBeCloseTo(0.5)
  })
})

describe('uvToPlane', () => {
  it('returns null for the sky and for water beyond the fog', () => {
    expect(uvToPlane(0, HORIZON + 0.1)).toBeNull()
    expect(uvToPlane(0, HORIZON)).toBeNull()
    expect(uvToPlane(0, HORIZON - CAMERA_HEIGHT / (MAX_DISTANCE * 2))).toBeNull()
  })

  it('puts lower pixels closer to the camera', () => {
    const near = uvToPlane(0, -0.45)!
    const far = uvToPlane(0, -0.05)!
    expect(near.z).toBeLessThan(far.z)
    expect(near.z).toBeCloseTo(CAMERA_HEIGHT / (HORIZON + 0.45))
  })

  it('shifts sideways with sway like the shader camera', () => {
    const still = uvToPlane(0.2, -0.3)!
    const swayed = uvToPlane(0.2, -0.3, 0.1)!
    expect(swayed.z).toBe(still.z)
    expect(swayed.x).toBeCloseTo((0.2 + 0.1) * still.z)
  })
})

describe('RippleRing', () => {
  it('overwrites the oldest ripple once full', () => {
    const ring = new RippleRing()
    for (let i = 0; i < RIPPLE_SLOTS + 1; i++) ring.add({ x: i, z: i }, i)
    expect(ring.data.length).toBe(RIPPLE_SLOTS * 3)
    expect(Array.from(ring.data.slice(0, 3))).toEqual([RIPPLE_SLOTS, RIPPLE_SLOTS, RIPPLE_SLOTS])
    expect(ring.data[3]).toBe(1)
  })
})

describe('palettes and shader', () => {
  it('blends palettes from one end to the other', () => {
    const { dark, light } = WAVE_PALETTES
    expect(mixPalettes(dark, light, 0).skyTop).toEqual(dark.skyTop)
    mixPalettes(dark, light, 1).skyTop.forEach((channel, i) => expect(channel).toBeCloseTo(light.skyTop[i]))
    const dir = mixPalettes(dark, light, 0.5).lightDir
    expect(Math.hypot(...dir)).toBeCloseTo(1)
  })

  it('eases and clamps', () => {
    expect(easeInOut(-1)).toBe(0)
    expect(easeInOut(0.5)).toBeCloseTo(0.5)
    expect(easeInOut(2)).toBe(1)
  })

  it('bakes the shared camera constants into the GLSL', () => {
    expect(FRAGMENT_SHADER).toContain(`const float HORIZON = ${HORIZON.toFixed(4)};`)
    expect(FRAGMENT_SHADER).toContain(`uniform vec3 uRipples[${RIPPLE_SLOTS}];`)
  })
})
