// The flood assistant's tools, run in the browser with the same typed services the map uses. The
// model only asks for them (by name, with arguments checked here); each returns a small object
// with the figures, where they come from and their limits, which goes back to the model as the
// only data it may quote. Tool declarations live with the server (supabase/functions/assistant/core.mts).
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { searchPlaces } from '../geocoding/photon'
import { loadAdmin1, loadCountries, loadCounties, loadFloodIndex, loadGrid, loadStates, type RegionCollection } from '../floodHistory'
import { fetchRainHistory, fetchRainOutlook, fetchRiverHistory, fetchRiverOutlook } from '../openMeteo'
import { fetchAlerts } from '../pointLookups'
import { fetchGlobalFloods } from '../gdacs'
import { busiestMonths, rainByYear, seasonalMedian, todayIndex } from '../../scripting/climate'
import { cellAt, cellWidthKm } from '../../scripting/cells'
import { causeRows } from '../../scripting/causes'
import { distanceKm } from '../../scripting/geo'
import { mayBeUS } from '../../scripting/region'
import type { FunctionCall } from '../../scripting/assistant'
import type { LngLat, RegionProps } from '../../scripting/types'

export interface ToolContext {
  signal: AbortSignal
  /** Flies the map to a point and selects it. */
  showOnMap: (at: LngLat, label: string) => void
}

type Result = Record<string, unknown>

const MM_PER_IN = 25.4
const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d
const rain = (mm: number) => ({ mm: round(mm), inches: round(mm / MM_PER_IN, 2) })
const sum = (xs?: readonly (number | null)[]) => (xs ?? []).reduce<number>((a, b) => a + (b ?? 0), 0)

function point(args: Record<string, unknown> | undefined): LngLat {
  const lat = Number(args?.lat), lon = Number(args?.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new Error('lat and lon must be valid coordinates')
  }
  return [lon, lat]
}

function regionAt(fc: RegionCollection | null, [x, y]: LngLat): RegionProps | null {
  if (!fc) return null
  for (const f of fc.features) {
    const [w, s, e, n] = f.properties.b
    // Boxes of shapes across the antimeridian are stored with e < w.
    const inBox = y >= s && y <= n && (w <= e ? x >= w && x <= e : x >= w || x <= e)
    if (inBox && booleanPointInPolygon([x, y], f.geometry)) return f.properties
  }
  return null
}

/** A region's record in plain fields: totals, worst years and harm, never per-year fractions. */
function record(p: RegionProps, firstYear: number, unit: string) {
  const years = p.y.map((count, i) => ({ year: firstYear + i, count }))
  const out: Result = {
    name: p.n,
    total: p.e,
    unit,
    period: `${firstYear}–${firstYear + p.y.length - 1}`,
    years_with_any: years.filter((y) => y.count > 0).length,
    years_in_period: years.length,
    worst_years: years.filter((y) => y.count > 0).sort((a, b) => b.count - a.count || b.year - a.year).slice(0, 3),
    by_year: Object.fromEntries(years.map((y) => [y.year, y.count])),
  }
  const months = busiestMonths(p.m)
  if (months) out.busiest_months = months
  if (p.d) out.deaths = sum(p.d)
  if (p.i) out.injuries = sum(p.i)
  if (p.$) out.damage_usd_property_and_crops = sum(p.$)
  if (p.x) out.serious_floods_orange_or_red_alert = sum(p.x)
  if (p.g) out.largest_flood_magnitude = p.g
  const causes = causeRows(p.c)
  if (causes.length) out.causes = { counts: causes.map((c) => ({ cause: c.label, floods: c.count })), note: 'A flood with more than one cause counts under each.' }
  return out
}

