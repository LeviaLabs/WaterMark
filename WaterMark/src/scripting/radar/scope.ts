/**
 * Geometry for the hero storm scope (components/hero/StormScope.tsx): where
 * the scope sits, bearings and ranges, when the sweep reaches a blip, and the
 * ragged outlines of radar echoes. Pure, so it can be tested.
 */

import type { EvidenceKind } from '../content/dataSources'
import { createRandom } from '../city/random'

/** One full turn of the sweep, in seconds. */
export const SWEEP_SECONDS = 6

/** A held press builds a cell from light rain to extreme over this many seconds. */
export const BUILD_SECONDS = 2.4

/** Intensity of a cell from a quick tap, and the most a held press can reach. */
export const TAP_INTENSITY = 0.28
export const MAX_INTENSITY = 1

/** Reflectivity bands, lightest first: where each one starts on the 0..1 intensity scale. */
export const ECHO_BANDS = [
  { id: 'light', label: 'Light', from: 0 },
  { id: 'moderate', label: 'Moderate', from: 0.35 },
  { id: 'heavy', label: 'Heavy', from: 0.62 },
  { id: 'extreme', label: 'Extreme', from: 0.88 },
] as const

export type EchoBand = (typeof ECHO_BANDS)[number]['id']

/** The heaviest band a cell of this intensity reaches. */
export function bandFor(intensity: number): EchoBand {
  let band: EchoBand = 'light'
  for (const item of ECHO_BANDS) if (intensity >= item.from) band = item.id
  return band
}

/** Intensity after holding for `seconds`, starting from a tap. */
export function heldIntensity(seconds: number): number {
  const t = Math.min(Math.max(seconds / BUILD_SECONDS, 0), 1)
  return TAP_INTENSITY + (MAX_INTENSITY - TAP_INTENSITY) * t
}

export type Scope = { cx: number; cy: number; radius: number }

/** Where the scope sits in a hero of this size: to the right on wide screens, low and centered on narrow ones. */
export function scopeFor(width: number, height: number): Scope {
  if (width < 720) {
    const radius = Math.min(width * 0.5, height * 0.32)
    return { cx: width * 0.62, cy: height - radius * 0.72, radius }
  }
  const radius = Math.min(height * 0.36, width * 0.25)
  return { cx: width - Math.max(radius + 56, width * 0.24), cy: height * 0.5, radius }
}

/** Bearing in degrees clockwise from north (up), 0 to 360. */
export function bearingOf(dx: number, dy: number): number {
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI
  return (degrees + 360) % 360
}

/** Offset from the center, in radii, for a bearing and a range (0 at the center, 1 at the rim). */
export function polar(bearing: number, range: number): { x: number; y: number } {
  const radians = (bearing * Math.PI) / 180
  return { x: Math.sin(radians) * range, y: -Math.cos(radians) * range }
}

/**
 * Animation delay that makes a blip at `bearing` flash as the sweep passes
 * it. Negative, so the loop is already in step on the first frame.
 */
export function sweepDelay(bearing: number, period = SWEEP_SECONDS): number {
  return (bearing / 360) * period - period
}

/** The evidence blips on the scope: one per kind, spread around the dial. */
export const BLIPS: readonly { kind: EvidenceKind; bearing: number; range: number }[] = [
  { kind: 'official', bearing: 28, range: 0.62 },
  { kind: 'forecast', bearing: 86, range: 0.42 },
  { kind: 'modeled', bearing: 134, range: 0.74 },
  { kind: 'scenario', bearing: 188, range: 0.5 },
  { kind: 'observed', bearing: 236, range: 0.7 },
  { kind: 'historical', bearing: 292, range: 0.4 },
  { kind: 'reference', bearing: 334, range: 0.8 },
]

type Point = readonly [number, number]

/** A closed, smooth, ragged loop around (cx, cy): Catmull-Rom points turned into cubic curves. */
export function blobPath(random: () => number, radius: number, cx = 0, cy = 0, points = 9, jitter = 0.32): string {
  const loop: Point[] = Array.from({ length: points }, (_, index) => {
    const angle = (index / points) * Math.PI * 2 + (random() - 0.5) * 0.35
    const r = radius * (1 - jitter / 2 + random() * jitter)
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]
  })
  const at = (index: number) => loop[(index + points) % points]
  const f = (value: number) => value.toFixed(1)
  let d = `M${f(loop[0][0])} ${f(loop[0][1])}`
  for (let i = 0; i < points; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`
  }
  return `${d}Z`
}

/**
 * The nested outlines of one radar echo in a -100..100 box, lightest (and
 * largest) first. Heavier cores sit a little off center, as real storm cells do.
 */
export function echoShape(seed: number): Record<EchoBand, string> {
  const random = createRandom(seed)
  const radii: Record<EchoBand, number> = { light: 90, moderate: 62, heavy: 38, extreme: 18 }
  let cx = 0
  let cy = 0
  const shape = {} as Record<EchoBand, string>
  for (const { id } of ECHO_BANDS) {
    const r = radii[id]
    shape[id] = blobPath(random, r, cx, cy)
    cx += (random() - 0.5) * r * 0.35
    cy += (random() - 0.5) * r * 0.35
  }
  return shape
}
