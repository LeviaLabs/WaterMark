/**
 * Water level rules for the hero's "hold to rain" interaction. Pure so it can
 * be tested; hooks/useRainFlood runs it once per animation frame, and only
 * while the water is moving.
 *
 * Levels are shares of the scene height (0 = dry, 1 = fully under water).
 */

export type FloodRules = {
  /** Where the water settles when nobody is holding. */
  rest: number
  /** Highest the water can climb. */
  max: number
  /** Rise speed while raining, in level per second. */
  riseRate: number
  /** Drain speed after the rain stops, in level per second. */
  drainRate: number
}

export const HERO_FLOOD: FloodRules = { rest: 0.16, max: 0.36, riseRate: 0.11, drainRate: 0.05 }

/** Advances the level by `seconds` (clamped to a sane frame length). */
export function stepFlood(level: number, raining: boolean, seconds: number, rules: FloodRules = HERO_FLOOD): number {
  const dt = Math.min(Math.max(seconds, 0), 0.1)
  if (raining) return Math.min(rules.max, level + rules.riseRate * dt * easeNearTop(level, rules))
  if (level > rules.rest) return Math.max(rules.rest, level - rules.drainRate * dt)
  if (level < rules.rest) return Math.min(rules.rest, level + rules.drainRate * dt)
  return level
}

/** Slows the climb near the top so the water swells to a stop instead of hitting a wall. */
function easeNearTop(level: number, rules: FloodRules): number {
  const room = (rules.max - level) / (rules.max - rules.rest)
  return 0.25 + 0.75 * Math.min(Math.max(room, 0), 1)
}

/** True once the water has nothing left to do, so the animation loop can stop. */
export function isSettled(level: number, raining: boolean, rules: FloodRules = HERO_FLOOD): boolean {
  if (raining) return level >= rules.max
  return Math.abs(level - rules.rest) < 1e-4
}

/** Water level for each step of the flood story: rises steadily, never past `top`. */
export function storyLevel(step: number, count: number, bottom = 0.1, top = 0.5): number {
  if (count <= 1) return bottom
  const t = Math.min(Math.max(step / (count - 1), 0), 1)
  return bottom + (top - bottom) * t
}
