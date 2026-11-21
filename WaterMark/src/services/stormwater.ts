// NYC Stormwater Flood Map (moderate scenario, current sea levels), ArcGIS FeatureServer.
// Flooding_Category 1 = nuisance flooding (4 in to 1 ft), 2 = deep flooding (1 ft or more).
import type { Feature, Polygon } from 'geojson'
import { ENDPOINTS } from './endpoints'
import { getJSON } from './http'
import { markFetched } from '../scripting/freshness'
import type { StormFeatures } from '../scripting/geo'

const COMMON = {
  where: '1=1', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
  outFields: 'Flooding_Category', outSR: '4326', geometryPrecision: '6', f: 'geojson',
}

/** Model polygons inside a map view, [west, south, east, north]. */
export async function fetchStormInView(bbox: [number, number, number, number], signal: AbortSignal): Promise<StormFeatures> {
  const q = new URLSearchParams({ ...COMMON, geometry: bbox.join(','), geometryType: 'esriGeometryEnvelope' })
  const fc = await getJSON<StormFeatures>(`${ENDPOINTS.storm}?${q}`, { signal })
  markFetched('stormwater')
  return fc
}

/** Model polygons intersecting a drawn circle (POST, because the ring is too long for a URL). */
export async function fetchStormInArea(area: Feature<Polygon>, signal: AbortSignal): Promise<StormFeatures> {
  const body = new URLSearchParams({
    ...COMMON,
    geometry: JSON.stringify({ rings: [area.geometry.coordinates[0]], spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPolygon',
  })
  const fc = await getJSON<StormFeatures>(ENDPOINTS.storm, { method: 'POST', body, signal })
  markFetched('stormwater')
  return fc
}
