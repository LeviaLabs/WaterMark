// The flood record at a point, most local level first: county then state in the US (NOAA episodes,
// 2016 on), province then country elsewhere (GDACS events, 2001 on). The outlook reads how often
// floods came and when from the most local level that has any (scripting/outlook.ts).
import { loadAdmin1, loadCountries, loadCounties, loadFloodIndex, loadStates, regionAt, type LevelMeta } from '../floodHistory'
import type { PlaceHistory } from '../../scripting/outlook'
import type { LngLat, RegionProps } from '../../scripting/types'

function toHistory(level: PlaceHistory['level'], p: RegionProps, meta: LevelMeta, unit: string): PlaceHistory {
  const name = level === 'county' && p.s ? `${p.n} County, ${p.s}` : level === 'province' && p.s ? `${p.n}, ${p.s}` : p.n
  return { level, name, firstYear: meta.years[0], perYear: p.y, months: p.m, last: p.l, unit, source: meta.source, url: meta.url }
}

export async function loadPlaceHistory(at: LngLat): Promise<PlaceHistory[]> {
  const [index, countries] = await Promise.all([loadFloodIndex(), loadCountries()])
  const country = regionAt(countries, at)
  const out: PlaceHistory[] = []
  if (country?.k === 'USA') {
    const state = regionAt(await loadStates(), at)
    if (state) {
      const county = regionAt(await loadCounties(state.k).catch(() => null), at)
      if (county) out.push(toHistory('county', county, index.state, 'NOAA flood episodes that touched the county'))
      out.push(toHistory('state', state, index.state, 'NOAA flood episodes in the state'))
    }
  } else if (country) {
    const province = regionAt(await loadAdmin1(country.k).catch(() => null), at)
    if (province) out.push(toHistory('province', province, index.admin1, 'GDACS flood events placed in the province'))
  }
  if (country) out.push(toHistory('country', country, index.country, 'GDACS flood events in the country'))
  return out
}
