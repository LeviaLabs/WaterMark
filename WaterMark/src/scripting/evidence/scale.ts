/**
 * A round number at or above `value` for a chart's top gridline
 * (1, 2, 2.5, 5 or 10 times a power of ten). Zero or bad input gives 1.
 */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (value <= step * power) return Number((step * power).toPrecision(6))
  }
  return 10 * power
}

/** Linear map of `value` from [d0, d1] to [r0, r1]; a flat domain maps to the middle. */
export function scaleLinear(value: number, [d0, d1]: readonly [number, number], [r0, r1]: readonly [number, number]): number {
  if (d1 === d0) return (r0 + r1) / 2
  return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0)
}
