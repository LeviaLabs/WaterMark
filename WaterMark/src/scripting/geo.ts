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
/** Circle-tool limits that match the watermark-v1 radius (100 m to 10 km). */
export const AREA_RADIUS_KM = { min: 0.1, max: 10 } as const

export function clampRadiusKm(km: number): number {
  if (!Number.isFinite(km)) return AREA_RADIUS_KM.min
  return Math.min(AREA_RADIUS_KM.max, Math.max(AREA_RADIUS_KM.min, km))
}

export function makeCircle(center: LngLat, radiusKm: number): Feature<Polygon> {
  return circle(center, Math.max(MIN_RADIUS_KM, radiusKm), { steps: 64, units: 'kilometers' })
}

export function distanceKm(a: LngLat, b: LngLat): number {
  return distance(a, b, { units: 'kilometers' })
}

export interface SensorSummary {
  count: number
  /** Null when any sensor in the circle omitted its count. Unknown is not zero. */
  events: number | null
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
  const counts = inside.map((f) => f.properties.events)
  const eventsKnown = counts.every((count): count is number => count != null)
  return {
    count: inside.length,
    events: eventsKnown ? counts.reduce((sum, count) => sum + count, 0) : null,
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

/** Square meters of each flooding category inside `clip`. */
function coveredArea(clip: Feature<Polygon | MultiPolygon>, features: StormFeatures['features']): Record<number, number> {
  const covered: Record<number, number> = { 1: 0, 2: 0 }
  for (const f of features) {
    try {
      const part = intersect(featureCollection<Polygon | MultiPolygon>([clip, f]))
      if (part) covered[f.properties.Flooding_Category] = (covered[f.properties.Flooding_Category] ?? 0) + area(part)
    } catch {
      // Skip a polygon with invalid geometry rather than failing the whole area.
    }
  }
  return covered
}

/** Share of the circle covered by modeled nuisance (category 1) and deep (category 2) flooding. */
export function stormShare(area_: Feature<Polygon>, fc: StormFeatures): StormShare {
  const total = area(area_)
  const covered = coveredArea(area_, fc.features)
  return {
    nuisance: (covered[1] / total) * 100,
    deep: (covered[2] / total) * 100,
    partial: Boolean(fc.properties?.exceededTransferLimit),
    none: fc.features.length === 0,
  }
}

/** One vector-tile block: its exact bounds [west, south, east, north] and the features it carries. */
export interface StormTile {
  bounds: [number, number, number, number]
  features: StormFeatures['features']
}

/**
 * The same shares, summed over tile blocks. Tiles carry a small buffer past their edges, so the
 * circle is first clipped to each tile's exact bounds; the pieces then never overlap.
 */
export function stormShareFromTiles(area_: Feature<Polygon>, tiles: readonly StormTile[]): Omit<StormShare, 'partial'> {
  const total = area(area_)
  const covered: Record<number, number> = { 1: 0, 2: 0 }
  let any = false
  for (const { bounds: [w, s, e, n], features } of tiles) {
    if (!features.length) continue
    const box: Feature<Polygon> = {
      type: 'Feature', properties: {},
      geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
    }
    const clip = intersect(featureCollection<Polygon | MultiPolygon>([area_, box]))
    if (!clip) continue
    const part = coveredArea(clip, features)
    covered[1] += part[1] ?? 0
    covered[2] += part[2] ?? 0
    any ||= (part[1] ?? 0) + (part[2] ?? 0) > 0
  }
  return { nuisance: (covered[1] / total) * 100, deep: (covered[2] / total) * 100, none: !any }
}
export type { StormFeatures }
