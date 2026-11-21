// Map colors per color scheme. The dark map brightens data colors so they stay visible at night.
import type { ColorScheme } from './types'

export interface MapPalette {
  style: string
  selectionLine: string
  selectionFillOpacity: number
  sensorStroke: string
  hollow: string
  storm: [nuisance: string, deep: string]
  stormOpacity: [nuisance: number, deep: number]
}

export const MAP_PALETTES: Record<ColorScheme, MapPalette> = {
  light: {
    style: 'https://tiles.openfreemap.org/styles/positron',
    selectionLine: '#d9a10f', selectionFillOpacity: 0.1, sensorStroke: '#12324a', hollow: '#ffffff',
    storm: ['#2c7a86', '#1b5560'], stormOpacity: [0.4, 0.65],
  },
  dark: {
    style: 'https://tiles.openfreemap.org/styles/dark',
    selectionLine: '#f5c437', selectionFillOpacity: 0.04, sensorStroke: '#e8edef', hollow: '#14212b',
    storm: ['#3fb7c9', '#8be3ef'], stormOpacity: [0.45, 0.75],
  },
}

export const ALERT_COLOR = { Red: '#c2372b', Orange: '#e07b1f', Green: '#3d8b57' } as const
export const SENSOR_FLOODED = '#e0453a'

export const ZONE_TEXT: Record<string, string> = {
  AE: 'High risk. A 1% chance of flooding each year; flood insurance is required for most mortgages.',
  A: 'High risk. A 1% chance of flooding each year; no detailed flood elevation was mapped.',
  AO: 'High risk from shallow flooding (1 to 3 feet).',
  VE: 'Highest risk. Coastal flooding with waves of 3 feet or more.',
  X: 'Moderate to low risk. Shaded X areas have a 0.2% annual chance; unshaded X is minimal risk.',
}
export const HIGH_RISK_ZONES = new Set(['AE', 'A', 'AO', 'VE'])
