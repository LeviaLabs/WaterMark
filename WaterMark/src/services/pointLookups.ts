// Per-point lookups run when an area is selected: rain and river forecasts, NWS alerts,
// FEMA flood zone, and the ZIP code (for the claims summary).
import { ENDPOINTS } from './endpoints'
import { getJSON } from './http'
import { markFetched } from '../scripting/freshness'
import type { FloodZone, LngLat, RainForecast, RiverForecast, WeatherAlert } from '../scripting/types'

export async function fetchRain([lon, lat]: LngLat, signal: AbortSignal): Promise<RainForecast> {
  const q = new URLSearchParams({
    latitude: String(lat), longitude: String(lon), forecast_days: '3', timezone: 'auto',
    daily: 'precipitation_sum,precipitation_probability_max', precipitation_unit: 'inch',
  })
  const j = await getJSON<{ daily: RainForecast }>(`${ENDPOINTS.forecast}?${q}`, { signal })
  markFetched('rain')
  return j.daily
}

export async function fetchRiver([lon, lat]: LngLat, signal: AbortSignal): Promise<RiverForecast> {
  const q = new URLSearchParams({ latitude: String(lat), longitude: String(lon), daily: 'river_discharge', forecast_days: '7' })
  const j = await getJSON<{ daily: RiverForecast }>(`${ENDPOINTS.flood}?${q}`, { signal })
  markFetched('river')
  return j.daily
}

export async function fetchAlerts([lon, lat]: LngLat, signal: AbortSignal): Promise<WeatherAlert[]> {
  const j = await getJSON<{ features?: { properties: WeatherAlert }[] }>(
    `${ENDPOINTS.nwsAlerts}?point=${lat.toFixed(4)},${lon.toFixed(4)}`,
    { headers: { Accept: 'application/geo+json' }, signal },
  )
  markFetched('nws')
  return (j.features ?? []).map((f) => f.properties)
}

export async function fetchFloodZone([lon, lat]: LngLat, signal: AbortSignal): Promise<FloodZone | 'none'> {
  const q = new URLSearchParams({
    geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', outFields: 'FLD_ZONE,ZONE_SUBTY', returnGeometry: 'false', f: 'json',
  })
  const j = await getJSON<{ features?: { attributes: FloodZone }[] }>(`${ENDPOINTS.femaQuery}?${q}`, { signal })
  markFetched('fema')
  return j.features?.[0]?.attributes ?? 'none'
}

export async function fetchZip([lon, lat]: LngLat, signal: AbortSignal): Promise<string> {
  const j = await getJSON<{ address?: { postcode?: string } }>(
    `${ENDPOINTS.nominatim}/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18`, { signal })
  markFetched('geocode')
  return j.address?.postcode?.slice(0, 5) ?? 'none'
}

export interface PlaceHit { center: LngLat; label: string }

/** Forward search: a 5-digit string is treated as a US ZIP code. */
export async function searchPlace(text: string, signal?: AbortSignal): Promise<PlaceHit | null> {
  const q = /^\d{5}$/.test(text) ? `postalcode=${text}&country=us` : `q=${encodeURIComponent(text)}`
  const hits = await getJSON<{ lon: string; lat: string; display_name: string }[]>(
    `${ENDPOINTS.nominatim}/search?${q}&format=json&limit=1`, { signal })
  markFetched('geocode')
  if (!hits.length) return null
  return { center: [Number(hits[0].lon), Number(hits[0].lat)], label: hits[0].display_name.split(',').slice(0, 2).join(',') }
}
