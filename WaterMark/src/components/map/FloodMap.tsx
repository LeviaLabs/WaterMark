// The MapLibre map. MapLibre is imperative, so this component owns one map instance and syncs
// React props into it with small effects: data -> setData, layer toggles -> visibility,
// color scheme -> setStyle (overlays are re-added on "style.load").
//
// Performance: the stormwater model is our own vector tiles (services/stormwater.ts), so only the
// blocks in view load, zoomed-out blocks are simplified, and MapLibre's tile cache is capped so
// blocks far from the view are dropped instead of piling up in memory.
import { useEffect, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
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
// window size; a fixed cap keeps memory flat on long sessions and drops blocks you have left.
const TILE_CACHE = 48

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
      maxTileCacheZoomLevels: 2,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-right')

    const addOverlays = () => {
      const p = latest.current
      const t = MAP_PALETTES[shownScheme.current]
      const vis = (id: LayerId) => (p.layers[id] ? 'visible' : 'none')

      map.addSource('rain', { type: 'raster', tiles: [ENDPOINTS.imergTiles], tileSize: 256, maxzoom: 6,
        attribution: 'Rain: NASA GPM IMERG via GIBS' })
      map.addLayer({ id: 'rain', type: 'raster', source: 'rain', layout: { visibility: vis('rain') },
        paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.75, 11, 0.45], 'raster-resampling': 'linear' } })

      map.addSource('fema', { type: 'raster', tiles: [ENDPOINTS.femaTiles], tileSize: 256, attribution: 'Flood zones: FEMA NFHL' })
      map.addLayer({ id: 'fema', type: 'raster', source: 'fema', layout: { visibility: vis('fema') }, paint: { 'raster-opacity': 0.6 } })

      map.addSource('storm', {
        type: 'vector', tiles: [`${STORM_PROTOCOL}://{z}/{x}/{y}`], minzoom: STORM_MIN_ZOOM, maxzoom: STORM_MAX_ZOOM,
        attribution: 'Stormwater model: NYC MOCEJ/DEP via NYC Open Data',
      })
      map.addLayer({ id: 'storm', type: 'fill', source: 'storm', 'source-layer': 'stormwater', minzoom: STORM_MIN_ZOOM,
        layout: { visibility: vis('storm') }, paint: {
        'fill-color': ['match', ['get', 'Flooding_Category'], 2, t.storm[1], t.storm[0]],
        'fill-opacity': ['match', ['get', 'Flooding_Category'], 2, t.stormOpacity[1], t.stormOpacity[0]],
      } })

      map.addSource('sel', { type: 'geojson', data: p.circle ?? EMPTY })
      map.addLayer({ id: 'sel-fill', type: 'fill', source: 'sel', paint: { 'fill-color': t.selectionFill, 'fill-opacity': t.selectionFillOpacity } })
      map.addLayer({ id: 'sel-line', type: 'line', source: 'sel',
        paint: { 'line-color': t.selectionLine, 'line-width': 3, 'line-dasharray': [2, 1.4] } })

      map.addSource('sensors', { type: 'geojson', data: data(p.sensors), attribution: 'Sensors: FloodNet NYC' })
      map.addLayer({ id: 'sensors', type: 'circle', source: 'sensors', layout: { visibility: vis('sensors') }, paint: {
        'circle-radius': ['interpolate', ['linear'], ['coalesce', ['get', 'events'], 0], 0, 4, 10, 6, 50, 9, 150, 13],
        'circle-color': ['case', ['>', ['coalesce', ['get', 'events'], 0], 0], t.sensorFlooded, t.hollow],
        'circle-stroke-color': t.sensorStroke, 'circle-stroke-width': 1.5,
      } })

      map.addSource('floods', { type: 'geojson', data: data(p.floods), attribution: 'Floods: GDACS' })
      map.addLayer({ id: 'floods', type: 'circle', source: 'floods', layout: { visibility: vis('floods') }, paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 6, 6, 9, 10, 12],
        'circle-color': ['case', ['get', 'active'], ['get', 'color'], t.hollow],
        'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2.5,
      } })
    }
    map.on('style.load', addOverlays)

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
  useEffect(() => { (mapRef.current?.getSource('sensors') as GeoJSONSource | undefined)?.setData(data(props.sensors)) }, [props.sensors])
  useEffect(() => { (mapRef.current?.getSource('floods') as GeoJSONSource | undefined)?.setData(data(props.floods)) }, [props.floods])
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
