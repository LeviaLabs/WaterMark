/**
 * Frontend copy of the WaterMark data API v1 result types.
 *
 * Mirrors supabase/functions/_shared/contracts.ts (apiVersion "1.0", owned by
 * Decong; see docs/API_CONTRACTS.md). Only the fields the UI reads are
 * listed. Keep the names identical to the backend so a validated response
 * can be passed straight into the components in components/features/.
 *
 * ObservationSeries and AreaMetric are UI-side shapes for data the API
 * returns in less specific form today (/series and /area-summary); they are
 * proposals until Ryan Lin and Decong agree on them.
 */

export type ResultStatus = 'available' | 'stale' | 'insufficient_data' | 'unsupported' | 'error'

export type Location = { lat: number; lon: number }

export type Source = {
  id: string
  name: string
  url: string
  geographicCoverage: string
}

export type EnvironmentalResult<T> = {
  status: ResultStatus
  kind: string
  source: Source
  location: Location
  coverage: { method: string; resolution?: string }
  observedAt: string | null
  forecastIssuedAt: string | null
  validFrom: string | null
  validTo: string | null
  fetchedAt: string
  sourceUpdatedAt: string | null
  units: string | null
  data: T | null
  qualityFlags: readonly string[]
  limitations: readonly string[]
  error?: { code: string; message: string; retryAfterSeconds?: number }
}

export type Sample = { validFrom: string; validTo: string; value: number | null }

export type ForecastData = { samples: readonly Sample[]; model: string }

export type OfficialAlert = {
  id: string
  event: string
  severity: string
  urgency: string
  certainty: string
  sent: string | null
  effective: string | null
  expires: string | null
  onset: string | null
  ends: string | null
  messageType: 'Alert' | 'Update'
  hazardTiming: 'upcoming' | 'active' | 'ended' | 'unknown'
  floodRelevance: 'flood_hazard_notice' | 'multi_hazard_context'
  areaDescription: string
  headline: string | null
  instruction: string | null
  severityBasis: string
}

export type ObservationPoint = { observedAt: string; value: number | null }

export type ObservationSeries = {
  stationId: string
  stationName: string
  metric: string
  points: readonly ObservationPoint[]
}

export type AreaMetric = {
  id: string
  label: string
  /** null means unknown. It is shown as "Unknown", never as zero. */
  value: number | null
  units: string
  kind: string
  /** Positive cached counts are lower bounds, not complete surveys. */
  isLowerBound: boolean
  note: string
}

export type AreaSummaryData = {
  center: Location
  radiusMeters: number
  coverageStatus: 'complete' | 'incomplete'
  metrics: readonly AreaMetric[]
}

/** Request body for POST /area-summary. Radius bounds come from the API contract. */
export const AREA_RADIUS_LIMITS = { min: 100, max: 10_000 } as const

export function buildAreaRequest(center: Location, radiusMeters: number): { center: Location; radiusMeters: number } {
  const radius = Math.round(Math.min(Math.max(radiusMeters, AREA_RADIUS_LIMITS.min), AREA_RADIUS_LIMITS.max))
  const lat = Math.min(Math.max(center.lat, -90), 90)
  const lon = Math.min(Math.max(center.lon, -180), 180)
  return { center: { lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) }, radiusMeters: radius }
}

/** States in which a result has nothing trustworthy to draw. */
export function hasUsableData<T>(result: EnvironmentalResult<T>): result is EnvironmentalResult<T> & { data: T } {
  return (result.status === 'available' || result.status === 'stale') && result.data !== null
}
