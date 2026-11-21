import type { EvidenceKind } from './dataSources'

export type LayerPattern = 'warning' | 'rain' | 'river' | 'stormwater' | 'sensors' | 'history'

export type EvidenceLayer = {
  id: string
  title: string
  kind: EvidenceKind
  sources: string
  summary: string
  pattern: LayerPattern
}

/** The plates of the parallax "evidence stack", top plate first. */
export const EVIDENCE_LAYERS: readonly EvidenceLayer[] = [
  {
    id: 'warnings',
    title: 'Official warnings',
    kind: 'official',
    sources: 'National Weather Service',
    summary: 'Active flood and heavy-rain alerts sit on top, exactly as the agency issued them, with a link back to the source.',
    pattern: 'warning',
  },
  {
    id: 'rain',
    title: 'Rainfall forecast',
    kind: 'forecast',
    sources: 'Open-Meteo',
    summary: 'How much rain is expected and how hard it will fall, stamped with when the forecast was issued.',
    pattern: 'rain',
  },
  {
    id: 'river',
    title: 'River flow',
    kind: 'modeled',
    sources: 'GloFAS via Open-Meteo',
    summary: 'Modeled river discharge where it exists. It is never passed off as street flooding or storm surge.',
    pattern: 'river',
  },
  {
    id: 'stormwater',
    title: 'Stormwater scenarios',
    kind: 'scenario',
    sources: 'NYC Stormwater Flood Maps',
    summary: 'Where a modeled cloudburst could pond water across New York City. A scenario, never today.',
    pattern: 'stormwater',
  },
  {
    id: 'sensors',
    title: 'Sensors & tides',
    kind: 'observed',
    sources: 'FloodNet · NOAA Tides · USGS',
    summary: 'Real readings from specific sensors, tide stations and stream gauges, each tied to its own location.',
    pattern: 'sensors',
  },
  {
    id: 'history',
    title: 'Flood history',
    kind: 'historical',
    sources: 'NYC 311 · OpenFEMA · FEMA NFHL',
    summary: 'Past reports, insurance claims and mapped flood zones show what this place has lived through before.',
    pattern: 'history',
  },
]

/** Maps scroll progress (0 to 1) through the stack to the plate in focus. */
export function activeLayerIndex(progress: number, count = EVIDENCE_LAYERS.length): number {
  const clamped = Math.min(Math.max(progress, 0), 0.9999)
  return Math.floor(clamped * count)
}