async function floodRecord(at: LngLat): Promise<Result> {
  const [index, countries] = await Promise.all([loadFloodIndex(), loadCountries()])
  const country = regionAt(countries, at)
  const out: Result = { point: { lat: at[1], lon: at[0] } }
  const gdacs = { source: index.country.source, url: index.country.url }
  if (country) out.country = { ...record(country, index.country.years[0], 'flood events (GDACS)'), ...gdacs }
  else out.country = null
  const isUS = country?.k === 'USA'
  if (isUS) {
    const state = regionAt(await loadStates(), at)
    const noaa = { source: index.state.source, url: index.state.url }
    if (state) {
      out.us_state = { ...record(state, index.state.years[0], 'flood episodes (NOAA: one weather system flooding the state, counted once)'), ...noaa }
      const county = regionAt(await loadCounties(state.k).catch(() => null), at)
      if (county) out.us_county = { ...record(county, index.state.years[0], 'flood episodes (NOAA) that touched the county'), ...noaa }
    }
  } else if (country) {
    const province = regionAt(await loadAdmin1(country.k).catch(() => null), at)
    if (province) out.province = { ...record(province, index.admin1.years[0], 'flood events whose GDACS point is in the province'), ...gdacs }
  }
  const grid = await loadGrid(isUS ? 'us' : 'world')
  const cell = cellAt(at, grid)
  const meta = index.cells[grid.kind]
  out.grid_square = {
    size_degrees: grid.size,
    about_km_across: Math.round(cellWidthKm(cell.bounds)),
    count: cell.e,
    years_with_any: cell.n,
    period: `${meta.years[0]}–${meta.years[1]}`,
    ...(cell.e ? { worst_year: cell.wy, worst_year_count: cell.wn } : {}),
    ...(isUS ? { deaths: cell.a, damage_usd: cell.b, causes: causeRows(cell.causes).map((c) => ({ cause: c.label, floods: c.count })) }
      : { serious_floods: cell.a, largest_magnitude: cell.b, causes: 'not recorded by GDACS' }),
    counts: meta.unit,
    source: meta.source,
  }
  out.limits = [
    'Historical counts describe the past, not today.',
    'GDACS lists floods large enough for international notice and recorded about three times as many a year from 2019 on.',
    'NOAA figures start in 2016 here; a US flood is one NOAA episode (a weather system), counted once per area; damage is as estimated in the reports, not inflation-adjusted.',
    'Causes come from NOAA (US only); GDACS does not record them.',
    'Zero recorded is not the same as no risk.',
  ]
  return out
}

async function rainForecast(at: LngLat, signal: AbortSignal): Promise<Result> {
  const r = await fetchRainOutlook(at, signal)
  const t = todayIndex(r.time)
  if (t < 0) return { ok: false, error: 'The forecast did not include today.' }
  const next = (n: number) => sum(r.mm.slice(t, t + n))
  const days = r.time.slice(t, t + 7).map((day, i) => ({ day, ...rain(r.mm[t + i] ?? 0), chance_percent: r.probability[t + i] }))
  const wettest = r.time.slice(t).reduce((best, day, i) => ((r.mm[t + i] ?? 0) > best.mm ? { day, mm: r.mm[t + i] ?? 0 } : best), { day: '', mm: -1 })
  return {
    kind: 'forecast (weather models), not an official warning',
    timezone: r.timezone,
    past_30_days_total: rain(sum(r.mm.slice(Math.max(0, t - 30), t))),
    next_7_days_total: rain(next(7)),
    next_16_days_total: rain(next(16)),
    next_7_days: days,
    wettest_forecast_day: wettest.day ? { day: wettest.day, ...rain(wettest.mm) } : null,
    fetched_at: new Date().toISOString(),
    source: 'Open-Meteo forecast API (best-match weather models)',
    url: 'https://open-meteo.com/',
  }
}

