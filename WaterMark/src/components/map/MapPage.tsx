// /map: the 2D flood map, circle-an-area tool and data panel (Ryan L).
// Open a place directly with /map?lat=40.68&lon=-74.01&z=14&label=Red%20Hook
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { FloodMap, type FlyTarget } from './FloodMap'
import { TopBar } from './TopBar'
import { LayersCard } from './LayersCard'
import { CollapsedPanel, DataPanel } from './DataPanel'
import { AreaReport } from './AreaReport'
import { AlertsList } from './AlertsList'
import { SourcesList } from '../sources/SourcesList'
import { useColorScheme } from '../../hooks/useColorScheme'
import { useGlobalLayers } from '../../hooks/useGlobalLayers'
import { useAreaReport } from '../../hooks/useAreaReport'
import { useDraggablePanel } from '../../hooks/useDraggablePanel'
import { usePresence } from '../../hooks/usePresence'
import { distanceKm, makeCircle } from '../../scripting/geo'
import type { GeocodedPlace } from '../../services/geocoding/photon'
import type { LayerId, LayerVisibility, LngLat, Selection } from '../../scripting/types'
import '../../styling/map-page.css'

const DEFAULT = { lat: 40.5755, lon: -73.986, z: 13, label: 'Coney Island' }
const HINT_MS = 4000
// On phones the layers card and the data sheet share the screen, so opening one folds the other.
const isPhone = () => matchMedia('(max-width: 700px)').matches

function select(center: LngLat, radiusKm: number, label: string): Selection {
  return { center, radiusKm, label, circle: makeCircle(center, radiusKm) }
}

export default function MapPage() {
  const [params] = useSearchParams()
  const start = useMemo(() => ({
    center: [Number(params.get('lon')) || DEFAULT.lon, Number(params.get('lat')) || DEFAULT.lat] as LngLat,
    zoom: Number(params.get('z')) || DEFAULT.z,
    label: params.get('label') || DEFAULT.label,
  }), [params])

  const { scheme } = useColorScheme()
  const { sensors, floods } = useGlobalLayers()
  const [selection, setSelection] = useState<Selection>(() => select(start.center, 1, start.label))
  const { report, retry } = useAreaReport(selection)
  const panel = useDraggablePanel()
  const isPanelOpen = panel.mode === 'open'
  const panelPresence = usePresence(isPanelOpen)
  const cardPresence = usePresence(!isPanelOpen)
  const [isMapBusy, setIsMapBusy] = useState(true)

  const [layers, setLayers] = useState<LayerVisibility>({ rain: true, floods: true, sensors: true, storm: true, fema: false })
  const [stormNote, setStormNote] = useState<string | null>(null)
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null)
  const [isLayersOpen, setIsLayersOpen] = useState(false)

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
    choose(select(drawCenter, km, 'Your selected area'))
  }
  const onDrawMove = (at: LngLat) => {
    if (drawCenter) setPreview(makeCircle(drawCenter, distanceKm(drawCenter, at)))
  }

  const onPick = (place: GeocodedPlace) => {
    const center: LngLat = [place.lon, place.lat]
    setFlyTo({ center, zoom: 14 })
    choose(select(center, 1, place.label))
  }

  const alertCount = Array.isArray(report.alerts) ? report.alerts.length : 0
  const isReportLoading = Object.values(report).some((v) => v === null)

  return (
    <main className="map-page">
      <FloodMap
        scheme={scheme}
        initialCenter={start.center}
        initialZoom={start.zoom}
        layers={layers}
        sensors={sensors}
        floods={floods}
        circle={preview ?? selection.circle}
        isDrawing={isDrawing}
        flyTo={flyTo}
        onDrawClick={onDrawClick}
        onDrawMove={onDrawMove}
        onStormNote={setStormNote}
        onBusyChange={setIsMapBusy}
      />
      <TopBar
        isDrawing={isDrawing}
        onToggleDraw={isDrawing ? stopDrawing : startDrawing}
        searchNear={selection.center}
        onPick={onPick}
      />
      <LayersCard layers={layers} onToggle={(id: LayerId, on) => setLayers((l) => ({ ...l, [id]: on }))}
        floods={floods} stormNote={stormNote} isOpen={isLayersOpen} onOpenChange={onLayersOpenChange} />
      {panelPresence.isMounted ? (
        <DataPanel
          title={selection.label}
          alertCount={alertCount}
          panelRef={panel.panelRef}
          style={panel.style}
          handleProps={panel.handleProps}
          onCollapse={() => panel.setMode('stowed')}
          isClosing={panelPresence.isClosing}
          onAnimationEnd={panelPresence.onAnimationEnd}
          area={<AreaReport selection={selection} report={report} onRetry={retry} sensors={sensors} floods={floods} />}
          alerts={<AlertsList alerts={report.alerts} />}
          sources={<SourcesList isToggleable={false} />}
        />
      ) : null}
      {cardPresence.isMounted ? (
        <CollapsedPanel title={selection.label} alertCount={alertCount} onOpen={openPanel}
          isClosing={cardPresence.isClosing} onAnimationEnd={cardPresence.onAnimationEnd} />
      ) : null}
      <span className={isMapBusy || isReportLoading ? 'map-progress is-busy' : 'map-progress'} aria-hidden="true" />
      {hint ? <p className="map-hint" role="status">{hint.text}</p> : null}
    </main>
  )
}
