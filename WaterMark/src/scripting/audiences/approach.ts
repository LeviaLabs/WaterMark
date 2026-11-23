// School approach-direction estimate.
// Votes come from three mapped cues, in this order when they disagree:
//   1. A FEMA high-risk zone or an NYC stormwater polygon on one side of the point.
//   2. The bearing to the nearest GloFAS river-model cell, when it is 1–25 km away.
//   3. The uphill side of the Copernicus DEM samples (surface water tends to run from higher ground).
// The result is an estimate. It is not a forecast of which wall of a building will be hit,
// and a missing direction is never described as safe.
import type { Compass } from './compass'
import { bearingOf } from './compass'
import { classifyAlert } from '../alerts'
import type { WeatherAlert } from '../types'

export interface DirectionSample {
  compass: Compass
  elevationM: number | null
  /** True only when a high-risk NFHL polygon contains the sample. False when a zone was mapped and it is not high-risk. */
  highRiskZone: boolean | null
  /** 0 none, 1 nuisance, 2 deep. Null when the NYC scenario was not checked. */
  storm: 0 | 1 | 2 | null
}

export interface WaterCue {
  compass: Compass
  distanceKm: number
}

export interface ApproachReason { source: string; text: string }

export interface ApproachEstimate {
  compass: Compass | null
  bearing: number | null
  /** Which cue set the headline. */
  basis: 'extent' | 'water' | 'terrain' | null
  headline: string
  reasons: ApproachReason[]
  severity: { label: string; source: string }
  timing: { label: string; source: string }
  limitation: string
}

const LIMITATION = 'Estimate only. These layers do not show which side of a building water would reach, and a missing direction is not a reason to treat the school as safe.'

function tally(votes: { compass: Compass; weight: number }[]): Compass | null {
  const score = new Map<Compass, number>()
  for (const vote of votes) score.set(vote.compass, (score.get(vote.compass) ?? 0) + vote.weight)
  let best: Compass | null = null
  let bestScore = 0
  for (const [compass, n] of score) {
    if (n > bestScore) { best = compass; bestScore = n }
  }
  return bestScore > 0 ? best : null
}

