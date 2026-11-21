// Data loaded once per visit: FloodNet sensors, worldwide GDACS floods, and the claims summary.
import { useEffect, useState } from 'react'
import { fetchSensors } from '../services/floodnet'
import { fetchGlobalFloods } from '../services/gdacs'
import { fetchClaimsSummary, type ClaimsSummary } from '../services/claims'
import { isAbort } from '../services/http'
import type { GlobalFloodCollection, Loadable, SensorCollection } from '../scripting/types'

export function useGlobalLayers() {
  const [sensors, setSensors] = useState<Loadable<SensorCollection>>(null)
  const [floods, setFloods] = useState<Loadable<GlobalFloodCollection>>(null)
  const [claims, setClaims] = useState<ClaimsSummary | null | undefined>(undefined)

  useEffect(() => {
    const ctl = new AbortController()
    const fail = (set: (v: 'error') => void) => (e: unknown) => { if (!isAbort(e)) set('error') }
    fetchSensors(ctl.signal).then(setSensors, fail(setSensors))
    fetchGlobalFloods(ctl.signal).then(setFloods, fail(setFloods))
    fetchClaimsSummary(ctl.signal).then(setClaims)
    return () => ctl.abort()
  }, [])

  return { sensors, floods, claims }
}
