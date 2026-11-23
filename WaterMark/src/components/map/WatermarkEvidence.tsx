import type { ReactNode } from 'react'
import { alertTimeLabel, classifyAlert } from '../../scripting/alerts'
import { STATUS_TEXT, formatLocalTime } from '../../scripting/evidence/format'
import { httpsUrl } from '../../scripting/httpsUrl'
import { sumKnown } from '../../scripting/climate'
import { sampleOnUtcDay } from '../../scripting/watermark/present'
import type { ApiResult, ApiSample, AreaMetrics, FloodCounts, WatermarkReport } from '../../scripting/watermark/types'

function countText(value: number | null, lowerBound: boolean): string {
  if (value == null) return 'No data'
  return lowerBound ? `≥ ${value.toLocaleString('en-US')}` : value.toLocaleString('en-US')
}

function SourceLine({ name, url }: { name: string; url: string | null }) {
  const href = httpsUrl(url)
  if (!href) return <p className="map-meta">Source: {name}</p>
  return <p className="map-meta"><a href={href} target="_blank" rel="noopener">Source: {name}</a></p>
}

function StatusLine({ result }: { result: ApiResult<unknown> }) {
  const text = STATUS_TEXT[result.status]
  const unavailable = result.status === 'error'
  return (
    <p>
      <strong>{unavailable ? 'data unavailable.' : `${text.label}.`}</strong>{' '}
      {text.explain}
      {result.error ? ` ${result.error.code}: ${result.error.message}` : ''}
    </p>
  )
}

function Block<T>({ title, result, children }: { title: string; result: ApiResult<T>; children?: (data: T) => ReactNode }) {
  const show = (result.status === 'available' || result.status === 'stale') && result.data != null
  return (
    <section className="report-section" data-status={result.status} aria-label={title}>
      <p className="report-title">{title}</p>
      <StatusLine result={result} />
      {result.fetchedAt ? <p className="map-meta">Fetched {formatLocalTime(result.fetchedAt)}</p> : null}
      {show && children ? children(result.data as T) : null}
      {result.limitations[0] ? <p className="map-meta">{result.limitations[0]}</p> : null}
      <SourceLine name={result.sourceName} url={result.sourceUrl} />
    </section>
  )
}

function Samples({ samples, unit }: { samples: readonly ApiSample[]; unit: string }) {
  const sum = sumKnown(samples.map((sample) => sample.value))
  const total = samples.length === 0 || sum.missing === samples.length ? 'No data' : `${sum.total.toFixed(1)} ${unit}`
  return (
    <>
      <p className="map-meta">Known total {total}{sum.missing ? `. ${sum.missing} missing` : ''}. A missing value is not zero.</p>
      <ul className="report-days">
        {samples.slice(0, 24).map((sample) => (
          <li key={`${sample.validFrom}-${sample.validTo}`}>
            <span>{formatLocalTime(sample.validFrom)}</span>
            <span>{sample.value == null ? 'No data' : `${sample.value.toFixed(1)} ${unit}`}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function AreaFigures({ area }: { area: AreaMetrics }) {
  return (
    <>
      <p className="stat-row"><span>Sensors in the cached sample</span><span className="wm-count">{countText(area.stationCount, true)}</span></p>
      <p className="stat-row"><span>Cached flood events</span><span className="wm-count">{countText(area.cachedEventCount, true)}</span></p>
      <p className="stat-row"><span>Deepest cached sample</span><span className="wm-count">{area.sampledHistoricalMaxDepthMm == null ? 'No data' : `${area.sampledHistoricalMaxDepthMm.toFixed(1)} mm`}</span></p>
      <p className="map-meta">
        Coverage is {area.coverageStatus}. Positive counts are incomplete lower bounds, not how often this area floods.
        {area.zeroMatchesVerified ? ' A verified empty query is still not an all-clear for the whole area.' : ' Unknown counts are not zero.'}
      </p>
    </>
  )
}

function FloodFigures({ floods }: { floods: FloodCounts }) {
  return (
    <>
      <p className="stat-row"><span>Sensors in this query</span><span className="wm-count">{countText(floods.stationCount, false)}</span></p>
      <p className="stat-row"><span>Flood events in this query</span><span className="wm-count">{floods.eventCount == null ? 'No data' : floods.eventCount.toLocaleString('en-US')}</span></p>
      {floods.eventCount === 0 ? <p className="map-meta">That zero is only this sensor query. It is not an all-clear for the area.</p> : null}
    </>
  )
}

export function WatermarkEvidence({ report }: { report: WatermarkReport }) {
  const riverToday = report.river.status === 'available' || report.river.status === 'stale'
    ? sampleOnUtcDay(report.river.data ?? [])
    : null
  return (
    <div className="report-block">
      <p className="map-meta">
        These readings come from watermark-v1
        {report.generatedAt ? `, generated ${formatLocalTime(report.generatedAt)}` : ''}.
        Missing data is not a low risk.
      </p>
      {report.radiusClamped ? (
        <p className="map-meta">
          The area request uses a {report.request.radiusMeters.toLocaleString('en-US')} m circle, the closest radius the API accepts (100 m to 10 km).
        </p>
      ) : null}
      {report.health === 'error' ? (
        <p className="callout callout-info" data-status="error">
          <strong>data unavailable.</strong> {report.healthDetail?.code}: {report.healthDetail?.message ?? 'data unavailable'}
        </p>
      ) : (
        <p className="map-meta">The data API answered this request. Global availability is unknown.</p>
      )}

      <Block title="Rainfall" result={report.rainfall}>
        {(samples) => <Samples samples={samples} unit="mm" />}
      </Block>
      <Block title="River discharge" result={report.river}>
        {(samples) => (
          <>
            <p className="stat-row">
              <span>Today</span>
              <span>{riverToday == null || riverToday.value == null ? 'No data' : `${riverToday.value.toFixed(1)} m³/s`}</span>
            </p>
            <Samples samples={samples} unit="m³/s" />
          </>
        )}
      </Block>
      <Block title="Official alerts" result={report.alerts}>
        {(alerts) => alerts.length === 0 ? (
          <p>No alerts were returned for this point. That is not an all-clear.</p>
        ) : (
          <ul className="report-days">
            {alerts.map((alert, index) => {
              const row = classifyAlert(alert)
              return (
                <li key={`${alert.event}-${index}`}>
                  <span>{alert.event}</span>
                  <span>{row.hazardTiming}. {alertTimeLabel(alert.onset) ?? alertTimeLabel(alert.effective) ?? 'time not provided'}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Block>
      <Block title="NYC flood exposure" result={report.exposure} />
      <Block title="FloodNet history" result={report.floods}>
        {(floods) => <FloodFigures floods={floods} />}
      </Block>
      <Block title="Area summary" result={report.area}>
        {(area) => <AreaFigures area={area} />}
      </Block>
      <Block title="Cached flood events" result={report.series}>
        {(series) => <p className="stat-row"><span>Events in the cache sample</span><span className="wm-count">{countText(series.count, true)}</span></p>}
      </Block>
    </div>
  )
}
