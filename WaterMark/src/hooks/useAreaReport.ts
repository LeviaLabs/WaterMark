// Runs every per-area lookup in parallel when the selection changes. Each result lands as soon as it
// arrives, and a newer selection aborts the older requests so stale answers never overwrite new ones.
import { useEffect, useState } from 'react'
import { fetchAlerts, fetchFloodZone, fetchRain, fetchRiver, fetchZip } from '../services/pointLookups'
import { fetchStormInArea } from '../services/stormwater'
import { isAbort } from '../services/http'
import { stormShare } from '../scripting/geo'
import type { AreaReport, Selection } from '../scripting/types'

const EMPTY: AreaReport = { rain: null, river: null, zone: null, storm: null, zip: null, alerts: null }

export function useAreaReport(selection: Selection | null): AreaReport {
  const [report, setReport] = useState<{ for: Selection | null; data: AreaReport }>({ for: null, data: EMPTY })

  useEffect(() => {
    if (!selection) return
    const ctl = new AbortController()
    const { center, circle } = selection
    // Results for an older selection start a fresh report instead of merging into it.
    const put = <K extends keyof AreaReport>(key: K, value: AreaReport[K]) =>
      setReport((r) => ({ for: selection, data: { ...(r.for === selection ? r.data : EMPTY), [key]: value } }))
    const run = <K extends keyof AreaReport>(key: K, job: Promise<AreaReport[K]>) => {
      job.then((v) => put(key, v), (e: unknown) => { if (!isAbort(e)) put(key, 'error' as AreaReport[K]) })
    }
    run('rain', fetchRain(center, ctl.signal))
    run('river', fetchRiver(center, ctl.signal))
    run('alerts', fetchAlerts(center, ctl.signal))
    run('zone', fetchFloodZone(center, ctl.signal))
    run('zip', fetchZip(center, ctl.signal))
    run('storm', fetchStormInArea(circle, ctl.signal).then((fc) => stormShare(circle, fc)))
    return () => ctl.abort()
  }, [selection])

  return report.for === selection ? report.data : EMPTY
}
