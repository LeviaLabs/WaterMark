// /map: the 2D flood map, circle-an-area tool and data panel (Ryan L).
// It opens on the whole world colored by floods per country. Clicking a country focuses it: the
// camera glides in, the rest of the world goes dark and its provinces (in the US, states and then
// counties) take the color, clickable straight away. Clicking inside a province or county selects
// that spot and zooms in; the area data loads for it. Search and the circle tool select a spot directly.
// Open a place directly with /map?lat=40.68&lon=-74.01&z=14&label=Red%20Hook
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { FloodMap, type FlyTarget } from './FloodMap'
import { TopBar } from './TopBar'
import { LayersCard } from './LayersCard'
import { CollapsedPanel, DataPanel } from './DataPanel'
import { AreaReport } from './AreaReport'
import { AlertsList } from './AlertsList'
import { MapLegend } from './MapLegend'
import { RegionSummary } from './RegionSummary'
import { Assistant } from './Assistant'
import { SourcesList } from '../sources/SourcesList'
import { useColorScheme } from '../../hooks/useColorScheme'
import { useGlobalLayers } from '../../hooks/useGlobalLayers'
import { useAreaReport } from '../../hooks/useAreaReport'
import { useFloodHistory } from '../../hooks/useFloodHistory'
import { useDraggablePanel } from '../../hooks/useDraggablePanel'
import { usePresence } from '../../hooks/usePresence'
import { distanceKm, makeCircle } from '../../scripting/geo'
import { bboxesOverlap, NYC_BOUNDS, touchesNYC, type BBox } from '../../scripting/region'
import { DETAIL_ZOOM, pathTo } from '../../scripting/choropleth'
import { cellAt, cellWidthKm, squareOf } from '../../scripting/cells'
import { gridAt, regionPathAt } from './regionLayers'
import { contextText } from '../../scripting/assistant'
import { UNITS } from '../../scripting/format'
import { fetchPlaceName, type GeocodedPlace } from '../../services/geocoding/photon'
import type { LayerId, LayerVisibility, LngLat, RegionLevel, RegionPick, Selection } from '../../scripting/types'
import '@fontsource-variable/bricolage-grotesque/index.css'
import '@fontsource-variable/instrument-sans/index.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import '../../styling/map-page.css'
import '../../styling/map-premium.css'
import '../../styling/assistant.css'

const HINT_MS = 4000
// On phones the layers card and the data sheet share the screen, so opening one folds the other.
const isPhone = () => matchMedia('(max-width: 700px)').matches
// The whole world in view at any width: about 300 degrees of longitude across the screen
// (a zoom-0 world is 512 px wide), never closer than 1.7 so wide screens still see every continent.
const WORLD = { center: [12, 22] as LngLat, zoom: () => Math.min(1.7, Math.max(0, Math.log2(innerWidth / 430))) }
// The lower 48 states: flying to the whole US (Alaska to Guam) would leave them tiny.
const US_FOCUS: [number, number, number, number] = [-125, 24.5, -66.9, 49.5]
const MAX_ZOOM: Record<RegionLevel, number> = { country: 7, admin1: 9, state: 8.5, county: 9.5 }

const AREA_LABEL = 'Your selected area'
const SPOT_LABEL = 'Selected square'
// Zoomed in to here when a square is picked: the whole square in view, its streets just visible.
const SQUARE_MAX_ZOOM = 9

function select(center: LngLat, radiusKm: number, label: string): Selection {
  return { center, radiusKm, label, circle: makeCircle(center, radiusKm) }
}

