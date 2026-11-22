import { describe, expect, it } from 'vitest'
import { childLevel, classOf, fillColor, focusAtDepth, focusVeil, legendLabels, maskAround, pathTo, stepUpFocus } from '../src/scripting/choropleth'
import type { RegionLevel, RegionPick } from '../src/scripting/types'

const pick = (level: RegionLevel, k: string): RegionPick => ({ level, props: { k, n: k, e: 0, py: 0, y: [], b: [0, 0, 1, 1] } })

const BREAKS = [0.24, 0.76, 1.4, 2.7, 4.9]
const COLORS = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6']

describe('flood-history classes', () => {
  it('keeps zero (none recorded) apart from the lowest class', () => {
    expect(classOf(0, BREAKS)).toBe(0)
    expect(classOf(0.01, BREAKS)).toBe(1)
    expect(classOf(0.24, BREAKS)).toBe(2)
    expect(classOf(3, BREAKS)).toBe(5)
    expect(classOf(9.5, BREAKS)).toBe(6)
  })
  it('builds a valid step expression even when breaks repeat', () => {
    const e = fillColor([1, 1, 1, 2, 2], COLORS) as unknown as (string | number)[]
    expect(e[0]).toBe('step')
    const stops = e.slice(3).filter((x): x is number => typeof x === 'number')
    for (let i = 1; i < stops.length; i++) expect(stops[i]).toBeGreaterThan(stops[i - 1])
  })
  it('labels the legend from none recorded to the top class', () => {
    expect(legendLabels(BREAKS)).toEqual(['None recorded', 'Under 0.24', '0.24 to 0.76', '0.76 to 1.4', '1.4 to 2.7', '2.7 to 4.9', '4.9 or more'])
    expect(legendLabels([33, 120, 170, 250, 430]).at(-1)).toBe('430 or more')
  })
})

describe('drill-down focus', () => {
  it('opens a country into provinces, the US into states, a state into counties', () => {
    expect(childLevel(null)).toBe('country')
    expect(childLevel(pick('country', 'FRA'))).toBe('admin1')
    expect(childLevel(pick('country', 'USA'))).toBe('state')
    expect(childLevel(pick('state', '06'))).toBe('county')
    expect(childLevel(pick('admin1', 'FR-75'))).toBeNull()
    expect(childLevel(pick('county', '06037'))).toBeNull()
  })
  it('builds the path down from the world, reusing known parents', () => {
    const usa = pick('country', 'USA')
    const ca = pick('state', '06')
    const find = (level: RegionLevel, k: string) => (level === 'country' && k === 'USA' ? usa : level === 'state' && k === '06' ? ca : null)
    expect(pathTo(pick('country', 'FRA'), [usa, ca], find).map((p) => p.props.k)).toEqual(['FRA'])
    expect(pathTo(pick('admin1', 'FR-75'), [pick('country', 'FRA')], find).map((p) => p.props.k)).toEqual(['FRA', 'FR-75'])
    expect(pathTo(pick('county', '06037'), [usa, ca], find).map((p) => p.props.k)).toEqual(['USA', '06', '06037'])
    expect(pathTo(pick('county', '06037'), [], find).map((p) => p.props.k)).toEqual(['USA', '06', '06037'])
    expect(pathTo(pick('state', '06'), [], find).map((p) => p.props.k)).toEqual(['USA', '06'])
  })
  it('clears a selected square by stepping back to its region, then up to the world', () => {
    const usa = pick('country', 'USA')
    const ca = pick('state', '06')
    const la = pick('county', '06037')
    const bosnia = pick('country', 'BIH')
    const keys = (path: { props: { k: string } }[]) => path.map((p) => p.props.k)

    const square = stepUpFocus([usa, ca, la], true)
    expect(keys(square.path)).toEqual(['USA', '06', '06037'])
    expect(square.selection).toBeNull()

    expect(keys(stepUpFocus(square.path, false).path)).toEqual(['USA', '06'])
    expect(keys(stepUpFocus([usa, ca], false).path)).toEqual(['USA'])
    expect(stepUpFocus([usa], false)).toEqual({ path: [], selection: null })

    // Choosing World, or stepping up from a country, drops the country and the spot.
    expect(focusAtDepth([bosnia], 0)).toEqual({ path: [], selection: null })
    expect(focusAtDepth([usa, ca, la], 0).selection).toBeNull()
    expect(keys(focusAtDepth([usa, ca, la], 2).path)).toEqual(['USA', '06'])
    expect(focusAtDepth([usa, ca, la], 2).selection).toBeNull()

    // A searched or drawn spot has no region. Back still clears it and returns to the world.
    expect(stepUpFocus([], true)).toEqual({ path: [], selection: null })
  })
  it('drops the dark veil when focus returns to the world', () => {
    expect(focusVeil({ level: 'country', k: 'BIH' }, null)).toBe('clear')
    expect(focusVeil({ level: 'state', k: '06' }, null)).toBe('clear')
    expect(focusVeil({ level: 'county', k: '06037' }, { level: 'state', k: '06' })).toBe('show')
    expect(focusVeil({ level: 'country', k: 'BIH' }, { level: 'country', k: 'BIH' })).toBe('keep')
    expect(focusVeil(null, null)).toBe('keep')
    expect(focusVeil(null, { level: 'country', k: 'BIH' })).toBe('show')
  })
  it('cuts every piece of the focused region out of a world-sized mask', () => {
    const sq = (x: number) => [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]]
    const m = maskAround({ type: 'MultiPolygon', coordinates: [sq(0), sq(5)] })
    expect(m.geometry.coordinates).toHaveLength(3)
    expect(m.geometry.coordinates[0][0]).toEqual([-180, -85])
  })
})
