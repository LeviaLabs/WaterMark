import { EvidenceTag } from '../common/EvidenceTag'
import { fmtTime } from '../../scripting/format'
import { alertTimeLabel, shownAlerts, type ClassifiedAlert } from '../../scripting/alerts'
import type { Coverable, WeatherAlert } from '../../scripting/types'

function clock(alert: WeatherAlert) {
  const start = alertTimeLabel(alert.onset) ?? alertTimeLabel(alert.effective)
  const end = alertTimeLabel(alert.ends) ?? alertTimeLabel(alert.expires)
  return `Starts ${start ?? 'not provided'} · Until ${end ?? 'not provided'}`
}

function timingWord(row: ClassifiedAlert): string {
  if (row.active && row.floodRelevance === 'flood_hazard_notice') return 'Active flood alert'
  if (row.active) return 'Other alert'
  if (row.hazardTiming === 'upcoming') return 'Upcoming'
  return 'Timing unknown'
}

export function AlertsList({ alerts }: { alerts: Coverable<WeatherAlert[]> }) {
  if (alerts === null) return <p className="map-meta">Loading…</p>
  if (alerts === 'unsupported') {
    return (
      <p className="callout callout-info">
        WaterMark reads official alerts from the US National Weather Service, which does not cover this place. This is not an
        all-clear: check your national weather service, listed by the{' '}
        <a href="https://severeweather.wmo.int" target="_blank" rel="noopener">WMO Severe Weather Information Centre</a>.
      </p>
    )
  }
  if (alerts === 'error') {
    return <p className="map-meta">Couldn't load weather alerts right now. Alerts cover the US only.</p>
  }
  const fetched = <p className="map-meta">From the National Weather Service, fetched {fmtTime(new Date())}</p>
  const shown = shownAlerts(alerts)
  if (!shown.length) {
    return (
      <>
        <p className="callout callout-info">No active weather alerts at the center of this area. That is not a guarantee that it won't flood.</p>
        {fetched}
      </>
    )
  }
  return (
    <>
      {shown.map((row, i) => (
        <article key={`${row.alert.event}-${i}`} className={row.active && row.floodRelevance === 'flood_hazard_notice' ? 'callout callout-alert alert-item' : 'callout callout-info alert-item'}>
          <span className="alert-head"><strong>{row.alert.event}</strong><EvidenceTag kind="official" /></span>
          <p className="map-meta">{timingWord(row)}</p>
          {row.alert.headline ? <p>{row.alert.headline}</p> : null}
          <p className="map-meta">{clock(row.alert)}</p>
          {row.alert.instruction ? <p>{row.alert.instruction}</p> : null}
        </article>
      ))}
      {fetched}
    </>
  )
}
