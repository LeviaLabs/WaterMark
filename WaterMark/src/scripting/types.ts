// Shared types for the map page. Each provider adapter in services/ returns one of these shapes,
// so components never depend on raw upstream payloads.
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson'
import type { ClaimsSummary } from '../services/claims'
import type { DailySeries } from './climate'
import type { CellProps } from './cells'

export type LngLat = [number, number]
export type { ColorScheme } from './theme/themeStorage'

/** A value that is still loading (null), failed ('error'), or loaded. */
export type Loadable<T> = T | null | 'error'
/** Like Loadable, plus 'unsupported': the dataset does not cover this place, so nothing was asked. */
export type Coverable<T> = Loadable<T> | 'unsupported'

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
  /** The selected area: a circle, or the grid square that was clicked. */
  circle: Feature<Polygon>
  /** Set when a grid square was clicked: its flood record. */
  cell?: CellProps
}

/** Past 30 days and next 16 of daily rain at a point (Open-Meteo; the past days are model analysis). */
export interface RainOutlook {
  time: string[]
  /** Daily totals, millimeters. */
  mm: number[]
  /** Highest hourly chance of rain each day, percent (forecast days only). */
  probability: (number | null)[]
  timezone: string
}
/** GloFAS river discharge, m³/s: the control run and the ensemble spread, past 60 days and next 3 months. */
export interface RiverOutlook {
  time: string[]
  flow: (number | null)[]
  median: (number | null)[]
  p25: (number | null)[]
  p75: (number | null)[]
  min: (number | null)[]
  max: (number | null)[]
}
export interface FloodZone {
  FLD_ZONE: string
  ZONE_SUBTY?: string | null
}
/** FEMA zones for a circle: the zone at its center and every zone that touches it. */
export interface ZoneReport {
  center: FloodZone | null
  /** Distinct zone codes inside the circle, high-risk ones first. */
  inArea: string[]
}
export interface StormShare {
  /** Percent of the circle modeled at 4 in to 1 ft. */
  nuisance: number
  /** Percent of the circle modeled at 1 ft or deeper. */
  deep: number
  /** True when a big circle was measured on coarser (simplified) tiles, so shares are approximate. */
  partial: boolean
  none: boolean
}
export interface WeatherAlert {
  event: string
  headline?: string
  instruction?: string
  severity?: string
  onset?: string | null
  ends?: string | null
  expires?: string | null
}

/**
 * Worldwide lookups (rain, river) are Loadable. US-only ones (NWS alerts, FEMA zones, ZIP, NFIP
 * claims) and the NYC stormwater model are Coverable: 'unsupported' outside the area they cover.
 */
export interface AreaReport {
  rain: Loadable<RainOutlook>
  river: Loadable<RiverOutlook>
  /** Daily rain since 1991 (ERA5 reanalysis), mm. */
  rainHistory: Loadable<DailySeries>
  /** Daily river discharge since 1984 (GloFAS reanalysis), m³/s. */
  riverHistory: Loadable<DailySeries>
  /** Ground height, meters above sea level. */
  elevation: Loadable<number | null>
  /** ISO country code at the center, 'none' over open water or when unknown. */
  country: Loadable<string>
  zone: Coverable<ZoneReport>
  storm: Coverable<StormShare>
  zip: Coverable<string>
  alerts: Coverable<WeatherAlert[]>
  /** NFIP claim totals for the ZIP at the center; 'none' when the point has no US ZIP. */
  claims: Coverable<ClaimsSummary | 'none'>
}

export type LayerId = 'rain' | 'floods' | 'sensors' | 'storm' | 'fema'
export type LayerVisibility = Record<LayerId, boolean>

/**
 * Flood-history levels. Every country opens into its provinces or regions ('admin1', GDACS floods);
 * the US opens into states and then counties instead (NOAA flood reports).
 */
export type RegionLevel = 'country' | 'admin1' | 'state' | 'county'

/** Flood history of one country, US state or US county (public/data/floods, built by scripts/floods). */
export interface RegionProps {
  /** ISO 3166 alpha-3 for countries, FIPS code for states (2 digits) and counties (5 digits). */
  k: string
  /** Name. */
  n: string
  /** Events (countries, GDACS) or reports (states and counties, NOAA) over the whole period. */
  e: number
  /** Yearly average of `e`. */
  py: number
  /** Count for each year of the period, oldest first. */
  y: number[]
  /** Bounds to fly to: [west, south, east, north]. */
  b: [number, number, number, number]
  /** Parent name: the state of a county, the country of a province. */
  s?: string
  /** Kind of subdivision as the source names it ("Department", "Province"), provinces only. */
  t?: string
  /** Count for each calendar month, January first (countries, provinces and states). */
  m?: number[]
  /** US (NOAA): deaths, injuries and damage in USD (property and crops) per year. */
  d?: number[]
  i?: number[]
  $?: number[]
  /** World (GDACS): serious floods (orange or red alert) per year, and the largest flood magnitude. */
  x?: number[]
  g?: number
}

export interface RegionPick { level: RegionLevel; props: RegionProps }

export type PanelMode = 'open' | 'stowed' | 'closed'
