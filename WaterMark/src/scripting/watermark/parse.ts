import { readWeatherAlert } from '../alerts'
import { buildAreaRequest } from '../evidence/contract'
import { httpsUrl } from '../httpsUrl'
import {
  AREA_BODY_LIMIT,
  SERIES_KINDS,
  WATERMARK_PATHS,
  WatermarkApiError,
  type ApiAlert,
  type ApiFailure,
  type ApiResult,
  type ApiSample,
  type AreaMetrics,
  type FloodCounts,
  type SeriesCount,
  type SeriesKind,
  type WatermarkPath,
} from './types'

const STATUSES = new Set(['available', 'stale', 'insufficient_data', 'unsupported', 'error'])

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function failure(code: string, message = 'data unavailable'): ApiFailure {
  return { code, message }
}

export function unavailableResult<T>(code: string, message = 'data unavailable'): ApiResult<T> {
  return {
    status: 'error',
    sourceName: 'watermark-v1',
    sourceUrl: null,
    fetchedAt: null,
    units: null,
    limitations: [],
    qualityFlags: [],
    error: failure(code, message),
    data: null,
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function time(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null
}

/** Positive counts only. Null, zero, and non-numbers are unknown, not a verified zero. */
export function unknownCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return value
}

function depthMm(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return value
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function errorOf(value: unknown): ApiFailure | null {
  const row = record(value)
  if (!row) return null
  const code = text(row.code)
  if (!code) return null
  return { code, message: text(row.message) ?? 'data unavailable' }
}

export function readEnvelope(body: unknown): { generatedAt: string; data: unknown } {
  const row = record(body)
  if (!row || row.apiVersion !== '1.0' || typeof row.generatedAt !== 'string') {
    throw new WatermarkApiError('INVALID_RESPONSE', 'data unavailable', 502)
  }
  const error = errorOf(row.error)
  if (error) throw new WatermarkApiError(error.code, error.message, 400)
  if (!('data' in row)) throw new WatermarkApiError('INVALID_RESPONSE', 'data unavailable', 502)
  return { generatedAt: row.generatedAt, data: row.data }
}

function shell<T>(value: unknown): ApiResult<T> | null {
  const row = record(value)
  if (!row || typeof row.status !== 'string' || !STATUSES.has(row.status)) return null
  const source = record(row.source)
  return {
    status: row.status as ApiResult<T>['status'],
    sourceName: text(source?.name) ?? 'watermark-v1',
    sourceUrl: httpsUrl(source?.url),
    fetchedAt: time(row.fetchedAt),
    units: text(row.units),
    limitations: strings(row.limitations),
    qualityFlags: strings(row.qualityFlags),
    error: errorOf(row.error),
    data: null,
  }
}

function samplesOf(data: unknown): ApiSample[] | null {
  const row = record(data)
  if (!row || !Array.isArray(row.samples)) return null
  const samples: ApiSample[] = []
  for (const item of row.samples) {
    const sample = record(item)
    if (!sample || typeof sample.validFrom !== 'string' || typeof sample.validTo !== 'string') return null
    if (sample.value !== null && (typeof sample.value !== 'number' || !Number.isFinite(sample.value))) return null
    samples.push({ validFrom: sample.validFrom, validTo: sample.validTo, value: sample.value })
  }
  return samples
}

function sectionSamples(value: unknown): ApiResult<ApiSample[]> {
  const parsed = shell<ApiSample[]>(value)
  if (!parsed) return unavailableResult('INVALID_RESPONSE')
  const row = record(value)
  if (row?.data == null) return parsed
  const samples = samplesOf(row.data)
  if (!samples) return { ...parsed, status: 'error', data: null, error: failure('INVALID_RESPONSE') }
  return { ...parsed, data: samples }
}

function sectionAlerts(value: unknown): ApiResult<ApiAlert[]> {
  const parsed = shell<ApiAlert[]>(value)
  if (!parsed) return unavailableResult('INVALID_RESPONSE')
  const row = record(value)
  if (row?.data == null) return parsed
  if (!Array.isArray(row.data)) return { ...parsed, status: 'error', data: null, error: failure('INVALID_RESPONSE') }
  const alerts = row.data.map((item) => readWeatherAlert(item)).filter((item): item is ApiAlert => item !== null)
  return { ...parsed, data: alerts }
}

function sectionExposure(value: unknown): ApiResult<null> {
  return shell<null>(value) ?? unavailableResult('INVALID_RESPONSE')
}

function sectionFloods(value: unknown): ApiResult<FloodCounts> {
  const parsed = shell<FloodCounts>(value)
  if (!parsed) return unavailableResult('INVALID_RESPONSE')
  const row = record(value)
  if (row?.data == null) return parsed
  const data = record(row.data)
  if (!data || !Array.isArray(data.stations) || !Array.isArray(data.events)) {
    return { ...parsed, status: 'error', data: null, error: failure('INVALID_RESPONSE') }
  }
  const evidence = record(data.queryEvidence)
  const verified = evidence?.zeroEventMatchesVerified === true
  return {
    ...parsed,
    data: {
      stationCount: data.stations.length > 0 ? data.stations.length : null,
      eventCount: data.events.length > 0 ? data.events.length : (verified ? 0 : null),
      zeroEventMatchesVerified: verified,
    },
  }
}

export function parseHealth(body: unknown): { generatedAt: string; ready: boolean } {
  const envelope = readEnvelope(body)
  const data = record(envelope.data)
  return { generatedAt: envelope.generatedAt, ready: data?.status === 'ready' }
}

export function parseLocationSummary(body: unknown): {
  generatedAt: string
  rainfall: ApiResult<ApiSample[]>
  river: ApiResult<ApiSample[]>
  alerts: ApiResult<ApiAlert[]>
  exposure: ApiResult<null>
  floods: ApiResult<FloodCounts>
} {
  const envelope = readEnvelope(body)
  const data = record(envelope.data)
  if (!data) throw new WatermarkApiError('INVALID_RESPONSE', 'data unavailable', 502)
  return {
    generatedAt: envelope.generatedAt,
    rainfall: sectionSamples(data.rainfall),
    river: sectionSamples(data.riverDischarge),
    alerts: sectionAlerts(data.officialAlerts),
    exposure: sectionExposure(data.modeledExposure),
    floods: sectionFloods(data.historicalFloods),
  }
}

export function parseForecastResult(body: unknown): ApiResult<ApiSample[]> {
  const envelope = readEnvelope(body)
  return sectionSamples(envelope.data)
}

export function parseAlertResult(body: unknown): ApiResult<ApiAlert[]> {
  const envelope = readEnvelope(body)
  return sectionAlerts(envelope.data)
}

export function parseExposureResult(body: unknown): ApiResult<null> {
  const envelope = readEnvelope(body)
  return sectionExposure(envelope.data)
}

function metricsOf(value: unknown, outer: Record<string, unknown>): AreaMetrics | null {
  const row = record(value)
  if (!row) return null
  const center = record(outer.center)
  const lat = center && typeof center.lat === 'number' ? center.lat : null
  const lon = center && typeof center.lon === 'number' ? center.lon : null
  return {
    stationCount: unknownCount(row.stationCount),
    cachedEventCount: unknownCount(row.cachedEventCount),
    sampledHistoricalMaxDepthMm: depthMm(row.sampledHistoricalMaxDepthMm),
    coverageStatus: text(row.coverageStatus) ?? 'incomplete',
    zeroMatchesVerified: row.zeroMatchesVerified === true,
    windowStart: time(row.windowStart),
    windowEnd: time(row.windowEnd),
    cacheOldestFetchedAt: time(row.cacheOldestFetchedAt),
    cacheNewestFetchedAt: time(row.cacheNewestFetchedAt),
    radiusMeters: typeof outer.radiusMeters === 'number' ? outer.radiusMeters : 0,
    center: { lat: lat ?? 0, lon: lon ?? 0 },
  }
}

export function parseAreaSummary(body: unknown): { generatedAt: string; result: ApiResult<AreaMetrics> } {
  const envelope = readEnvelope(body)
  const outer = record(envelope.data)
  const parsed = outer ? shell<AreaMetrics>(outer) : null
  if (!outer || !parsed) throw new WatermarkApiError('INVALID_RESPONSE', 'data unavailable', 502)
  const metrics = metricsOf(outer.data, outer) ?? metricsOf(outer.metrics, outer)
  if (outer.data != null && !record(outer.data)) {
    return { generatedAt: envelope.generatedAt, result: { ...parsed, status: 'error', data: null, error: failure('INVALID_RESPONSE') } }
  }
  return { generatedAt: envelope.generatedAt, result: { ...parsed, data: metrics } }
}

export function parseSeriesCount(body: unknown): ApiResult<SeriesCount> {
  const envelope = readEnvelope(body)
  const parsed = shell<SeriesCount>(envelope.data)
  if (!parsed) return unavailableResult('INVALID_RESPONSE')
  const inner = record(envelope.data)?.data
  if (inner == null) return parsed
  if (Array.isArray(inner)) return { ...parsed, data: { count: inner.length > 0 ? inner.length : null } }
  const data = record(inner)
  if (!data) return { ...parsed, status: 'error', data: null, error: failure('INVALID_RESPONSE') }
  const rows = Array.isArray(data.events) ? data.events : null
  if (!rows) return { ...parsed, status: 'error', data: null, error: failure('INVALID_RESPONSE') }
  return { ...parsed, data: { count: rows.length > 0 ? rows.length : null } }
}

export function isSeriesKind(value: string): value is SeriesKind {
  return (SERIES_KINDS as readonly string[]).includes(value)
}

export function watermarkUrl(base: string, path: string): string {
  if (!(WATERMARK_PATHS as readonly string[]).includes(path)) {
    throw new WatermarkApiError('NOT_FOUND', 'Unknown API route.', 404)
  }
  return `${base.replace(/\/+$/, '')}${path as WatermarkPath}`
}

export function coordinateParam(value: number, min: number, max: number): string {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new WatermarkApiError('INVALID_COORDINATES', 'Coordinates are outside WGS84 bounds.', 400)
  }
  return String(Number(value.toFixed(5)))
}

/**
 * Body for POST /area-summary. Radius outside 100–10000 m is rejected here so the
 * browser does not send a request the API will answer with INVALID_RADIUS.
 * The JSON is the two allowed fields only, and it must fit in 4 KB.
 */
export function encodeAreaBody(center: { lat: number; lon: number }, radiusMeters: number): string {
  if (!Number.isFinite(radiusMeters) || radiusMeters < 100 || radiusMeters > 10000) {
    throw new WatermarkApiError('INVALID_RADIUS', 'Radius must be between 100 and 10000 meters.', 400)
  }
  const payload = {
    center: {
      lat: Number(coordinateParam(center.lat, -90, 90)),
      lon: Number(coordinateParam(center.lon, -180, 180)),
    },
    radiusMeters,
  }
  const json = JSON.stringify(payload)
  if (new TextEncoder().encode(json).length > AREA_BODY_LIMIT) {
    throw new WatermarkApiError('PAYLOAD_TOO_LARGE', 'Payload exceeds size limit.', 413)
  }
  return json
}

/** Clamped center and radius for a map selection, in the API's units. */
export function areaRequestFromSelection(lat: number, lon: number, radiusMeters: number): {
  body: { center: { lat: number; lon: number }; radiusMeters: number }
  clamped: boolean
} {
  const finite = Number.isFinite(radiusMeters) ? radiusMeters : 100
  const clamped = finite < 100 || finite > 10000
  return { body: buildAreaRequest({ lat, lon }, finite), clamped }
}

export function guardJsonBody(json: string): string {
  if (new TextEncoder().encode(json).length > AREA_BODY_LIMIT) {
    throw new WatermarkApiError('PAYLOAD_TOO_LARGE', 'Payload exceeds size limit.', 413)
  }
  return json
}
