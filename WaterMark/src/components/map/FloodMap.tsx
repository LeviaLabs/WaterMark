// The MapLibre map. MapLibre is imperative, so this component owns one map instance and syncs
// React props into it with small effects: data -> setData, layer toggles -> visibility,
// color scheme -> setStyle (overlays are re-added on "style.load").
//
// Performance: the stormwater model is our own vector tiles (services/stormwater.ts), so only the
// blocks in view load and zoomed-out blocks are simplified. MapLibre's tile cache is capped so
// blocks far from the view are dropped, and sensor and flood points are trimmed to the area
// around the view after every move, so points you have panned away from are removed.
// The rain layer fades in as one image once its tiles arrive instead of tile by tile.
// Sources with limited coverage declare `bounds` (NYC for the stormwater model, the US for FEMA),
// so MapLibre never requests a tile outside the area they cover.
//
// Drill-down: the map opens on the world, colored by floods per country (regionLayers.ts). Clicking
// a country focuses it: the camera eases in, everything outside goes dark and its provinces (in the
// US, states, then counties) take the color. Clicking inside a province or county selects that spot
// and zooms to street level, where the detailed layers (sensors, the NYC model, FEMA zones) draw.
import { useEffect, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson'
import { ENDPOINTS } from '../../services/endpoints'
import { STORM_PROTOCOL, loadStormTile } from '../../services/stormwater'
import { markFetched } from '../../scripting/freshness'
import { MAP_PALETTES } from '../../scripting/mapTheme'
import { fmtDate, fmtDepthIn, UNITS } from '../../scripting/format'
import { bboxesOverlap, NYC_BOUNDS, type BBox } from '../../scripting/region'
import { selectionGrid, selectionStepForView } from '../../scripting/cells'
import { DETAIL_ZOOM } from '../../scripting/choropleth'
import { addFocusLayers, addRegionLayers, clearHover, hoverRegion, pickAt, syncRegionLayers, type RegionData } from './regionLayers'
import type { MapPalette } from '../../scripting/mapTheme'
import type {
  ColorScheme, GlobalFloodCollection, LayerId, LayerVisibility, Loadable, LngLat, RegionPick, SensorCollection,
} from '../../scripting/types'

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }
const STORM_MIN_ZOOM = 10
const STORM_MAX_ZOOM = 14
// FEMA renders each tile on its server; below city-region zoom the zones are too small to read
// and a world view would ask for dozens of slow images.
const FEMA_MIN_ZOOM = 9
// The selected circle is meaningless as a dot on a world map.
const SELECTION_MIN_ZOOM = 5
const ZOOM_MS = 450
// The US and its Caribbean and Pacific territories east of the antimeridian (Guam is not included).
const FEMA_BOUNDS: BBox = [-180, -15, -64, 72]

// Tiles kept in memory per source beyond the ones on screen. MapLibre's default grows with the
// window size; a fixed cap keeps memory flat on long sessions and drops blocks you have left,
// while the parent zoom levels stay so zooming out shows the coarser map instantly.
const TILE_CACHE = 96

// NASA IMERG on GIBS is published through zoom 6 (about 0.1°, roughly 10 km). Closer zooms used to
// stretch those tiles with linear smoothing, which looked like detail the satellite does not have.
// Nearest-neighbor keeps the real pixels, and the layer fades out just past its native zoom.
const RAIN_MAX_ZOOM = 6
const RAIN_OPACITY: maplibregl.ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 0.62, 8, 0]

/** Points within the view plus half a screen on every side; the rest are dropped from the map. */
function nearView<T extends FeatureCollection>(fc: T, map: maplibregl.Map): T {
  const b = map.getBounds()
  const padX = (b.getEast() - b.getWest()) / 2
  const padY = (b.getNorth() - b.getSouth()) / 2
  if (b.getEast() - b.getWest() + 2 * padX >= 360) return fc
  const [w, e, s, n] = [b.getWest() - padX, b.getEast() + padX, b.getSouth() - padY, b.getNorth() + padY]
  const features = fc.features.filter((f) => {
    if (f.geometry?.type !== 'Point') return true
    const [x, y] = (f.geometry as Point).coordinates
    return x >= w && x <= e && y >= s && y <= n
  })
  return { ...fc, features }
}

