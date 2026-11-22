/**
 * Small seeded random number generator (mulberry32). The skyline is generated
 * from a fixed seed so the city looks the same on every visit and in tests.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Random number in [min, max). */
export function between(random: () => number, min: number, max: number): number {
  return min + random() * (max - min)
}
