// The MapLibre map. MapLibre is imperative, so this component owns one map instance and syncs
// React props into it with small effects: data -> setData, layer toggles -> visibility,
// color scheme -> setStyle (overlays are re-added on "style.load").
//
// Performance: the stormwater model is our own vector tiles (services/stormwater.ts), so only the
// blocks in view load and zoomed-out blocks are simplified. MapLibre's tile cache is capped so
// blocks far from the view are dropped, and sensor and flood points are trimmed to the area
// around the view after every move, so points you have panned away from are removed.
// The rain layer fades in as one image once its tiles arrive instead of tile by tile.
import { useEffect, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson'
import { ENDPOINTS } from '../../services/endpoints'
import { STORM_PROTOCOL, loadStormTile } from '../../services/stormwater'
import { markFetched } from '../../scripting/freshness'
import { MAP_PALETTES } from '../../scripting/mapTheme'
import { fmtDate } from '../../scripting/format'
import type {
  ColorScheme, GlobalFloodCollection, LayerId, LayerVisibility, Loadable, LngLat, SensorCollection,
} from '../../scripting/types'

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }
const STORM_MIN_ZOOM = 10
const STORM_MAX_ZOOM = 14

// Tiles kept in memory per source beyond the ones on screen. MapLibre's default grows with the
// window size; a fixed cap keeps memory flat on long sessions and drops blocks you have left,
// while the parent zoom levels stay so zooming out shows the coarser map instantly.
const TILE_CACHE = 96

// NASA IMERG is a 0.1-degree (about 10 km) grid: zoom 5 tiles already show every pixel, so asking
// for closer tiles only adds requests and a blurry-then-sharp flash while they load.
const RAIN_MAX_ZOOM = 5
// Light at world and country zoom, gone by city zoom: there one 10 km satellite pixel covers the
// whole view, which only tints the map and hides the street-level layers.
const RAIN_OPACITY: maplibregl.ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 2, 0.6, 6, 0.45, 8, 0.2, 9.5, 0]

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

export interface FlyTarget { center: LngLat; zoom: number }

interface Props {
  scheme: ColorScheme
  initialCenter: LngLat
  initialZoom: number
  layers: LayerVisibility
  sensors: Loadable<SensorCollection>
  floods: Loadable<GlobalFloodCollection>
  /** The selected circle, or the live preview while drawing. */
  circle: Feature<Polygon> | null
  isDrawing: boolean
  flyTo: FlyTarget | null
  onDrawClick: (at: LngLat) => void
  onDrawMove: (at: LngLat) => void
  onStormNote: (note: string | null) => void
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
      // Sharp enough on high-density screens without drawing 9x the pixels on a 3x phone.
      pixelRatio: Math.min(devicePixelRatio, 2),
      fadeDuration: 200,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-right')

