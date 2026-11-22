// The flood-history map layers for FloodMap.
//
// What you see is the flood grid (scripting/cells.ts): squares colored by how many floods were
// recorded inside them, dim for a few and bright for many, with thin gaps between them, so every
// state or country shows its own pattern. Over the grid, thin outlines show the regions you can
// click: countries, then a focused country's provinces (or US states, then a state's counties).
// With a region focused, everything outside sits under a dark veil (a world polygon with the region
// cut out) and a crisp line traces its edge. The squares stay on until street zoom, so a picked
// square is still visible after the map flies to it.
//
// Picking (click and hover) is done on the loaded geometry, not on rendered pixels, so a state's
// counties are clickable the moment the state is focused, at any zoom.
import type maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, GeoJSONSource } from 'maplibre-gl'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { childLevel, fillColor, maskAround } from '../../scripting/choropleth'
import type { Grid, GridKind } from '../../scripting/cells'
import type { MapPalette } from '../../scripting/mapTheme'
import type { FloodHistoryIndex, RegionCollection } from '../../services/floodHistory'
import type { LngLat, RegionLevel, RegionPick, RegionProps } from '../../scripting/types'

export interface RegionData {
  index: FloodHistoryIndex | null
  countries: RegionCollection | null
  states: RegionCollection | null
  /** Counties of the focused state, once loaded. */
  counties: RegionCollection | null
  /** Provinces of the focused country (not the US), once loaded. */
  admin1: RegionCollection | null
  /** The deepest focused region, or null for the whole world. */
  focus: RegionPick | null
  focusGeometry: Polygon | MultiPolygon | null
  /** ISO3 of the focused country, or of the focused province's country. */
  country: string | null
  grids: { us: Grid | null; world: Grid | null }
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }
const LEVELS: RegionLevel[] = ['country', 'admin1', 'state', 'county']
const GRIDS: GridKind[] = ['world', 'us']
const SOURCE: Record<RegionLevel, string> = { country: 'countries', admin1: 'admin1', state: 'states', county: 'counties' }
// GeoJSON is cut into vector tiles in the browser. maxzoom is the last tile that keeps its own
// vertices; past that, MapLibre enlarges the last tile. Local borders use a higher maxzoom and a
// tighter tolerance so a county line stays the census shape when you zoom in. Countries stay
// coarser because the world file is large and is only read zoomed out.
const OUTLINE: Record<RegionLevel, { maxzoom: number; tolerance: number }> = {
  country: { maxzoom: 6, tolerance: 0.5 },
  state: { maxzoom: 9, tolerance: 0.25 },
  admin1: { maxzoom: 12, tolerance: 0.12 },
  county: { maxzoom: 13, tolerance: 0.04 },
}
const lineId = (l: RegionLevel) => `${SOURCE[l]}-line`
const cellSource = (g: GridKind) => `cells-${g}`
const hovered = ['boolean', ['feature-state', 'hover'], false] as ExpressionSpecification
const FOCUS_LAYERS = ['mask-fill', 'focus-edge', 'focus-line'] as const

const collectionOf = (d: RegionData, level: RegionLevel) =>
  ({ country: d.countries, admin1: d.admin1, state: d.states, county: d.counties })[level]

/** Whether a level's outlines are drawn while this region is focused: the focus's own level and the one below. */
function isShown(d: RegionData, level: RegionLevel): boolean {
  const f = d.focus
  if (level === 'country') return true
  if (!f) return false
  const inUS = f.level === 'state' || f.level === 'county' || (f.level === 'country' && f.props.k === 'USA')
  if (level === 'state') return inUS
  if (level === 'county') return f.level === 'state' || f.level === 'county'
  return !inUS // admin1: a focused country outside the US, or one of its provinces
}

/** The squares are 0.5° or 1° of real counts. They fade once streets are readable so a coarse fill is not mistaken for block-level data. */
const CELL_OPACITY = ['interpolate', ['linear'], ['zoom'], 10, 0.9, 12.5, 0] as ExpressionSpecification
/** Thin gaps between squares: a hairline zoomed out, a clear gap up close. */
const GAP_WIDTH = ['interpolate', ['linear'], ['zoom'], 1, 0.15, 4, 0.5, 8, 1.4, 11, 2] as ExpressionSpecification

function lineOpacity(d: RegionData, level: RegionLevel): ExpressionSpecification | number {
  if (!isShown(d, level)) return 0
  const top = level === 'country' ? (d.focus ? 0.35 : 0.5) : 0.75
  return ['interpolate', ['linear'], ['zoom'], 11, top, 13, 0] as ExpressionSpecification
}

const cellColor = (d: RegionData, t: MapPalette, g: GridKind) =>
  fillColor(d.index?.cells[g].breaks ?? [1, 2, 3, 5, 8], t.flood, 'e')

/**
 * The basemap layer the grid goes under: the first one after the last line or fill, so the
 * squares cover land, water and roads, and only the place names sit on top.
 */