let protocolAdded = false
function addStormProtocol() {
  if (protocolAdded) return
  maplibregl.addProtocol(STORM_PROTOCOL, loadStormTile)
  protocolAdded = true
}
const LAYER_IDS: LayerId[] = ['rain', 'floods', 'sensors', 'storm', 'fema']

export type FlyTarget = { center: LngLat; zoom: number } | { bounds: [number, number, number, number]; maxZoom?: number }

/** Slow in, slow out: the camera glides into a region instead of snapping. */
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/**
 * Strips the OpenFreeMap style down to a quiet backdrop for the data, like a printed atlas plate:
 * plain land and water, faint borders, and only city and region names until street zoom.
 *   - land cover, parks and land use: hidden; buildings from zoom 14
 *   - roads, railways and rivers: none until zoom 10, then thin and faint
 *   - names: countries and states spaced uppercase; cities from zoom 4, towns from 8, villages
 *     from 11; road and water names, shields and points of interest hidden until street zoom
 * MapLibre keeps the remaining labels from colliding with each other.
 */
function retouchBasemap(map: maplibregl.Map, t: MapPalette) {
  const b = t.basemap
  const from = (id: string, minzoom: number, current?: number) => map.setLayerZoomRange(id, Math.max(minzoom, current ?? 0), 24)
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id
    const src = ('source-layer' in layer ? layer['source-layer'] : '') ?? ''
    if (layer.type === 'background') map.setPaintProperty(id, 'background-color', b.background)
    else if (layer.type === 'fill' && src === 'water') map.setPaintProperty(id, 'fill-color', b.water)
    else if (layer.type === 'fill' && /landcover|landuse|park/.test(src)) {
      // Kept off the world view. From street zoom they are real OpenStreetMap polygons, not an upscale.
      from(id, 14, layer.minzoom)
      map.setPaintProperty(id, 'fill-opacity', 0.45)
    }
    else if (layer.type === 'fill' && src === 'building') from(id, 14, layer.minzoom)
    else if (layer.type === 'line' && (src === 'waterway' || src === 'transportation' || src === 'aeroway')) {
      map.setPaintProperty(id, 'line-color', src === 'waterway' ? b.water : b.road)
      map.setPaintProperty(id, 'line-opacity', ['interpolate', ['linear'], ['zoom'], 10, 0.45, 14, 0.95])
      from(id, 10, layer.minzoom)
    } else if (layer.type === 'line' && src === 'boundary') {
      map.setPaintProperty(id, 'line-color', b.border)
      map.setPaintProperty(id, 'line-opacity', 0.5)
    } else if (layer.type === 'fill' && src === 'transportation') from(id, 12, layer.minzoom)
    else if (layer.type === 'symbol') {
      if (/housenumber/.test(id)) {
        from(id, 16, layer.minzoom)
        map.setPaintProperty(id, 'text-color', b.label)
        map.setPaintProperty(id, 'text-halo-color', b.labelHalo)
        continue
      } else if (/poi|aerialway|airport|aerodrome|oneway|shield/.test(id) || src === 'aerodrome_label') {
        map.setLayoutProperty(id, 'visibility', 'none')
        continue
      }
      map.setPaintProperty(id, 'text-color', b.label)
      map.setPaintProperty(id, 'text-halo-color', b.labelHalo)
      map.setPaintProperty(id, 'text-halo-width', 1)
      map.setPaintProperty(id, 'text-halo-blur', 1)
      if (src === 'transportation_name' || src === 'water_name' || src === 'waterway') from(id, 13, layer.minzoom)
      else if (/country|state/.test(id)) {
        map.setLayoutProperty(id, 'text-transform', 'uppercase')
        map.setLayoutProperty(id, 'text-letter-spacing', 0.2)
        map.setLayoutProperty(id, 'text-size', 10)
        map.setPaintProperty(id, 'text-opacity', 0.55)
      } else if (/city/.test(id)) from(id, 4, layer.minzoom)
      else if (/town/.test(id)) from(id, 8, layer.minzoom)
      else if (/village|suburb/.test(id)) from(id, 11, layer.minzoom)
      else from(id, 12, layer.minzoom)
    }
  }
}

