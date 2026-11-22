// Worldwide point data from Open-Meteo (keyless, CORS-enabled), for any spot on Earth:
//   rain outlook     past 30 days and next 16, daily (forecast API; past days are model analysis)
//   river outlook    past 60 days and next 3 months of GloFAS v4 river discharge, with the ensemble spread
//   rain history     every day since 1991 from the ERA5 reanalysis (historical weather API)
//   river history    every day since 1984 of GloFAS reanalysis discharge (flood API)
//   elevation        ground height from the Copernicus 90 m elevation model
// Answers go through the shared cache: outlooks for 10 minutes, history and elevation for the visit.
import { ENDPOINTS } from './endpoints'
import { getJSON } from './http'
import { MINUTE, pointKey, shared } from './shared'
import { markFetched } from '../scripting/freshness'
import type { DailySeries } from '../scripting/climate'
import type { LngLat, RainOutlook, RiverOutlook } from '../scripting/types'

const LIVE_TTL = 10 * MINUTE
const VISIT_TTL = 24 * 60 * MINUTE
const RAIN_HISTORY_FROM = '1991-01-01'
const RIVER_HISTORY_FROM = '1984-01-01'

const isNumList = (v: unknown): v is (number | null)[] => Array.isArray(v) && v.every((x) => x === null || typeof x === 'number')
const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')
const ll = ([lon, lat]: LngLat) => ({ latitude: lat.toFixed(4), longitude: lon.toFixed(4) })
const isoDay = (d: Date) => d.toISOString().slice(0, 10)

function daily(j: { daily?: Record<string, unknown> }, key: string): DailySeries {
  const d = j.daily
  if (!d || !isStrList(d.time) || !isNumList(d[key])) throw new Error('Open-Meteo returned an unexpected response.')
  return { time: d.time, values: d[key] }
}

export function fetchRainOutlook(center: LngLat, signal: AbortSignal): Promise<RainOutlook> {
  return shared(`rain-outlook:${pointKey(center)}`, LIVE_TTL, async () => {
    const q = new URLSearchParams({
      ...ll(center), past_days: '30', forecast_days: '16', timezone: 'auto',
      daily: 'precipitation_sum,precipitation_probability_max',
    })
    const j = await getJSON<{ daily?: Record<string, unknown>; timezone?: unknown }>(`${ENDPOINTS.forecast}?${q}`)
    const rain = daily(j, 'precipitation_sum')
    const prob = j.daily && isNumList(j.daily.precipitation_probability_max) ? j.daily.precipitation_probability_max : rain.time.map(() => null)
    markFetched('rain')
    return { time: rain.time, mm: rain.values.map((v) => v ?? 0), probability: prob, timezone: typeof j.timezone === 'string' ? j.timezone : 'UTC' }
  }, signal)
}

export function fetchRiverOutlook(center: LngLat, signal: AbortSignal): Promise<RiverOutlook> {
  return shared(`river-outlook:${pointKey(center)}`, LIVE_TTL, async () => {
    const q = new URLSearchParams({
      ...ll(center), past_days: '60', forecast_days: '92',
      daily: 'river_discharge,river_discharge_median,river_discharge_p25,river_discharge_p75,river_discharge_min,river_discharge_max',
    })
    const j = await getJSON<{ daily?: Record<string, unknown> }>(`${ENDPOINTS.flood}?${q}`)
    const flow = daily(j, 'river_discharge')
    const d = j.daily ?? {}
    const band = (k: string) => (isNumList(d[k]) ? d[k] : flow.time.map(() => null))
    markFetched('river')
    return {
      time: flow.time, flow: flow.values, median: band('river_discharge_median'),
      p25: band('river_discharge_p25'), p75: band('river_discharge_p75'), min: band('river_discharge_min'), max: band('river_discharge_max'),
    }
  }, signal)
}

export function fetchRainHistory(center: LngLat, signal: AbortSignal): Promise<DailySeries> {
  return shared(`rain-history:${pointKey(center)}`, VISIT_TTL, async () => {
    // ERA5 is final about five days behind; stop at the end of the last complete year.
    const end = `${new Date().getFullYear() - 1}-12-31`
    const q = new URLSearchParams({ ...ll(center), start_date: RAIN_HISTORY_FROM, end_date: end, daily: 'precipitation_sum', timezone: 'auto' })
    const series = daily(await getJSON(`${ENDPOINTS.rainArchive}?${q}`, { timeoutMs: 30_000 }), 'precipitation_sum')
    markFetched('rain-history')
    return series
  }, signal)
}

export function fetchRiverHistory(center: LngLat, signal: AbortSignal): Promise<DailySeries> {
  return shared(`river-history:${pointKey(center)}`, VISIT_TTL, async () => {
    const end = isoDay(new Date(Date.now() - 2 * 864e5))
    const q = new URLSearchParams({ ...ll(center), start_date: RIVER_HISTORY_FROM, end_date: end, daily: 'river_discharge' })
    const series = daily(await getJSON(`${ENDPOINTS.flood}?${q}`, { timeoutMs: 30_000 }), 'river_discharge')
    markFetched('river')
    return series
  }, signal)
}

export function fetchElevation([lon, lat]: LngLat, signal: AbortSignal): Promise<number | null> {
  return fetchElevations([[lon, lat]], signal).then((rows) => rows[0] ?? null)
}

/** Ground height for many points in one Copernicus DEM request. Null where the model has no value. */
export function fetchElevations(points: readonly LngLat[], signal: AbortSignal): Promise<(number | null)[]> {
  const key = points.map((p) => pointKey(p)).join(';')
  return shared(`elevations:${key}`, VISIT_TTL, async () => {
    const q = new URLSearchParams({
      latitude: points.map(([, lat]) => lat.toFixed(4)).join(','),
      longitude: points.map(([lon]) => lon.toFixed(4)).join(','),
    })
    const j = await getJSON<{ elevation?: unknown }>(`${ENDPOINTS.elevation}?${q}`)
    if (!Array.isArray(j.elevation) || j.elevation.length !== points.length) throw new Error('Open-Meteo returned an unexpected elevation response.')
    markFetched('elevation')
    return j.elevation.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null))
  }, signal)
}

/**
 * Coordinate of the nearest GloFAS river-model cell (about 5 km). This is the cell the flood API
 * returned, not a surveyed channel or a shoreline.
 */
export function fetchNearestRiverCell(center: LngLat, signal: AbortSignal): Promise<{ lat: number; lon: number } | null> {
  return shared(`river-cell:${pointKey(center)}`, VISIT_TTL, async () => {
    const q = new URLSearchParams({ ...ll(center), forecast_days: '1', daily: 'river_discharge' })
    const j = await getJSON<{ latitude?: unknown; longitude?: unknown }>(`${ENDPOINTS.flood}?${q}`)
    markFetched('river')
    if (typeof j.latitude !== 'number' || typeof j.longitude !== 'number') return null
    if (!Number.isFinite(j.latitude) || !Number.isFinite(j.longitude)) return null
    return { lat: j.latitude, lon: j.longitude }
  }, signal)
}
