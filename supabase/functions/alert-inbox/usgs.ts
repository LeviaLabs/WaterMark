// Official reading for a USGS monitoring location: USGS Water Services instantaneous values.
// https://waterservices.usgs.gov/nwis/iv/ — public, no key. The email never supplies a number.
// These are observations (provisional until USGS approves them), not National Weather Service warnings.
import { readBounded } from './limits.ts'

export const USGS_IV_URL = 'https://waterservices.usgs.gov/nwis/iv/'
const PARAMETERS: Record<string, { label: string; unit: string }> = {
  '00065': { label: 'Gage height', unit: 'ft' },
  '00060': { label: 'Streamflow', unit: 'ft³/s' },
}
const MAX_BYTES = 512_000

export interface Reading {
  parameter: string
  label: string
  unit: string
  value: number
  time: string
  provisional: boolean
}
export interface SiteReading {
  siteName: string
  latitude: number
  longitude: number
  readings: Reading[]
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

/** Safe nested read of untrusted JSON: at(x, 'a', 0, 'b') is x?.a?.[0]?.b without `any`. */
function at(value: unknown, ...path: Array<string | number>): unknown {
  let cur = value
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string | number, unknown>)[key]
  }
  return cur
}

/** Latest gage height and streamflow; null when USGS has nothing usable. Throws on outage. */
export async function fetchSiteReading(siteId: string, fetcher: Fetcher = (i, init) => fetch(i, init), timeoutMs = 12_000): Promise<SiteReading | null> {
  if (!/^\d{8,15}$/.test(siteId)) return null
  const url = `${USGS_IV_URL}?format=json&sites=${siteId}&parameterCd=${Object.keys(PARAMETERS).join(',')}&siteStatus=active`
  const res = await fetcher(url, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('usgs-unavailable')
  const text = await readBounded(res, MAX_BYTES, timeoutMs)
  if (text === null) throw new Error('usgs-too-large')
  const series = at(JSON.parse(text), 'value', 'timeSeries')
  let site: Omit<SiteReading, 'readings'> | null = null
  const readings: Reading[] = []
  for (const s of Array.isArray(series) ? series : []) {
    if (at(s, 'sourceInfo', 'siteCode', 0, 'value') !== siteId) continue
    const lat = Number(at(s, 'sourceInfo', 'geoLocation', 'geogLocation', 'latitude'))
    const lon = Number(at(s, 'sourceInfo', 'geoLocation', 'geogLocation', 'longitude'))
    if (!site && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      site = { siteName: String(at(s, 'sourceInfo', 'siteName') ?? '').slice(0, 200), latitude: lat, longitude: lon }
    }
    const code = String(at(s, 'variable', 'variableCode', 0, 'value') ?? '')
    const meta = PARAMETERS[code]
    const values = at(s, 'values', 0, 'value')
    const last = Array.isArray(values) ? values[values.length - 1] : undefined
    const value = Number(at(last, 'value'))
    const time = String(at(last, 'dateTime') ?? '')
    if (!meta || !last || !Number.isFinite(value) || value <= -999_999 || Number.isNaN(Date.parse(time))) continue
    const qualifiers = at(last, 'qualifiers')
    readings.push({
      parameter: code,
      ...meta,
      value,
      time: new Date(time).toISOString(),
      provisional: Array.isArray(qualifiers) && qualifiers.includes('P'),
    })
  }
  return site ? { ...site, readings } : null
}
