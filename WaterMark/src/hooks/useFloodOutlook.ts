// The flood outlook for the selected place: its flood record (loaded once per selection), the
// lookups the area report already made (rain, river, their histories, NWS alerts: no extra
// requests), and, once those have answered, one AI summary of the result.
import { useEffect, useMemo, useState } from 'react'
import { loadPlaceHistory } from '../services/outlook/history'
import { fetchSummary, SummaryError, type Summary } from '../services/outlook/summary'
import { isAbort } from '../services/http'
import { buildOutlook, summaryFacts, type FloodOutlook, type PlaceHistory } from '../scripting/outlook'
import type { AreaReport, Selection } from '../scripting/types'

export type SummaryState = { status: 'idle' } | { status: 'loading' } | { status: 'done'; summary: Summary } | { status: 'error'; code: string; message: string }

export function useFloodOutlook(selection: Selection | null, report: AreaReport, placeName: string): { outlook: FloodOutlook | null; summary: SummaryState } {
  const [history, setHistory] = useState<{ for: Selection | null; levels: PlaceHistory[] | null }>({ for: null, levels: null })
  const [summary, setSummary] = useState<{ key: string; state: SummaryState }>({ key: '', state: { status: 'idle' } })

  useEffect(() => {
    if (!selection) return
    let isCurrent = true
    // A failed record is shown as no record (the outlook then leaves out "when next"), not an error.
    loadPlaceHistory(selection.center).then((levels) => levels, () => []).then((levels) => {
      if (isCurrent) setHistory({ for: selection, levels })
    })
    return () => { isCurrent = false }
  }, [selection])

  const levels = history.for === selection ? history.levels : null
  const outlook = useMemo(() => (selection ? buildOutlook({
    rain: report.rain, rainHistory: report.rainHistory, river: report.river, riverHistory: report.riverHistory,
    alerts: report.alerts, history: levels,
  }) : null), [selection, report.rain, report.rainHistory, report.river, report.riverHistory, report.alerts, levels])

  const facts = useMemo(() => (outlook && !outlook.isPending ? summaryFacts(placeName, outlook) : null), [outlook, placeName])
  const key = facts ? JSON.stringify(facts) : ''

  useEffect(() => {
    if (!facts) return
    const ctl = new AbortController()
    fetchSummary(facts, ctl.signal).then(
      (s) => setSummary({ key, state: { status: 'done', summary: s } }),
      (e: unknown) => {
        if (isAbort(e)) return
        const err = e instanceof SummaryError ? e : new SummaryError('MODEL_ERROR', 'The AI summary failed.')
        setSummary({ key, state: { status: 'error', code: err.code, message: err.message } })
      },
    )
    return () => ctl.abort()
    // `facts` is described exactly by `key`; a new object with the same figures must not ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const pending: SummaryState = facts ? { status: 'loading' } : { status: 'idle' }
  return { outlook, summary: summary.key === key && key ? summary.state : pending }
}
