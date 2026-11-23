// Flood history per country, US state and US county: static files built by `npm run data:floods`
// (scripts/floods/build.py) from GDACS and the NOAA Storm Events Database. The world and state
// files load once; a country's provinces and a state's counties load the first time it is opened.
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { getJSON } from './http'
import { markFetched } from '../scripting/freshness'
import type { LngLat, RegionLevel, RegionPick, RegionProps } from '../scripting/types'
import { parseGrid, type Grid, type GridKind } from '../scripting/cells'

const BASE = '/data/floods'

export type RegionCollection = FeatureCollection<Polygon | MultiPolygon, RegionProps>

export interface LevelMeta {
  source: string
  url: string
  years: [number, number]
  unit: string
  /** Five class breaks over the non-zero yearly averages; zero is its own class. */
  breaks: number[]
}

export interface CellMeta {
  size: number
  /** Color classes for all years together, and for one year on the time slider (one scale for every year). */
  breaks: number[]
  yearBreaks: number[]
  years: [number, number]
  source: string
  url: string
  unit: string
}

export interface FloodHistoryIndex {
  builtAt: string
  cells: Record<GridKind, CellMeta>
  country: LevelMeta
  admin1: LevelMeta
  state: LevelMeta
  county: LevelMeta
}

const isBreaks = (v: unknown): v is number[] => Array.isArray(v) && v.length === 5 && v.every((x) => typeof x === 'number')

function level(raw: unknown, breaks: unknown): LevelMeta {
  const r = raw as Partial<LevelMeta> | undefined
  if (!r || typeof r.source !== 'string' || !Array.isArray(r.years) || !isBreaks(breaks)) {
    throw new Error('Flood history index is malformed.')
  }
  return { source: r.source, url: String(r.url ?? ''), years: [Number(r.years[0]), Number(r.years[1])], unit: String(r.unit ?? ''), breaks }
}

let indexJob: Promise<FloodHistoryIndex> | null = null
export function loadFloodIndex(): Promise<FloodHistoryIndex> {
  indexJob ??= getJSON<Record<string, unknown>>(`${BASE}/index.json`).then((j) => {
    const countries = j.countries as { breaks?: unknown } | undefined
    const states = j.states as { breaks?: unknown; countyBreaks?: unknown } | undefined
    const admin1 = j.admin1 as { breaks?: unknown } | undefined
    const cells = j.cells as Record<string, Partial<CellMeta>> | undefined
    const cell = (k: GridKind): CellMeta => {
      const c = cells?.[k]
      if (!c || typeof c.size !== 'number' || !isBreaks(c.breaks) || !Array.isArray(c.years)) throw new Error('Flood index has no grid.')
      return { size: c.size, breaks: c.breaks, yearBreaks: isBreaks(c.yearBreaks) ? c.yearBreaks : c.breaks, years: [Number(c.years[0]), Number(c.years[1])], source: String(c.source ?? ''), url: String(c.url ?? ''), unit: String(c.unit ?? '') }
    }
    return {
      builtAt: String(j.builtAt ?? ''),
      cells: { us: cell('us'), world: cell('world') },
      country: level(countries, countries?.breaks),
      admin1: level(admin1, admin1?.breaks),
      state: level(states, states?.breaks),
      county: level(states, states?.countyBreaks),
    }
  })
  indexJob.catch(() => { indexJob = null })
  return indexJob
}

function validate(j: unknown): RegionCollection {
  const fc = j as Partial<RegionCollection>
  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) throw new Error('Flood history file is malformed.')
  const features = fc.features.filter((f) => {
    const p = f?.properties as Partial<RegionProps> | undefined
    return p && typeof p.k === 'string' && typeof p.py === 'number' && Array.isArray(p.b) && p.b.length === 4
  })
  return { type: 'FeatureCollection', features }
}

const files = new Map<string, Promise<RegionCollection>>()
/** Files that have arrived, for answers that cannot wait (regionChainNow); and ones that failed this visit. */
const settled = new Map<string, RegionCollection>()
const failed = new Set<string>()
function file(path: string, source: 'gdacs-history' | 'noaa-storm-events'): Promise<RegionCollection> {
  let job = files.get(path)
  if (!job) {
    job = getJSON<unknown>(`${BASE}/${path}`, { timeoutMs: 30_000 }).then((j) => { markFetched(source); return validate(j) })
    files.set(path, job)
    job.then((fc) => { settled.set(path, fc); failed.delete(path) }, () => { files.delete(path); failed.add(path) })
  }
  return job
}

