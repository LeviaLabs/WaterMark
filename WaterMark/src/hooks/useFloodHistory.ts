// Loads the flood-history files for the drill-down map: the index and the world at once, US states
// right after (small, and the US is one click away), then a country's provinces or a state's
// counties the first time that region is focused. Each file downloads once per visit.
import { useEffect, useMemo, useState } from 'react'
import {
  loadAdmin1, loadCounties, loadCountries, loadFloodIndex, loadGrid, loadStates, type FloodHistoryIndex, type RegionCollection,
} from '../services/floodHistory'
import type { RegionData } from '../components/map/regionLayers'
import type { Loadable, RegionPick } from '../scripting/types'
import type { Grid } from '../scripting/cells'

type Keyed = { for: string; data: RegionCollection } | null

export function useFloodHistory(path: readonly RegionPick[]): Omit<RegionData, 'year'> & { status: Loadable<true> } {
  const [index, setIndex] = useState<FloodHistoryIndex | null>(null)
  const [countries, setCountries] = useState<RegionCollection | null>(null)
  const [states, setStates] = useState<RegionCollection | null>(null)
  const [counties, setCounties] = useState<Keyed>(null)
  const [admin1, setAdmin1] = useState<Keyed>(null)
  const [failed, setFailed] = useState(false)
  const [grids, setGrids] = useState<{ us: Grid | null; world: Grid | null }>({ us: null, world: null })

  useEffect(() => {
    let isLive = true
    const fail = () => { if (isLive) setFailed(true) }
    loadFloodIndex().then((v) => { if (isLive) setIndex(v) }, fail)
    loadCountries()
      .then((v) => { if (isLive) setCountries(v) })
      .then(() => loadStates())
      .then((v) => { if (isLive && v) setStates(v) }, fail)
    // The grids are what the map draws: load both right away (about 40 kB together).
    for (const kind of ['world', 'us'] as const) {
      loadGrid(kind).then((g) => { if (isLive) setGrids((cur) => ({ ...cur, [kind]: g })) }, fail)
    }
    return () => { isLive = false }
  }, [])

  const country = path[0]?.level === 'country' ? path[0].props.k : null
  const stateFips = path.find((p) => p.level === 'state')?.props.k ?? null
  const admin1Key = country && country !== 'USA' ? country : null

  // A subdivision file that fails just leaves the parent colored; the map stays usable.
  useEffect(() => {
    if (!stateFips) return
    let isLive = true
    loadCounties(stateFips).then((data) => { if (isLive) setCounties({ for: stateFips, data }) }, () => {})
    return () => { isLive = false }
  }, [stateFips])

  useEffect(() => {
    if (!admin1Key) return
    let isLive = true
    loadAdmin1(admin1Key).then((data) => { if (isLive) setAdmin1({ for: admin1Key, data }) }, () => {})
    return () => { isLive = false }
  }, [admin1Key])

  const shownCounties = counties && counties.for === stateFips ? counties.data : null
  const shownAdmin1 = admin1 && admin1.for === admin1Key ? admin1.data : null
  const focus = path.at(-1) ?? null
  const status: Loadable<true> = failed ? 'error' : index && countries ? true : null

  return useMemo(() => {
    const byLevel = { country: countries, state: states, county: shownCounties, admin1: shownAdmin1 }
    const focusGeometry = focus ? byLevel[focus.level]?.features.find((f) => f.properties.k === focus.props.k)?.geometry ?? null : null
    return { index, countries, states, counties: shownCounties, admin1: shownAdmin1, focus, focusGeometry, country, grids, status }
  }, [index, countries, states, shownCounties, shownAdmin1, focus, country, grids, status])
}