function regionBeforeId(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle().layers ?? []
  let last = -1
  layers.forEach((l, i) => { if (l.type === 'line' || l.type === 'fill' || l.type === 'background') last = i })
  return layers[last + 1]?.id
}

/** Adds the grid and the region outlines over the roads and under the place names. Call on every style load. */
export function addRegionLayers(map: maplibregl.Map, t: MapPalette, d: RegionData): void {
  const beforeId = regionBeforeId(map)
  for (const g of GRIDS) {
    map.addSource(cellSource(g), { type: 'geojson', data: d.grids[g]?.cells ?? EMPTY, maxzoom: 12, tolerance: 0, buffer: 4 })
    map.addLayer({ id: `${cellSource(g)}-fill`, type: 'fill', source: cellSource(g), paint: {
      'fill-color': cellColor(d, t, g), 'fill-opacity': CELL_OPACITY, 'fill-antialias': false,
    } }, beforeId)
    map.addLayer({ id: `${cellSource(g)}-gap`, type: 'line', source: cellSource(g), paint: {
      'line-color': t.basemap.background, 'line-width': GAP_WIDTH, 'line-opacity': CELL_OPACITY,
    } }, beforeId)
  }
  for (const level of LEVELS) {
    map.addSource(SOURCE[level], { type: 'geojson', data: collectionOf(d, level) ?? EMPTY, promoteId: 'k', ...OUTLINE[level] })
    map.addLayer({ id: lineId(level), type: 'line', source: SOURCE[level], layout: { 'line-join': 'round' }, paint: {
      'line-color': ['case', hovered, t.hoverLine, t.regionLine] as ExpressionSpecification,
      'line-width': ['case', hovered, 2, level === 'country' ? 0.8 : 0.7] as ExpressionSpecification,
      'line-opacity': lineOpacity(d, level),
    } }, beforeId)
  }
}

function focusData(d: RegionData): { mask: Feature | FeatureCollection; edge: Feature | FeatureCollection } {
  if (!d.focusGeometry) return { mask: EMPTY, edge: EMPTY }
  return { mask: maskAround(d.focusGeometry), edge: { type: 'Feature', properties: {}, geometry: d.focusGeometry } }
}

const TARGET_OPACITY: Record<(typeof FOCUS_LAYERS)[number], (t: MapPalette) => number> = {
  'mask-fill': (t) => t.maskOpacity, 'focus-edge': () => 0.35, 'focus-line': () => 0.95,
}

/**
 * The veil and the outline, above the data overlays (rain, FEMA, the NYC model) and below the points.
 * The outline is a crisp 1.4 px line over a narrow 3 px soft edge: enough to lift the region off
 * the dark without a halo.
 */
export function addFocusLayers(map: maplibregl.Map, t: MapPalette, d: RegionData, beforeId?: string): void {
  const { mask, edge } = focusData(d)
  map.addSource('mask', { type: 'geojson', data: mask, tolerance: 0.5 })
  map.addSource('focus', { type: 'geojson', data: edge, tolerance: 0.3 })
  map.addLayer({ id: 'mask-fill', type: 'fill', source: 'mask', paint: { 'fill-color': t.mask, 'fill-opacity': t.maskOpacity } }, beforeId)
  map.addLayer({ id: 'focus-edge', type: 'line', source: 'focus', layout: { 'line-join': 'round' },
    paint: { 'line-color': t.glow, 'line-width': 3, 'line-blur': 1.5, 'line-opacity': 0.35 } }, beforeId)
  map.addLayer({ id: 'focus-line', type: 'line', source: 'focus', layout: { 'line-join': 'round' },
    paint: { 'line-color': t.focusLine, 'line-width': 1.4, 'line-opacity': 0.95 } }, beforeId)
}

/** Pushes changed data, class breaks or focus into existing layers; a new focus fades its veil in. */
export function syncRegionLayers(map: maplibregl.Map, t: MapPalette, d: RegionData, prev: RegionData | null): void {
  if (!map.getLayer(lineId('country'))) return
  for (const g of GRIDS) {
    if (!prev || prev.grids[g] !== d.grids[g]) (map.getSource(cellSource(g)) as GeoJSONSource).setData(d.grids[g]?.cells ?? EMPTY)
    if (!prev || prev.index !== d.index) map.setPaintProperty(`${cellSource(g)}-fill`, 'fill-color', cellColor(d, t, g))
  }
  for (const level of LEVELS) {
    if (!prev || collectionOf(prev, level) !== collectionOf(d, level)) {
      (map.getSource(SOURCE[level]) as GeoJSONSource).setData(collectionOf(d, level) ?? EMPTY)
    }
  }
  const isNewFocus = !prev || prev.focus?.props.k !== d.focus?.props.k || prev.focus?.level !== d.focus?.level
  if (isNewFocus || prev?.focusGeometry !== d.focusGeometry) {
    for (const level of LEVELS) map.setPaintProperty(lineId(level), 'line-opacity', lineOpacity(d, level))
    const { mask, edge } = focusData(d)
    ;(map.getSource('mask') as GeoJSONSource | undefined)?.setData(mask)
    ;(map.getSource('focus') as GeoJSONSource | undefined)?.setData(edge)
    if (isNewFocus && map.getLayer('focus-line')) {
      // Start clear and fade in, so the region lights up as the camera arrives.
      for (const id of FOCUS_LAYERS) {
        const prop = id === 'mask-fill' ? 'fill-opacity' : 'line-opacity'
        map.setPaintProperty(id, `${prop}-transition` as 'fill-opacity', { duration: 0, delay: 0 } as unknown as number)
        map.setPaintProperty(id, prop, 0)
      }
      requestAnimationFrame(() => {
        for (const id of FOCUS_LAYERS) {
          if (!map.getLayer(id)) continue
          const prop = id === 'mask-fill' ? 'fill-opacity' : 'line-opacity'
          map.setPaintProperty(id, `${prop}-transition` as 'fill-opacity', { duration: 900, delay: id === 'mask-fill' ? 0 : 300 } as unknown as number)
          map.setPaintProperty(id, prop, TARGET_OPACITY[id](t))
        }
      })
    }
  }
}

