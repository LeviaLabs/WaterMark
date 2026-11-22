// Per-point lookups run when an area is selected: rain and river forecasts, NWS alerts,
// FEMA flood zone, and the ZIP code (for the insurance claims).
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

/** The 5-digit ZIP code at a point, from Photon's reverse geocoder (OpenStreetMap data). */
export async function fetchZip([lon, lat]: LngLat, signal: AbortSignal): Promise<string> {
  const q = new URLSearchParams({ lat: lat.toFixed(5), lon: lon.toFixed(5), limit: '1', lang: 'en' })
  const j = await getJSON<{ features?: { properties?: { postcode?: unknown; countrycode?: unknown } }[] }>(
    `${ENDPOINTS.photonReverse}?${q}`, { signal })
  markFetched('geocode')
  const props = j.features?.[0]?.properties
  const zip = typeof props?.postcode === 'string' ? props.postcode.trim().slice(0, 5) : ''
  // Claims are keyed by US ZIP code, so anything else counts as "no ZIP here".
  return props?.countrycode === 'US' && /^\d{5}$/.test(zip) ? zip : 'none'
}
