// Responder ranking. Order comes from mapped evidence that is actually present:
// an active official alert, an active GDACS flood, FloodNet events, then historical
// report counts. The sort key is never shown as a percent or a probability.
import type { CellProps, Grid } from '../cells'
import { cellAt, cellBounds } from '../cells'
import type { LngLat } from '../types'

export interface EvidenceItem { source: string; detail: string }

export interface RankedArea {
  id: string
  name: string
  bounds: [number, number, number, number]
  center: LngLat
  items: EvidenceItem[]
}

export interface AreaInput {
  id: string
  name: string
  bounds: [number, number, number, number]
  center: LngLat
  reports: number
  yearStart: number
  yearEnd: number
  sourceName: string
  sensorEvents: number
  sensorCount: number
  deepestIn: number | null
  activeFloods: number
  femaHighRisk: boolean | null
  stormDeepPct: number | null
  alertEvents: string[]
}

function score(area: AreaInput): number {
  let value = 0
  if (area.alertEvents.length) value += 1_000_000
  if (area.activeFloods) value += 500_000
  value += area.sensorEvents * 100
  value += area.reports
  if (area.femaHighRisk) value += 40
  if (area.stormDeepPct != null && area.stormDeepPct > 0) value += area.stormDeepPct
  return value
}

function itemsOf(area: AreaInput): EvidenceItem[] {
  const items: EvidenceItem[] = []
  if (area.alertEvents.length) items.push({ source: 'National Weather Service', detail: area.alertEvents.join('; ') })
  if (area.activeFloods) items.push({ source: 'GDACS', detail: `${area.activeFloods} active flood report${area.activeFloods === 1 ? '' : 's'} plotted in this square` })
  if (area.sensorCount) items.push({ source: 'FloodNet', detail: `${area.sensorCount} sensor${area.sensorCount === 1 ? '' : 's'}, ${area.sensorEvents} recorded flood${area.sensorEvents === 1 ? '' : 's'}${area.deepestIn != null ? `, deepest ${area.deepestIn} in` : ''}` })
  items.push({ source: area.sourceName, detail: `${area.reports} flood report${area.reports === 1 ? '' : 's'} with a point in this square, ${area.yearStart}–${area.yearEnd}` })
  if (area.femaHighRisk === true) items.push({ source: 'FEMA NFHL', detail: 'A high-risk zone was mapped at the selected spot in this square. Checked only for the spot you picked.' })
  if (area.stormDeepPct != null) items.push({ source: 'NYC Stormwater Flood Map', detail: `${area.stormDeepPct.toFixed(0)}% of the selected spot is in the deep-flooding scenario (1 ft or more). A scenario, not today.` })
  if (items.length === 1 && area.reports === 0) items[0] = { source: area.sourceName, detail: `No flood reports with a point in this square, ${area.yearStart}–${area.yearEnd}. No record is not an all-clear.` }
  return items
}

