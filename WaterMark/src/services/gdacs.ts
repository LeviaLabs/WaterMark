// GDACS: floods reported worldwide in the past 30 days.
import type { FeatureCollection, Geometry } from 'geojson'
import { ENDPOINTS } from './endpoints'
import { getJSON } from './http'
import { markFetched } from '../scripting/freshness'
import { ALERT_COLOR } from '../scripting/mapTheme'
import type { AlertLevel, GlobalFloodCollection } from '../scripting/types'

interface RawEvent {
  name: string; alertlevel: string; iscurrent: string; fromdate: string; todate: string; url?: { report?: string }
}

const isoDay = (msAgo: number) => new Date(Date.now() - msAgo).toISOString().slice(0, 10)
const DAY_MS = 864e5

export async function fetchGlobalFloods(signal?: AbortSignal): Promise<GlobalFloodCollection> {
  const q = new URLSearchParams({
    eventlist: 'FL',
    fromdate: isoDay(30 * DAY_MS),
    todate: isoDay(0),
    alertlevel: 'red;orange;green', // GDACS returns nothing without an alert level filter
  })
  const fc = await getJSON<FeatureCollection<Geometry, RawEvent>>(`${ENDPOINTS.gdacs}?${q}`, { signal })
  const features: GlobalFloodCollection['features'] = []
  for (const f of fc.features ?? []) {
    if (f.geometry?.type !== 'Point') continue
    const p = f.properties
    const level = (p.alertlevel in ALERT_COLOR ? p.alertlevel : 'Green') as AlertLevel
    features.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        name: p.name, alertlevel: level, color: ALERT_COLOR[level], active: p.iscurrent === 'true',
        fromdate: p.fromdate, todate: p.todate, report: p.url?.report ?? 'https://www.gdacs.org/',
      },
    })
  }
  markFetched('gdacs')
  return { type: 'FeatureCollection', features }
}
