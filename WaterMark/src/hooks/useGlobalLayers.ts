// Point layers loaded once per visit: worldwide GDACS floods at once, and FloodNet NYC sensors only
// the first time New York City is in view or selected (`needsSensors`). A visitor exploring Jakarta
// never downloads the NYC sensor tables.
import { useEffect, useState } from 'react'
import { fetchSensors } from '../services/floodnet'
import { fetchGlobalFloods } from '../services/gdacs'
import { isAbort } from '../services/http'
import type { GlobalFloodCollection, Loadable, SensorCollection } from '../scripting/types'

export function useGlobalLayers(needsSensors: boolean) {
  const [sensors, setSensors] = useState<Loadable<SensorCollection>>(null)
  const [floods, setFloods] = useState<Loadable<GlobalFloodCollection>>(null)
  const [wantsSensors, setWantsSensors] = useState(needsSensors)
  // Once wanted, keep them: panning away and back must not download them again.
  if (needsSensors && !wantsSensors) setWantsSensors(true)

  useEffect(() => {
    const ctl = new AbortController()
    fetchGlobalFloods(ctl.signal).then(setFloods, (e: unknown) => { if (!isAbort(e)) setFloods('error') })
    return () => ctl.abort()
  }, [])

  useEffect(() => {
    if (!wantsSensors) return
    const ctl = new AbortController()
    fetchSensors(ctl.signal).then(setSensors, (e: unknown) => { if (!isAbort(e)) setSensors('error') })
    return () => ctl.abort()
  }, [wantsSensors])

  return { sensors, floods }
}