export function rankEvidence(areas: readonly AreaInput[], stagingPool: readonly AreaInput[]): { response: RankedArea[]; staging: RankedArea[] } {
  const ranked = [...areas].sort((a, b) => score(b) - score(a) || b.reports - a.reports || a.id.localeCompare(b.id))
  const response = ranked.slice(0, 5).map((area) => ({
    id: area.id, name: area.name, bounds: area.bounds, center: area.center, items: itemsOf(area),
  }))
  const used = new Set(response.map((area) => area.id))
  const staging = [...stagingPool]
    .filter((area) => !used.has(area.id) && area.alertEvents.length === 0 && area.activeFloods === 0)
    .sort((a, b) => a.reports - b.reports || a.sensorEvents - b.sensorEvents || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map((area) => ({
      id: area.id,
      name: area.name,
      bounds: area.bounds,
      center: area.center,
      items: [
        ...itemsOf(area),
        { source: 'WaterMark', detail: 'Fewer mapped records than the squares listed for response. That is not a clearance to stage people or vehicles here.' },
      ],
    }))
  return { response, staging }
}

export interface SensorHit { id: string; name: string; lon: number; lat: number; events: number; depthIn: number; last: string | null }
export interface FloodHit { lon: number; lat: number; active: boolean }

function contains(bounds: [number, number, number, number], lon: number, lat: number): boolean {
  const [w, s, e, n] = bounds
  return lon >= w && lon < e && lat >= s && lat < n
}

function nameOf(cell: CellProps): string {
  const [w, s, e, n] = cell.bounds
  const lat = (s + n) / 2
  const lon = (w + e) / 2
  return `Square near ${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`
}

export function areaFromCell(cell: CellProps, years: [number, number], sourceName: string, sensors: readonly SensorHit[], floods: readonly FloodHit[], extra?: Partial<Pick<AreaInput, 'femaHighRisk' | 'stormDeepPct' | 'alertEvents'>> | null): AreaInput {
  const [w, s, e, n] = cell.bounds
  const here = sensors.filter((sensor) => contains(cell.bounds, sensor.lon, sensor.lat))
  const active = floods.filter((flood) => flood.active && contains(cell.bounds, flood.lon, flood.lat))
  const deepest = here.reduce((max, sensor) => Math.max(max, sensor.depthIn), 0)
  return {
    id: cell.k,
    name: nameOf(cell),
    bounds: cell.bounds,
    center: [(w + e) / 2, (s + n) / 2],
    reports: cell.e,
    yearStart: years[0],
    yearEnd: years[1],
    sourceName,
    sensorEvents: here.reduce((sum, sensor) => sum + sensor.events, 0),
    sensorCount: here.length,
    deepestIn: here.length ? deepest : null,
    activeFloods: active.length,
    femaHighRisk: extra?.femaHighRisk ?? null,
    stormDeepPct: extra?.stormDeepPct ?? null,
    alertEvents: extra?.alertEvents ?? [],
  }
}

/** The eight squares around `id` ("column_row"), including squares with no records. */
export function neighborCells(grid: Grid, id: string): CellProps[] {
  const [i, j] = id.split('_').map(Number)
  if (!Number.isFinite(i) || !Number.isFinite(j)) return []
  const out: CellProps[] = []
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue
      const key = `${i + di}_${j + dj}`
      const found = grid.byKey.get(key)
      if (found) out.push(found.properties)
      else {
        const bounds = cellBounds(i + di, j + dj, grid.size)
        out.push(cellAt([(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2], grid))
      }
    }
  }
  return out
}

export interface SensorRank { id: string; name: string; point: LngLat; events: number; depthIn: number; last: string | null }

/** FloodNet sensors with the most recorded floods, and a few with none near the busiest one. */
export function rankSensors(sensors: readonly SensorHit[]): { recorded: SensorRank[]; quiet: SensorRank[] } {
  const recorded = [...sensors].filter((sensor) => sensor.events > 0)
    .sort((a, b) => b.events - a.events || b.depthIn - a.depthIn || a.id.localeCompare(b.id))
    .slice(0, 6)
    .map((sensor) => ({ id: sensor.id, name: sensor.name, point: [sensor.lon, sensor.lat] as LngLat, events: sensor.events, depthIn: sensor.depthIn, last: sensor.last }))
  const top = recorded[0]
  const quietPool = sensors.filter((sensor) => sensor.events === 0)
  const quiet = (top
    ? [...quietPool].sort((a, b) => {
      const da = (a.lon - top.point[0]) ** 2 + (a.lat - top.point[1]) ** 2
      const db = (b.lon - top.point[0]) ** 2 + (b.lat - top.point[1]) ** 2
      return da - db || a.id.localeCompare(b.id)
    })
    : quietPool)
    .slice(0, 3)
    .map((sensor) => ({ id: sensor.id, name: sensor.name, point: [sensor.lon, sensor.lat] as LngLat, events: 0, depthIn: sensor.depthIn, last: sensor.last }))
  return { recorded, quiet }
}
