/**
 * Random layout for the fish in the underwater evidence section
 * (components/landing/EvidenceSea.tsx). Pure: pass a random source
 * (Math.random in the app, a seeded one in tests).
 */

export type FishShape = 'sleek' | 'round' | 'tall'

export type Fish<K extends string = string> = {
  kind: K
  shape: FishShape
  /** Depth: 0 is the top of the swimming band, 1 the bottom. */
  y: number
  /** 1 swims left to right, -1 right to left. */
  dir: 1 | -1
  /** Seconds to cross the section once. */
  swim: number
  /** How far through its first crossing the fish starts, 0 to 1. */
  phase: number
  /** Size, about 1; bigger fish are nearer and a little faster. */
  size: number
  /** Seconds per up-and-down bob. */
  bob: number
}

export type Bubble = { x: number; rise: number; phase: number; size: number; drift: number }

const between = (random: () => number, min: number, max: number) => min + random() * (max - min)

/** Fisher-Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const SHAPES: readonly FishShape[] = ['sleek', 'round', 'tall']

/**
 * One fish per kind, in random order, at spread-out depths (one per band,
 * jittered) so they never stack. Directions alternate after shuffling, so
 * about half swim each way.
 */
export function makeSchool<K extends string>(kinds: readonly K[], random: () => number): Fish<K>[] {
  const order = shuffle(kinds, random)
  const bands = shuffle(
    order.map((_, i) => i),
    random,
  )
  const firstDir = random() < 0.5 ? 1 : -1
  return order.map((kind, i) => {
    const size = between(random, 0.85, 1.2)
    return {
      kind,
      shape: SHAPES[i % SHAPES.length],
      y: (bands[i] + between(random, 0.15, 0.85)) / order.length,
      dir: (i % 2 === 0 ? firstDir : -firstDir) as 1 | -1,
      swim: between(random, 20, 30) / size,
      phase: random(),
      size,
      bob: between(random, 2.6, 4.4),
    }
  })
}

/** A new depth for a fish that just left the screen, kept inside its band of the school. */
export function newDepth(current: number, count: number, random: () => number): number {
  const band = Math.min(count - 1, Math.floor(current * count))
  return (band + between(random, 0.15, 0.85)) / count
}

/** Bubbles rising from the seabed. */
export function makeBubbles(count: number, random: () => number): Bubble[] {
  return Array.from({ length: count }, () => ({
    x: Number(random().toFixed(3)),
    rise: between(random, 7, 15),
    phase: random(),
    size: between(random, 4, 12),
    drift: between(random, -24, 24),
  }))
}
