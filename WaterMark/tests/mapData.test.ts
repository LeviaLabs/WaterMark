import { describe, expect, it } from 'vitest'
import type { Feature, Polygon } from 'geojson'
import { latToTileY, lonToTileX, tileBounds, tilesCovering } from '../src/scripting/tiles'
import { makeCircle, stormShareFromTiles, type StormTile } from '../src/scripting/geo'
import { summarizeClaims } from '../src/services/claims'
import type { LngLat } from '../src/scripting/types'

const CONEY: LngLat = [-73.986, 40.5755]

const square = (w: number, s: number, e: number, n: number, category: number) => ({
  type: 'Feature' as const,
  properties: { Flooding_Category: category },
  geometry: { type: 'Polygon' as const, coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
})

describe('tile math', () => {
  it('matches the standard slippy-map tile for Coney Island at z14', () => {
    expect([lonToTileX(CONEY[0], 14), latToTileY(CONEY[1], 14)]).toEqual([4824, 6168])
  })

  it('gives bounds that contain the point', () => {
    const [w, s, e, n] = tileBounds(14, 4824, 6168)
    expect(CONEY[0]).toBeGreaterThanOrEqual(w)
    expect(CONEY[0]).toBeLessThan(e)
    expect(CONEY[1]).toBeGreaterThan(s)
    expect(CONEY[1]).toBeLessThanOrEqual(n)
  })

  it('covers a circle with every tile its box touches, and fewer at lower zooms', () => {
    const circle = makeCircle(CONEY, 2)
    const z14 = tilesCovering(circle, 14)
    expect(z14.length).toBeGreaterThan(4)
    expect(tilesCovering(circle, 12).length).toBeLessThan(z14.length)
    expect(z14).toContainEqual([14, 4824, 6168])
  })
})

describe('stormShareFromTiles', () => {
  const circle: Feature<Polygon> = makeCircle(CONEY, 0.5)
  const [w, s, e, n] = [-74.0, 40.56, -73.97, 40.59] // covers the whole circle

  it('is 100% when one category covers the circle', () => {
    const r = stormShareFromTiles(circle, [{ bounds: [w, s, e, n], features: [square(w, s, e, n, 2)] }])
    expect(r.deep).toBeCloseTo(100, 0)
    expect(r.nuisance).toBe(0)
    expect(r.none).toBe(false)
  })

  it('does not double count a polygon that two buffered tiles both carry', () => {
    const mid = CONEY[0]
    const shared = square(w, s, e, n, 1) // each tile carries the full polygon, as buffered tiles do at edges
    const tiles: StormTile[] = [
      { bounds: [w, s, mid, n], features: [shared] },
      { bounds: [mid, s, e, n], features: [shared] },
    ]
    expect(stormShareFromTiles(circle, tiles).nuisance).toBeCloseTo(100, 0)
  })

  it('reports none when no tile has features', () => {
    expect(stormShareFromTiles(circle, [{ bounds: [w, s, e, n], features: [] }]).none).toBe(true)
  })
})

describe('summarizeClaims', () => {
  it('totals payments, ignores missing or negative amounts, and ranks busy years', () => {
    const r = summarizeClaims('11224', [
      { yearOfLoss: 2012, amountPaidOnBuildingClaim: 1000, amountPaidOnContentsClaim: 500 },
      { yearOfLoss: 2012, amountPaidOnBuildingClaim: null, amountPaidOnIncreasedCostOfComplianceClaim: 250 },
      { yearOfLoss: 1992, amountPaidOnBuildingClaim: -40 },
      { yearOfLoss: 'bad' },
    ], false)
    expect(r).toMatchObject({ zip: '11224', claims: 4, totalPaidUsd: 1750, firstYear: 1992, lastYear: 2012, partial: false })
    expect(r.topYears[0]).toEqual({ year: 2012, claims: 2 })
  })

  it('handles a ZIP with no claims', () => {
    expect(summarizeClaims('99999', [], false)).toMatchObject({ claims: 0, totalPaidUsd: 0, firstYear: null, topYears: [] })
  })
})
