// FloodNet NYC (NYC Open Data): sensor locations joined with per-sensor flood statistics.
import type { FeatureCollection, Point } from 'geojson'
import { ENDPOINTS } from './endpoints'
import { getJSON } from './http'
import { markFetched } from '../scripting/freshness'
import type { SensorCollection, SensorProps } from '../scripting/types'

interface RawSensor { sensor_id: string; sensor_name?: string; street_name?: string; date_installed?: string; date_removed?: string }
interface RawStat { sensor_id: string; events?: string; max_depth?: string; last_flood?: string }

/** A FloodNet event count. A blank or missing field stays null, never 0. */
export function floodEventCount(value: string | undefined): number | null {
  if (value == null || value.trim() === '') return null
  const count = Number(value)
  return Number.isFinite(count) && count >= 0 ? count : null
}

export async function fetchSensors(signal?: AbortSignal): Promise<SensorCollection> {
  const [geo, stats] = await Promise.all([
    getJSON<FeatureCollection<Point | null, RawSensor>>(ENDPOINTS.sensors, { signal }),
    getJSON<RawStat[]>(ENDPOINTS.sensorStats, { signal }),
  ])
  const byId = new Map(stats.map((s) => [s.sensor_id, s]))
  const features = geo.features
    .filter((f): f is typeof f & { geometry: Point } => Boolean(f.geometry) && !f.properties.date_removed)
    .map((f) => {
      const s = byId.get(f.properties.sensor_id)
      const properties: SensorProps = {
        sensor_id: f.properties.sensor_id,
        sensor_name: f.properties.sensor_name,
        street_name: f.properties.street_name,
        date_installed: f.properties.date_installed,
        events: floodEventCount(s?.events),
        max_depth: Number(s?.max_depth) || 0,
        last_flood: s?.last_flood ?? null,
      }
      return { type: 'Feature' as const, geometry: f.geometry, properties }
    })
  markFetched('floodnet')
  return { type: 'FeatureCollection', features }
}