export const loadCountries = () => file('countries.json', 'gdacs-history')
export const loadStates = () => file('us-states.json', 'noaa-storm-events')
/** The counties of one state; `stateFips` is the two-digit code the state features carry as `k`. */
export function loadCounties(stateFips: string): Promise<RegionCollection> {
  if (!/^\d{2}$/.test(stateFips)) return Promise.reject(new Error(`Not a state FIPS code: ${stateFips}`))
  return file(`counties/${stateFips}.json`, 'noaa-storm-events')
}

/** The provinces, regions or departments of one country; `iso3` is the country's `k`. */
export function loadAdmin1(iso3: string): Promise<RegionCollection> {
  if (!/^[A-Z0-9]{3}$/.test(iso3)) return Promise.reject(new Error(`Not a country code: ${iso3}`))
  return file(`admin1/${iso3}.json`, 'gdacs-history')
}

export const LEVEL_NAMES: Record<RegionLevel, string> = {
  country: 'Countries', admin1: 'Provinces and regions', state: 'US states', county: 'Counties',
}

const gridJobs = new Map<GridKind, Promise<Grid>>()
/** One flood grid (US or world), parsed once per visit. */
export function loadGrid(kind: GridKind): Promise<Grid> {
  let job = gridJobs.get(kind)
  if (!job) {
    job = getJSON<unknown>(`${BASE}/cells-${kind}.json`).then((raw) => {
      markFetched(kind === 'us' ? 'noaa-storm-events' : 'gdacs-history')
      return parseGrid(raw, kind)
    })
    gridJobs.set(kind, job)
    job.catch(() => gridJobs.delete(kind))
  }
  return job
}

/** The region of a collection that contains a point, or null. */
export function regionAt(fc: RegionCollection | null, [x, y]: LngLat): RegionProps | null {
  if (!fc) return null
  for (const f of fc.features) {
    const [w, s, e, n] = f.properties.b
    // Boxes of shapes across the antimeridian are stored with e < w.
    const inBox = y >= s && y <= n && (w <= e ? x >= w && x <= e : x >= w || x <= e)
    if (inBox && booleanPointInPolygon([x, y], f.geometry)) return f.properties
  }
  return null
}

/**
 * The regions at a point, outermost first: its country, then its state and county in the US or its
 * province elsewhere, from the files already loaded, so it answers at once. When a deeper level's
 * file is not loaded yet, `missing` is that file loading (started here); ask again once it settles.
 * A level with no region at the point ends the chain.
 */
export function regionChainNow(at: LngLat): { chain: RegionPick[]; missing: Promise<unknown> | null } {
  const chain: RegionPick[] = []
  const need = (path: string, load: () => Promise<RegionCollection>) => {
    const fc = settled.get(path)
    return fc ? { fc, missing: null } : { fc: null, missing: load().catch(() => null) }
  }
  const countries = need('countries.json', loadCountries)
  if (!countries.fc) return { chain, missing: countries.missing }
  const country = regionAt(countries.fc, at)
  if (!country) return { chain, missing: null }
  chain.push({ level: 'country', props: country })
  if (country.k === 'USA') {
    const states = need('us-states.json', loadStates)
    if (!states.fc) return { chain, missing: states.missing }
    const state = regionAt(states.fc, at)
    if (!state) return { chain, missing: null }
    chain.push({ level: 'state', props: state })
    if (failed.has(`counties/${state.k}.json`)) return { chain, missing: null }
    const counties = need(`counties/${state.k}.json`, () => loadCounties(state.k))
    if (!counties.fc) return { chain, missing: counties.missing }
    const county = regionAt(counties.fc, at)
    if (county) chain.push({ level: 'county', props: county })
  } else if (!failed.has(`admin1/${country.k}.json`)) {
    const provinces = need(`admin1/${country.k}.json`, () => loadAdmin1(country.k))
    if (!provinces.fc) return { chain, missing: provinces.missing }
    const province = regionAt(provinces.fc, at)
    if (province) chain.push({ level: 'admin1', props: province })
  }
  return { chain, missing: null }
}
