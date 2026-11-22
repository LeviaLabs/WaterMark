// Map colors per color scheme. MapLibre paints with literal colors, not CSS variables, so these
// copy values from styling/tokens.css: --kind-scenario for the stormwater model, --kind-official for
// flooded sensors, --flood-0..6 for the flood-history classes (one blue hue from dim to
// bright, neighboring steps about 10 OKLab units or more apart) and --map-glow for the focus edge.
// Keep them in sync with tokens.css.
import type { ColorScheme } from './types'

export interface MapPalette {
  style: string
  /** Basemap retouch: background, water and label colors laid over the OpenFreeMap style. */
  basemap: { background: string; water: string; label: string; labelHalo: string; road: string; border: string }
  selectionLine: string
  selectionFill: string
  selectionFillOpacity: number
  sensorStroke: string
  sensorFlooded: string
  hollow: string
  storm: [nuisance: string, deep: string]
  stormOpacity: [nuisance: number, deep: number]
  /** Flood-history colors: [none recorded, then five classes from fewest to most]. Mirrors --flood-0..6. */
  flood: readonly string[]
  regionLine: string
  hoverLine: string
  /** Everything outside the focused region. */
  mask: string
  maskOpacity: number
  /** The soft light around the focused region's edge, and the crisp edge itself. */
  glow: string
  focusLine: string
}

export const MAP_PALETTES: Record<ColorScheme, MapPalette> = {
  light: {
    style: 'https://tiles.openfreemap.org/styles/positron',
    basemap: { background: '#f1f3f6', water: '#e2e7ed', label: '#4a5565', labelHalo: 'rgba(241, 243, 246, 0.95)', road: '#d5dbe2', border: '#b3bcc8' },
    selectionLine: '#0b1220', selectionFill: '#2563eb', selectionFillOpacity: 0.08,
    sensorStroke: '#0b1220', sensorFlooded: '#c2410c', hollow: '#ffffff',
    storm: ['#2563eb', '#1e3a8a'], stormOpacity: [0.35, 0.6],
    flood: ['#e9ebef', '#c4d6f1', '#98b9ea', '#6c97de', '#4073cb', '#2352a8', '#10306f'],
    regionLine: '#5b6677', hoverLine: '#0b1220',
    mask: '#f1f3f6', maskOpacity: 0.72, glow: '#2563eb', focusLine: '#0b1220',
  },
  dark: {
    style: 'https://tiles.openfreemap.org/styles/dark',
    basemap: { background: '#07090d', water: '#030407', label: '#c3cad5', labelHalo: 'rgba(3, 4, 7, 0.95)', road: '#161b24', border: '#2b323d' },
    selectionLine: '#ffffff', selectionFill: '#7cc4ff', selectionFillOpacity: 0.08,
    sensorStroke: '#e7f3f9', sensorFlooded: '#ff8f6b', hollow: '#0a0f18',
    storm: ['#3fa9ff', '#a6dcff'], stormOpacity: [0.4, 0.7],
    flood: ['#1b222d', '#16305c', '#1b478c', '#2263bd', '#2f83e3', '#55a6f7', '#9dd2ff'],
    regionLine: '#8b97a8', hoverLine: '#ffffff',
    mask: '#020306', maskOpacity: 0.76, glow: '#6fb6ff', focusLine: '#eef6ff',
  },
}

export const ALERT_COLOR = { Red: '#c2372b', Orange: '#e07b1f', Green: '#3d8b57' } as const

export const ZONE_TEXT: Record<string, string> = {
  AE: 'High risk. A 1% chance of flooding each year; flood insurance is required for most mortgages.',
  A: 'High risk. A 1% chance of flooding each year; no detailed flood elevation was mapped.',
  AO: 'High risk from shallow flooding (1 to 3 feet).',
  VE: 'Highest risk. Coastal flooding with waves of 3 feet or more.',
  X: 'Moderate to low risk. Shaded X areas have a 0.2% annual chance; unshaded X is minimal risk.',
}
export const HIGH_RISK_ZONES = new Set(['AE', 'A', 'AO', 'VE'])
