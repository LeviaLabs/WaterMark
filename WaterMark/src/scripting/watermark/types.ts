import type { ResultStatus } from '../evidence/contract'

/** Routes the accepted M5 contract allows. `/flood-zones` is not one of them. */
export const WATERMARK_PATHS = [
  '/health',
  '/location-summary',
  '/rainfall',
  '/alerts',
  '/flood-exposure',
  '/area-summary',
  '/series',
] as const

export type WatermarkPath = (typeof WATERMARK_PATHS)[number]

export const SERIES_KINDS = [
  'rainfall',
  'river_discharge',
  'historical_observations',
  'historical_flood_events',
] as const

export type SeriesKind = (typeof SERIES_KINDS)[number]

/** The handler reads at most 4 KB before it returns 413. */
export const AREA_BODY_LIMIT = 4096

export class WatermarkApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'WatermarkApiError'
    this.code = code
    this.status = status
  }
}

export interface ApiSample {
  validFrom: string
  validTo: string
  value: number | null
}

/** Alert fields the map already classifies. Backend timing is kept when all three are present. */
export interface ApiAlert {
  event: string
  headline?: string | null
  instruction?: string | null
  severity?: string | null
  status?: string | null
  messageType?: string | null
  onset?: string | null
  effective?: string | null
  ends?: string | null
  expires?: string | null
  hazardTiming?: 'upcoming' | 'active' | 'ended' | 'unknown'
  messageValidity?: 'in_force' | 'upcoming' | 'expired' | 'unknown'
  floodRelevance?: 'flood_hazard_notice' | 'multi_hazard_context'
}

export interface ApiFailure {
  code: string
  message: string
}

export interface ApiResult<T> {
  status: ResultStatus
  sourceName: string
  sourceUrl: string | null
  fetchedAt: string | null
  units: string | null
  limitations: string[]
  qualityFlags: string[]
  error: ApiFailure | null
  data: T | null
}

export interface AreaMetrics {
  stationCount: number | null
  cachedEventCount: number | null
  sampledHistoricalMaxDepthMm: number | null
  coverageStatus: string
  zeroMatchesVerified: boolean
  windowStart: string | null
  windowEnd: string | null
  cacheOldestFetchedAt: string | null
  cacheNewestFetchedAt: string | null
  radiusMeters: number
  center: { lat: number; lon: number }
}

export interface FloodCounts {
  stationCount: number | null
  eventCount: number | null
  zeroEventMatchesVerified: boolean
}

export interface SeriesCount {
  count: number | null
}

export interface WatermarkReport {
  generatedAt: string | null
  /** Ready means this process answered. It is not a claim that every provider is up. */
  health: 'ready' | 'error'
  healthDetail: ApiFailure | null
  rainfall: ApiResult<ApiSample[]>
  river: ApiResult<ApiSample[]>
  alerts: ApiResult<ApiAlert[]>
  exposure: ApiResult<null>
  floods: ApiResult<FloodCounts>
  area: ApiResult<AreaMetrics>
  series: ApiResult<SeriesCount>
  request: { center: { lat: number; lon: number }; radiusMeters: number }
  /** True when the circle on the map was outside 100 m–10 km and the request was clamped. */
  radiusClamped: boolean
}