// ---- picking ----

const bboxCache = new WeakMap<object, [number, number, number, number]>()
function bboxOf(g: Polygon | MultiPolygon): [number, number, number, number] {
  let b = bboxCache.get(g)
  if (b) return b
  let [w, s, e, n] = [180, 90, -180, -90]
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  for (const p of polys) for (const [x, y] of p[0]) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y) }
  b = [w, s, e, n]
  bboxCache.set(g, b)
  return b
}

function contains(g: Polygon | MultiPolygon, [x, y]: LngLat): boolean {
  const [w, s, e, n] = bboxOf(g)
  return x >= w && x <= e && y >= s && y <= n && booleanPointInPolygon([x, y], g)
}

function featureAt(fc: RegionCollection | null, at: LngLat): RegionProps | null {
  return fc?.features.find((f) => contains(f.geometry, at))?.properties ?? null
}

/**
 * What a click at `at` means: a subdivision of the focused region, the focused leaf itself
 * ('inside', meaning "pick the square here"), a sibling or parent-level region outside the focus,
 * or nothing (open sea).
 */
export function pickAt(at: LngLat, d: RegionData): RegionPick | 'inside' | null {
  const focus = d.focus
  if (focus && d.focusGeometry && contains(d.focusGeometry, at)) {
    const child = childLevel(focus)
    if (!child) return 'inside'
    const props = featureAt(collectionOf(d, child), at)
    return props ? { level: child, props } : 'inside'
  }
  // Outside the focus: a neighbor inside the same parent first (the next county), else a country.
  if (focus && (focus.level === 'county' || focus.level === 'state')) {
    const level = focus.level
    const props = featureAt(collectionOf(d, level), at)
    if (props) return { level, props }
    if (level === 'county') {
      const state = featureAt(d.states, at)
      if (state) return { level: 'state', props: state }
    }
  }
  if (focus?.level === 'admin1') {
    const props = featureAt(d.admin1, at)
    if (props) return { level: 'admin1', props }
  }
  const country = featureAt(d.countries, at)
  if (!country) return null
  // Inside the US but outside the focused state: the state, not the whole country again.
  if (country.k === 'USA' && focus && focus.level !== 'country') {
    const state = featureAt(d.states, at)
    if (state) return { level: 'state', props: state }
  }
  return { level: 'country', props: country }
}

/** The grid that covers a point: NOAA's US squares inside the US, GDACS's world squares elsewhere. */
export function gridAt(at: LngLat, d: RegionData): Grid | null {
  const country = featureAt(d.countries, at)
  return country?.k === 'USA' ? d.grids.us : d.grids.world
}

/** The focus trail for a point from the loaded outlines: its country, and its state in the US. */
export function regionPathAt(at: LngLat, d: RegionData): RegionPick[] {
  const country = featureAt(d.countries, at)
  if (!country) return []
  const path: RegionPick[] = [{ level: 'country', props: country }]
  const state = country.k === 'USA' ? featureAt(d.states, at) : null
  if (state) path.push({ level: 'state', props: state })
  return path
}

let hover: { source: string; id: string } | null = null

/** Outlines the region a click would pick; returns whether there is one (for the cursor). */
export function hoverRegion(map: maplibregl.Map, at: LngLat, d: RegionData): boolean {
  const pick = pickAt(at, d)
  const next = pick && pick !== 'inside' ? { source: SOURCE[pick.level], id: pick.props.k } : null
  if (hover && (!next || hover.source !== next.source || hover.id !== next.id)) clearHover(map)
  if (next && !hover && map.getSource(next.source)) {
    map.setFeatureState(next, { hover: true })
    hover = next
  }
  return Boolean(pick)
}

export function clearHover(map: maplibregl.Map): void {
  if (hover && map.getSource(hover.source)) map.setFeatureState(hover, { hover: false })
  hover = null
}