/**
 * Zoom buttons that always ease to the next level. MapLibre's own buttons jump instantly when the
 * system asks for reduced motion; this team keeps animations on (AGENTS.md), so these pass
 * `essential`. Same markup and classes as MapLibre's, so the existing control styles apply.
 */
class SmoothZoomControl implements maplibregl.IControl {
  private el: HTMLElement | null = null
  /** Where the running animation is headed, so quick repeated clicks add up. */
  private target: number | null = null

  onAdd(map: maplibregl.Map) {
    const el = document.createElement('div')
    el.className = 'maplibregl-ctrl maplibregl-ctrl-group'
    map.on('zoomend', () => { this.target = null })
    for (const [cls, label, delta] of [['zoom-in', 'Zoom in', 1], ['zoom-out', 'Zoom out', -1]] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `maplibregl-ctrl-${cls}`
      b.title = label
      b.setAttribute('aria-label', label)
      const icon = document.createElement('span')
      icon.className = 'maplibregl-ctrl-icon'
      icon.setAttribute('aria-hidden', 'true')
      b.append(icon)
      b.addEventListener('click', () => {
        const from = this.target ?? map.getZoom()
        const zoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), Math.round(from) + delta))
        this.target = zoom
        map.easeTo({ zoom, duration: ZOOM_MS, essential: true })
      })
      el.append(b)
    }
    this.el = el
    return el
  }

  onRemove() { this.el?.remove(); this.el = null }
}

/** Room the data panel and top bar take, so a region flown to is not hidden under them. */
function flyPadding(): maplibregl.PaddingOptions {
  if (matchMedia('(max-width: 700px)').matches) return { top: 70, bottom: Math.round(innerHeight * 0.3), left: 20, right: 20 }
  return { top: 90, bottom: 40, left: 40, right: innerWidth > 1000 ? 440 : 60 }
}

interface Props {
  scheme: ColorScheme
  initialCenter: LngLat
  initialZoom: number
  layers: LayerVisibility
  sensors: Loadable<SensorCollection>
  floods: Loadable<GlobalFloodCollection>
  /** The selected circle, or the live preview while drawing. */
  circle: Feature<Polygon> | null
  /** Approach arrow, car suggestions, and ranked squares. Empty when no audience tool is showing them. */
  marks: FeatureCollection
  isDrawing: boolean
  flyTo: FlyTarget | null
  onDrawClick: (at: LngLat) => void
  onDrawMove: (at: LngLat) => void
  /** Flood-history colors per country, state and county. */
  regions: RegionData
  /** A country, state or county was clicked (zoomed out). */
  onRegionClick: (pick: RegionPick) => void
  /** A spot was clicked: at street zoom, or inside a focused province or county (`shouldZoom`). */
  onSpotClick: (at: LngLat, shouldZoom: boolean) => void
  onStormNote: (note: string | null) => void
  /** The visible area [west, south, east, north] and zoom after every move. */
  onViewChange: (bounds: BBox, zoom: number) => void
  /** True while map tiles or data are loading, for the progress bar. */
  onBusyChange: (isBusy: boolean) => void
}

const data = <T,>(v: Loadable<T>): T | FeatureCollection => (v && v !== 'error' ? v : EMPTY)

