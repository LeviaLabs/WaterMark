import type { ColorScheme } from '../theme/themeStorage'

type Vec3 = [number, number, number]

export type WavePalette = {
  skyTop: Vec3
  skyHorizon: Vec3
  waterDeep: Vec3
  waterShallow: Vec3
  lightColor: Vec3
  lightDir: Vec3
  lightDisc: number
}

function normalize([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z) || 1
  return [x / length, y / length, z / length]
}

/** Night: a moonlit, deep-teal sea. Day: a bright sky over clear coastal water. */
export const WAVE_PALETTES: Record<ColorScheme, WavePalette> = {
  dark: {
    skyTop: [0.012, 0.027, 0.07],
    skyHorizon: [0.06, 0.17, 0.26],
    waterDeep: [0.004, 0.035, 0.07],
    waterShallow: [0.04, 0.3, 0.38],
    lightColor: [0.72, 0.86, 1.0],
    lightDir: normalize([0.38, 0.2, 1]),
    lightDisc: 2.2,
  },
  light: {
    skyTop: [0.3, 0.6, 0.9],
    skyHorizon: [0.84, 0.93, 0.98],
    waterDeep: [0.01, 0.22, 0.4],
    waterShallow: [0.08, 0.55, 0.66],
    lightColor: [1, 0.94, 0.82],
    lightDir: normalize([0.4, 0.24, 1]),
    lightDisc: 1.4,
  },
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

/** Blends two palettes; t = 0 gives `from`, t = 1 gives `to`. */
export function mixPalettes(from: WavePalette, to: WavePalette, t: number): WavePalette {
  return {
    skyTop: lerp3(from.skyTop, to.skyTop, t),
    skyHorizon: lerp3(from.skyHorizon, to.skyHorizon, t),
    waterDeep: lerp3(from.waterDeep, to.waterDeep, t),
    waterShallow: lerp3(from.waterShallow, to.waterShallow, t),
    lightColor: lerp3(from.lightColor, to.lightColor, t),
    lightDir: normalize(lerp3(from.lightDir, to.lightDir, t)),
    lightDisc: lerp(from.lightDisc, to.lightDisc, t),
  }
}

/** Smoothstep easing so the day/night crossfade starts and ends gently. */
export function easeInOut(t: number): number {
  const c = Math.min(Math.max(t, 0), 1)
  return c * c * (3 - 2 * c)
}