export function estimateApproach(input: {
  centerElevationM: number | null
  samples: readonly DirectionSample[]
  water: WaterCue | null
  alert: { event: string; severity?: string | null; onset?: string | null; ends?: string | null; expires?: string | null } | null
  rain: { day: string; mm: number } | null
}): ApproachEstimate {
  const reasons: ApproachReason[] = []
  const extentVotes: { compass: Compass; weight: number }[] = []
  const high = input.samples.filter((s) => s.highRiskZone === true).map((s) => s.compass)
  const deep = input.samples.filter((s) => s.storm === 2).map((s) => s.compass)
  const nuisance = input.samples.filter((s) => s.storm === 1).map((s) => s.compass)
  for (const compass of high) extentVotes.push({ compass, weight: 3 })
  for (const compass of deep) extentVotes.push({ compass, weight: 3 })
  for (const compass of nuisance) extentVotes.push({ compass, weight: 2 })
  if (high.length) reasons.push({ source: 'FEMA NFHL', text: `A high-risk flood zone is mapped about 0.8 km to the ${high.join(', ')}. That is a map class (AE, A, AO, or VE), not a forecast.` })
  if (deep.length) reasons.push({ source: 'NYC Stormwater Flood Map', text: `The moderate-flood scenario (2.13 in/hr, current sea level) shows deep flooding, 1 ft or more, about 0.8 km to the ${deep.join(', ')}. A scenario, not water today.` })
  else if (nuisance.length) reasons.push({ source: 'NYC Stormwater Flood Map', text: `The same scenario shows nuisance flooding, 4 in to 1 ft, about 0.8 km to the ${nuisance.join(', ')}. A scenario, not water today.` })

  let waterVote: Compass | null = null
  if (!input.water) reasons.push({ source: 'GloFAS', text: 'The nearest river-model cell was not available, so it was not used.' })
  else if (input.water.distanceKm < 1) reasons.push({ source: 'GloFAS', text: 'The nearest river-model cell is within 1 km, so it does not give a direction. The cell is about 5 km across and is not a shoreline.' })
  else if (input.water.distanceKm > 25) reasons.push({ source: 'GloFAS', text: `The nearest river-model cell is ${input.water.distanceKm.toFixed(0)} km to the ${input.water.compass}, too far to use as an approach direction for this point.` })
  else {
    waterVote = input.water.compass
    reasons.push({ source: 'GloFAS', text: `The nearest river-model cell is ${input.water.distanceKm.toFixed(1)} km to the ${input.water.compass}. About a 5 km cell, not a surveyed channel.` })
  }

  let terrainVote: Compass | null = null
  const known = input.samples.filter((s): s is DirectionSample & { elevationM: number } => s.elevationM != null)
  if (input.centerElevationM == null || known.length < 4) {
    reasons.push({ source: 'Copernicus DEM GLO-90', text: 'Not enough ground heights were returned to estimate a slope.' })
  } else {
    const highest = known.reduce((a, b) => (b.elevationM > a.elevationM ? b : a))
    const lowest = known.reduce((a, b) => (b.elevationM < a.elevationM ? b : a))
    const spread = highest.elevationM - lowest.elevationM
    const rise = highest.elevationM - input.centerElevationM
    if (spread >= 2 && rise >= 1) {
      terrainVote = highest.compass
      reasons.push({
        source: 'Copernicus DEM GLO-90',
        text: `Ground is about ${Math.round(rise)} m higher to the ${highest.compass} than at this point (${Math.round(highest.elevationM)} m vs ${Math.round(input.centerElevationM)} m). Surface runoff would tend to move from that higher ground. The model is about 90 m cells and does not resolve a building.`,
      })
    } else {
      reasons.push({ source: 'Copernicus DEM GLO-90', text: `Sampled ground within 0.8 km spans about ${Math.round(spread)} m. No clear slope to estimate a runoff direction.` })
    }
  }

  const extent = tally(extentVotes)
  const compass = extent ?? waterVote ?? terrainVote
  const basis = extent ? 'extent' : waterVote && compass === waterVote ? 'water' : terrainVote && compass === terrainVote ? 'terrain' : null
  const how = basis === 'extent' ? 'mapped flood extent' : basis === 'water' ? 'the nearest modeled river' : basis === 'terrain' ? 'higher ground around the point' : null
  const headline = compass && how
    ? `Estimate: mapped cues point to the ${compass}, from ${how}.`
    : 'Approach direction is unknown from the layers checked. Unknown is not the same as safe.'

  let severity: ApproachEstimate['severity']
  if (input.alert) {
    severity = { label: input.alert.severity ? `${input.alert.event} (${input.alert.severity})` : input.alert.event, source: 'National Weather Service' }
  } else if (high.length) {
    severity = { label: 'A FEMA high-risk zone is mapped on at least one side. Map class, not a forecast, and not a measure of today.', source: 'FEMA NFHL' }
  } else if (deep.length || nuisance.length) {
    severity = { label: 'The NYC stormwater scenario shows flooding on at least one side. A scenario, not water today.', source: 'NYC Stormwater Flood Map' }
  } else {
    severity = { label: 'No flood alert, high-risk zone, or stormwater polygon turned up in these samples. That does not mean the school is safe.', source: 'NWS, FEMA NFHL, NYC stormwater' }
  }

  let timing: ApproachEstimate['timing']
  if (input.alert && (input.alert.onset || input.alert.ends || input.alert.expires)) {
    const until = input.alert.ends || input.alert.expires
    timing = {
      label: `Official alert timing: ${input.alert.onset ? `onset ${input.alert.onset}` : 'onset not given'}${until ? `, until ${until}` : ''}.`,
      source: 'National Weather Service',
    }
  } else if (input.rain && input.rain.mm >= 10) {
    timing = { label: `Rainfall forecast, not a flood-arrival time: ${input.rain.mm.toFixed(0)} mm on ${input.rain.day}.`, source: 'Open-Meteo' }
  } else {
    timing = { label: 'Timing is unknown. No flood-alert clock, and no day in the rainfall forecast reached 10 mm.', source: 'NWS and Open-Meteo' }
  }

  return { compass, bearing: compass ? bearingOf(compass) : null, basis, headline, reasons, severity, timing, limitation: LIMITATION }
}

/** The first flood alert that is in effect now, or null. Upcoming, test and non-flood alerts are skipped. */
export function firstFloodAlert(alerts: readonly WeatherAlert[] | null | 'error' | 'unsupported'): WeatherAlert | null {
  if (!Array.isArray(alerts)) return null
  return alerts.find((alert) => {
    const row = classifyAlert(alert)
    return row.active && row.floodRelevance === 'flood_hazard_notice'
  }) ?? null
}

/** The first day from today forward with at least 10 mm. Null days are skipped. Rainfall, not a flood probability. */
export function nextRainDay(time: readonly string[], mm: readonly (number | null)[], today: number): { day: string; mm: number } | null {
  if (today < 0) return null
  for (let i = today; i < time.length; i++) {
    const value = mm[i]
    if (value != null && value >= 10) return { day: time[i], mm: value }
  }
  return null
}
