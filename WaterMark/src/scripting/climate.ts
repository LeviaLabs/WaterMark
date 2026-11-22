// Summaries of daily rain and river series for the charts. Pure; tested in tests/climate.test.ts.

export interface DailySeries {
  /** YYYY-MM-DD */
  time: string[]
  values: (number | null)[]
}

export interface YearStat { year: number; value: number }

/** Heaviest single day of each complete year, and how many days reached `heavyMm`. */
export function rainByYear(s: DailySeries, heavyMm = 50): { maxDay: YearStat[]; heavyDays: YearStat[]; wettest: { day: string; mm: number } | null } {
  const max = new Map<number, number>()
  const heavy = new Map<number, number>()
  let wettest: { day: string; mm: number } | null = null
  s.time.forEach((day, i) => {
    const v = s.values[i]
    if (v == null || !Number.isFinite(v)) return
    const y = Number(day.slice(0, 4))
    max.set(y, Math.max(max.get(y) ?? 0, v))
    heavy.set(y, (heavy.get(y) ?? 0) + (v >= heavyMm ? 1 : 0))
    if (!wettest || v > wettest.mm) wettest = { day, mm: v }
  })
  const years = [...max.keys()].sort((a, b) => a - b)
  return {
    maxDay: years.map((year) => ({ year, value: max.get(year) ?? 0 })),
    heavyDays: years.map((year) => ({ year, value: heavy.get(year) ?? 0 })),
    wettest,
  }
}

/** Highest daily flow of each year. */
export function peaksByYear(s: DailySeries): YearStat[] {
  const peak = new Map<number, number>()
  s.time.forEach((day, i) => {
    const v = s.values[i]
    if (v == null || !Number.isFinite(v)) return
    const y = Number(day.slice(0, 4))
    peak.set(y, Math.max(peak.get(y) ?? 0, v))
  })
  return [...peak].sort((a, b) => a[0] - b[0]).map(([year, value]) => ({ year, value }))
}

/** Share (0 to 100) of the history's days with a flow below `value`: "higher than 97% of days". */
export function percentileOf(value: number, history: readonly (number | null)[]): number | null {
  const v = history.filter((x): x is number => x != null && Number.isFinite(x))
  if (!v.length) return null
  return (v.filter((x) => x < value).length / v.length) * 100
}

/** Median of the history's flows on the same calendar day (±7 days) as `isoDay`, for "typical for the season". */
export function seasonalMedian(isoDay: string, s: DailySeries, windowDays = 7): number | null {
  const doy = (d: string) => {
    const t = Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))
    return Math.floor((t - Date.UTC(Number(d.slice(0, 4)), 0, 1)) / 864e5)
  }
  const target = doy(isoDay)
  const vals: number[] = []
  s.time.forEach((d, i) => {
    const v = s.values[i]
    if (v == null) return
    const diff = Math.abs(doy(d) - target)
    if (Math.min(diff, 365 - diff) <= windowDays) vals.push(v)
  })
  if (!vals.length) return null
  vals.sort((a, b) => a - b)
  const mid = Math.floor(vals.length / 2)
  return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2
}

/** Index of today's date in a daily series (or -1), for splitting past from forecast. */
export function todayIndex(time: readonly string[], now = new Date()): number {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return time.indexOf(today)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** "Jul, Aug and Sep" for the three busiest months of twelve counts; null when there are none. */
export function busiestMonths(m: readonly number[] | undefined): string | null {
  if (!m || m.length !== 12 || !m.some((x) => x > 0)) return null
  const top = m.map((n, i) => ({ n, i })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n || a.i - b.i).slice(0, 3).map((x) => MONTHS[x.i])
  return top.length > 1 ? `${top.slice(0, -1).join(', ')} and ${top.at(-1)}` : top[0]
}
