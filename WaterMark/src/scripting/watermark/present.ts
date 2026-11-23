import type { RainOutlook, RiverOutlook, WeatherAlert } from '../types'
import type { ApiAlert, ApiSample, WatermarkReport } from './types'

const blank = (n: number) => Array.from({ length: n }, () => null)

/** Full UTC days only. A partial day or a null hour stays null, never a zero total. */
export function samplesToDailyRain(samples: readonly ApiSample[]): RainOutlook | null {
  const byDay = new Map<string, { values: number[]; nulls: number }>()
  for (const sample of samples) {
    const day = sample.validTo.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
    const bucket = byDay.get(day) ?? { values: [], nulls: 0 }
    if (sample.value == null || !Number.isFinite(sample.value)) bucket.nulls += 1
    else bucket.values.push(sample.value)
    byDay.set(day, bucket)
  }
  const time = [...byDay.keys()].sort()
  if (!time.length) return null
  const mm = time.map((day) => {
    const bucket = byDay.get(day)
    if (!bucket || bucket.nulls > 0 || bucket.values.length !== 24) return null
    return bucket.values.reduce((sum, value) => sum + value, 0)
  })
  return { time, mm, probability: mm.map(() => null), timezone: 'UTC' }
}

export function samplesToRiver(samples: readonly ApiSample[]): RiverOutlook | null {
  if (!samples.length || !samples.some((sample) => sample.value != null && Number.isFinite(sample.value))) return null
  return {
    time: samples.map((sample) => sample.validFrom.slice(0, 10)),
    flow: samples.map((sample) => sample.value),
    median: blank(samples.length),
    p25: blank(samples.length),
    p75: blank(samples.length),
    min: blank(samples.length),
    max: blank(samples.length),
  }
}

function asAlerts(data: readonly ApiAlert[] | null): WeatherAlert[] | 'error' {
  if (!data) return 'error'
  return data.map((alert) => ({ ...alert }))
}

/**
 * Shapes the rest of the map already understands.
 * insufficient_data, unsupported, and error do not become an empty list or a zero series.
 */
export function legacyFromWatermark(view: WatermarkReport): {
  rain: RainOutlook | 'error'
  river: RiverOutlook | 'error'
  alerts: WeatherAlert[] | 'error' | 'unsupported'
} {
  const rain = view.rainfall.status === 'available' || view.rainfall.status === 'stale'
    ? samplesToDailyRain(view.rainfall.data ?? []) ?? 'error'
    : 'error'
  const river = view.river.status === 'available' || view.river.status === 'stale'
    ? samplesToRiver(view.river.data ?? []) ?? 'error'
    : 'error'
  const alerts = view.alerts.status === 'unsupported'
    ? 'unsupported'
    : view.alerts.status === 'available' || view.alerts.status === 'stale'
      ? asAlerts(view.alerts.data)
      : 'error'
  return { rain, river, alerts }
}

/** The sample whose UTC day is today, if the series has that day. */
export function sampleOnUtcDay(samples: readonly ApiSample[], now = new Date()): ApiSample | null {
  const day = now.toISOString().slice(0, 10)
  return samples.find((sample) => sample.validFrom.slice(0, 10) === day) ?? null
}
