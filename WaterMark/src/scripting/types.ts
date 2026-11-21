// Shared types for the map page. Each provider adapter in services/ returns one of these shapes,
// so components never depend on raw upstream payloads.
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson'

export type LngLat = [number, number]
export type ColorScheme = 'light' | 'dark'

/** A value that is still loading (null), failed ('error'), or loaded. */
export type Loadable<T> = T | null | 'error'

export interface SensorProps {
  sensor_id: string
  sensor_name?: string
  street_name?: string
  date_installed?: string
  /** Flood events this sensor recorded (FloodNet). */
  events: number
  /** Deepest recorded flood, inches. */
  max_depth: number
  last_flood: string | null
}
export type SensorCollection = FeatureCollection<Point, SensorProps>

export type AlertLevel = 'Red' | 'Orange' | 'Green'
export interface GlobalFloodProps {
  name: string
  alertlevel: AlertLevel
  color: string
  active: boolean
  fromdate: string
  todate: string
  report: string
}
export type GlobalFloodCollection = FeatureCollection<Point, GlobalFloodProps>

export interface Selection {
  center: LngLat
  radiusKm: number
  label: string
  circle: Feature<Polygon>
}

export interface RainForecast {
  time: string[]
  /** Daily totals, inches. */
  precipitation_sum: number[]
  precipitation_probability_max?: (number | null)[]
}
export interface RiverForecast {
  time: string[]
  /** m³/s */
  river_discharge: (number | null)[]
}
export interface FloodZone {
  FLD_ZONE: string
  ZONE_SUBTY?: string | null
}
export interface StormShare {
  /** Percent of the circle modeled at 4 in to 1 ft. */
  nuisance: number
  /** Percent of the circle modeled at 1 ft or deeper. */
  deep: number
  /** True when the service hit its feature limit, so the share is a lower bound. */
  partial: boolean
  none: boolean
}
export interface WeatherAlert {
  event: string
  headline?: string
  instruction?: string
  ends?: string | null
  expires?: string | null
}

export interface AreaReport {
  rain: Loadable<RainForecast>
  river: Loadable<RiverForecast>
  zone: Loadable<FloodZone | 'none'>
  storm: Loadable<StormShare>
  zip: Loadable<string>
  alerts: Loadable<WeatherAlert[]>
}

export type LayerId = 'rain' | 'floods' | 'sensors' | 'storm' | 'fema'
export type LayerVisibility = Record<LayerId, boolean>

export type PanelMode = 'open' | 'stowed' | 'closed'
