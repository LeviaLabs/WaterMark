// The flood outlook for a selected place, worked out here in code and never by an AI model:
//
//   Next 16 days   official NWS flood alerts (US), forecast rain against a typical year's wettest
//                  day at this spot (ERA5, since 1991), and the GloFAS river forecast against a
//                  typical year's highest flow (GloFAS reanalysis, since 1984).
//   When next      the place's own flood record (NOAA episodes in the US, GDACS events elsewhere):
//                  how often floods came, when the last one began, and the three-month season most
//                  of them began in. A pattern from past floods, not a forecast and not a probability.
//
// "A typical year's wettest day" and "a typical year's highest flow" are the medians of each
// year's maximum, roughly what comes once in two years. Nothing here is a calibrated chance of
// flooding, and a quiet outlook is never called safe.
import { peaksByYear, rainByYear, todayIndex, type DailySeries } from './climate'
import { shownAlerts } from './alerts'
import type { Coverable, Loadable, RainOutlook, RiverOutlook, WeatherAlert } from './types'

export type OutlookLevel = 'warning' | 'watch' | 'elevated' | 'quiet' | 'unknown'
const RANK: Record<OutlookLevel, number> = { unknown: 0, quiet: 1, elevated: 2, watch: 3, warning: 4 }

export interface OutlookSignal {
  kind: 'alert' | 'rain' | 'river'
  level: OutlookLevel
  text: string
  source: string
  url: string
}

/** One level of a place's flood record, most local first (county, state; province, country). */
export interface PlaceHistory {
  level: 'county' | 'state' | 'province' | 'country'
  name: string
  firstYear: number
  perYear: readonly number[]
  /** Floods that began in each month, January first. */
  months?: readonly number[]
  /** Start of the most recent flood, YYYY-MM-DD. */
  last?: string
  unit: string
  source: string
  url: string
}

export interface Recurrence {
  place: string
  period: string
  total: number
  yearsWithAny: number
  years: number
  /** "about one every 2 months" */
  rate: string
  /** "Aug 31, 2025" */
  last: string | null
  /** "3 months ago" */
  sinceLast: string | null
  /** The three months most floods began in, and the share of past floods that began then. */
  season: { months: string; sharePercent: number; from: string } | null
  /** That season's next run: "May–Jul 2026", or the current one when it is under way. */
  nextWindow: string | null
  isInSeason: boolean
  unit: string
  source: string
  url: string
}

export interface FloodOutlook {
  level: OutlookLevel
  headline: string
  signals: OutlookSignal[]
  /** Forecast days ahead that were checked. */
  days: number
  recurrence: Recurrence | null
  /** True while a lookup it needs is still loading. */
  isPending: boolean
  /** False while a lookup is loading, or when one failed. */
  isComplete: boolean
  notes: string[]
}

export interface OutlookInput {
  rain: Loadable<RainOutlook>
  rainHistory: Loadable<DailySeries>
  river: Loadable<RiverOutlook>
  riverHistory: Loadable<DailySeries>
  alerts: Coverable<WeatherAlert[]>
  history: readonly PlaceHistory[] | null
  now?: Date
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const OPEN_METEO = 'https://open-meteo.com/'
const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const utc = (d: string) => new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))))
/** "Tue, Nov 25" */
export const fmtDay = (d: string) => utc(d).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
/** "Aug 31, 2025" */
export const fmtDate = (d: string) => utc(d).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
const mm = (v: number) => `${Math.round(v)} mm (${(v / 25.4).toFixed(1)} in)`
const flow = (v: number) => `${v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1)} m³/s`

/** Each complete year's maximum, without the current (partial) year. */
function typicalYearMax(stats: { year: number; value: number }[], now: Date): number | null {
  return median(stats.filter((s) => s.year < now.getFullYear()).map((s) => s.value))
}

