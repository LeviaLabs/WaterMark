import { useMemo } from 'react'
import { areaFromCell, neighborCells, rankEvidence, rankSensors, type FloodHit, type RankedArea, type SensorHit, type SensorRank } from '../scripting/audiences/rank'
import { HIGH_RISK_ZONES } from '../scripting/mapTheme'
import type { Grid } from '../scripting/cells'
import type { CellMeta } from '../services/floodHistory'
import type { AreaReport, GlobalFloodCollection, RegionPick, Selection, SensorCollection } from '../scripting/types'

export interface ResponderModel {
  response: RankedArea[]
  staging: RankedArea[]
  sensors: { recorded: SensorRank[]; quiet: SensorRank[] }
  size: number
  years: [number, number]
  source: string
  focused: boolean
}

export function useResponderModel(
  grid: Grid | null, meta: CellMeta | null, focus: RegionPick | null, selection: Selection | null,
  report: AreaReport, sensors: SensorCollection | null, floods: GlobalFloodCollection | null,
): ResponderModel | null {
  return useMemo(() => {
    if (!grid || !meta) return null
    const sensorHits: SensorHit[] = (sensors?.features ?? []).map((feature) => ({
      id: feature.properties.sensor_id,
      name: feature.properties.street_name || feature.properties.sensor_name || feature.properties.sensor_id,
      lon: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
      events: feature.properties.events,
      depthIn: feature.properties.max_depth,
      last: feature.properties.last_flood,
    }))
    const floodHits: FloodHit[] = (floods?.features ?? []).map((feature) => ({
      lon: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
      active: feature.properties.active,
    }))
    const bounds = focus?.props.b ?? null
    const cells = grid.cells.features.map((feature) => feature.properties)
    const pool = bounds
      ? cells.filter((cell) => {
        const [w, s, e, n] = cell.bounds
        const lon = (w + e) / 2
        const lat = (s + n) / 2
        return lon >= bounds[0] && lon <= bounds[2] && lat >= bounds[1] && lat <= bounds[3]
      })
      : [...cells].sort((a, b) => b.e - a.e).slice(0, 40)
    const selectedId = selection?.cell?.k ?? null
    const extra = selectedId ? {
      femaHighRisk: report.zone && report.zone !== 'error' && report.zone !== 'unsupported' ? report.zone.inArea.some((zone) => HIGH_RISK_ZONES.has(zone)) : null,
      stormDeepPct: report.storm && report.storm !== 'error' && report.storm !== 'unsupported' ? report.storm.deep : null,
      alertEvents: Array.isArray(report.alerts) ? report.alerts.filter((alert) => /flood|surge/i.test(alert.event)).map((alert) => alert.event) : [],
    } : null
    const areas = pool.map((cell) => areaFromCell(cell, meta.years, meta.source, sensorHits, floodHits, cell.k === selectedId ? extra : null))
    const top = [...areas].sort((a, b) => b.reports - a.reports)[0]
    const neighbors = top ? neighborCells(grid, top.id).map((cell) => areaFromCell(cell, meta.years, meta.source, sensorHits, floodHits, null)) : []
    return { ...rankEvidence(areas, neighbors), sensors: rankSensors(sensorHits), size: grid.size, years: meta.years, source: meta.source, focused: focus != null }
  }, [grid, meta, focus, selection, report, sensors, floods])
}