async function rainHistory(at: LngLat, signal: AbortSignal): Promise<Result> {
  const s = await fetchRainHistory(at, signal)
  const r = rainByYear(s, 50)
  return {
    kind: 'historical reanalysis (modeled from observations, about 25 km grid)',
    period: `${s.time[0]?.slice(0, 4)}–${s.time.at(-1)?.slice(0, 4)}`,
    wettest_day: r.wettest ? { day: r.wettest.day, ...rain(r.wettest.mm) } : null,
    days_with_50mm_or_more_total: sum(r.heavyDays.map((d) => d.value)),
    heaviest_day_each_recent_year: r.maxDay.slice(-10).map((d) => ({ year: d.year, ...rain(d.value) })),
    source: 'ERA5 reanalysis via the Open-Meteo historical weather API',
    url: 'https://open-meteo.com/en/docs/historical-weather-api',
  }
}

async function riverForecast(at: LngLat, signal: AbortSignal): Promise<Result> {
  const [r, history] = await Promise.all([fetchRiverOutlook(at, signal), fetchRiverHistory(at, signal).catch(() => null)])
  const t = todayIndex(r.time)
  const now = t >= 0 ? r.flow[t] : null
  if (now == null || !r.flow.some((f) => (f ?? 0) > 0)) {
    return { ok: false, error: 'No modeled river near this point (GloFAS covers larger rivers only).' }
  }
  let peak = { day: '', flow: -1 }
  for (let i = t; i < Math.min(r.time.length, t + 30); i++) {
    const f = r.flow[i]
    if (f != null && f > peak.flow) peak = { day: r.time[i], flow: f }
  }
  const typical = history ? seasonalMedian(r.time[t], history) : null
  return {
    kind: 'modeled river discharge (forecast), not flood depth and not street or coastal flooding',
    unit: 'm³/s',
    today: round(now),
    typical_for_this_time_of_year: typical != null ? round(typical) : null,
    highest_next_30_days: peak.day ? { day: peak.day, flow: round(peak.flow) } : null,
    source: 'GloFAS v4 (Copernicus) via the Open-Meteo flood API, nearest river cell (about 5 km)',
    url: 'https://open-meteo.com/en/docs/flood-api',
  }
}

async function weatherAlerts(at: LngLat, signal: AbortSignal): Promise<Result> {
  if (!mayBeUS(at)) {
    return { covered: false, note: 'The NWS covers the US only. Check the national weather service for this country.' }
  }
  const alerts = await fetchAlerts(at, signal)
  return {
    covered: true,
    count: alerts.length,
    alerts: alerts.slice(0, 8).map((a) => ({
      event: a.event,
      headline: a.headline ?? null,
      instruction: a.instruction ? a.instruction.slice(0, 500) : null,
      ends: a.ends ?? a.expires ?? null,
    })),
    note: 'No alerts in effect does not mean there is no flood risk.',
    checked_at: new Date().toISOString(),
    source: 'US National Weather Service, api.weather.gov',
    url: 'https://www.weather.gov/',
  }
}

async function currentFloods(args: Record<string, unknown> | undefined, signal: AbortSignal): Promise<Result> {
  const fc = await fetchGlobalFloods(signal)
  let near: LngLat | null = null
  try { near = args && args.lat != null ? point(args) : null } catch { near = null }
  const list = fc.features.map((f) => {
    const [lon, lat] = f.geometry.coordinates as [number, number]
    return {
      name: f.properties.name,
      alert_level: f.properties.alertlevel,
      still_active: f.properties.active,
      from: f.properties.fromdate,
      to: f.properties.todate,
      lat: round(lat, 2),
      lon: round(lon, 2),
      distance_km: near ? Math.round(distanceKm(near, [lon, lat])) : undefined,
      report: f.properties.report,
    }
  })
  list.sort((a, b) => (near ? (a.distance_km ?? 0) - (b.distance_km ?? 0) : Number(b.still_active) - Number(a.still_active)))
  return {
    total_past_30_days: list.length,
    active_now: list.filter((f) => f.still_active).length,
    floods: list.slice(0, 10),
    note: 'GDACS lists floods large enough for international notice; local flooding is often missing.',
    source: 'GDACS (UN and European Commission JRC)',
    url: 'https://www.gdacs.org/',
  }
}

