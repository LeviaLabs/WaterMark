import { between, createRandom } from '../city/random'

/**
 * The hero's tide chart: a made-up island drawn as a topographic map. Pure
 * geometry, no DOM; components/hero/TideChart.tsx turns it into SVG and CSS
 * floods the contour bands as the tide rises and falls.
 *
 * Each island is a stack of closed contour lines. Contour `level` 0 is the
 * coastline at low tide; higher levels are higher ground, smaller and nested
 * inside the ones below. Negative levels are depth lines out at sea.
 */

export const CHART = { width: 1600, height: 1000 } as const

/** Contour lines on land, coastline included. */
export const LAND_LEVELS = 8

/** Depth lines drawn offshore (levels -1 and -2). */
export const DEPTH_LEVELS = 2

export type Island = {
  id: string
  cx: number
  cy: number
  /** Coastline radius before the wobble. */
  radius: number
  /** Horizontal stretch; 1 is round. */
  stretch: number
  seed: number
}

type Harmonic = { amplitude: number; cycles: number; phase: number }

type Shape = { harmonics: Harmonic[]; driftPhase: number }

function shapeOf(island: Island): Shape {
  const random = createRandom(island.seed)
  const harmonics = [2, 3, 4, 5].map((cycles) => ({
    amplitude: between(random, 0.03, 0.085) / (cycles / 2),
    cycles,
    phase: between(random, 0, Math.PI * 2),
  }))
  return { harmonics, driftPhase: between(random, 0, Math.PI * 2) }
}

/** Radius of contour `level` at angle `theta`, before the horizontal stretch. */
export function contourRadius(island: Island, level: number, theta: number, shape: Shape = shapeOf(island)): number {
  let wobble = 0
  for (const { amplitude, cycles, phase } of shape.harmonics) wobble += amplitude * Math.sin(cycles * theta + phase)
  // Each level drifts a little, so the rings are not just scaled copies.
  wobble += 0.03 * Math.sin(3 * theta + level * 0.55 + shape.driftPhase)
  const height = Math.max(0, 1 - level / LAND_LEVELS)
  return island.radius * height ** 0.85 * (1 + wobble)
}

/** Points along one closed contour, `samples` of them. */
export function contourPoints(island: Island, level: number, samples = 56): [number, number][] {
  const shape = shapeOf(island)
  return Array.from({ length: samples }, (_, i) => {
    const theta = (i / samples) * Math.PI * 2
    const r = contourRadius(island, level, theta, shape)
    return [island.cx + Math.cos(theta) * r * island.stretch, island.cy + Math.sin(theta) * r] as [number, number]
  })
}

/** A point on a contour, for pins and labels. */
export function pointOn(island: Island, level: number, theta: number): { x: number; y: number } {
  const r = contourRadius(island, level, theta)
  return { x: island.cx + Math.cos(theta) * r * island.stretch, y: island.cy + Math.sin(theta) * r }
}

const fixed = (value: number) => Number(value.toFixed(1))

/** Smooth closed path through the points (Catmull-Rom turned into cubic Béziers). */
export function closedPath(points: readonly (readonly [number, number])[]): string {
  const n = points.length
  if (n < 3) return ''
  const at = (i: number) => points[((i % n) + n) % n]
  let d = `M${fixed(at(0)[0])} ${fixed(at(0)[1])}`
  for (let i = 0; i < n; i++) {
    const [x0, y0] = at(i - 1)
    const [x1, y1] = at(i)
    const [x2, y2] = at(i + 1)
    const [x3, y3] = at(i + 2)
    d += `C${fixed(x1 + (x2 - x0) / 6)} ${fixed(y1 + (y2 - y0) / 6)} ${fixed(x2 - (x3 - x1) / 6)} ${fixed(y2 - (y3 - y1) / 6)} ${fixed(x2)} ${fixed(y2)}`
  }
  return `${d}Z`
}

export type Contour = { level: number; d: string }

/** Every contour of an island, lowest (depth lines) first. */
export function islandContours(island: Island): Contour[] {
  const contours: Contour[] = []
  for (let level = -DEPTH_LEVELS; level < LAND_LEVELS; level++) {
    contours.push({ level, d: closedPath(contourPoints(island, level)) })
  }
  return contours
}

/** The chart's islands: a big one on the right (the text sits on the left), two islets. */
export const ISLANDS: readonly Island[] = [
  { id: 'main', cx: 1110, cy: 540, radius: 320, stretch: 1.25, seed: 11 },
  { id: 'south', cx: 560, cy: 850, radius: 110, stretch: 1.25, seed: 4 },
  { id: 'north', cx: 1440, cy: 150, radius: 92, stretch: 1.2, seed: 29 },
]
