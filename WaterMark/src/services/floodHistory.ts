// Flood history per country, US state and US county: static files built by `npm run data:floods`
// (scripts/floods/build.py) from GDACS and the NOAA Storm Events Database. The world and state
// files load once; a country's provinces and a state's counties load the first time it is opened.
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import { getJSON } from './http'
import { markFetched } from '../scripting/freshness'
import type { RegionLevel, RegionProps } from '../scripting/types'
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

export interface CellMeta { size: number; breaks: number[]; years: [number, number]; source: string; url: string; unit: string }

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
      return { size: c.size, breaks: c.breaks, years: [Number(c.years[0]), Number(c.years[1])], source: String(c.source ?? ''), url: String(c.url ?? ''), unit: String(c.unit ?? '') }
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
function file(path: string, source: 'gdacs-history' | 'noaa-storm-events'): Promise<RegionCollection> {
  let job = files.get(path)
  if (!job) {
    job = getJSON<unknown>(`${BASE}/${path}`, { timeoutMs: 30_000 }).then((j) => { markFetched(source); return validate(j) })
    files.set(path, job)
    job.catch(() => files.delete(path))
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