export default function MapPage() {
  const [params] = useSearchParams()
  // A shared link with lat and lon opens on that spot with it selected; otherwise the world.
  const start = useMemo(() => {
    const lat = Number(params.get('lat'))
    const lon = Number(params.get('lon'))
    const has = params.has('lat') && params.has('lon') && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    return has
      ? { center: [lon, lat] as LngLat, zoom: Number(params.get('z')) || 14, label: params.get('label') || 'Shared location', isSpot: true }
      : { center: WORLD.center, zoom: WORLD.zoom(), label: '', isSpot: false }
  }, [params])

  const { scheme } = useColorScheme()
  const [selection, setSelection] = useState<Selection | null>(() => (start.isSpot ? select(start.center, 1, start.label) : null))
  // World > country > (province | state > county): the regions focused, outermost first.
  const [path, setPath] = useState<RegionPick[]>([])
  const loaded = useFloodHistory(path)
  // The time slider: one year of the flood squares, or all years (null). A year the shown grid has
  // no data for (NOAA starts in 2016) falls back to all years when you focus the US.
  const [pickedYear, setPickedYear] = useState<number | null>(null)
  const gridKind = path[0]?.props.k === 'USA' ? 'us' : 'world'
  const yearRange = loaded.index?.cells[gridKind].years
  const year = pickedYear != null && yearRange && (pickedYear < yearRange[0] || pickedYear > yearRange[1]) ? null : pickedYear
  const history = useMemo(() => ({ ...loaded, year }), [loaded, year])
  const region = path.at(-1) ?? null

  // FloodNet covers NYC only, so its tables download the first time NYC is on screen up close or selected.
  const [view, setView] = useState<{ isNyc: boolean; zoom: number }>({ isNyc: false, zoom: start.zoom })
  const onViewChange = useCallback((b: BBox, zoom: number) => {
    const isNyc = zoom >= 7 && bboxesOverlap(b, NYC_BOUNDS)
    setView((v) => (v.isNyc === isNyc && Math.abs(v.zoom - zoom) < 0.01 ? v : { isNyc, zoom }))
  }, [])
  const { sensors, floods } = useGlobalLayers(view.isNyc || (selection ? touchesNYC(selection.circle) : false))
  const { report, retry } = useAreaReport(selection)

  // A clicked spot or a drawn circle has no name of its own: name it from the reverse lookup.
  const [placeName, setPlaceName] = useState<{ for: Selection; name: string } | null>(null)
  useEffect(() => {
    if (!selection || (selection.label !== AREA_LABEL && selection.label !== SPOT_LABEL)) return
    const ctl = new AbortController()
    fetchPlaceName(selection.center, ctl.signal).then((name) => {
      if (name) setPlaceName({ for: selection, name: selection.label === AREA_LABEL ? `Area around ${name}` : `Square around ${name}` })
    }, () => {})
    return () => ctl.abort()
  }, [selection])
  const panel = useDraggablePanel()
  const isPanelOpen = panel.mode === 'open'
  const panelPresence = usePresence(isPanelOpen)
  const cardPresence = usePresence(!isPanelOpen)
  const [isMapBusy, setIsMapBusy] = useState(true)

  // The rain radar starts off: over the flood colors it reads as noise. It is one toggle away, and
  // each spot's own rain forecast is in the panel.
  // Overlays start off, and only one shows at a time so the flood squares stay readable.
  const [layers, setLayers] = useState<LayerVisibility>({ rain: false, floods: false, sensors: false, storm: false, fema: false })
  const showOverlay = (id: LayerId, on: boolean) =>
    setLayers({ rain: false, floods: false, sensors: false, storm: false, fema: false, [id]: on })
  const [stormNote, setStormNote] = useState<string | null>(null)
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null)
  const [isLayersOpen, setIsLayersOpen] = useState(false)
  // The assistant starts closed: a tab at the bottom of the map opens it.
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)

  // Circle tool: first click sets the center, the second sets the edge.
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawCenter, setDrawCenter] = useState<LngLat | null>(null)
  const [preview, setPreview] = useState<Selection['circle'] | null>(null)
  const [hint, setHint] = useState<{ text: string; transient: boolean } | null>(null)

  const stopDrawing = useCallback(() => {
    setIsDrawing(false); setDrawCenter(null); setPreview(null); setHint(null)
  }, [])

  useEffect(() => {
    if (!isDrawing) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') stopDrawing() }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [isDrawing, stopDrawing])

  useEffect(() => {
    if (!hint?.transient) return
    const t = setTimeout(() => setHint(null), HINT_MS)
    return () => clearTimeout(t)
  }, [hint])

  const startDrawing = () => {
    setIsDrawing(true)
    setHint({ text: 'Click the center of the area. Press Esc to cancel.', transient: false })
  }

  const openPanel = () => {
    panel.setMode('open')
    if (isPhone()) setIsLayersOpen(false)
  }
  const onLayersOpenChange = (isOpen: boolean) => {
    setIsLayersOpen(isOpen)
    if (isOpen && isPhone() && panel.mode === 'open') panel.setMode('stowed')
  }
  const choose = (s: Selection) => { setSelection(s); if (panel.mode !== 'open') openPanel() }

  const onDrawClick = (at: LngLat) => {
    if (!drawCenter) {
      setDrawCenter(at)
      setHint({ text: 'Now click the edge of the area.', transient: false })
      return
    }
    const km = distanceKm(drawCenter, at)
    stopDrawing()
    choose(select(drawCenter, km, AREA_LABEL))
  }
  const onDrawMove = (at: LngLat) => {
    if (drawCenter) setPreview(makeCircle(drawCenter, distanceKm(drawCenter, at)))
  }

  const onPick = (place: GeocodedPlace) => {
    const center: LngLat = [place.lon, place.lat]
    setFlyTo({ center, zoom: 14 })
    choose(select(center, 1, place.label))
  }

  // Parents of a picked region (the US above a state) come from the loaded files.
  const find = useCallback((level: RegionLevel, k: string): RegionPick | null => {
    const fc = level === 'country' ? history.countries : level === 'state' ? history.states : null
    const props = fc?.features.find((f) => f.properties.k === k)?.properties
    return props ? { level, props } : null
  }, [history.countries, history.states])

  const flyToRegion = (pick: RegionPick) => {
    const bounds = pick.level === 'country' && pick.props.k === 'USA' ? US_FOCUS : pick.props.b
    setFlyTo({ bounds, maxZoom: MAX_ZOOM[pick.level] })
  }

  // Focus a region: fly there, dim the rest and show its record. A new region clears the spot,
  // whose data belonged to the place you just left.
  const onRegionClick = (pick: RegionPick) => {
    setPath(pathTo(pick, path, find))
    setSelection(null)
    flyToRegion(pick)
    if (panel.mode !== 'open' && !isPhone()) openPanel()
  }
  const goTo = (depth: number) => {
    const next = path.slice(0, depth)
    setPath(next)
    setSelection(null)
    const last = next.at(-1)
    if (last) flyToRegion(last)
    else setFlyTo({ center: WORLD.center, zoom: WORLD.zoom() })
  }
  // A click inside a province or county (or anywhere at street zoom) picks the grid square there:
  // its flood record, plus the forecasts and history at its middle.
  const onSpotClick = (at: LngLat, shouldZoom: boolean) => {
    const grid = gridAt(at, history)
    if (!grid) return choose(select(at, 5, SPOT_LABEL))
    const cell = cellAt(at, grid)
    const [w, s0, e, n] = cell.bounds
    const center: LngLat = [(w + e) / 2, (s0 + n) / 2]
    if (shouldZoom) setFlyTo({ bounds: cell.bounds, maxZoom: SQUARE_MAX_ZOOM })
    choose({ center, radiusKm: cellWidthKm(cell.bounds) / 2, label: SPOT_LABEL, cell,
      circle: { type: 'Feature', properties: {}, geometry: squareOf(cell.bounds) } })
  }

  // The assistant opened a place: focus its country (and US state) so the veil never hides it, fly
  // to the grid square there and select it. On phones the chat covers the panel, so it stays shut.
  const showFromAssistant = (at: LngLat, label: string) => {
    setPath(regionPathAt(at, history))
    const grid = gridAt(at, history)
    if (!grid) {
      setFlyTo({ center: at, zoom: 9 })
      setSelection(select(at, 5, label))
      return
    }
    const cell = cellAt(at, grid)
    const [w, s0, e, n] = cell.bounds
    setFlyTo({ bounds: cell.bounds, maxZoom: SQUARE_MAX_ZOOM })
    setSelection({ center: [(w + e) / 2, (s0 + n) / 2], radiusKm: cellWidthKm(cell.bounds) / 2, label: SPOT_LABEL, cell,
      circle: { type: 'Feature', properties: {}, geometry: squareOf(cell.bounds) } })
    if (!isPhone() && panel.mode !== 'open') openPanel()
  }

  useEffect(() => {
    if (!path.length || isDrawing) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) goTo(path.length - 1) }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  const alertCount = Array.isArray(report.alerts) ? report.alerts.length : 0
  const isReportLoading = selection ? Object.values(report).some((v) => v === null) : false
  const crumbName = (p: RegionPick) => (p.level === 'county' ? `${p.props.n} County` : p.level === 'country' && p.props.k === 'USA' ? 'United States' : p.props.n)
  const named = placeName && placeName.for === selection ? placeName.name : null
  const title = selection
    ? named ?? (selection.label === SPOT_LABEL && region ? `Square in ${crumbName(region)}` : selection.label)
    : region ? (region.level === 'county' && region.props.s ? `${crumbName(region)}, ${region.props.s}` : crumbName(region)) : 'Floods around the world'
  const zoomHint = !selection && view.zoom >= DETAIL_ZOOM ? 'Click a spot on the map to see the data there.' : null

  return (
    <main className="map-page">
      <FloodMap
        scheme={scheme}
        initialCenter={start.center}
        initialZoom={start.zoom}
        layers={layers}
        sensors={sensors}
        floods={floods}
        circle={preview ?? selection?.circle ?? null}
        isDrawing={isDrawing}
        flyTo={flyTo}
        regions={history}
        onRegionClick={onRegionClick}
        onSpotClick={onSpotClick}
        onDrawClick={onDrawClick}
        onDrawMove={onDrawMove}
        onStormNote={setStormNote}
        onViewChange={onViewChange}
        onBusyChange={setIsMapBusy}
      />
      <TopBar
        isDrawing={isDrawing}
        onToggleDraw={isDrawing ? stopDrawing : startDrawing}
        searchNear={selection?.center ?? null}
        onPick={onPick}
      />
      <LayersCard layers={layers} onToggle={showOverlay}
        floods={floods} stormNote={stormNote} isOpen={isLayersOpen} onOpenChange={onLayersOpenChange}
        legend={isLayersOpen || view.zoom >= 12 ? null : <MapLegend grid={gridKind} index={history.index} year={year} onYearChange={setPickedYear} />} />
      {path.length ? (
        <nav className="map-crumbs" aria-label="Map focus">
          <button type="button" className="map-crumb map-crumb--back" onClick={() => goTo(path.length - 1)} aria-label="Back out one level">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" /></svg>
          </button>
          <button type="button" className="map-crumb" onClick={() => goTo(0)}>World</button>
          {path.map((p, i) => (
            <button key={p.level + p.props.k} type="button" className="map-crumb" aria-current={i === path.length - 1 ? 'location' : undefined}
              onClick={() => goTo(i + 1)}>{crumbName(p)}</button>
          ))}
        </nav>
      ) : null}
      {panelPresence.isMounted ? (
        <DataPanel
          title={title}
          subject={selection ? `${selection.center.join()}:${selection.radiusKm}` : region ? `${region.level}:${region.props.k}` : 'world'}
          alertCount={alertCount}
          panelRef={panel.panelRef}
          style={panel.style}
          handleProps={panel.handleProps}
          onCollapse={() => panel.setMode('stowed')}
          isClosing={panelPresence.isClosing}
          presence={panelPresence.bind}
          area={
            <>
              {selection ? null : <RegionSummary region={region} index={history.index} status={history.status} year={year} />}
              {selection ? <AreaReport selection={selection} report={report} onRetry={retry} sensors={sensors} floods={floods}
                cellMeta={selection.cell ? history.index?.cells[selection.cell.grid] : null} year={year} /> : null}
            </>
          }
          alerts={selection ? <AlertsList alerts={report.alerts} />
            : <p className="map-meta">Select a spot to check its official alerts: click inside a region on the map, or search for a place.</p>}
          sources={<SourcesList isToggleable={false} />}
        />
      ) : null}
      {cardPresence.isMounted ? (
        <CollapsedPanel title={title} alertCount={alertCount} onOpen={openPanel}
          isClosing={cardPresence.isClosing} presence={cardPresence.bind} />
      ) : null}
      <Assistant isOpen={isAssistantOpen} onOpenChange={setIsAssistantOpen}
        placeName={region ? crumbName(region) : null}
        isUS={path[0]?.props.k === 'USA'}
        getContext={() => contextText({
          focus: path.map(crumbName),
          selection: selection ? { label: title, lat: selection.center[1], lon: selection.center[0] } : null,
          units: UNITS,
          today: new Date().toISOString().slice(0, 10),
        })}
        showOnMap={showFromAssistant} />
      <span className={isMapBusy || isReportLoading ? 'map-progress is-busy' : 'map-progress'} aria-hidden="true" />
      {hint ? <p className="map-hint" role="status">{hint.text}</p> : zoomHint && !isDrawing ? <p className="map-hint" role="status">{zoomHint}</p> : null}
    </main>
  )
}