function rainSignal(r: Loadable<RainOutlook>, hist: Loadable<DailySeries>, now: Date): { signal: OutlookSignal | null; days: number; pending: boolean } {
  const base = { kind: 'rain' as const, source: 'Open-Meteo forecast (weather models); ERA5 rain since 1991 for comparison', url: OPEN_METEO }
  if (r === null || hist === null) return { signal: null, days: 0, pending: true }
  if (r === 'error') return { signal: { ...base, level: 'unknown', text: "The rain forecast couldn't be loaded." }, days: 0, pending: false }
  const t = todayIndex(r.time, now)
  if (t < 0) return { signal: { ...base, level: 'unknown', text: 'The rain forecast did not include today.' }, days: 0, pending: false }
  const days = r.time.length - t
  const typical = hist === 'error' ? null : typicalYearMax(rainByYear(hist).maxDay, now)
  const mark = typical ?? 50
  const markText = typical != null ? `a typical year's wettest day here, ${mm(mark)}` : `${mm(mark)}, a common heavy-rain mark (this spot's rain history didn't load)`
  let peak = { day: r.time[t], v: -1 }
  let three = { day: r.time[t], v: -1 }
  let missing = 0
  for (let i = t; i < r.time.length; i++) {
    const v = r.mm[i]
    if (v == null || !Number.isFinite(v)) {
      missing += 1
      continue
    }
    if (v > peak.v) peak = { day: r.time[i], v }
    const next = r.mm[i + 1]
    const after = r.mm[i + 2]
    if (i + 2 < r.time.length && next != null && after != null && Number.isFinite(next) && Number.isFinite(after)) {
      const s = v + next + after
      if (s > three.v) three = { day: r.time[i], v: s }
    }
  }
  if (peak.v < 0) {
    return { days, pending: false, signal: { ...base, level: 'unknown', text: 'Rainfall values are missing for this forecast. Missing values are not zero, and this is not an all-clear.' } }
  }
  const gap = missing ? ` ${missing} forecast day${missing === 1 ? '' : 's'} have no data, so this is not a complete picture.` : ''
  if (peak.v >= mark) {
    return { days, pending: false, signal: { ...base, level: 'elevated', text: `Heavy rain forecast: ${mm(peak.v)} on ${fmtDay(peak.day)}, at least as much as ${markText}.${gap}` } }
  }
  if (three.v >= mark * 1.5) {
    return { days, pending: false, signal: { ...base, level: 'elevated', text: `Heavy rain forecast: ${mm(three.v)} over three days from ${fmtDay(three.day)}, half again ${markText}.${gap}` } }
  }
  const text = peak.v < 1
    ? `Little or no rain forecast for the next ${days} days.${gap}`
    : `Forecast rain stays below ${markText}: the most on one day is ${mm(peak.v)} on ${fmtDay(peak.day)}.${gap}`
  return { days, pending: false, signal: { ...base, level: 'quiet', text } }
}

function riverSignal(r: Loadable<RiverOutlook>, hist: Loadable<DailySeries>, now: Date): { signal: OutlookSignal | null; pending: boolean; note?: string } {
  const base = { kind: 'river' as const, source: 'GloFAS v4 river model (Copernicus) via Open-Meteo, nearest river cell', url: 'https://open-meteo.com/en/docs/flood-api' }
  if (r === null || hist === null) return { signal: null, pending: true }
  if (r === 'error') return { signal: { ...base, level: 'unknown', text: "The river forecast couldn't be loaded." }, pending: false }
  if (!r.flow.some((f) => (f ?? 0) > 0)) return { signal: null, pending: false, note: 'No modeled river near this spot (GloFAS covers larger rivers only).' }
  const t = todayIndex(r.time, now)
  if (t < 0) return { signal: { ...base, level: 'unknown', text: 'The river forecast did not include today.' }, pending: false }
  let peak = { day: r.time[t], v: -1 }
  for (let i = t; i < Math.min(r.time.length, t + 30); i++) {
    const f = r.flow[i]
    if (f != null && f > peak.v) peak = { day: r.time[i], v: f }
  }
  if (peak.v < 0) {
    return { pending: false, signal: { ...base, level: 'unknown', text: "The river forecast has no reading for today or the next 30 days. A missing value is not a low flow." } }
  }
  const typical = hist === 'error' ? null : typicalYearMax(peaksByYear(hist), now)
  if (typical == null || typical <= 0) {
    return { pending: false, signal: { ...base, level: 'unknown', text: `The river forecast peaks at ${flow(peak.v)} around ${fmtDay(peak.day)}, but this river's history didn't load to compare it with.` } }
  }
  if (peak.v >= typical) {
    return { pending: false, signal: { ...base, level: 'elevated', text: `The nearest river is forecast to reach ${flow(peak.v)} around ${fmtDay(peak.day)}, at or above a typical year's highest flow here (${flow(typical)}). Modeled flow, not flood depth.` } }
  }
  return { pending: false, signal: { ...base, level: 'quiet', text: `The nearest river's forecast peaks at ${flow(peak.v)} around ${fmtDay(peak.day)}, below a typical year's highest flow here (${flow(typical)}).` } }
}

