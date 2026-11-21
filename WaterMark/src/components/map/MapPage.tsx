// /map: the 2D flood map, circle-an-area tool and data panel (Ryan L).
// Open a place directly with /map?lat=40.68&lon=-74.01&z=14&label=Red%20Hook
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { FloodMap, type FlyTarget } from './FloodMap'
import { TopBar } from './TopBar'
import { LayersCard } from './LayersCard'
import { DataPanel, StowTab } from './DataPanel'
import { AreaReport } from './AreaReport'
import { AlertsList } from './AlertsList'
import { SourcesList } from '../sources/SourcesList'
import { useColorScheme } from '../../hooks/useColorScheme'
import { useGlobalLayers } from '../../hooks/useGlobalLayers'
import { useAreaReport } from '../../hooks/useAreaReport'
import { useDraggablePanel } from '../../hooks/useDraggablePanel'
import { distanceKm, makeCircle } from '../../scripting/geo'
import { searchPlace } from '../../services/pointLookups'
import type { LayerId, LayerVisibility, LngLat, Selection } from '../../scripting/types'
import '../../styling/map-page.css'

const DEFAULT = { lat: 40.5755, lon: -73.986, z: 13, label: 'Coney Island' }
const HINT_MS = 4000

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
  const { sensors, floods, claims } = useGlobalLayers()
  const [selection, setSelection] = useState<Selection>(() => select(start.center, 1, start.label))
  const report = useAreaReport(selection)
  const panel = useDraggablePanel()

  const [layers, setLayers] = useState<LayerVisibility>({ rain: true, floods: true, sensors: true, storm: true, fema: false })
  const [stormNote, setStormNote] = useState<string | null>(null)
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null)
  const [isSearching, setIsSearching] = useState(false)

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

  const openPanel = () => panel.setMode('open')
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

  const onSearch = async (text: string) => {
    setIsSearching(true)
    try {
      const hit = await searchPlace(text)
      if (!hit) { setHint({ text: `Couldn't find "${text}". Try a ZIP code or add the city.`, transient: true }); return }
      setFlyTo({ center: hit.center, zoom: 14 })
      choose(select(hit.center, 1, hit.label))
    } catch {
      setHint({ text: "Place search isn't responding. Try again in a moment.", transient: true })
    } finally {
      setIsSearching(false)
    }
  }

  const alertCount = Array.isArray(report.alerts) ? report.alerts.length : 0

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
      />
      <TopBar
        isDrawing={isDrawing}
        onToggleDraw={isDrawing ? stopDrawing : startDrawing}
        onSearch={onSearch}
        isSearching={isSearching}
        showReopen={panel.mode === 'closed'}
        onReopen={openPanel}
      />
      <LayersCard layers={layers} onToggle={(id: LayerId, on) => setLayers((l) => ({ ...l, [id]: on }))}
        floods={floods} stormNote={stormNote} />
      {panel.mode === 'open' ? (
        <DataPanel
          title={selection.label}
          alertCount={alertCount}
          panelRef={panel.panelRef}
          style={panel.style}
          handleProps={panel.handleProps}
          onStow={() => panel.setMode('stowed')}
          onClose={() => panel.setMode('closed')}
          area={<AreaReport selection={selection} report={report} sensors={sensors} floods={floods} claims={claims} />}
          alerts={<AlertsList alerts={report.alerts} />}
          sources={<SourcesList isToggleable={false} />}
        />
      ) : null}
      {panel.mode === 'stowed' ? <StowTab onOpen={openPanel} /> : null}
      {hint ? <p className="map-hint" role="status">{hint.text}</p> : null}
    </main>
  )
}
