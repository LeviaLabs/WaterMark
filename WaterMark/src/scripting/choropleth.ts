// The drill-down flood-history map: which level a focused region opens into, its color classes,
// its legend, and the mask that darkens everything outside it. Pure; tested in tests/choropleth.test.ts.
//
//   nothing focused   the world, every country colored by GDACS floods per year
//   a country         its provinces or regions (the US: its states), everything else dark
//   a US state        its counties
//   a province or     a leaf: clicking inside selects that spot and zooms to street level,
//   a county          where the detailed layers and the area data take over
import type { ExpressionSpecification } from 'maplibre-gl'
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson'
import type { RegionLevel, RegionPick } from './types'

/** From here the detailed layers draw, the region colors are gone and a click reads that spot. */
export const DETAIL_ZOOM = 10
/** Where a click inside a leaf region zooms to. */
export const SPOT_ZOOM = 12.5

/** The level a focused region opens into, or null for a leaf. */
export function childLevel(focus: RegionPick | null): RegionLevel | null {
  if (!focus) return 'country'
  if (focus.level === 'country') return focus.props.k === 'USA' ? 'state' : 'admin1'
  if (focus.level === 'state') return 'county'
  return null
}

/** The colors the legend explains while this region is focused. */
export const legendLevel = (focus: RegionPick | null): RegionLevel => childLevel(focus) ?? focus?.level ?? 'country'

/** Index of the color class for a yearly average: 0 for none recorded, then 1 to 6. */
export function classOf(perYear: number, breaks: readonly number[]): number {
  if (!(perYear > 0)) return 0
  let c = 1
  for (const b of breaks) if (perYear >= b) c++
  return Math.min(c, 6)
}

/** MapLibre fill color for a numeric property (`py`, or a square's count `e`) with these breaks; `colors` has seven entries. */
export function fillColor(breaks: readonly number[], colors: readonly string[], prop = 'py'): ExpressionSpecification {
  // Equal or falling breaks (few distinct values) would make an invalid step expression.
  const stops: (number | string)[] = [1e-9, colors[1]]
  stepBreaks(breaks).forEach((b, i) => stops.push(b, colors[i + 2]))
  return ['step', ['coalesce', ['get', prop], 0], colors[0], ...stops] as unknown as ExpressionSpecification
}

/** Legend rows "None recorded", "Under 0.24", "0.24 to 0.76" ... "4.9 or more" for the five breaks. */
export function legendLabels(breaks: readonly number[]): string[] {
  const n = (x: number) => (x >= 10 ? Math.round(x).toLocaleString('en-US') : String(Number(x.toPrecision(2))))
  const labels = ['None recorded', `Under ${n(breaks[0])}`]
  for (let i = 0; i < breaks.length - 1; i++) labels.push(`${n(breaks[i])} to ${n(breaks[i + 1])}`)
  labels.push(`${n(breaks[breaks.length - 1])} or more`)
  return labels
}

/** The break values fillColor really uses: equal or falling breaks nudged up so steps stay valid. */
function stepBreaks(breaks: readonly number[]): number[] {
  const out: number[] = []
  let prev = 1e-9
  breaks.forEach((b, i) => {
    const v = b > prev ? b : prev + 1e-6 * (i + 1)
    out.push(v)
    prev = v
  })
  return out
}

/**
 * Legend rows for the flood squares, whose values are whole counts of 1 or more: one row per color
 * class that some count lands in, with its range ("1", "2–8", "88+"). Uses the same steps as
 * fillColor, so a row's color is exactly the color those squares get.
 */
export function cellLegend(breaks: readonly number[]): { cls: number; label: string }[] {
  const steps = stepBreaks(breaks)
  const cls = (v: number) => 1 + steps.filter((b) => v >= b).length
  const top = Math.ceil(steps[steps.length - 1])
  const ranges = new Map<number, [number, number]>()
  for (let v = 1; v <= top; v++) {
    const c = cls(v)
    const r = ranges.get(c)
    ranges.set(c, r ? [r[0], v] : [v, v])
  }
  const n = (x: number) => x.toLocaleString('en-US')
  const last = cls(top)
  return [...ranges].sort((x, y) => x[0] - y[0]).map(([c, [lo, hi]]) => ({
    cls: c, label: c === last ? `${n(lo)}+` : lo === hi ? n(lo) : `${n(lo)}–${n(hi)}`,
  }))
}

/** The whole world as one ring, a little short of the poles where Web Mercator ends. */
const WORLD: Position[] = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]

/**
 * A polygon covering the whole world with the focused region cut out of it: drawn dark, it leaves
 * only the region lit. Each piece of the region becomes one hole (its outer ring; lakes stay lit).
 */
export function maskAround(region: Polygon | MultiPolygon): Feature<Polygon> {
  const pieces = region.type === 'Polygon' ? [region.coordinates] : region.coordinates
  return {
    type: 'Feature', properties: {},
    geometry: { type: 'Polygon', coordinates: [WORLD, ...pieces.map((p) => p[0]).filter((r) => r && r.length >= 4)] },
  }
}

/** Where focus moves, with any selected square or spot cleared. An empty path is the whole world. */
export interface FocusStep {
  path: RegionPick[]
  selection: null
}

/**
 * Jump to a breadcrumb. Depth 0 is the world, 1 the country, then a state or county.
 * Every jump clears the selected square, circle, or searched spot.
 */
export function focusAtDepth(path: readonly RegionPick[], depth: number): FocusStep {
  const end = Math.max(0, Math.min(Math.floor(depth), path.length))
  return { path: path.slice(0, end), selection: null }
}

/**
 * One level up. A selected square returns to the county, province, or country around it
 * (or straight to the world, if the spot had no region). A county returns to its state,
 * a state or province to its country, and a country to the world.
 */
export function stepUpFocus(path: readonly RegionPick[], hasSelection: boolean): FocusStep {
  if (hasSelection) return { path: path.slice(), selection: null }
  return focusAtDepth(path, path.length - 1)
}

/** What the dark veil should do when the focused region changes. `clear` restores the colored world. */
export function focusVeil(
  prev: { level: string; k: string } | null,
  next: { level: string; k: string } | null,
): 'keep' | 'show' | 'clear' {
  const same = (prev?.level ?? null) === (next?.level ?? null) && (prev?.k ?? null) === (next?.k ?? null)
  if (same) return 'keep'
  return next ? 'show' : 'clear'
}

/** The path from the world down to a newly clicked region, reusing the parents already known. */
export function pathTo(pick: RegionPick, path: readonly RegionPick[], find: (level: RegionLevel, k: string) => RegionPick | null): RegionPick[] {
  const usa = () => path.find((p) => p.level === 'country' && p.props.k === 'USA') ?? find('country', 'USA')
  switch (pick.level) {
    case 'country': return [pick]
    case 'admin1': return path[0]?.level === 'country' ? [path[0], pick] : [pick]
    case 'state': return [usa(), pick].filter((p): p is RegionPick => Boolean(p))
    case 'county': {
      const fips = pick.props.k.slice(0, 2)
      const state = path.find((p) => p.level === 'state' && p.props.k === fips) ?? find('state', fips)
      return [usa(), state, pick].filter((p): p is RegionPick => Boolean(p))
    }
  }
}
