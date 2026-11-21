// Display formatting. Pure functions, covered by test/format.test.ts.

export function fmtDate(s: string | null | undefined): string {
  if (!s) return 'none'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return 'none'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function fmtTime(d: Date): string {
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Percent with one decimal; tiny non-zero shares read "under 0.1%" instead of a misleading 0.0%. */
export function pct(x: number): string {
  if (x > 0 && x < 0.1) return 'under 0.1%'
  return `${x.toFixed(1)}%`
}

const KM_TO_MI = 0.621371

/** Circle radius in feet below half a mile, otherwise miles. */
export function fmtRadius(km: number): string {
  const mi = km * KM_TO_MI
  return mi < 0.5 ? `${Math.round(mi * 5280).toLocaleString('en-US')} ft` : `${mi.toFixed(2)} mi`
}

export function fmtMiles(km: number): string {
  const mi = km * KM_TO_MI
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi).toLocaleString('en-US')} mi`
}

/** "Sat" for a YYYY-MM-DD date, read at local noon so time zones never shift the day. */
export function weekday(isoDay: string, style: 'short' | 'long' = 'short'): string {
  return new Date(`${isoDay}T12:00`).toLocaleDateString('en-US', { weekday: style })
}
