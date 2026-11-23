import { describe, expect, it } from 'vitest'
import { clampRadiusKm, distanceKm, makeCircle, nearestFlood, stormShare, summarizeSensors } from '../src/scripting/geo'
import type { GlobalFloodCollection, SensorCollection } from '../src/scripting/types'
import type { StormFeatures } from '../src/scripting/geo'

const CONEY: [number, number] = [-73.986, 40.5755]
const sensor = (lon: number, lat: number, events: number, depth: number, last: string | null, installed: string) => ({
  type: 'Feature' as const,
  geometry: { type: 'Point' as const, coordinates: [lon, lat] },
  properties: { sensor_id: `${lon}`, events, max_depth: depth, last_flood: last, date_installed: installed },
})

describe('summarizeSensors', () => {
  const sensors: SensorCollection = {
    type: 'FeatureCollection',
    features: [
      sensor(-73.986, 40.5755, 10, 5.8, '2026-09-27', '2024-06-20'),
      sensor(-73.985, 40.576, 5, 2.1, '2025-01-01', '2024-08-01'),
      sensor(-73.9, 40.7, 99, 30, '2026-11-01', '2023-01-01'), // far outside
    ],
  }
  it('counts only sensors inside the circle', () => {
    const s = summarizeSensors(sensors, makeCircle(CONEY, 1))
    expect(s).toEqual({ count: 2, events: 15, deepestIn: 5.8, lastFlood: '2026-09-27', since: '2024-06-20' })
  })
  it('returns null when no sensor is inside', () => {
    expect(summarizeSensors(sensors, makeCircle([-80, 25], 1))).toBeNull()
  })
  it('leaves the event total unknown when a count is missing', () => {
    const withGap: SensorCollection = {
      type: 'FeatureCollection',
      features: [
        sensor(-73.986, 40.5755, 4, 1, null, '2024-01-01'),
        { ...sensor(-73.985, 40.576, 0, 1, null, '2024-01-01'), properties: { sensor_id: 'gap', events: null, max_depth: 1, last_flood: null } },
      ],
    }
    expect(summarizeSensors(withGap, makeCircle(CONEY, 1))?.events).toBeNull()
  })
})

describe('clampRadiusKm', () => {
  it('keeps a drawn circle inside the API radius', () => {
    expect(clampRadiusKm(0.01)).toBe(0.1)
    expect(clampRadiusKm(1.2)).toBe(1.2)
    expect(clampRadiusKm(80)).toBe(10)
    expect(clampRadiusKm(Number.NaN)).toBe(0.1)
  })
})

describe('nearestFlood', () => {
  it('picks the closest event', () => {
    const fc: GlobalFloodCollection = {
      type: 'FeatureCollection',
      features: [[2.35, 48.85], [-74, 40.7]].map(([lon, lat], i) => ({
        type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { name: `e${i}`, alertlevel: 'Green', color: '#000', active: true, fromdate: '', todate: '', report: '' },
      })),
    }
    expect(nearestFlood(fc, CONEY)?.feature.properties.name).toBe('e1')
    expect(nearestFlood({ type: 'FeatureCollection', features: [] }, CONEY)).toBeNull()
  })
})

describe('stormShare', () => {
  it('measures the share of the circle covered by each flood category', () => {
    const area = makeCircle(CONEY, 1)
    // A polygon covering the whole circle, as deep flooding.
    const big = { type: 'Feature' as const, properties: { Flooding_Category: 2 },
      geometry: { type: 'Polygon' as const, coordinates: [[[-74.1, 40.5], [-73.9, 40.5], [-73.9, 40.7], [-74.1, 40.7], [-74.1, 40.5]]] } }
    const r = stormShare(area, { type: 'FeatureCollection', features: [big] } as StormFeatures)
    expect(r.deep).toBeCloseTo(100, 0)
    expect(r.nuisance).toBe(0)
    expect(r.none).toBe(false)
  })
  it('reports no modeled flooding for an empty result', () => {
    const r = stormShare(makeCircle(CONEY, 1), { type: 'FeatureCollection', features: [] })
    expect(r).toMatchObject({ none: true, deep: 0, nuisance: 0 })
  })
})

describe('makeCircle', () => {
  it('never draws a circle smaller than 50 m', () => {
    const c = makeCircle(CONEY, 0)
    const edge = c.geometry.coordinates[0][0] as [number, number]
    expect(distanceKm(CONEY, edge)).toBeCloseTo(0.05, 2)
  })
})