    const addOverlays = () => {
      const p = latest.current
      const t = MAP_PALETTES[shownScheme.current]
      const vis = (id: LayerId) => (p.layers[id] ? 'visible' : 'none')

      // 256 px images declared as 512 px tiles: MapLibre asks for one zoom level lower and stretches
      // them with linear smoothing, which softens IMERG's blocky pixels and needs 4x fewer requests.
      map.addSource('rain', { type: 'raster', tiles: [ENDPOINTS.imergTiles], tileSize: 512, maxzoom: RAIN_MAX_ZOOM,
        attribution: 'Rain: NASA GPM IMERG via GIBS' })
      // Starts invisible; fades in once (see onSourceData) so the rain appears as one image.
      map.addLayer({ id: 'rain', type: 'raster', source: 'rain', layout: { visibility: vis('rain') },
        paint: { 'raster-opacity': 0, 'raster-resampling': 'linear', 'raster-fade-duration': 0 } })
      map.setPaintProperty('rain', 'raster-opacity-transition', { duration: 600, delay: 0 })
      rainShown = false

      map.addSource('fema', { type: 'raster', tiles: [ENDPOINTS.femaTiles], tileSize: 256, attribution: 'Flood zones: FEMA NFHL' })
      map.addLayer({ id: 'fema', type: 'raster', source: 'fema', layout: { visibility: vis('fema') }, paint: { 'raster-opacity': 0.6 } })

      map.addSource('storm', {
        type: 'vector', tiles: [`${STORM_PROTOCOL}://{z}/{x}/{y}`], minzoom: STORM_MIN_ZOOM, maxzoom: STORM_MAX_ZOOM,
        attribution: 'Stormwater model: NYC MOCEJ/DEP via NYC Open Data',
      })
      map.addLayer({ id: 'storm', type: 'fill', source: 'storm', 'source-layer': 'stormwater', minzoom: STORM_MIN_ZOOM,
        layout: { visibility: vis('storm') }, paint: {
        'fill-color': ['match', ['get', 'Flooding_Category'], 2, t.storm[1], t.storm[0]],
        // Fades in over the first half zoom instead of popping in at zoom 10.
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], STORM_MIN_ZOOM, 0, STORM_MIN_ZOOM + 0.5,
          ['match', ['get', 'Flooding_Category'], 2, t.stormOpacity[1], t.stormOpacity[0]]],
      } })

      map.addSource('sel', { type: 'geojson', data: p.circle ?? EMPTY })
      map.addLayer({ id: 'sel-fill', type: 'fill', source: 'sel', paint: { 'fill-color': t.selectionFill, 'fill-opacity': t.selectionFillOpacity } })
      map.addLayer({ id: 'sel-line', type: 'line', source: 'sel',
        paint: { 'line-color': t.selectionLine, 'line-width': 3, 'line-dasharray': [2, 1.4] } })

      map.addSource('sensors', { type: 'geojson', data: nearView(data(p.sensors), map), attribution: 'Sensors: FloodNet NYC' })
      map.addLayer({ id: 'sensors', type: 'circle', source: 'sensors', layout: { visibility: vis('sensors') }, paint: {
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

    // Keep only the points around the view; the full lists stay in React state.
    map.on('moveend', () => syncPoints(map))

    // The heavy-rain model is citywide at zoom 10 and closer; say so when zoomed further out.
    const stormNote = () => {
      latest.current.onStormNote(map.getZoom() < STORM_MIN_ZOOM ? 'Zoom in to New York City to see the heavy-rain model.' : null)
    }

    const onSensor = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0]
      if (latest.current.isDrawing || !f) return
      const p = f.properties
      new maplibregl.Popup({ offset: 8 }).setLngLat(e.lngLat).setDOMContent(popup([
        String(p.street_name || p.sensor_name || 'FloodNet sensor'),
        `${p.events} recorded floods`,
        `Deepest: ${(Number(p.max_depth) || 0).toFixed(1)} in`,
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
    map.on('zoomend', stormNote)
    for (const id of ['sensors', 'floods'] as const) {
      map.on('click', id, id === 'sensors' ? onSensor : onFlood)
      map.on('mouseenter', id, pointer(true))
      map.on('mouseleave', id, pointer(false))
    }
    map.on('click', (e) => { if (latest.current.isDrawing) latest.current.onDrawClick([e.lngLat.lng, e.lngLat.lat]) })
    map.on('mousemove', (e) => { if (latest.current.isDrawing) latest.current.onDrawMove([e.lngLat.lng, e.lngLat.lat]) })

    return () => {
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

  // Data and selection.
  useEffect(() => { if (mapRef.current) syncPoints(mapRef.current) }, [props.sensors, props.floods])
  useEffect(() => { (mapRef.current?.getSource('sel') as GeoJSONSource | undefined)?.setData(props.circle ?? EMPTY) }, [props.circle])

  // Layer toggles.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const id of LAYER_IDS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', props.layers[id] ? 'visible' : 'none')
    }
  }, [props.layers])

  useEffect(() => {
    const canvas = mapRef.current?.getCanvas()
    if (canvas) canvas.style.cursor = props.isDrawing ? 'crosshair' : ''
  }, [props.isDrawing])

  useEffect(() => {
    if (props.flyTo) mapRef.current?.flyTo({ center: props.flyTo.center, zoom: props.flyTo.zoom })
  }, [props.flyTo])

  return <div ref={containerRef} className="flood-map" role="region" aria-label="Flood map" />
}
