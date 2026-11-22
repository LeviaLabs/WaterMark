// US-only per-point lookups run when an area is selected: NWS alerts, FEMA flood zones, and the
// ZIP code (for the insurance claims). The worldwide ones live in services/openMeteo.ts. Every answer goes through the
// shared cache (services/shared.ts), so reselecting a place reuses it instead of asking again:
// forecasts and alerts for 10 minutes, mapped zones and ZIP codes for six hours.
import { ENDPOINTS } from './endpoints'
import { getJSON } from './http'
import { MINUTE, pointKey, shared } from './shared'
import { markFetched } from '../scripting/freshness'
import type { Feature, Polygon } from 'geojson'
import { HIGH_RISK_ZONES } from '../scripting/mapTheme'
import type { FloodZone, LngLat, WeatherAlert, ZoneReport } from '../scripting/types'

const LIVE_TTL = 10 * MINUTE
const STATIC_TTL = 6 * 60 * MINUTE


export function fetchAlerts(center: LngLat, signal: AbortSignal): Promise<WeatherAlert[]> {
  const [lon, lat] = center
  return shared(`nws:${pointKey(center)}`, LIVE_TTL, async () => {
    const j = await getJSON<{ features?: { properties?: Partial<WeatherAlert> }[] }>(
      `${ENDPOINTS.nwsAlerts}?point=${lat.toFixed(4)},${lon.toFixed(4)}`,
      { headers: { Accept: 'application/geo+json' } },
    )
    markFetched('nws')
    return (j.features ?? [])
      .map((f) => f.properties)
      .filter((p): p is WeatherAlert => typeof p?.event === 'string')
  }, signal)
}

// ArcGIS query helper: POST keeps a 64-point circle out of the URL, and a form body is a
// "simple" request, so the browser sends it without a CORS preflight.
async function arcgisQuery<T>(url: string, params: Record<string, string>): Promise<T> {
  const j = await getJSON<T & { error?: { message?: string } }>(url, {
    method: 'POST', body: new URLSearchParams({ ...params, f: 'json' }),
  })
  // ArcGIS reports query errors with HTTP 200 and an error object.
  if (j.error) throw new Error(j.error.message ?? 'ArcGIS query failed')
  return j
}

const pointQuery = ([lon, lat]: LngLat) => ({
  geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'false',
})

/** FEMA flood zones (NFHL layer 28): the zone at the center and every zone that touches the circle. */
export function fetchFloodZones(center: LngLat, circle: Feature<Polygon>, signal: AbortSignal): Promise<ZoneReport> {
  type Res = { features?: { attributes?: FloodZone }[] }
  const ring = circle.geometry.coordinates[0].map(([x, y]) => [Number(x.toFixed(5)), Number(y.toFixed(5))])
  return shared(`fema:${pointKey(center)}:${ring[0].join(',')}`, STATIC_TTL, async () => {
    const [atCenter, inCircle] = await Promise.all([
      arcgisQuery<Res>(ENDPOINTS.femaQuery, { ...pointQuery(center), outFields: 'FLD_ZONE,ZONE_SUBTY' }),
      arcgisQuery<Res>(ENDPOINTS.femaQuery, {
        geometry: JSON.stringify({ rings: [ring], spatialReference: { wkid: 4326 } }), geometryType: 'esriGeometryPolygon',
        inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'FLD_ZONE', returnGeometry: 'false',
      }),
    ])
    markFetched('fema')
    const codes = new Set((inCircle.features ?? []).map((f) => f.attributes?.FLD_ZONE)
      .filter((z): z is string => typeof z === 'string' && z !== '' && z !== 'OPEN WATER'))
    return {
      center: atCenter.features?.[0]?.attributes ?? null,
      inArea: [...codes].sort((a, b) => Number(HIGH_RISK_ZONES.has(b)) - Number(HIGH_RISK_ZONES.has(a)) || a.localeCompare(b)),
    }
  }, signal)
}

/**
 * The ZIP code at a point, from the Census Bureau's ZIP Code Tabulation Areas (TIGERweb).
 * OpenStreetMap postcodes were tried first and often named a nearby PO-box ZIP instead.
 * 'none' outside the US.
 */
export function fetchZip(center: LngLat, signal: AbortSignal): Promise<string> {
  return shared(`zip:${pointKey(center)}`, STATIC_TTL, async () => {
    const j = await arcgisQuery<{ features?: { attributes?: { ZCTA5?: unknown } }[] }>(
      ENDPOINTS.censusZcta, { ...pointQuery(center), outFields: 'ZCTA5' })
    markFetched('zip')
    const zip = j.features?.[0]?.attributes?.ZCTA5
    return typeof zip === 'string' && /^\d{5}$/.test(zip) ? zip : 'none'
  }, signal)
}
