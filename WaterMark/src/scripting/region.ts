// Which datasets cover a place. Pure; tested in tests/region.test.ts.
//
// Rain, river, rain-now and worldwide flood reports cover the whole world. NWS alerts, FEMA zones,
// Census ZIP codes and NFIP claims cover the US only, and FloodNet and the stormwater model cover
// New York City only. Checking coverage first means a selection in Lagos or Osaka sends no request
// that can only fail, and the panel says "not covered here" instead of "couldn't load".
import type { Feature, Polygon } from 'geojson'
import type { LngLat } from './types'

/** [west, south, east, north] in degrees. */
export type BBox = [number, number, number, number]

/** New York City's five boroughs (the extent of the stormwater model and FloodNet). */
export const NYC_BOUNDS: BBox = [-74.26, 40.49, -73.69, 40.92]

/**
 * Generous boxes around the US and its territories. Inside one, a point *may* be in the US
 * (the boxes also catch southern Canada and northern Mexico); outside all of them it is not.
 */
const US_BOXES: readonly BBox[] = [
  [-125.0, 24.4, -66.9, 49.4], // contiguous states
  [-180, 51.0, -129.9, 71.6], // Alaska
  [172.0, 51.0, 180, 53.1], // western Aleutians
  [-160.6, 18.8, -154.7, 22.4], // Hawaii
  [-67.4, 17.6, -64.5, 18.6], // Puerto Rico and the US Virgin Islands
  [144.5, 13.2, 146.1, 20.6], // Guam and the Northern Mariana Islands
  [-171.2, -14.6, -168.1, -11.0], // American Samoa
]

/** Country codes OpenStreetMap uses for the US and the territories FEMA and NWS serve. */
export const US_COUNTRY_CODES: ReadonlySet<string> = new Set(['US', 'PR', 'VI', 'GU', 'MP', 'AS'])

const inBox = ([lon, lat]: LngLat, [w, s, e, n]: BBox) => lon >= w && lon <= e && lat >= s && lat <= n

/** False only when the point is certainly outside the US; true means "ask the providers". */
export const mayBeUS = (p: LngLat): boolean => US_BOXES.some((b) => inBox(p, b))

export function bboxOf(area: Feature<Polygon>): BBox {
  let [w, s, e, n] = [180, 90, -180, -90]
  for (const [lon, lat] of area.geometry.coordinates[0]) {
    w = Math.min(w, lon); e = Math.max(e, lon); s = Math.min(s, lat); n = Math.max(n, lat)
  }
  return [w, s, e, n]
}

export const bboxesOverlap = (a: BBox, b: BBox): boolean => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]

/** True when any part of the circle touches New York City. */
export const touchesNYC = (area: Feature<Polygon>): boolean => bboxesOverlap(bboxOf(area), NYC_BOUNDS)

export type Units = 'imperial' | 'metric'

// Countries that measure rain in inches and distance in miles.
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM'])

/** The units the viewer's browser language implies ("en-US" imperial, "en-GB" or "fr" metric). */
export function unitsForLocale(locale: string | undefined): Units {
  if (!locale) return 'imperial'
  try {
    const region = new Intl.Locale(locale).maximize().region
    return region && IMPERIAL_REGIONS.has(region) ? 'imperial' : 'metric'
  } catch {
    return 'imperial'
  }
}
