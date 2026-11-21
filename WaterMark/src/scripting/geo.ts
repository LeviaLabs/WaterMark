// Geometry for the circle-an-area tool. Pure functions, covered by test/geo.test.ts.
import circle from '@turf/circle'
import distance from '@turf/distance'
import area from '@turf/area'
import intersect from '@turf/intersect'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { featureCollection } from '@turf/helpers'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { GlobalFloodCollection, LngLat, SensorCollection, StormShare } from './types'

const MIN_RADIUS_KM = 0.05

export function makeCircle(center: LngLat, radiusKm: number): Feature<Polygon> {
  return circle(center, Math.max(MIN_RADIUS_KM, radiusKm), { steps: 64, units: 'kilometers' })
}

export function distanceKm(a: LngLat, b: LngLat): number {
  return distance(a, b, { units: 'kilometers' })
}

export interface SensorSummary {
  count: number
  events: number
  deepestIn: number
  lastFlood: string | null
  since: string | null
}

/** Aggregates FloodNet sensors that fall inside the circle. Returns null when none do. */
export function summarizeSensors(sensors: SensorCollection, area: Feature<Polygon>): SensorSummary | null {
  const inside = sensors.features.filter((f) => booleanPointInPolygon(f, area))
  if (!inside.length) return null
  const dates = (pick: (p: (typeof inside)[number]['properties']) => string | null | undefined) =>
    inside.map((f) => pick(f.properties)).filter((d): d is string => Boolean(d)).sort()
  return {
    count: inside.length,
    events: inside.reduce((sum, f) => sum + f.properties.events, 0),
    deepestIn: Math.max(...inside.map((f) => f.properties.max_depth)),
    lastFlood: dates((p) => p.last_flood).pop() ?? null,
    since: dates((p) => p.date_installed)[0] ?? null,
  }
}

/** The GDACS flood event closest to a point, or null if the list is empty. */
export function nearestFlood(floods: GlobalFloodCollection, from: LngLat) {
  let best: { feature: GlobalFloodCollection['features'][number]; km: number } | null = null
  for (const feature of floods.features) {
    const km = distanceKm(from, feature.geometry.coordinates as LngLat)
    if (!best || km < best.km) best = { feature, km }
  }
  return best
}

type StormFeatures = FeatureCollection<Polygon | MultiPolygon, { Flooding_Category: number }> & {
  properties?: { exceededTransferLimit?: boolean }
}

/** Share of the circle covered by modeled nuisance (category 1) and deep (category 2) flooding. */
export function stormShare(area_: Feature<Polygon>, fc: StormFeatures): StormShare {
  const total = area(area_)
  const covered: Record<number, number> = { 1: 0, 2: 0 }
  for (const f of fc.features) {
    try {
      const part = intersect(featureCollection<Polygon | MultiPolygon>([area_, f]))
      if (part) covered[f.properties.Flooding_Category] = (covered[f.properties.Flooding_Category] ?? 0) + area(part)
    } catch {
      // Skip a polygon with invalid geometry rather than failing the whole area.
    }
  }
  return {
    nuisance: (covered[1] / total) * 100,
    deep: (covered[2] / total) * 100,
    partial: Boolean(fc.properties?.exceededTransferLimit),
    none: fc.features.length === 0,
  }
}
export type { StormFeatures }
