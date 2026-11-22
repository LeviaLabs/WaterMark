// The flood grid: squares of a fixed size in degrees, each holding the flood records whose
// reported point falls inside it (scripts/floods/build.py writes them as compact rows). Pure;
// tested in tests/cells.test.ts.
//
//   US       0.5-degree squares (about 55 km), NOAA Storm Events flood reports, 2016-2025
//   world    1-degree squares (about 110 km), GDACS flood events, 2001-2025 (US points left out)
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { LngLat } from './types'

export type GridKind = 'us' | 'world'

export interface CellProps {
  /** "column_row", unique within a grid. */
  k: string
  grid: GridKind
  /** Flood records in the square. */
  e: number
  /** Years with at least one record. */
  n: number
  /** The year with the most records, and how many. */
  wy: number
  wn: number
  /** US: deaths. World: serious floods (orange or red GDACS alert). */
  a: number
  /** US: damage in USD (property and crops). World: largest GDACS flood magnitude. */
  b: number
  /** [west, south, east, north] */
  bounds: [number, number, number, number]
  /** Records in one year, as `y2019`; absent means none that year. Flat so map styles can read them. */
  [year: `y${number}`]: number
}

/** Records in a square in one year (the time slider). */
export const countIn = (cell: CellProps, year: number): number => cell[`y${year}`] ?? 0

export interface Grid {
  kind: GridKind
  size: number
  years: [number, number]
  cells: FeatureCollection<Polygon, CellProps>
  /** "column_row" -> cell, for clicks. */
  byKey: Map<string, Feature<Polygon, CellProps>>
}

const round = (x: number) => Math.round(x * 1e4) / 1e4

export function cellBounds(i: number, j: number, size: number): [number, number, number, number] {
  const w = round(i * size - 180)
  const s = round(j * size - 90)
  return [w, s, round(w + size), round(s + size)]
}

export function squareOf([w, s, e, n]: [number, number, number, number]): Polygon {
  return { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] }
}

export function cellIndex([lon, lat]: LngLat, size: number): [number, number] {
  return [Math.floor((lon + 180) / size), Math.floor((lat + 90) / size)]
}

/** Parses a built grid file; throws on a malformed one. */
export function parseGrid(raw: unknown, kind: GridKind): Grid {
  const r = raw as { size?: unknown; years?: unknown; rows?: unknown }
  if (typeof r?.size !== 'number' || !Array.isArray(r.rows) || !Array.isArray(r.years)) throw new Error('Malformed flood grid file.')
  const size = r.size
  const firstYear = Number(r.years[0])
  const features: Feature<Polygon, CellProps>[] = []
  for (const row of r.rows as unknown[]) {
    if (!Array.isArray(row) || row.length < 8 || !row.slice(0, 8).every((x) => typeof x === 'number')) continue
    const [i, j, e, n, wy, wn, a, b] = row as number[]
    const bounds = cellBounds(i, j, size)
    const props: CellProps = { k: `${i}_${j}`, grid: kind, e, n, wy, wn, a, b, bounds }
    // Per year, as [year offset, records, ...] for the years with any.
    const byYear = row[8]
    if (Array.isArray(byYear)) {
      for (let q = 0; q + 1 < byYear.length; q += 2) {
        const off = byYear[q], count = byYear[q + 1]
        if (typeof off === 'number' && typeof count === 'number' && count > 0) props[`y${firstYear + off}`] = count
      }
    }
    features.push({ type: 'Feature', properties: props, geometry: squareOf(bounds) })
  }
  const cells: FeatureCollection<Polygon, CellProps> = { type: 'FeatureCollection', features }
  return { kind, size, years: [Number(r.years[0]), Number(r.years[1])], cells, byKey: new Map(features.map((f) => [f.properties.k, f])) }
}

/**
 * The square at a point in this grid: the recorded one, or an empty square (no records) so any
 * spot can still be picked and read.
 */
export function cellAt(at: LngLat, grid: Grid): CellProps {
  const [i, j] = cellIndex(at, grid.size)
  const found = grid.byKey.get(`${i}_${j}`)
  if (found) return found.properties
  const [, y1] = grid.years
  return { k: `${i}_${j}`, grid: grid.kind, e: 0, n: 0, wy: y1, wn: 0, a: 0, b: 0, bounds: cellBounds(i, j, grid.size) }
}

/** Distance across a square at its middle latitude, km (east-west). */
export function cellWidthKm([w, s, e, n]: [number, number, number, number]): number {
  const lat = ((s + n) / 2) * (Math.PI / 180)
  return (e - w) * 111.32 * Math.cos(lat)
}

/**
 * How often, in plain words, for a count over a number of years: "about 3 a year",
 * "about one every 4 years", "once in 10 years", "none recorded".
 */
export function howOften(count: number, years: number): string {
  if (!(count > 0)) return 'none recorded'
  const perYear = count / years
  if (perYear >= 1.5) return `about ${Math.round(perYear).toLocaleString('en-US')} a year`
  if (perYear >= 0.9) return 'about one a year'
  if (count === 1) return `once in ${years} years`
  const every = Math.round(years / count)
  return every < 2 ? 'nearly one a year' : `about one every ${every} years`
}
