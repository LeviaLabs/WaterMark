// What caused US floods, from NOAA's event type and FLOOD_CAUSE field (scripts/floods/build.py,
// CAUSES: same ids in the same order; tests/floodData.test.ts checks they match index.json).
// GDACS, used outside the US, does not record a cause.

export const CAUSES = [
  { id: 'rain', label: 'Flash floods from heavy rain', short: 'Heavy rain (flash floods)' },
  { id: 'river', label: 'Rivers and slow-rising water', short: 'Rivers, slow-rising water' },
  { id: 'tropical', label: 'Tropical storms and hurricanes', short: 'Tropical storms' },
  { id: 'snowmelt', label: 'Rain with snowmelt', short: 'Snowmelt' },
  { id: 'burn', label: 'Rain on wildfire burn scars', short: 'Burn scars' },
  { id: 'ice', label: 'Ice jams', short: 'Ice jams' },
  { id: 'dam', label: 'Dams and levees', short: 'Dams, levees' },
  { id: 'sea', label: 'The sea: storm surge and high tides', short: 'Sea (surge, tides)' },
  { id: 'lake', label: 'Lakes: Great Lakes and large lakes', short: 'Lakes' },
] as const

export type CauseId = (typeof CAUSES)[number]['id']
export const CAUSE_IDS: readonly string[] = CAUSES.map((c) => c.id)

export interface CauseRow { id: CauseId; label: string; short: string; count: number }

/** A cause count map as rows, most common first (unknown ids dropped). */
export function causeRows(counts: Readonly<Record<string, number>> | undefined): CauseRow[] {
  if (!counts) return []
  return CAUSES.filter((c) => (counts[c.id] ?? 0) > 0)
    .map((c) => ({ ...c, count: counts[c.id] }))
    .sort((a, b) => b.count - a.count)
}

/** A grid row's [cause index, floods, ...] pairs as a cause count map. */
export function decodeCauses(pairs: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!Array.isArray(pairs)) return out
  for (let q = 0; q + 1 < pairs.length; q += 2) {
    const id = CAUSE_IDS[pairs[q] as number]
    const n = pairs[q + 1]
    if (id && typeof n === 'number' && n > 0) out[id] = n
  }
  return out
}
