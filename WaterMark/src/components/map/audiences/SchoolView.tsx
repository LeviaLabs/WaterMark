import { estimateApproach, firstFloodAlert, nextRainDay } from '../../../scripting/audiences/approach'
import { SCHOOL_SAMPLE_KM } from '../../../scripting/audiences/compass'
import { todayIndex } from '../../../scripting/climate'
import { fmtTime } from '../../../scripting/format'
import type { PlaceSamples } from '../../../hooks/usePlaceSamples'
import type { AreaReport } from '../../../scripting/types'

export function SchoolView({ place, samples, report }: { place: string; samples: PlaceSamples & { retry: () => void }; report: AreaReport }) {
  if (!place) {
    return (
      <section className="aud-block">
        <p className="aud-kicker">School</p>
        <h3 className="aud-title">Which way is water mapped?</h3>
        <p>Search for the school, or click the campus. The estimate uses mapped flood extent, ground height, and the nearest modeled river. It is not a forecast for one wall of a building.</p>
      </section>
    )
  }
  if (samples.status === 'loading' || samples.status === 'idle') {
    return <section className="aud-block"><p className="report-skeleton" aria-busy="true">Sampling ground height and mapped flood extent…</p></section>
  }
  if (samples.status === 'error') {
    return (
      <section className="aud-block">
        <p className="panel-failed">Ground height did not load, so no direction was estimated. Unknown is not the same as safe. <button type="button" className="panel-retry" onClick={samples.retry}>Try again</button></p>
      </section>
    )
  }
  const alert = firstFloodAlert(report.alerts)
  const rain = report.rain && report.rain !== 'error'
    ? nextRainDay(report.rain.time, report.rain.mm, todayIndex(report.rain.time))
    : null
  const estimate = estimateApproach({
    centerElevationM: samples.centerElevationM,
    samples: samples.samples.filter((sample) => sample.distanceKm === SCHOOL_SAMPLE_KM),
    water: samples.water,
    alert: alert ? { event: alert.event, severity: alert.severity, onset: alert.onset, ends: alert.ends, expires: alert.expires } : null,
    rain,
  })
  return (
    <section className="aud-block">
      <p className="aud-kicker">School · estimate</p>
      <h3 className="aud-title">{estimate.headline}</h3>
      {estimate.compass ? (
        <p className="aud-compass" aria-hidden="true">
          <span className="aud-arrow" style={{ transform: `rotate(${estimate.bearing ?? 0}deg)` }}>↑</span>
          <span>{estimate.compass}</span>
        </p>
      ) : null}
      <p className="aud-severity"><span>Severity</span> {estimate.severity.label}</p>
      <p className="map-meta">Source: {estimate.severity.source}</p>
      <p className="aud-severity"><span>Timing</span> {estimate.timing.label}</p>
      <p className="map-meta">Source: {estimate.timing.source}</p>
      <ul className="aud-reasons">
        {estimate.reasons.map((reason) => (
          <li key={reason.source + reason.text}><strong>{reason.source}.</strong> {reason.text}</li>
        ))}
      </ul>
      <p className="callout callout-info">{estimate.limitation}</p>
      {samples.fetchedAt ? <p className="map-meta">Sampled {fmtTime(new Date(samples.fetchedAt))}. Heights are meters above sea level.</p> : null}
    </section>
  )
}
