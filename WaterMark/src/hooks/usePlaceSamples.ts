// Elevation, nearest river cell, FEMA zone, and NYC stormwater category for a ring of points
// around a place. Used by the school view and move-your-car. Failures of the optional layers
// become nulls (unknown), not zeros. Elevation is required; if it fails the whole sample errors.
import { useEffect, useState } from 'react'
import type { Compass } from '../scripting/audiences/compass'
import { bearingBetween, compassOf, compassRing } from '../scripting/audiences/compass'
import { distanceKm, makeCircle } from '../scripting/geo'
import { mayBeUS, touchesNYC } from '../scripting/region'
import { fetchElevations, fetchNearestRiverCell } from '../services/openMeteo'
import { fetchHighRiskAtPoints } from '../services/pointLookups'
import { fetchStormAtPoints } from '../services/stormwater'
import { isAbort } from '../services/http'
import type { LngLat } from '../scripting/types'

export interface PlaceSample {
  compass: Compass
  distanceKm: number
  point: LngLat
  elevationM: number | null
  highRiskZone: boolean | null
  storm: 0 | 1 | 2 | null
}

export interface PlaceSamples {
  status: 'idle' | 'loading' | 'ready' | 'error'
  centerElevationM: number | null
  samples: PlaceSample[]
  water: { compass: Compass; distanceKm: number } | null
  fetchedAt: string | null
}

const IDLE: PlaceSamples = { status: 'idle', centerElevationM: null, samples: [], water: null, fetchedAt: null }
type Stored = PlaceSamples & { key: string }
const EMPTY: Stored = { ...IDLE, key: '' }

export function usePlaceSamples(origin: LngLat | null, ringsKm: readonly number[], enabled: boolean): PlaceSamples & { retry: () => void } {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<Stored>(EMPTY)
  const key = origin ? `${origin[0].toFixed(4)},${origin[1].toFixed(4)}:${ringsKm.join(',')}:${enabled}:${attempt}` : ''

  useEffect(() => {
    if (!enabled || !origin) return
    const ctl = new AbortController()
    const here = origin
    const requestKey = key
    const ring = ringsKm.flatMap((km) => compassRing(here, km))
    const run = async () => {
      const elevations = await fetchElevations([here, ...ring.map((sample) => sample.point)], ctl.signal)
      let water: PlaceSamples['water'] = null
      try {
        const cell = await fetchNearestRiverCell(here, ctl.signal)
        if (cell) {
          const point: LngLat = [cell.lon, cell.lat]
          water = { compass: compassOf(bearingBetween(here, point)), distanceKm: distanceKm(here, point) }
        }
      } catch (error) {
        if (isAbort(error)) throw error
      }
      const points = ring.map((sample) => sample.point)
      let high: (boolean | null)[] = points.map(() => null)
      let storm: (0 | 1 | 2 | null)[] = points.map(() => null)
      const circle = makeCircle(here, Math.max(...ringsKm))
      if (mayBeUS(here)) {
        try { high = await fetchHighRiskAtPoints(points, circle, ctl.signal) } catch (error) { if (isAbort(error)) throw error }
      }
      if (touchesNYC(circle)) {
        try { storm = await fetchStormAtPoints(points, ctl.signal) } catch (error) { if (isAbort(error)) throw error }
      }
      if (ctl.signal.aborted) return
      setState({
        key: requestKey,
        status: 'ready',
        centerElevationM: elevations[0] ?? null,
        water,
        fetchedAt: new Date().toISOString(),
        samples: ring.map((sample, index) => ({
          compass: sample.compass,
          distanceKm: sample.distanceKm,
          point: sample.point,
          elevationM: elevations[index + 1] ?? null,
          highRiskZone: high[index] ?? null,
          storm: storm[index] ?? null,
        })),
      })
    }
    run().catch((error: unknown) => {
      if (!isAbort(error)) setState({ key: requestKey, status: 'error', centerElevationM: null, samples: [], water: null, fetchedAt: null })
    })
    return () => ctl.abort()
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps -- `key` already covers origin, rings, enabled, and attempt

  const retry = () => setAttempt((n) => n + 1)
  if (!enabled || !origin) return { ...IDLE, retry }
  if (state.key !== key) return { ...IDLE, status: 'loading', retry }
  return { ...state, retry }
}