function alertSignals(a: Coverable<WeatherAlert[]>, now: Date): { signals: OutlookSignal[]; pending: boolean; note?: string } {
  const base = { kind: 'alert' as const, source: 'US National Weather Service (api.weather.gov)', url: 'https://www.weather.gov/' }
  if (a === null) return { signals: [], pending: true }
  if (a === 'unsupported') return { signals: [], pending: false, note: 'Official alerts here come from your national weather service; WaterMark reads US (NWS) alerts only.' }
  if (a === 'error') return { signals: [{ ...base, level: 'unknown', text: "Official NWS alerts couldn't be loaded. Check weather.gov." }], pending: false }
  const rows = shownAlerts(a, now)
  const flood = rows.filter((row) => row.active && row.floodRelevance === 'flood_hazard_notice')
  const upcoming = rows.filter((row) => row.hazardTiming === 'upcoming' && row.floodRelevance === 'flood_hazard_notice')
  const others = rows.filter((row) => row.active && row.floodRelevance !== 'flood_hazard_notice')
  if (!flood.length) {
    const extra = [
      upcoming.length ? `${upcoming.length} upcoming flood alert${upcoming.length === 1 ? '' : 's'}, not in effect yet` : '',
      others.length ? `${others.length} other weather alert${others.length === 1 ? '' : 's'}` : '',
    ].filter(Boolean).join('; ')
    const suffix = extra ? ` (${extra})` : ''
    return { signals: [{ ...base, level: 'quiet', text: `No NWS flood alerts in effect at this spot${suffix}.` }], pending: false }
  }
  return {
    pending: false,
    signals: flood.slice(0, 3).map((row) => {
      const until = row.alert.ends || row.alert.expires
      const when = until ? ` until ${new Date(until).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''
      const level: OutlookLevel = /warning/i.test(row.alert.event) ? 'warning' : /watch/i.test(row.alert.event) ? 'watch' : 'elevated'
      return { ...base, level, text: `${row.alert.event} in effect${when}.` }
    }),
  }
}

/** "about one every 2 months", from a count over a number of years. */
export function rateText(total: number, years: number): string {
  if (total <= 0) return 'none recorded'
  const perYear = total / years
  if (perYear >= 18) return `about ${Math.round(perYear / 12)} a month`
  const months = 12 / perYear
  if (months < 1.5) return 'about one a month'
  if (perYear >= 1.5) return `about one every ${Math.round(months)} months`
  if (perYear >= 0.75) return 'about one a year'
  return `about one every ${Math.round(1 / perYear)} years`
}

function since(last: string, now: Date): string {
  const days = Math.floor((now.getTime() - utc(last).getTime()) / 864e5)
  if (days < 1) return 'today'
  if (days < 45) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.round(days / 30.44)
  if (months < 24) return `${months} months ago`
  return `${Math.floor(days / 365.25)} years ago`
}

/** The three-month run (wrapping round the year) that most floods began in. */
export function floodSeason(months: readonly number[]): { start: number; sharePercent: number } | null {
  const total = months.reduce((a, b) => a + b, 0)
  if (months.length !== 12 || total < 8) return null
  let best = { start: 0, n: -1 }
  for (let s = 0; s < 12; s++) {
    const n = months[s] + months[(s + 1) % 12] + months[(s + 2) % 12]
    if (n > best.n) best = { start: s, n }
  }
  const sharePercent = Math.round((best.n / total) * 100)
  // Three months of twelve hold a quarter of floods with no season at all.
  return sharePercent >= 35 ? { start: best.start, sharePercent } : null
}

/** "May–Jul 2026", or "Nov 2026–Jan 2027" across the new year. */
function windowLabel(start: number, year: number): string {
  const end = (start + 2) % 12
  const endYear = start + 2 >= 12 ? year + 1 : year
  return endYear === year ? `${MONTHS[start]}–${MONTHS[end]} ${year}` : `${MONTHS[start]} ${year}–${MONTHS[end]} ${endYear}`
}

export function recurrenceOf(levels: readonly PlaceHistory[], now: Date): Recurrence | null {
  // How often: always the most local level, so a county with no floods is not given its state's rate.
  const local = levels[0]
  if (!local) return null
  const total = local.perYear.reduce((a, b) => a + b, 0)
  const years = local.perYear.length
  const period = `${local.firstYear}–${local.firstYear + years - 1}`
  // The season needs enough floods to mean anything: from the most local level that has them.
  const seasonal = levels.find((h) => h.months && floodSeason(h.months))
  const season = seasonal?.months ? floodSeason(seasonal.months) : null
  let nextWindow: string | null = null
  let isInSeason = false
  if (season) {
    const m = now.getMonth()
    const offset = (m - season.start + 12) % 12
    isInSeason = offset <= 2
    const startYear = isInSeason ? (m >= season.start ? now.getFullYear() : now.getFullYear() - 1)
      : (season.start > m ? now.getFullYear() : now.getFullYear() + 1)
    nextWindow = windowLabel(season.start, startYear)
  }
  return {
    place: local.name,
    period,
    total,
    yearsWithAny: local.perYear.filter((n) => n > 0).length,
    years,
    rate: rateText(total, years),
    last: local.last ? fmtDate(local.last) : null,
    sinceLast: local.last ? since(local.last, now) : null,
    season: season && seasonal ? {
      months: `${MONTHS[season.start]}–${MONTHS[(season.start + 2) % 12]}`, sharePercent: season.sharePercent, from: seasonal.name,
    } : null,
    nextWindow,
    isInSeason,
    unit: local.unit,
    source: local.source,
    url: local.url,
  }
}

const WORDS: Record<'rain' | 'river' | 'alert', string> = { rain: 'heavy rain', river: 'a high river', alert: 'a flood alert' }

export function buildOutlook(input: OutlookInput): FloodOutlook {
  const now = input.now ?? new Date()
  const rain = rainSignal(input.rain, input.rainHistory, now)
  const river = riverSignal(input.river, input.riverHistory, now)
  const alerts = alertSignals(input.alerts, now)
  const signals = [...alerts.signals, rain.signal, river.signal].filter((s): s is OutlookSignal => s != null)
  const notes = [alerts.note, river.note].filter((n): n is string => !!n)
  const pending = rain.pending || river.pending || alerts.pending || input.history === null
  const level = signals.reduce<OutlookLevel>((best, s) => (RANK[s.level] > RANK[best] ? s.level : best), 'unknown')
  const days = rain.days || 16
  const raised = [...new Set(signals.filter((s) => s.level === 'elevated').map((s) => WORDS[s.kind]))]
  const headline = pending && level !== 'warning' && level !== 'watch' ? 'Checking the forecasts and alerts…'
    : level === 'warning' ? 'An official flood warning is in effect here. Follow your local officials.'
    : level === 'watch' ? 'A flood watch is in effect: flooding is possible here.'
    : level === 'elevated' ? `Forecasts show ${raised.join(' and ')}: flooding is possible in the next ${days} days.`
    : level === 'quiet' ? `Nothing in the next ${days} days of forecasts${input.alerts === 'unsupported' ? '' : ' or alerts'} points to flooding here. That is not a guarantee.`
    : "The forecasts couldn't be checked right now."
  return {
    level,
    headline,
    signals,
    days,
    recurrence: input.history ? recurrenceOf(input.history, now) : null,
    isPending: pending,
    isComplete: !pending && !signals.some((s) => s.level === 'unknown'),
    notes,
  }
}

/** The figures an AI summary may use: the outlook as plain text fields, nothing else. */
export function summaryFacts(place: string, o: FloodOutlook, now = new Date()) {
  const r = o.recurrence
  return {
    place,
    checked_on: fmtDate(now.toISOString().slice(0, 10)),
    next_days: {
      days_checked: o.days,
      overall: o.level,
      headline: o.headline,
      signals: o.signals.map((s) => s.text),
      notes: o.notes,
    },
    flood_record: r ? {
      area: r.place,
      period: r.period,
      floods: r.total,
      counts: r.unit,
      how_often: r.rate,
      years_with_a_flood: `${r.yearsWithAny} of ${r.years}`,
      last_flood_began: r.last,
      last_flood_was: r.sinceLast,
      busiest_season: r.season ? `${r.season.months} (${r.season.sharePercent}% of past floods in ${r.season.from} began then)` : 'no clear season',
      next_busy_season: r.nextWindow,
      in_busy_season_now: r.isInSeason,
      note: 'A pattern from past floods, not a forecast.',
    } : null,
  }
}

const NUMBER = /\d[\d,]*(?:\.\d+)?/g
const numbers = (text: string) => (text.match(NUMBER) ?? []).map((n) => String(Number(n.replace(/,/g, '').replace(/\.$/, ''))))

// All-clear wording no outlook can back: a quiet forecast is not a guarantee.
const ALL_CLEAR = /\b(?:is|are|be|stay|remain)s? safe\b|\bno flood(?:ing|s)? (?:is |are )?expected\b|\b(?:will not|won't|will never) flood\b|\bno (?:chance|risk) of flood/i

/** True when an AI summary gives no all-clear the figures cannot support. */
export const isCautious = (summary: string) => !ALL_CLEAR.test(summary)

/** True when every number in an AI summary appears in the facts it was given. */
export function isGrounded(summary: string, facts: unknown): boolean {
  const allowed = new Set(numbers(JSON.stringify(facts)))
  return numbers(summary).every((n) => allowed.has(n))
}
