// Map colors per color scheme. MapLibre paints with literal colors, not CSS variables, so these
// copy values from styling/tokens.css: --kind-scenario for the stormwater model, --kind-official for
// flooded sensors, --text and --bg-raised for outlines, and the sun gold (--sun-edge) for the selection
// so it stays distinct from the cyan accent and the stormwater fill. Keep them in sync with tokens.css.
import type { ColorScheme } from './types'

export interface MapPalette {
  style: string
  selectionLine: string
  selectionFill: string
  selectionFillOpacity: number
  sensorStroke: string
  sensorFlooded: string
  hollow: string
  storm: [nuisance: string, deep: string]
  stormOpacity: [nuisance: number, deep: number]
}

export const MAP_PALETTES: Record<ColorScheme, MapPalette> = {
  light: {
    style: 'https://tiles.openfreemap.org/styles/positron',
    selectionLine: '#d99a1e', selectionFill: '#ffc65c', selectionFillOpacity: 0.14,
    sensorStroke: '#062538', sensorFlooded: '#c2410c', hollow: '#ffffff',
    storm: ['#0369a1', '#08425f'], stormOpacity: [0.35, 0.6],
  },
  dark: {
    style: 'https://tiles.openfreemap.org/styles/dark',
    selectionLine: '#ffc65c', selectionFill: '#ffc65c', selectionFillOpacity: 0.06,
    sensorStroke: '#e7f3f9', sensorFlooded: '#ff8f6b', hollow: '#082036',
    storm: ['#45c8f5', '#a5e6ff'], stormOpacity: [0.4, 0.7],
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
