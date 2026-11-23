import { isAbort } from '../http'
import {
  coordinateParam,
  encodeAreaBody,
  isSeriesKind,
  parseAlertResult,
  parseAreaSummary,
  parseExposureResult,
  parseForecastResult,
  parseHealth,
  parseLocationSummary,
  parseSeriesCount,
  readEnvelope,
  watermarkUrl,
} from '../../scripting/watermark/parse'
import {
  WatermarkApiError,
  type ApiAlert,
  type ApiResult,
  type ApiSample,
  type AreaMetrics,
  type SeriesKind,
  type WatermarkPath,
} from '../../scripting/watermark/types'

const TIMEOUT_MS = 20_000

export interface WatermarkClient {
  health(signal?: AbortSignal): Promise<{ generatedAt: string; ready: boolean }>
  locationSummary(lat: number, lon: number, signal?: AbortSignal): Promise<ReturnType<typeof parseLocationSummary>>
  rainfall(lat: number, lon: number, signal?: AbortSignal): Promise<ApiResult<ApiSample[]>>
  alerts(lat: number, lon: number, signal?: AbortSignal): Promise<ApiResult<ApiAlert[]>>
  floodExposure(lat: number, lon: number, signal?: AbortSignal): Promise<ApiResult<null>>
  areaSummary(center: { lat: number; lon: number }, radiusMeters: number, signal?: AbortSignal): Promise<{ generatedAt: string; result: ApiResult<AreaMetrics> }>
  series(lat: number, lon: number, kind: SeriesKind, signal?: AbortSignal): Promise<ApiResult<ApiSample[]> | ApiResult<{ count: number | null }>>
}

function statusCode(status: number): string {
  if (status === 400) return 'INVALID_INPUT'
  if (status === 403) return 'ORIGIN_NOT_ALLOWED'
  if (status === 404) return 'NOT_FOUND'
  if (status === 405) return 'METHOD_NOT_ALLOWED'
  if (status === 413) return 'PAYLOAD_TOO_LARGE'
  if (status === 429) return 'RATE_LIMITED'
  if (status === 503) return 'BACKEND_UNAVAILABLE'
  return 'DATA_UNAVAILABLE'
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function throwForStatus(response: Response, body: unknown): void {
  if (response.ok) return
  const row = body && typeof body === 'object' ? body as { error?: { code?: unknown; message?: unknown } } : null
  const code = typeof row?.error?.code === 'string' ? row.error.code : statusCode(response.status)
  const message = typeof row?.error?.message === 'string' ? row.error.message : 'data unavailable'
  throw new WatermarkApiError(code, message, response.status)
}

export function createWatermarkClient(baseUrl: string, fetchImpl: typeof fetch = fetch): WatermarkClient {
  const base = baseUrl.replace(/\/+$/, '')

  async function send(path: WatermarkPath, query: Record<string, string> | null, json: string | null, signal?: AbortSignal): Promise<unknown> {
    const url = new URL(watermarkUrl(base, path))
    if (query) {
      for (const [key, value] of Object.entries(query)) url.searchParams.append(key, value)
    }
    const limit = AbortSignal.timeout(TIMEOUT_MS)
    let response: Response
    try {
      response = await fetchImpl(url.href, {
        method: json == null ? 'GET' : 'POST',
        credentials: 'omit',
        headers: json == null
          ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: json ?? undefined,
        signal: signal ? AbortSignal.any([signal, limit]) : limit,
      })
    } catch (error) {
      if (isAbort(error)) throw error
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new WatermarkApiError('PROVIDER_TIMEOUT', 'data unavailable', 0)
      }
      throw new WatermarkApiError('DATA_UNAVAILABLE', 'data unavailable', 0)
    }
    const body = await readBody(response)
    throwForStatus(response, body)
    readEnvelope(body)
    return body
  }

  const point = (lat: number, lon: number) => ({
    lat: coordinateParam(lat, -90, 90),
    lon: coordinateParam(lon, -180, 180),
  })

  return {
    async health(signal) {
      return parseHealth(await send('/health', null, null, signal))
    },
    async locationSummary(lat, lon, signal) {
      return parseLocationSummary(await send('/location-summary', point(lat, lon), null, signal))
    },
    async rainfall(lat, lon, signal) {
      return parseForecastResult(await send('/rainfall', point(lat, lon), null, signal))
    },
    async alerts(lat, lon, signal) {
      return parseAlertResult(await send('/alerts', point(lat, lon), null, signal))
    },
    async floodExposure(lat, lon, signal) {
      return parseExposureResult(await send('/flood-exposure', point(lat, lon), null, signal))
    },
    async areaSummary(center, radiusMeters, signal) {
      return parseAreaSummary(await send('/area-summary', null, encodeAreaBody(center, radiusMeters), signal))
    },
    async series(lat, lon, kind, signal) {
      if (!isSeriesKind(kind)) throw new WatermarkApiError('INVALID_INPUT', 'Unsupported series kind.', 400)
      const body = await send('/series', { ...point(lat, lon), kind }, null, signal)
      if (kind === 'rainfall' || kind === 'river_discharge') return parseForecastResult(body)
      return parseSeriesCount(body)
    },
  }
}
