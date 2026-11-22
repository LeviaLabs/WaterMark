import { describe, expect, it } from 'vitest'
import { bearingBetween, compassOf, offsetPoint } from '../src/scripting/audiences/compass'
import { estimateApproach, firstFloodAlert, nextRainDay } from '../src/scripting/audiences/approach'
import { rankParking } from '../src/scripting/audiences/parking'
import { areaFromCell, neighborCells, rankEvidence, rankSensors } from '../src/scripting/audiences/rank'
import { audienceMarks } from '../src/scripting/audiences/marks'
import { claimSheetText } from '../src/scripting/audiences/claimSheet'
import { parseRole } from '../src/scripting/audiences/role'
import { parseGrid } from '../src/scripting/cells'
import type { DirectionSample } from '../src/scripting/audiences/approach'

const flat = (compass: DirectionSample['compass'], elevationM: number | null = 10): DirectionSample => ({
  compass, elevationM, highRiskZone: null, storm: null,
})

describe('audience compass', () => {
  it('names the eight directions and offsets a point east', () => {
    expect(compassOf(0)).toBe('N')
    expect(compassOf(360)).toBe('N')
    expect(compassOf(44)).toBe('NE')
    expect(compassOf(-45)).toBe('NW')
    const east = offsetPoint([0, 0], 90, 111.2)
    expect(east[0]).toBeGreaterThan(0.9)
    expect(east[0]).toBeLessThan(1.1)
    expect(Math.abs(east[1])).toBeLessThan(0.05)
    expect(compassOf(bearingBetween([0, 0], east))).toBe('E')
  })
})

