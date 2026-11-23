import { isAbort } from '../http'
import { areaRequestFromSelection, unavailableResult } from '../../scripting/watermark/parse'
import { legacyFromWatermark } from '../../scripting/watermark/present'
import {
  WatermarkApiError,
  type ApiResult,
  type WatermarkReport,
} from '../../scripting/watermark/types'
import type { WatermarkClient } from './client'

function detail(error: unknown): { code: string; message: string } {
  if (error instanceof WatermarkApiError) {
    return { code: error.code, message: error.message || 'data unavailable' }
  }
  return { code: 'DATA_UNAVAILABLE', message: 'data unavailable' }
}

function failed<T>(error: unknown): ApiResult<T> {
  const info = detail(error)
  return unavailableResult(info.code, info.message)
}

export function failedWatermarkReport(error: unknown = 'DATA_UNAVAILABLE'): WatermarkReport {
  const info = detail(error)
  return {
    generatedAt: null,
    health: 'error',
    healthDetail: info,
    rainfall: unavailableResult(info.code, info.message),
    river: unavailableResult(info.code, info.message),
    alerts: unavailableResult(info.code, info.message),
    exposure: unavailableResult(info.code, info.message),
    floods: unavailableResult(info.code, info.message),
    area: unavailableResult(info.code, info.message),
    series: unavailableResult(info.code, info.message),
    request: { center: { lat: 0, lon: 0 }, radiusMeters: 100 },
    radiusClamped: false,
  }
}

/**
 * Location summary, area summary, health, and the cached event series.
 * One failed route leaves the others in place and is marked data unavailable.
 */
export async function loadWatermarkArea(
  client: WatermarkClient,
  lat: number,
  lon: number,
  radiusKm: number,
  signal?: AbortSignal,
): Promise<WatermarkReport> {
  const { body, clamped } = areaRequestFromSelection(lat, lon, radiusKm * 1000)
  const [health, location, area] = await Promise.all([
    client.health(signal).then((value) => ({ ok: true as const, value }), (error: unknown) => {
      if (isAbort(error)) throw error
      return { ok: false as const, error }
    }),
    client.locationSummary(body.center.lat, body.center.lon, signal).then((value) => ({ ok: true as const, value }), (error: unknown) => {
      if (isAbort(error)) throw error
      return { ok: false as const, error }
    }),
    client.areaSummary(body.center, body.radiusMeters, signal).then((value) => ({ ok: true as const, value }), (error: unknown) => {
      if (isAbort(error)) throw error
      return { ok: false as const, error }
    }),
  ])

  let series: ApiResult<{ count: number | null }>
  if (location.ok) {
    try {
      const value = await client.series(body.center.lat, body.center.lon, 'historical_flood_events', signal)
      series = value as ApiResult<{ count: number | null }>
    } catch (error) {
      if (isAbort(error)) throw error
      series = failed(error)
    }
  } else {
    series = failed(location.error)
  }

  const located = location.ok ? location.value : null
  return {
    generatedAt: located?.generatedAt ?? (area.ok ? area.value.generatedAt : null),
    health: health.ok && health.value.ready ? 'ready' : 'error',
    healthDetail: health.ok ? (health.value.ready ? null : { code: 'NOT_READY', message: 'data unavailable' }) : detail(health.error),
    rainfall: located?.rainfall ?? failed(location.ok ? 'INVALID_RESPONSE' : location.error),
    river: located?.river ?? failed(location.ok ? 'INVALID_RESPONSE' : location.error),
    alerts: located?.alerts ?? failed(location.ok ? 'INVALID_RESPONSE' : location.error),
    exposure: located?.exposure ?? failed(location.ok ? 'INVALID_RESPONSE' : location.error),
    floods: located?.floods ?? failed(location.ok ? 'INVALID_RESPONSE' : location.error),
    area: area.ok ? area.value.result : failed(area.error),
    series,
    request: body,
    radiusClamped: clamped,
  }
}

export { legacyFromWatermark }
