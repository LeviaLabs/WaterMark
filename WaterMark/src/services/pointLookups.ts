// Per-point lookups run when an area is selected: rain and river forecasts, NWS alerts,
// FEMA flood zones, and the ZIP code (for the insurance claims).
import { ENDPOINTS } from './endpoints'
import { getJSON } from './http'
import { markFetched } from '../scripting/freshness'
import type { Feature, Polygon } from 'geojson'
import { HIGH_RISK_ZONES } from '../scripting/mapTheme'
import type { FloodZone, LngLat, RainForecast, RiverForecast, WeatherAlert, ZoneReport } from '../scripting/types'

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

// ArcGIS query helper: POST keeps a 64-point circle out of the URL, and a form body is a
// "simple" request, so the browser sends it without a CORS preflight.
async function arcgisQuery<T>(url: string, params: Record<string, string>, signal: AbortSignal): Promise<T> {
  const j = await getJSON<T & { error?: { message?: string } }>(url, {
    method: 'POST', body: new URLSearchParams({ ...params, f: 'json' }), signal,
  })
  // ArcGIS reports query errors with HTTP 200 and an error object.
  if (j.error) throw new Error(j.error.message ?? 'ArcGIS query failed')
  return j
}

const pointQuery = ([lon, lat]: LngLat) => ({
  geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'false',
})

/** FEMA flood zones (NFHL layer 28): the zone at the center and every zone that touches the circle. */
export async function fetchFloodZones(center: LngLat, circle: Feature<Polygon>, signal: AbortSignal): Promise<ZoneReport> {
  type Res = { features?: { attributes: FloodZone }[] }
  const ring = circle.geometry.coordinates[0].map(([x, y]) => [Number(x.toFixed(5)), Number(y.toFixed(5))])
  const [atCenter, inCircle] = await Promise.all([
    arcgisQuery<Res>(ENDPOINTS.femaQuery, { ...pointQuery(center), outFields: 'FLD_ZONE,ZONE_SUBTY' }, signal),
    arcgisQuery<Res>(ENDPOINTS.femaQuery, {
      geometry: JSON.stringify({ rings: [ring], spatialReference: { wkid: 4326 } }), geometryType: 'esriGeometryPolygon',
      inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'FLD_ZONE', returnGeometry: 'false',
    }, signal),
  ])
  markFetched('fema')
  const codes = new Set((inCircle.features ?? []).map((f) => f.attributes.FLD_ZONE).filter((z) => z && z !== 'OPEN WATER'))
  return {
    center: atCenter.features?.[0]?.attributes ?? null,
    inArea: [...codes].sort((a, b) => Number(HIGH_RISK_ZONES.has(b)) - Number(HIGH_RISK_ZONES.has(a)) || a.localeCompare(b)),
  }
}

/**
 * The ZIP code at a point, from the Census Bureau's ZIP Code Tabulation Areas (TIGERweb).
 * OpenStreetMap postcodes were tried first and often named a nearby PO-box ZIP instead.
 * 'none' outside the US.
 */
export async function fetchZip(center: LngLat, signal: AbortSignal): Promise<string> {
  const j = await arcgisQuery<{ features?: { attributes: { ZCTA5?: unknown } }[] }>(
    ENDPOINTS.censusZcta, { ...pointQuery(center), outFields: 'ZCTA5' }, signal)
  markFetched('zip')
  const zip = j.features?.[0]?.attributes.ZCTA5
  return typeof zip === 'string' && /^\d{5}$/.test(zip) ? zip : 'none'
}