const MEASURE_FIELD = { floods: 'y', serious_floods: 'x', deaths: 'd', damage: '$' } as const

async function topRegions(args: Record<string, unknown> | undefined): Promise<Result> {
  const level = args?.level === 'us_state' ? 'us_state' : 'country'
  const measure = String(args?.measure ?? 'floods') as keyof typeof MEASURE_FIELD
  if (!(measure in MEASURE_FIELD)) return { ok: false, error: 'Unknown measure.' }
  if (level === 'country' && (measure === 'deaths' || measure === 'damage')) {
    return { ok: false, error: 'Deaths and damage are only available for US states (GDACS lists do not include them).' }
  }
  if (level === 'us_state' && measure === 'serious_floods') return { ok: false, error: 'Serious-flood alerts are for countries only.' }
  const index = await loadFloodIndex()
  const meta = level === 'country' ? index.country : index.state
  const fc = level === 'country' ? await loadCountries() : await loadStates()
  const year = Number(args?.year)
  const yi = Number.isInteger(year) ? year - meta.years[0] : -1
  if (Number.isInteger(year) && (yi < 0 || year > meta.years[1])) return { ok: false, error: `Years available: ${meta.years[0]}–${meta.years[1]}.` }
  const limit = Math.min(15, Math.max(1, Number(args?.limit) || 10))
  const field = MEASURE_FIELD[measure]
  const ranked = fc.features
    .map((f) => {
      const series = f.properties[field] ?? []
      return { name: f.properties.n, value: yi >= 0 ? series[yi] ?? 0 : sum(series) }
    })
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
  return {
    measure: { floods: level === 'country' ? 'flood events' : 'flood episodes', serious_floods: 'floods with an orange or red GDACS alert', deaths: 'deaths in flood reports', damage: 'property and crop damage, USD, not inflation-adjusted' }[measure],
    period: yi >= 0 ? String(year) : `${meta.years[0]}–${meta.years[1]}`,
    ranking: ranked,
    note: level === 'country'
      ? 'GDACS lists floods large enough for international notice; big countries collect more events.'
      : 'NOAA counts one report per county or zone an event touched, so large states collect more.',
    source: meta.source,
    url: meta.url,
  }
}

/** Runs one tool call; failures come back as { ok: false, error } so the model can say so. */
export async function runTool(call: FunctionCall, ctx: ToolContext): Promise<Result> {
  try {
    const a = call.args
    switch (call.name) {
      case 'find_place': {
        const query = String(a?.query ?? '').trim().slice(0, 120)
        if (query.length < 2) return { ok: false, error: 'Empty place name.' }
        const found = await searchPlaces(query, ctx.signal, { limit: 3 })
        return {
          matches: found.map((p) => ({ name: p.label, where: p.detail, kind: p.kind, lat: round(p.lat, 4), lon: round(p.lon, 4), country_code: p.countryCode ?? null })),
          source: 'Photon geocoder (OpenStreetMap data)',
        }
      }
      case 'flood_record': return await floodRecord(point(a))
      case 'rain_forecast': return await rainForecast(point(a), ctx.signal)
      case 'rain_history': return await rainHistory(point(a), ctx.signal)
      case 'river_forecast': return await riverForecast(point(a), ctx.signal)
      case 'weather_alerts': return await weatherAlerts(point(a), ctx.signal)
      case 'current_floods': return await currentFloods(a, ctx.signal)
      case 'top_regions': return await topRegions(a)
      case 'show_on_map': {
        ctx.showOnMap(point(a), String(a?.label ?? 'Place').slice(0, 80))
        return { ok: true, shown: true }
      }
      default: return { ok: false, error: `Unknown tool ${call.name}.` }
    }
  } catch (e) {
    if (ctx.signal.aborted) throw e
    return { ok: false, error: e instanceof Error ? e.message : 'The data source did not answer.' }
  }
}
