// Eight-point compass math for the school approach arrow and the move-your-car ring.
// Pure. Distances use a spherical Earth of 6371 km, which is enough for a few kilometers.
import type { LngLat } from '../types'

export const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
export type Compass = (typeof COMPASS)[number]

const BEARING: Record<Compass, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 }

export const bearingOf = (compass: Compass): number => BEARING[compass]

/** Nearest of the eight compass names. 0° and 360° are north. */
export function compassOf(deg: number): Compass {
  const wrapped = ((deg % 360) + 360) % 360
  return COMPASS[Math.round(wrapped / 45) % 8]
}

/** A point `distanceKm` from `origin` along `bearingDeg` (0 = north, clockwise). */
export function offsetPoint([lon, lat]: LngLat, bearingDeg: number, distanceKm: number): LngLat {
  const distance = distanceKm / 6371
  const theta = (bearingDeg * Math.PI) / 180
  const lat1 = (lat * Math.PI) / 180
  const lon1 = (lon * Math.PI) / 180
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance) + Math.cos(lat1) * Math.sin(distance) * Math.cos(theta))
  const lon2 = lon1 + Math.atan2(
    Math.sin(theta) * Math.sin(distance) * Math.cos(lat1),
    Math.cos(distance) - Math.sin(lat1) * Math.sin(lat2),
  )
  let degrees = (lon2 * 180) / Math.PI
  degrees = ((degrees + 540) % 360) - 180
  return [degrees, (lat2 * 180) / Math.PI]
}

/** Forward bearing from `from` to `to`, degrees clockwise from north. */
export function bearingBetween(from: LngLat, to: LngLat): number {
  const lat1 = (from[1] * Math.PI) / 180
  const lat2 = (to[1] * Math.PI) / 180
  const dLon = ((to[0] - from[0]) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

export const SCHOOL_SAMPLE_KM = 0.8
export const CAR_RINGS_KM = [0.6, 1.2, 2.5] as const

export function compassRing(origin: LngLat, distanceKm: number): { compass: Compass; point: LngLat; distanceKm: number }[] {
  return COMPASS.map((compass) => ({ compass, point: offsetPoint(origin, BEARING[compass], distanceKm), distanceKm }))
}
