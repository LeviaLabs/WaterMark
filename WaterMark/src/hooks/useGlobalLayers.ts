// Data loaded once per visit: FloodNet sensors and worldwide GDACS floods.
import { useEffect, useState } from 'react'
import { fetchSensors } from '../services/floodnet'
import { fetchGlobalFloods } from '../services/gdacs'
import { isAbort } from '../services/http'
import type { GlobalFloodCollection, Loadable, SensorCollection } from '../scripting/types'

export function useGlobalLayers() {
  const [sensors, setSensors] = useState<Loadable<SensorCollection>>(null)
  const [floods, setFloods] = useState<Loadable<GlobalFloodCollection>>(null)

  useEffect(() => {
    const ctl = new AbortController()
    const fail = (set: (v: 'error') => void) => (e: unknown) => { if (!isAbort(e)) set('error') }
    fetchSensors(ctl.signal).then(setSensors, fail(setSensors))
    fetchGlobalFloods(ctl.signal).then(setFloods, fail(setFloods))
    return () => ctl.abort()
  }, [])

  return { sensors, floods }
}
