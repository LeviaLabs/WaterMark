// Display formatting. Pure functions, covered by test/format.test.ts.
// Lengths take the units to show; UNITS is the viewer's, read once from the browser language.
import { unitsForLocale, type Units } from './region'

export const UNITS: Units = unitsForLocale(typeof navigator === 'undefined' ? undefined : navigator.language)

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
const MM_PER_IN = 25.4
const n0 = (x: number) => Math.round(x).toLocaleString('en-US')

/** Circle radius: feet below half a mile, otherwise miles (metric: meters below 1 km, otherwise km). */
export function fmtRadius(km: number, units: Units = 'imperial'): string {
  if (units === 'metric') return km < 1 ? `${n0(km * 1000)} m` : `${km.toFixed(2)} km`
  const mi = km * KM_TO_MI
  return mi < 0.5 ? `${n0(mi * 5280)} ft` : `${mi.toFixed(2)} mi`
}

/** A distance between places, in miles or kilometers. */
export function fmtDistance(km: number, units: Units = 'imperial'): string {
  const x = units === 'metric' ? km : km * KM_TO_MI
  return `${x < 10 ? x.toFixed(1) : n0(x)} ${units === 'metric' ? 'km' : 'mi'}`
}

/** @deprecated Use fmtDistance. */
export const fmtMiles = (km: number) => fmtDistance(km, 'imperial')

/** Rainfall from millimeters: inches with two decimals, or millimeters with one. */
export function fmtRain(mm: number, units: Units = 'imperial'): string {
  return units === 'metric' ? `${mm.toFixed(1)} mm` : `${(mm / MM_PER_IN).toFixed(2)} in`
}

/** A water depth recorded in inches (FloodNet), shown in inches or centimeters. */
export function fmtDepthIn(inches: number, units: Units = 'imperial'): string {
  return units === 'metric' ? `${n0(inches * 2.54)} cm` : `${inches.toFixed(1)} in`
}

/** "Sat" for a YYYY-MM-DD date, read at local noon so time zones never shift the day. */
export function weekday(isoDay: string, style: 'short' | 'long' = 'short'): string {
  return new Date(`${isoDay}T12:00`).toLocaleDateString('en-US', { weekday: style })
}

/** Dollars in short form: "$840", "$12K", "$3.4M", "$1.2B". */
export function fmtUsd(usd: number): string {
  const a = Math.abs(usd)
  if (a >= 1e9) return `$${(usd / 1e9).toFixed(usd >= 1e10 ? 0 : 1)}B`
  if (a >= 1e6) return `$${(usd / 1e6).toFixed(usd >= 1e7 ? 0 : 1)}M`
  if (a >= 1e3) return `$${Math.round(usd / 1e3).toLocaleString('en-US')}K`
  return `$${Math.round(usd).toLocaleString('en-US')}`
}
