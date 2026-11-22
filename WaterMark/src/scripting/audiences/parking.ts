// Move-your-car suggestions.
// A candidate is kept when it is at least 2 m higher than the car (Copernicus DEM) and it is not
// inside a mapped flood extent we actually checked (FEMA high-risk zone, or an NYC stormwater polygon).
// A spot whose flood maps were not checked can still be listed as higher ground, and is labeled that way.
// Nothing here says a street or a parking spot will stay dry.
import type { Compass } from './compass'
import type { LngLat } from '../types'

export interface ParkingCandidate {
  compass: Compass
  distanceKm: number
  point: LngLat
  elevationM: number | null
  highRiskZone: boolean | null
  storm: 0 | 1 | 2 | null
}

export interface ParkingSuggestion {
  compass: Compass
  distanceKm: number
  point: LngLat
  elevationM: number
  gainM: number
  /** True only when at least one flood layer was checked here and none of them showed a mapped extent. */
  outsideMappedExtent: boolean
  checks: string[]
}

export interface ParkingRank {
  suggestions: ParkingSuggestion[]
  /** Shown when nothing qualified. Never advice to leave the car where it is. */
  emptyNote: string
}

export function rankParking(carElevationM: number | null, candidates: readonly ParkingCandidate[]): ParkingRank {
  const emptyNote = 'None of the sampled spots are at least 2 m higher and clear of the mapped flood layers that were checked. This is not advice to leave the car where it is.'
  if (carElevationM == null) return { suggestions: [], emptyNote: 'Ground height at the car did not load, so no higher-ground suggestion was made. Unknown is not the same as safe.' }
  const viable: (ParkingSuggestion & { checked: number })[] = []
  for (const candidate of candidates) {
    if (candidate.elevationM == null) continue
    const gain = candidate.elevationM - carElevationM
    if (gain < 2) continue
    const inExtent = candidate.highRiskZone === true || (candidate.storm != null && candidate.storm >= 1)
    if (inExtent) continue
    const checks: string[] = [`About ${Math.round(gain)} m higher than the car (${Math.round(candidate.elevationM)} m, Copernicus DEM GLO-90).`]
    let checked = 0
    if (candidate.highRiskZone === false) {
      checked += 1
      checks.push('A FEMA zone polygon covers this spot and it is not a high-risk zone (AE, A, AO, VE). Moderate and unmapped areas are not a clearance.')
    } else checks.push('FEMA zone was not confirmed at this spot.')
    if (candidate.storm === 0) {
      checked += 1
      checks.push('Not inside the NYC stormwater scenario polygons (moderate flood, current sea level). That scenario is not a forecast of today.')
    } else if (candidate.storm == null) checks.push('The NYC stormwater model does not cover this spot, or it was not checked.')
    viable.push({
      compass: candidate.compass,
      distanceKm: candidate.distanceKm,
      point: candidate.point,
      elevationM: candidate.elevationM,
      gainM: gain,
      outsideMappedExtent: checked > 0,
      checks,
      checked,
    })
  }
  viable.sort((a, b) => b.checked - a.checked || b.gainM - a.gainM || a.distanceKm - b.distanceKm)
  return {
    suggestions: viable.slice(0, 3).map((item) => ({
      compass: item.compass,
      distanceKm: item.distanceKm,
      point: item.point,
      elevationM: item.elevationM,
      gainM: item.gainM,
      outsideMappedExtent: item.outsideMappedExtent,
      checks: item.checks,
    })),
    emptyNote,
  }
}
