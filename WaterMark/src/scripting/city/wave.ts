/**
 * Curved water surfaces as SVG paths.
 *
 * A wave is a sum of sines whose frequencies are whole numbers of cycles per
 * `period`, so the curve repeats exactly every `period` units. The path is
 * drawn `repeats` periods wide; CSS slides the whole SVG left by one period
 * (translateX(-50%) for two repeats) and loops, which looks like an endless
 * moving swell while only `transform` animates.
 */

export type WaveComponent = {
  /** Height of the crest above the baseline, in path units. */
  amplitude: number
  /** Whole cycles per period. Must be an integer for a seamless loop. */
  cycles: number
  /** Phase offset in radians. */
  phase: number
}

export type WaveOptions = {
  period: number
  height: number
  /** Distance of the resting waterline from the top of the path box. */
  baseline: number
  components: readonly WaveComponent[]
  repeats?: number
  /** Sample points per period; more is smoother. */
  samples?: number
}

export function waveHeight(x: number, options: Pick<WaveOptions, 'period' | 'baseline' | 'components'>): number {
  let y = options.baseline
  for (const { amplitude, cycles, phase } of options.components) {
    y -= amplitude * Math.sin((2 * Math.PI * Math.round(cycles) * x) / options.period + phase)
  }
  return y
}

const fixed = (value: number) => Number(value.toFixed(2))

/**
 * Closed path: the curved surface on top, filled down to the bottom of the
 * box. Points are joined with Catmull-Rom splines converted to cubic Béziers,
 * so the surface has no kinks.
 */
export function wavePath(options: WaveOptions): string {
  const repeats = options.repeats ?? 2
  const samples = options.samples ?? 32
  const total = samples * repeats
  const step = options.period / samples
  const points: [number, number][] = []
  for (let i = -1; i <= total + 1; i++) {
    const x = i * step
    points.push([x, waveHeight(x, options)])
  }

  let d = `M0 ${fixed(points[1][1])}`
  for (let i = 1; i <= total; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const [x2, y2] = points[i + 1]
    const [x3, y3] = points[i + 2]
    const c1x = x1 + (x2 - x0) / 6
    const c1y = y1 + (y2 - y0) / 6
    const c2x = x2 - (x3 - x1) / 6
    const c2y = y2 - (y3 - y1) / 6
    d += `C${fixed(c1x)} ${fixed(c1y)} ${fixed(c2x)} ${fixed(c2y)} ${fixed(x2)} ${fixed(y2)}`
  }
  const width = options.period * repeats
  d += `L${fixed(width)} ${fixed(options.height)}L0 ${fixed(options.height)}Z`
  return d
}

/** Path box used by every water surface: one period is 1000 units wide. */
export const WAVE_BOX = { period: 1000, height: 100, baseline: 50 }

/** Three surfaces, back to front: smaller, slower swells farther away. */
export const WAVE_PATHS = {
  back: wavePath({
    ...WAVE_BOX,
    components: [
      { amplitude: 22, cycles: 3, phase: 0.4 },
      { amplitude: 8, cycles: 7, phase: 1.3 },
    ],
  }),
  mid: wavePath({
    ...WAVE_BOX,
    components: [
      { amplitude: 26, cycles: 2, phase: 2.1 },
      { amplitude: 10, cycles: 5, phase: 0.2 },
    ],
  }),
  front: wavePath({
    ...WAVE_BOX,
    components: [
      { amplitude: 28, cycles: 2, phase: 0 },
      { amplitude: 11, cycles: 5, phase: 2.6 },
      { amplitude: 4, cycles: 11, phase: 0.9 },
    ],
  }),
} as const
