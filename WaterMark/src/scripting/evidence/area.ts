import { AREA_RADIUS_LIMITS } from './contract'

/**
 * Radius slider on a log scale, so both 100 m and 10 km are reachable on one
 * control. Positions run 0–1000. Meters round to 10 m below 1 km, else 100 m.
 */
export function sliderToRadius(position: number): number {
  const { min, max } = AREA_RADIUS_LIMITS
  const t = Math.min(Math.max(Number.isFinite(position) ? position : 0, 0), 1000) / 1000
  const meters = min * (max / min) ** t
  return meters < 1000 ? Math.round(meters / 10) * 10 : Math.round(meters / 100) * 100
}

export function radiusToSlider(meters: number): number {
  const { min, max } = AREA_RADIUS_LIMITS
  const clamped = Math.min(Math.max(meters, min), max)
  return Math.round((Math.log(clamped / min) / Math.log(max / min)) * 1000)
}
