// Checks the built flood-history files (npm run data:floods) have the shape the map reads.
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

const read = (p: string) => JSON.parse(readFileSync(`public/data/floods/${p}`, 'utf8'))

describe('built flood-history files', () => {
  it('has an index with five rising breaks per level', () => {
    const i = read('index.json')
    for (const b of [i.countries.breaks, i.admin1.breaks, i.states.breaks, i.states.countyBreaks, i.cells.us.yearBreaks, i.cells.world.yearBreaks]) {
      expect(b).toHaveLength(5)
      for (let k = 1; k < 5; k++) expect(b[k]).toBeGreaterThanOrEqual(b[k - 1])
    }
  })
  it('gives every country, state and county an id, name, yearly average and flyable bounds', () => {
    const countries = read('countries.json').features
    const states = read('us-states.json').features
    expect(countries.length).toBeGreaterThan(200)
    expect(states.length).toBeGreaterThanOrEqual(50)
    for (const f of [...countries, ...states]) {
      const [w, s, e, n] = f.properties.b
      expect(typeof f.properties.k).toBe('string')
      expect(f.properties.py).toBeGreaterThanOrEqual(0)
      // Never the whole world for a shape split by the antimeridian; Antarctica really circles the pole.
      if (f.properties.k !== 'ATA') expect(e - w).toBeLessThanOrEqual(180)
      expect(n).toBeGreaterThan(s)
    }
    for (const st of states) expect(existsSync(`public/data/floods/counties/${st.properties.k}.json`)).toBe(true)
    const usa = countries.find((f: { properties: { k: string } }) => f.properties.k === 'USA')
    expect(usa.properties.e).toBeGreaterThan(0)
  })
  it('breaks every other country into provinces with unique ids and month counts', () => {
    const fra = read('admin1/FRA.json').features
    expect(fra.length).toBeGreaterThan(10)
    expect(new Set(fra.map((f: { properties: { k: string } }) => f.properties.k)).size).toBe(fra.length)
    for (const f of fra) expect(f.properties.m).toHaveLength(12)
    expect(existsSync('public/data/floods/admin1/USA.json')).toBe(false)
    // France flies to mainland France, not to French Guiana and Reunion as well.
    const france = read('countries.json').features.find((f: { properties: { k: string } }) => f.properties.k === 'FRA')
    expect(france.properties.b[0]).toBeGreaterThan(-10)
  })
  it('lists US flood causes in the same order as the build script', async () => {
    const { CAUSE_IDS, causeRows, decodeCauses } = await import('../src/scripting/causes')
    const i = JSON.parse(readFileSync('public/data/floods/index.json', 'utf8'))
    expect(i.states.causes.map((c: string[]) => c[0])).toEqual(CAUSE_IDS)
    expect(decodeCauses([0, 5, 7, 2, 99, 1])).toEqual({ rain: 5, sea: 2 })
    expect(causeRows({ river: 3, rain: 9, made_up: 4 }).map((r) => r.id)).toEqual(['rain', 'river'])
    // Every state's flood count is NOAA episodes, so no cause has more floods than the state.
    for (const f of JSON.parse(readFileSync('public/data/floods/us-states.json', 'utf8')).features) {
      for (const n of Object.values(f.properties.c ?? {})) expect(n as number).toBeLessThanOrEqual(f.properties.e)
    }
  })
})
