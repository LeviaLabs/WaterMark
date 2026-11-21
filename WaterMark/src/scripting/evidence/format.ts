import type { ResultStatus, Sample } from './contract'

/**
 * Display helpers shared by the feature components. Times stay UTC in data
 * and are shown in the viewer's local time with an explicit time zone
 * (README Section 3).
 */

export function formatLocalTime(iso: string | null, options: { timeZone?: string; withDate?: boolean } = {}): string {
  if (!iso) return 'Not provided by source'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Invalid time from source'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: options.timeZone,
    month: options.withDate === false ? undefined : 'short',
    day: options.withDate === false ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

/** Hour label for a chart axis, e.g. "3 PM". */
export function formatHour(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric' }).format(new Date(iso))
}

export const STATUS_TEXT: Record<ResultStatus, { label: string; explain: string }> = {
  available: { label: 'Available', explain: '' },
  stale: { label: 'Stale', explain: 'This is the most recent data we have, and it is older than our freshness window.' },
  insufficient_data: {
    label: 'Not enough data',
    explain: 'The source has no usable record for this place. Unknown is not the same as low risk.',
  },
  unsupported: {
    label: 'Not covered',
    explain: 'This source does not cover this location. That says nothing about the risk here.',
  },
  error: {
    label: 'Source unavailable',
    explain: 'We could not reach this source just now. Check the official source directly.',
  },
}

/** Sum of known values; null when every value is missing (unknown, not zero). */
export function totalOf(samples: readonly { value: number | null }[]): number | null {
  let total = 0
  let known = 0
  for (const { value } of samples) {
    if (value === null || !Number.isFinite(value)) continue
    total += value
    known++
  }
  return known === 0 ? null : total
}

/** The sample with the largest known value, or null. */
export function peakOf(samples: readonly Sample[]): Sample | null {
  let peak: Sample | null = null
  for (const sample of samples) {
    if (sample.value === null || !Number.isFinite(sample.value)) continue
    if (!peak || sample.value > (peak.value ?? -Infinity)) peak = sample
  }
  return peak
}

export function formatNumber(value: number | null, units: string, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return 'Unknown'
  return `${value.toFixed(digits)} ${units}`
}

/** Readable distance for a circle radius. */
export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(meters >= 10_000 ? 0 : 1)} km` : `${Math.round(meters)} m`
}

/** "Map" deep link understood by Ryan Lin's map page (/map?lat=&lon=&z=&label=). */
export function mapLink(place: { lat: number; lon: number; label: string }, zoom = 14): string {
  const params = new URLSearchParams({
    lat: place.lat.toFixed(4),
    lon: place.lon.toFixed(4),
    z: String(zoom),
    label: place.label,
  })
  return `/map?${params.toString()}`
}