describe('school approach estimate', () => {
  const eight = (['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const).map((compass) => flat(compass))

  it('uses the nearest river when no flood extent is mapped', () => {
    const estimate = estimateApproach({
      centerElevationM: 10, samples: eight, water: { compass: 'NE', distanceKm: 4.2 }, alert: null, rain: null,
    })
    expect(estimate.compass).toBe('NE')
    expect(estimate.basis).toBe('water')
    expect(estimate.headline).toMatch(/Estimate/)
    expect(estimate.limitation).toMatch(/not a reason to treat the school as safe/)
  })

  it('prefers a mapped flood extent over the river bearing', () => {
    const samples = eight.map((sample) => sample.compass === 'SW' ? { ...sample, highRiskZone: true } : sample)
    const estimate = estimateApproach({
      centerElevationM: 10, samples, water: { compass: 'NE', distanceKm: 6 }, alert: null, rain: null,
    })
    expect(estimate.compass).toBe('SW')
    expect(estimate.basis).toBe('extent')
    expect(estimate.reasons.some((reason) => reason.source === 'FEMA NFHL')).toBe(true)
    expect(estimate.severity.label).toMatch(/not a forecast/)
  })

  it('uses the uphill side when extent and river do not give a direction', () => {
    const samples = eight.map((sample) => sample.compass === 'N' ? { ...sample, elevationM: 40 } : sample)
    const estimate = estimateApproach({
      centerElevationM: 10, samples, water: { compass: 'E', distanceKm: 40 }, alert: null, rain: null,
    })
    expect(estimate.compass).toBe('N')
    expect(estimate.basis).toBe('terrain')
  })

  it('says the direction is unknown instead of safe when nothing was measured', () => {
    const estimate = estimateApproach({
      centerElevationM: null,
      samples: eight.map((sample) => ({ ...sample, elevationM: null })),
      water: null, alert: null, rain: null,
    })
    expect(estimate.compass).toBeNull()
    expect(estimate.headline).toMatch(/Unknown is not the same as safe/)
    expect(estimate.severity.label).toMatch(/does not mean the school is safe/)
  })

  it('keeps official alert timing separate from a rainfall forecast', () => {
    const withAlert = estimateApproach({
      centerElevationM: 10, samples: eight, water: null,
      alert: { event: 'Flash Flood Warning', severity: 'Severe', onset: '2026-11-22T18:00:00Z', ends: '2026-11-22T22:00:00Z' },
      rain: { day: '2026-11-23', mm: 40 },
    })
    expect(withAlert.severity.label).toBe('Flash Flood Warning (Severe)')
    expect(withAlert.timing.source).toBe('National Weather Service')
    expect(withAlert.timing.label).toMatch(/onset/)
    expect(firstFloodAlert([{ event: 'Wind Advisory' }, { event: 'Flood Warning' }])?.event).toBe('Flood Warning')
    expect(firstFloodAlert('unsupported')).toBeNull()
    expect(nextRainDay(['2026-11-22', '2026-11-23'], [1, 12], 0)).toEqual({ day: '2026-11-23', mm: 12 })
  })
})

describe('move your car', () => {
  it('keeps higher ground outside a checked flood extent and drops mapped flooding', () => {
    const ranked = rankParking(5, [
      { compass: 'E', distanceKm: 0.6, point: [1, 0], elevationM: 20, highRiskZone: true, storm: 0 },
      { compass: 'NE', distanceKm: 1.2, point: [1, 1], elevationM: 9, highRiskZone: false, storm: 0 },
      { compass: 'N', distanceKm: 0.6, point: [0, 1], elevationM: 12, highRiskZone: null, storm: null },
      { compass: 'S', distanceKm: 0.6, point: [0, -1], elevationM: 6, highRiskZone: false, storm: 0 },
    ])
    expect(ranked.suggestions.map((spot) => spot.compass)).toEqual(['NE', 'N'])
    expect(ranked.suggestions[0].outsideMappedExtent).toBe(true)
    expect(ranked.suggestions[1].outsideMappedExtent).toBe(false)
    expect(ranked.suggestions[1].checks.join(' ')).toMatch(/not confirmed/)
  })

  it('does not tell anyone to stay put when nothing qualifies', () => {
    const ranked = rankParking(10, [
      { compass: 'N', distanceKm: 0.6, point: [0, 1], elevationM: 11, highRiskZone: false, storm: 0 },
    ])
    expect(ranked.suggestions).toHaveLength(0)
    expect(ranked.emptyNote).toMatch(/not advice to leave the car/)
  })
})

describe('responder evidence rank', () => {
  const base = {
    bounds: [0, 0, 1, 1] as [number, number, number, number],
    center: [0.5, 0.5] as [number, number],
    yearStart: 2016, yearEnd: 2025, sourceName: 'NOAA',
    sensorEvents: 0, sensorCount: 0, deepestIn: null, activeFloods: 0,
    femaHighRisk: null, stormDeepPct: null, alertEvents: [] as string[],
  }
  it('orders by mapped evidence and does not emit a probability', () => {
    const { response, staging } = rankEvidence(
      [
        { ...base, id: 'quiet', name: 'Quiet', reports: 2 },
        { ...base, id: 'busy', name: 'Busy', reports: 40 },
        { ...base, id: 'alert', name: 'Alert', reports: 3, alertEvents: ['Flood Warning'] },
      ],
      [
        { ...base, id: 'alert', name: 'Alert', reports: 3, alertEvents: ['Flood Warning'] },
        { ...base, id: 'stage', name: 'Stage', reports: 0 },
        { ...base, id: 'busy', name: 'Busy', reports: 40 },
      ],
    )
    expect(response.map((area) => area.id)).toEqual(['alert', 'busy', 'quiet'])
    expect(JSON.stringify(response)).not.toMatch(/%|probability/i)
    expect(staging.map((area) => area.id)).toEqual(['stage'])
    expect(staging[0].items.at(-1)?.detail).toMatch(/not a clearance/)
  })

  it('ranks FloodNet by recorded floods and keeps zero-event sensors out of that list', () => {
    const ranked = rankSensors([
      { id: 'a', name: 'A', lon: 0, lat: 0, events: 2, depthIn: 1, last: null },
      { id: 'b', name: 'B', lon: 0.1, lat: 0, events: 9, depthIn: 4, last: '2024-01-01' },
      { id: 'c', name: 'C', lon: 0.2, lat: 0, events: 0, depthIn: 0, last: null },
    ])
    expect(ranked.recorded.map((sensor) => sensor.id)).toEqual(['b', 'a'])
    expect(ranked.quiet.map((sensor) => sensor.id)).toEqual(['c'])
  })

  it('finds the eight neighboring squares, including ones with no records', () => {
    const grid = parseGrid({ size: 1, years: [2001, 2025], rows: [[180, 90, 4, 2, 2012, 2, 0, 1]] }, 'world')
    const cell = grid.cells.features[0].properties
    const area = areaFromCell(cell, [2001, 2025], 'GDACS', [], [])
    expect(area.reports).toBe(4)
    expect(neighborCells(grid, cell.k)).toHaveLength(8)
  })
})

describe('audience marks and roles', () => {
  it('draws an arrow and a suggestion line', () => {
    const marks = audienceMarks({
      approach: { origin: [0, 0], compass: 'NE' },
      parking: { origin: [0, 0], points: [[1, 1]] },
      areas: [{ bounds: [0, 0, 1, 1], role: 'response' }],
      sensors: [],
    })
    expect(marks.features.some((feature) => feature.properties?.kind === 'approach')).toBe(true)
    expect(marks.features.some((feature) => feature.geometry.type === 'LineString')).toBe(true)
  })
  it('falls back to the public map for an unknown role', () => {
    expect(parseRole(null)).toBe('explore')
    expect(parseRole('school')).toBe('school')
    expect(parseRole('admin')).toBe('explore')
  })
  it('writes a claim sheet that does not call the property safe', () => {
    const text = claimSheetText({
      place: '1 Example Street', fetchedAt: 'now',
      facts: [{ label: 'FEMA zone at this point', value: 'No zone polygon at this point. That is not a finding of low risk.' }],
      checked: ['when'], notes: '', photoNames: [],
    })
    expect(text).toMatch(/not a statement that the property is safe/)
    expect(text).toMatch(/\[x\] Date and time/)
    expect(text).toMatch(/floodsmart\.gov/)
  })
})
