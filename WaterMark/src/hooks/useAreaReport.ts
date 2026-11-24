// Runs every per-area lookup in parallel when the selection changes. Each result lands as soon as it
// arrives, and a newer selection aborts the older requests so stale answers never overwrite new ones.
// `retry` reruns only the lookups that failed, keeping the ones that already answered.
//
// Coverage first (scripting/region.ts): rain, river, their histories and elevation run everywhere; US-only lookups run
// only when the center may be in the US, and the NYC stormwater model only when the circle touches
// NYC. Elsewhere those rows are 'unsupported' at once, with no request. Near a border (inside the
// rough US boxes but in Canada or Mexico), the US lookups run alongside a country check and their
// answers are replaced by 'unsupported' if the point turns out not to be in the US.
import { useCallback, useEffect, useState } from 'react'
import { fetchAlerts, fetchFloodZones, fetchZip } from '../services/pointLookups'
import { fetchElevation, fetchRainHistory, fetchRainOutlook, fetchRiverHistory, fetchRiverOutlook } from '../services/openMeteo'
import { fetchStormInArea } from '../services/stormwater'
import { fetchClaims, type ClaimsSummary } from '../services/claims'
import { fetchCountry } from '../services/geocoding/photon'
import { isAbort } from '../services/http'
import { watermarkApiUrlFromEnv } from '../services/watermark/config'
import { createWatermarkClient } from '../services/watermark/client'
import { legacyFromWatermark, loadWatermarkArea, failedWatermarkReport } from '../services/watermark/loadArea'
import { mayBeUS, touchesNYC, US_COUNTRY_CODES } from '../scripting/region'
import type { AreaReport, Selection } from '../scripting/types'
import type { WatermarkReport } from '../scripting/watermark/types'

const EMPTY: AreaReport = { rain: null, river: null, rainHistory: null, riverHistory: null, elevation: null, country: null, zone: null, storm: null, zip: null, alerts: null, claims: null }
type Key = keyof AreaReport

function watermarkFailed(report: WatermarkReport | null | undefined): boolean {
  if (report == null) return true
  return report.health === 'error' || [report.rainfall, report.river, report.alerts, report.exposure, report.floods, report.area, report.series].some((part) => part.status === 'error')
}

export function useAreaReport(selection: Selection | null): { report: AreaReport; retry: () => void } {
  const apiUrl = watermarkApiUrlFromEnv({
    VITE_WATERMARK_API_URL: import.meta.env.VITE_WATERMARK_API_URL,
    PROD: import.meta.env.PROD,
  })
  const [report, setReport] = useState<{ for: Selection | null; data: AreaReport }>({ for: null, data: EMPTY })
  const [attempt, setAttempt] = useState({ for: selection, n: 0 })
  const current = report.for === selection ? report.data : (apiUrl ? { ...EMPTY, watermark: null } : EMPTY)

  useEffect(() => {
    if (!selection) return
    const ctl = new AbortController()
    const { center, circle } = selection
    // On a retry, only lookups that failed (or never answered) run again.
    const keep = attempt.for === selection && attempt.n > 0
    const has = (k: Key) => {
      if (!keep || current[k] === null || current[k] === 'error') return false
      if (k === 'watermark') return !watermarkFailed(current.watermark)
      return true
    }
    // Results for an older selection start a fresh report instead of merging into it.
    // An answer that lands after the selection changed is dropped: it would reset the report to the old place.
    const put = <K extends Key>(key: K, value: AreaReport[K]) => {
      if (ctl.signal.aborted) return
      setReport((r) => ({ for: selection, data: { ...(r.for === selection ? r.data : EMPTY), [key]: value } }))
    }
    const run = <K extends Key>(key: K, job: () => Promise<AreaReport[K]>) => {
      if (has(key)) return
      put(key, null as AreaReport[K])
      job().then((v) => put(key, v), (e: unknown) => { if (!isAbort(e)) put(key, 'error' as AreaReport[K]) })
    }

    // The country is shown in the panel and settles border cases; a failed lookup is not fatal.
    const country = fetchCountry(center, ctl.signal)
    run('country', () => country)
    // Worldwide: forecasts, the long history behind them, and ground height.
    // When watermark-v1 is configured, rain, river, and alerts come from that API.
    // The long archives, elevation, FEMA zones, and insurance claims are not in the contract.
    if (apiUrl) {
      if (!has('watermark')) {
        put('watermark', null)
        put('rain', null)
        put('river', null)
        put('alerts', null)
        const client = createWatermarkClient(apiUrl)
        loadWatermarkArea(client, center[1], center[0], selection.radiusKm, ctl.signal).then((view) => {
          const legacy = legacyFromWatermark(view)
          put('watermark', view)
          put('rain', legacy.rain)
          put('river', legacy.river)
          put('alerts', legacy.alerts)
        }, (error: unknown) => {
          if (isAbort(error)) return
          const view = failedWatermarkReport(error)
          const legacy = legacyFromWatermark(view)
          put('watermark', view)
          put('rain', legacy.rain)
          put('river', legacy.river)
          put('alerts', legacy.alerts)
        })
      }
    } else {
      run('rain', () => fetchRainOutlook(center, ctl.signal))
      run('river', () => fetchRiverOutlook(center, ctl.signal))
    }
    run('elevation', () => fetchElevation(center, ctl.signal))
    run('rainHistory', () => fetchRainHistory(center, ctl.signal))
    run('riverHistory', () => fetchRiverHistory(center, ctl.signal))
    if (touchesNYC(circle)) run('storm', () => fetchStormInArea(circle, ctl.signal))
    else put('storm', 'unsupported')

    if (!mayBeUS(center)) {
      for (const k of ['zone', 'zip', 'claims'] as const) put(k, 'unsupported')
      if (!apiUrl) put('alerts', 'unsupported')
    } else {
      const outsideUS = country.then((c) => c !== 'none' && !US_COUNTRY_CODES.has(c), () => false)
      /** A US-only answer, or 'unsupported' once the country check says the point is not in the US. */
      const usOnly = <T,>(job: () => Promise<T>) => () => {
        const answer = job()
        answer.catch(() => {}) // an error that 'unsupported' replaces is not reported
        return outsideUS.then((isOut): T | 'unsupported' | Promise<T> => (isOut ? 'unsupported' : answer))
      }
      if (!apiUrl) run('alerts', usOnly(() => fetchAlerts(center, ctl.signal)))
      run('zone', usOnly(() => fetchFloodZones(center, circle, ctl.signal)))
      if (!has('claims')) {
        const zip = has('zip') ? Promise.resolve(current.zip as string) : usOnly(() => fetchZip(center, ctl.signal))()
        zip.catch(() => {}) // failures are reported through the 'zip' and 'claims' rows below
        run('zip', () => zip)
        run('claims', () => zip.then<ClaimsSummary | 'none' | 'unsupported'>((z) =>
          (z === 'unsupported' || z === 'none' ? z : fetchClaims(z, ctl.signal))))
      }
    }
    return () => ctl.abort()
    // `current` is read only to decide what a retry skips; a new result must not rerun the lookups.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, attempt, apiUrl])

  const retry = useCallback(() => setAttempt((a) => ({ for: selection, n: a.for === selection ? a.n + 1 : 1 })), [selection])
  return { report: current, retry }
}
