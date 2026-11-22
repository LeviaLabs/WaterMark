// Runs every per-area lookup in parallel when the selection changes. Each result lands as soon as it
// arrives, and a newer selection aborts the older requests so stale answers never overwrite new ones.
// `retry` reruns only the lookups that failed, keeping the ones that already answered.
import { useCallback, useEffect, useState } from 'react'
import { fetchAlerts, fetchFloodZones, fetchRain, fetchRiver, fetchZip } from '../services/pointLookups'
import { fetchStormInArea } from '../services/stormwater'
import { fetchClaims, type ClaimsSummary } from '../services/claims'
import { isAbort } from '../services/http'
import type { AreaReport, Selection } from '../scripting/types'

const EMPTY: AreaReport = { rain: null, river: null, zone: null, storm: null, zip: null, alerts: null, claims: null }
type Key = keyof AreaReport

export function useAreaReport(selection: Selection | null): { report: AreaReport; retry: () => void } {
  const [report, setReport] = useState<{ for: Selection | null; data: AreaReport }>({ for: null, data: EMPTY })
  const [attempt, setAttempt] = useState({ for: selection, n: 0 })
  const current = report.for === selection ? report.data : EMPTY

  useEffect(() => {
    if (!selection) return
    const ctl = new AbortController()
    const { center, circle } = selection
    // On a retry, only lookups that failed (or never answered) run again.
    const keep = attempt.for === selection && attempt.n > 0
    const has = (k: Key) => keep && current[k] !== null && current[k] !== 'error'
    // Results for an older selection start a fresh report instead of merging into it.
    const put = <K extends Key>(key: K, value: AreaReport[K]) =>
      setReport((r) => ({ for: selection, data: { ...(r.for === selection ? r.data : EMPTY), [key]: value } }))
    const run = <K extends Key>(key: K, job: () => Promise<AreaReport[K]>) => {
      if (has(key)) return
      put(key, null as AreaReport[K])
      job().then((v) => put(key, v), (e: unknown) => { if (!isAbort(e)) put(key, 'error' as AreaReport[K]) })
    }
    run('rain', () => fetchRain(center, ctl.signal))
    run('river', () => fetchRiver(center, ctl.signal))
    run('alerts', () => fetchAlerts(center, ctl.signal))
    run('zone', () => fetchFloodZones(center, circle, ctl.signal))
    run('storm', () => fetchStormInArea(circle, ctl.signal))
    if (!has('claims')) {
      const zip = has('zip') ? Promise.resolve(current.zip as string) : fetchZip(center, ctl.signal)
      run('zip', () => zip)
      run('claims', () => zip.then<ClaimsSummary | 'none'>((z) => (z === 'none' ? 'none' : fetchClaims(z, ctl.signal))))
    }
    return () => ctl.abort()
    // `current` is read only to decide what a retry skips; a new result must not rerun the lookups.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, attempt])

  const retry = useCallback(() => setAttempt((a) => ({ for: selection, n: a.for === selection ? a.n + 1 : 1 })), [selection])
  return { report: current, retry }
}