// Popup text is built with DOM nodes, never HTML strings, so upstream text can't inject markup.
function popup(lines: (string | [string, string])[]): HTMLElement {
  const el = document.createElement('div')
  lines.forEach((line, i) => {
    if (i) el.append(document.createElement('br'))
    if (typeof line === 'string') {
      if (i === 0) { const b = document.createElement('strong'); b.textContent = line; el.append(b) } else el.append(line)
    } else {
      const a = document.createElement('a')
      a.href = line[1]; a.textContent = line[0]; a.target = '_blank'; a.rel = 'noopener'
      el.append(a)
    }
  })
  return el
}

export function FloodMap(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  // Latest props, read by MapLibre callbacks that outlive a render.
  const latest = useRef(props)
  const shownScheme = useRef(props.scheme)
  /** Recomputes the coverage note; set once the map exists. */
  const refreshNote = useRef<() => void>(() => {})
  const shownRegions = useRef<RegionData | null>(null)

  /** Pushes the sensors and floods near the current view into the map. */
  const syncPoints = (map: maplibregl.Map) => {
    const p = latest.current
    ;(map.getSource('sensors') as GeoJSONSource | undefined)?.setData(nearView(data(p.sensors), map))
    ;(map.getSource('floods') as GeoJSONSource | undefined)?.setData(nearView(data(p.floods), map))
  }

  useEffect(() => { latest.current = props })

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return
    const { scheme, initialCenter, initialZoom } = latest.current
    addStormProtocol()
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_PALETTES[scheme].style,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: { compact: true },
      maxTileCacheSize: TILE_CACHE,
      // A tab left open for hours would otherwise re-download every expired basemap tile in view.
      refreshExpiredTiles: false,
      // Sharp enough on high-density screens without drawing 9x the pixels on a 3x phone.
      pixelRatio: Math.min(devicePixelRatio, 2),
      // OpenFreeMap's vector tiles stop at 14 and stay sharp a few levels past that. Further zoom
      // only enlarges them, and the coarse rasters have already faded, so the camera stops here.
      maxZoom: 18,
      fadeDuration: 200,
    })
    mapRef.current = map
    map.addControl(new SmoothZoomControl(), 'bottom-right')
    map.addControl(new maplibregl.ScaleControl({ unit: UNITS }), 'bottom-right')

    const addOverlays = () => {
      const p = latest.current
      const t = MAP_PALETTES[shownScheme.current]
      const vis = (id: LayerId) => (p.layers[id] ? 'visible' : 'none')

      retouchBasemap(map, t)
      addRegionLayers(map, t, p.regions)
      shownRegions.current = p.regions

      // Native 256 px tiles at their full resolution; beyond zoom 6 MapLibre smooths them up.
      map.addSource('rain', { type: 'raster', tiles: [ENDPOINTS.imergTiles], tileSize: 256, maxzoom: RAIN_MAX_ZOOM,
        attribution: 'Rain: NASA GPM IMERG via GIBS' })
      // Starts invisible; fades in once (see onSourceData) so the rain appears as one image.
      map.addLayer({ id: 'rain', type: 'raster', source: 'rain', layout: { visibility: vis('rain') },
        paint: { 'raster-opacity': 0, 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } })
      map.setPaintProperty('rain', 'raster-opacity-transition', { duration: 600, delay: 0 })
      rainShown = false

      map.addSource('fema', { type: 'raster', tiles: [ENDPOINTS.femaTiles], tileSize: 256, minzoom: FEMA_MIN_ZOOM,
        bounds: FEMA_BOUNDS, attribution: 'Flood zones: FEMA NFHL' })
      map.addLayer({ id: 'fema', type: 'raster', source: 'fema', minzoom: FEMA_MIN_ZOOM, layout: { visibility: vis('fema') },
        paint: { 'raster-opacity': 0.6 } })

      map.addSource('storm', {
        type: 'vector', tiles: [`${STORM_PROTOCOL}://{z}/{x}/{y}`], minzoom: STORM_MIN_ZOOM, maxzoom: STORM_MAX_ZOOM, bounds: NYC_BOUNDS,
        attribution: 'Stormwater model: NYC MOCEJ/DEP via NYC Open Data',
      })
      map.addLayer({ id: 'storm', type: 'fill', source: 'storm', 'source-layer': 'stormwater', minzoom: STORM_MIN_ZOOM,
        layout: { visibility: vis('storm') }, paint: {
        'fill-color': ['match', ['get', 'Flooding_Category'], 2, t.storm[1], t.storm[0]],
        // Fades in over the first half zoom instead of popping in at zoom 10.
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], STORM_MIN_ZOOM, 0, STORM_MIN_ZOOM + 0.5,
          ['match', ['get', 'Flooding_Category'], 2, t.stormOpacity[1], t.stormOpacity[0]]],
      } })

      map.addSource('pick-grid', { type: 'geojson', data: EMPTY })
      map.addLayer({ id: 'pick-grid', type: 'line', source: 'pick-grid', paint: {
        'line-color': t.regionLine, 'line-width': 1, 'line-opacity': 0.45,
      } })

      map.addSource('sel', { type: 'geojson', data: p.circle ?? EMPTY })
      map.addLayer({ id: 'sel-fill', type: 'fill', source: 'sel', minzoom: SELECTION_MIN_ZOOM, paint: { 'fill-color': t.selectionFill, 'fill-opacity': t.selectionFillOpacity } })
      map.addLayer({ id: 'sel-line', type: 'line', source: 'sel', minzoom: SELECTION_MIN_ZOOM,
        paint: { 'line-color': t.selectionLine, 'line-width': 2.6, 'line-dasharray': [2.5, 1.5] } })

      map.addSource('sensors', { type: 'geojson', data: nearView(data(p.sensors), map), attribution: 'Sensors: FloodNet NYC' })
      map.addLayer({ id: 'sensors', type: 'circle', source: 'sensors', minzoom: DETAIL_ZOOM, layout: { visibility: vis('sensors') }, paint: {
        'circle-radius': ['interpolate', ['linear'], ['coalesce', ['get', 'events'], 0], 0, 4, 10, 6, 50, 9, 150, 13],
        'circle-color': ['case', ['>', ['coalesce', ['get', 'events'], 0], 0], t.sensorFlooded, t.hollow],
        'circle-stroke-color': t.sensorStroke, 'circle-stroke-width': 1.5,
      } })

      map.addSource('floods', { type: 'geojson', data: nearView(data(p.floods), map), attribution: 'Floods: GDACS' })
      map.addLayer({ id: 'floods', type: 'circle', source: 'floods', layout: { visibility: vis('floods') }, paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 6, 6, 9, 10, 12],
        'circle-color': ['case', ['get', 'active'], ['get', 'color'], t.hollow],
        'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2.5,
      } })

      map.addSource('aud', { type: 'geojson', data: p.marks })
      map.addLayer({ id: 'aud-fill', type: 'fill', source: 'aud', filter: ['==', ['geometry-type'], 'Polygon'], paint: {
        'fill-color': ['match', ['get', 'kind'], 'response', t.flood[5], 'staging', t.flood[2], t.glow],
        'fill-opacity': 0.12,
      } })
      map.addLayer({ id: 'aud-outline', type: 'line', source: 'aud', filter: ['==', ['geometry-type'], 'Polygon'], paint: {
        'line-color': ['match', ['get', 'kind'], 'response', t.flood[6], 'staging', t.flood[3], t.glow],
        'line-width': 2.5,
      } })
      map.addLayer({ id: 'aud-line', type: 'line', source: 'aud', filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]], paint: {
        'line-color': ['match', ['get', 'kind'], 'suggestion', t.sensorFlooded, 'approach', t.glow, t.selectionLine],
        'line-width': 3,
      } })
      map.addLayer({ id: 'aud-point', type: 'circle', source: 'aud', filter: ['==', ['geometry-type'], 'Point'], paint: {
        'circle-radius': 7,
        'circle-color': ['match', ['get', 'kind'], 'suggestion', t.sensorFlooded, 'car', t.selectionLine, 'sensor', t.sensorFlooded, t.hollow],
        'circle-stroke-color': t.sensorStroke, 'circle-stroke-width': 2,
      } })
      // The dark veil over everything outside the focused region sits above the data overlays
      // and under the selection and the points.
      addFocusLayers(map, t, p.regions, 'sel-fill')
      refreshNote.current()
    }
    let rainShown = false
    map.on('style.load', addOverlays)
    map.on('sourcedata', (e) => {
      if (rainShown || e.sourceId !== 'rain' || !map.getLayer('rain') || !map.isSourceLoaded('rain')) return
      rainShown = true
      map.setPaintProperty('rain', 'raster-opacity', RAIN_OPACITY)
    })

    // Progress bar: busy from the first tile request until the map settles.
    let isBusy = true
    const busy = (on: boolean) => { if (on !== isBusy) { isBusy = on; latest.current.onBusyChange(on) } }
    map.on('dataloading', () => busy(true))
    map.on('idle', () => busy(false))

    // The local layers only draw in part of the world; say why one shows nothing in this view.
    const stormNote = () => {
      const b = map.getBounds()
      const view: BBox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
      const z = map.getZoom()
      const notes: string[] = []
      if (!bboxesOverlap(view, NYC_BOUNDS)) notes.push('The heavy-rain model and FloodNet sensors cover New York City only.')
      else if (z < DETAIL_ZOOM) notes.push('Zoom in to New York City to see the heavy-rain model and street sensors.')
      if (latest.current.layers.fema && z < FEMA_MIN_ZOOM) notes.push('Zoom in to a US city to see FEMA flood zones.')
      if (latest.current.layers.rain && z > RAIN_MAX_ZOOM) notes.push('Rain is hidden this close. NASA IMERG is about 0.1° (zoom 6) and is not stretched over the streets.')
      const step = selectionStepForView(view, z)
      const lines = step ? selectionGrid(view, step) : null
      const gridSource = map.getSource('pick-grid') as GeoJSONSource | undefined
      gridSource?.setData(lines
        ? { type: 'Feature', properties: { kind: 'selection-grid' }, geometry: { type: 'MultiLineString', coordinates: lines } }
        : EMPTY)
      latest.current.onStormNote(notes.length ? notes.join(' ') : null)
      latest.current.onViewChange(view, z)
    }

    refreshNote.current = stormNote

    // Keep only the points around the view; the full lists stay in React state.
    map.on('moveend', () => { syncPoints(map); stormNote() })

    const onSensor = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0]
      if (latest.current.isDrawing || !f) return
      const p = f.properties
      new maplibregl.Popup({ offset: 8 }).setLngLat(e.lngLat).setDOMContent(popup([
        String(p.street_name || p.sensor_name || 'FloodNet sensor'),
        `${p.events} recorded floods`,
        `Deepest: ${fmtDepthIn(Number(p.max_depth) || 0, UNITS)}`,
        `Last flood: ${fmtDate(p.last_flood === 'null' ? null : p.last_flood)}`,
      ])).addTo(map)
    }
    const onFlood = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0]
      if (latest.current.isDrawing || !f) return
      const p = f.properties
      new maplibregl.Popup({ offset: 10 }).setLngLat(e.lngLat).setDOMContent(popup([
        String(p.name),
        `${p.alertlevel} alert, ${p.active ? 'still active' : 'ended'}`,
        `${fmtDate(p.fromdate)} to ${fmtDate(p.todate)}`,
        ['GDACS report', String(p.report)],
      ])).addTo(map)
    }
    const pointer = (on: boolean) => () => { if (!latest.current.isDrawing) map.getCanvas().style.cursor = on ? 'pointer' : '' }

    map.once('load', () => {
      // On phones the expanded attribution covers the collapsed panel card; start it folded
      // (the info button still opens it, so every credit stays one tap away).
      if (matchMedia('(max-width: 700px)').matches) {
        containerRef.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
      }
      markFetched('basemap')
      markFetched('imerg')
      stormNote()
    })
    for (const id of ['sensors', 'floods'] as const) {
      map.on('click', id, id === 'sensors' ? onSensor : onFlood)
      map.on('mouseenter', id, pointer(true))
      map.on('mouseleave', id, pointer(false))
    }
    map.on('click', (e) => {
      const p = latest.current
      const at: LngLat = [e.lngLat.lng, e.lngLat.lat]
      if (p.isDrawing) return p.onDrawClick(at)
      const points = ['sensors', 'floods'].filter((id) => map.getLayer(id))
      if (points.length && map.queryRenderedFeatures(e.point, { layers: points }).length) return // a popup opens instead
      if (map.getZoom() >= DETAIL_ZOOM) return p.onSpotClick(at, false)
      const pick = pickAt(at, p.regions)
      if (pick === 'inside') p.onSpotClick(at, true)
      else if (pick) p.onRegionClick(pick)
    })
    // Hover outlines are worked out at most once a frame.
    let hoverFrame = 0
    let hoverAt: LngLat | null = null
    map.on('mousemove', (e) => {
      const p = latest.current
      if (p.isDrawing) return p.onDrawMove([e.lngLat.lng, e.lngLat.lat])
      hoverAt = [e.lngLat.lng, e.lngLat.lat]
      if (hoverFrame) return
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = 0
        if (!hoverAt || latest.current.isDrawing) return
        const isOver = map.getZoom() < DETAIL_ZOOM && hoverRegion(map, hoverAt, latest.current.regions)
        if (!isOver) clearHover(map)
        map.getCanvas().style.cursor = isOver ? 'pointer' : ''
      })
    })
    map.on('mouseout', () => { hoverAt = null; clearHover(map) })

    return () => {
      cancelAnimationFrame(hoverFrame)
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Swap the basemap when the color scheme changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || shownScheme.current === props.scheme) return
    shownScheme.current = props.scheme
    map.setStyle(MAP_PALETTES[props.scheme].style, { diff: false })
  }, [props.scheme])

  // Flood-history data, class breaks and the opened state.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    syncRegionLayers(map, MAP_PALETTES[shownScheme.current], props.regions, shownRegions.current)
    if (map.getLayer('countries-fill')) shownRegions.current = props.regions
  }, [props.regions])

  // Data and selection.
  useEffect(() => { if (mapRef.current) syncPoints(mapRef.current) }, [props.sensors, props.floods])
  useEffect(() => { (mapRef.current?.getSource('sel') as GeoJSONSource | undefined)?.setData(props.circle ?? EMPTY) }, [props.circle])
  useEffect(() => { (mapRef.current?.getSource('aud') as GeoJSONSource | undefined)?.setData(props.marks) }, [props.marks])

  // Layer toggles.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const id of LAYER_IDS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', props.layers[id] ? 'visible' : 'none')
    }
    if (map.loaded()) refreshNote.current()
  }, [props.layers])

  useEffect(() => {
    const canvas = mapRef.current?.getCanvas()
    if (canvas) canvas.style.cursor = props.isDrawing ? 'crosshair' : ''
  }, [props.isDrawing])

  useEffect(() => {
    const map = mapRef.current
    const to = props.flyTo
    if (!map || !to) return
    if ('bounds' in to) {
      map.fitBounds(to.bounds, {
        padding: flyPadding(), maxZoom: to.maxZoom ?? DETAIL_ZOOM - 0.5, duration: 1700, easing: easeInOutCubic, essential: true,
      })
    } else {
      map.flyTo({ center: to.center, zoom: to.zoom, duration: 1600, curve: 1.3, essential: true })
    }
  }, [props.flyTo])

  return <div ref={containerRef} className="flood-map" role="region" aria-label="Flood map" />
}
