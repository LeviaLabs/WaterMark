// The "Area" tab. A short "what to do" line sits on top; every dataset below is a folded row that
// already shows its one-line answer, and opens for the numbers, sources and caveats. Every number
// names its source and fetch time, and every empty or failed state says what it means
// (no sensor is not the same as no flooding).
import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import { usePresence } from '../../hooks/usePresence'
import { EvidenceTag } from '../common/EvidenceTag'
import type { EvidenceKind } from '../../scripting/content/dataSources'
import { fmtDate, fmtMiles, fmtRadius, fmtTime, pct, weekday } from '../../scripting/format'
import { nearestFlood, summarizeSensors } from '../../scripting/geo'
import { HIGH_RISK_ZONES, ZONE_TEXT } from '../../scripting/mapTheme'
import type { AreaReport as Report, GlobalFloodCollection, Loadable, Selection, SensorCollection } from '../../scripting/types'

interface Props {
  selection: Selection
  report: Report
  /** Reruns the lookups that failed. */
  onRetry: () => void
  sensors: Loadable<SensorCollection>
  floods: Loadable<GlobalFloodCollection>
}

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <p className="stat-row"><span>{k}</span><span className="report-stat-value">{v}</span></p>
)
// GDACS lists floods worldwide; farther than this, "nearest" says nothing useful about the area.
const NEAR_FLOOD_KM = 800

const RetryContext = createContext<() => void>(() => {})
function Failed({ what }: { what: string }) {
  const retry = useContext(RetryContext)
  return (
    <p className="panel-failed">
      Couldn't load {what}. The source may be busy or blocking requests.{' '}
      <button type="button" className="panel-retry" onClick={retry}>Try again</button>
    </p>
  )
}
const Fetched = ({ from }: { from: string }) => <p className="map-meta">From {from}, fetched {fmtTime(new Date())}</p>
const Empty = ({ children }: { children: ReactNode }) => <p className="panel-empty">{children}</p>

/** The one-line answer for a folded row, from its loading state. */
function line<T>(v: Loadable<T>, done: (v: T) => string, waiting = 'Loading…'): ReactNode {
  if (v === null) return <span className="report-loading">{waiting}</span>
  if (v === 'error') return <span className="report-error">Couldn't load. Open to retry.</span>
  return <span className="report-value">{done(v)}</span>
}

/** A folded row: title, evidence pill and the one-line answer; opens and closes with a short slide. */
function Section({ title, kind, summary, children }: { title: string; kind: EvidenceKind; summary: ReactNode; children: ReactNode }) {
  const id = useId()
  const [isOpen, setIsOpen] = useState(false)
  const body = usePresence(isOpen)
  return (
    <section className={isOpen ? 'report-section is-open' : 'report-section'}>
      <button type="button" className="report-summary" aria-expanded={isOpen} aria-controls={id} onClick={() => setIsOpen(!isOpen)}>
        <span className="report-head">
          <span className="report-title">{title}</span>
          <EvidenceTag kind={kind} />
        </span>
        <span className="report-line">{summary}</span>
      </button>
      {body.isMounted ? (
        <div id={id} className={body.isClosing ? 'report-body is-closing' : 'report-body'} onAnimationEnd={body.onAnimationEnd}>
          {children}
        </div>
      ) : null}
    </section>
  )
}

export function AreaReport({ selection, report: s, onRetry, sensors, floods }: Props) {
  const { center, radiusKm, circle } = selection

  const sensorSummary = sensors && sensors !== 'error' ? summarizeSensors(sensors, circle) : null
  const nearest = floods && floods !== 'error' ? nearestFlood(floods, center) : null
  const near = nearest && nearest.km <= NEAR_FLOOD_KM ? nearest : null
  const zones = s.zone && s.zone !== 'error' ? s.zone : null
  const highZones = zones ? zones.inArea.filter((z) => HIGH_RISK_ZONES.has(z)) : []
  const isHighRisk = highZones.length > 0 || (s.storm && s.storm !== 'error' && s.storm.deep > 1)
  const alertCount = Array.isArray(s.alerts) ? s.alerts.length : 0
  const riverFlows = s.river && s.river !== 'error' ? s.river.river_discharge.filter((x): x is number => x != null) : []

  return (
    <RetryContext.Provider value={onRetry}>
      <p className="map-meta report-where">
        Circle of {fmtRadius(radiusKm)} radius around {center[1].toFixed(4)}, {center[0].toFixed(4)}.
        Sensors, the heavy-rain model and FEMA zones cover the whole circle; rain, river and ZIP code are read at its center.
      </p>

      {alertCount ? (
        <p className="callout callout-alert">
          <strong>There {alertCount === 1 ? 'is an active alert' : `are ${alertCount} active alerts`} here.</strong>{' '}
          Open the Alerts tab and follow the National Weather Service instructions.
        </p>
      ) : isHighRisk ? (
        <p className="callout callout-info">
          This area has a mapped flood risk. Renters and owners can buy flood insurance through{' '}
          <a href="https://www.floodsmart.gov" target="_blank" rel="noopener">FloodSmart.gov</a>;{' '}
          <a href="https://www.floodhelpny.org" target="_blank" rel="noopener">FloodHelpNY</a> explains options in NYC.
        </p>
      ) : s.alerts === null || s.zone === null || s.storm === null ? (
        <p className="callout callout-info">Checking weather alerts and flood zones for this area…</p>
      ) : s.alerts === 'error' ? (
        <p className="callout callout-info">
          Couldn't check weather alerts right now, so this is not an all-clear. See{' '}
          <a href="https://www.weather.gov" target="_blank" rel="noopener">weather.gov</a> for current warnings.
        </p>
      ) : (
        <p className="callout callout-info">
          No active alerts or high-risk zone found here. Flooding can still happen in heavy rain, so keep drains clear and know your route to higher ground.
        </p>
      )}

      <Section title="Street flooding sensors" kind="observed"
        summary={line(sensors, () => (sensorSummary
          ? `${sensorSummary.count} sensor${sensorSummary.count === 1 ? '' : 's'}, ${sensorSummary.events.toLocaleString('en-US')} floods recorded`
          : 'No sensors in this area'))}>
        {sensors === 'error' ? <Failed what="FloodNet sensors" /> : !sensorSummary ? (
          <Empty>No FloodNet sensors in this area. Sensors only cover parts of NYC, so no sensor does not mean no flooding.</Empty>
        ) : (
          <>
            <Row k="Sensors in area" v={sensorSummary.count} />
            <Row k="Monitoring since" v={fmtDate(sensorSummary.since)} />
            <Row k="Floods recorded" v={sensorSummary.events.toLocaleString('en-US')} />
            <Row k="Deepest flood" v={sensorSummary.events ? `${sensorSummary.deepestIn.toFixed(1)} in` : 'none yet'} />
            <Row k="Most recent flood" v={fmtDate(sensorSummary.lastFlood)} />
          </>
        )}
        {sensors && sensors !== 'error' ? <Fetched from="FloodNet NYC" /> : null}
      </Section>

      <Section title="Heavy-rain flood model" kind="scenario"
        summary={line(s.storm, (v) => (v.none ? 'No modeled flooding here' : `${pct(v.nuisance)} shallow, ${pct(v.deep)} deep`))}>
        {s.storm === 'error' ? <Failed what="the NYC stormwater model" /> : s.storm === null ? null : s.storm.none ? (
          <Empty>No modeled heavy-rain flooding in this circle. The model covers New York City only.</Empty>
        ) : (
          <>
            <p className="map-meta">A scenario, not flooding today. If 2.13 inches of rain fell in an hour, this share of the area is modeled to flood:</p>
            <Row k="4 inches to 1 foot deep" v={pct(s.storm.nuisance)} />
            <Row k="1 foot or deeper" v={pct(s.storm.deep)} />
            {s.storm.partial ? <p className="map-meta">This area is large, so it was measured on simplified map tiles. Draw a smaller circle for a more exact figure.</p> : null}
            <p className="map-meta">From the NYC Stormwater Flood Map (NYC Open Data, updated July 3, 2024).</p>
          </>
        )}
      </Section>

      <Section title="FEMA flood zones" kind="reference"
        summary={line(s.zone, (v) => (!v.inArea.length ? 'No zone mapped here'
          : highZones.length ? `High-risk zone ${highZones.join(', ')} in this area` : `Zone ${v.inArea.join(', ')}, outside high risk`))}>
        {s.zone === 'error' ? <Failed what="FEMA flood zones" /> : s.zone === null ? null : !s.zone.inArea.length ? (
          <Empty>No FEMA flood zone is mapped in this area. FEMA maps cover the US only, and some areas are unmapped.</Empty>
        ) : (
          <>
            <Row k="Zones in this area" v={s.zone.inArea.join(', ')} />
            <Row k="Zone at the center" v={s.zone.center
              ? s.zone.center.FLD_ZONE + (s.zone.center.ZONE_SUBTY ? ` (${s.zone.center.ZONE_SUBTY.toLowerCase()})` : '')
              : 'none mapped'} />
            {s.zone.inArea.filter((z) => ZONE_TEXT[z]).map((z) => (
              <p key={z} className="report-text"><strong>{z}:</strong> {ZONE_TEXT[z]}</p>
            ))}
            <p className="map-meta">A reference map for insurance, not a current warning.</p>
            <Fetched from="FEMA National Flood Hazard Layer" />
          </>
        )}
      </Section>

      <Section title="Rain, next 3 days" kind="forecast"
        summary={line(s.rain, (v) => `${v.precipitation_sum.reduce((a, b) => a + b, 0).toFixed(2)} in expected`)}>
        {s.rain === 'error' ? <Failed what="the rain forecast" /> : s.rain === null ? null : <RainBars rain={s.rain} />}
      </Section>

      <Section title="Nearest river, 7 days" kind="modeled"
        summary={line(s.river, () => (riverFlows.length ? `Peak ${Math.max(...riverFlows).toLocaleString('en-US')} m³/s` : 'No modeled river nearby'))}>
        {s.river === 'error' ? <Failed what="the river forecast" /> : s.river === null ? null : !riverFlows.length ? (
          <Empty>No modeled river near this point.</Empty>
        ) : (
          <>
            <Row k="Today" v={`${riverFlows[0].toLocaleString('en-US')} m³/s`} />
            <Row k="7-day peak" v={`${Math.max(...riverFlows).toLocaleString('en-US')} m³/s`} />
            <p className="map-meta">
              Modeled flow in the GloFAS river cell nearest the center (a 5 km grid), which may be a small stream rather than the river
              you have in mind. It does not include coastal surge or street flooding.
            </p>
            <Fetched from="GloFAS via Open-Meteo" />
          </>
        )}
      </Section>

      <Section title="Past insurance claims" kind="historical"
        summary={line(s.claims, (v) => (v === 'none' ? 'No US ZIP code here' : `${v.claims.toLocaleString('en-US')} claims in ZIP ${v.zip}`),
          typeof s.zip === 'string' && s.zip !== 'none' ? `Counting claims in ZIP ${s.zip}…` : 'Finding the ZIP code…')}>
        {s.claims === 'error' ? <Failed what="flood insurance claims from OpenFEMA" /> : s.claims === null ? null : s.claims === 'none' ? (
          <Empty>Claims are listed by US ZIP code, and no ZIP code was found at the center of this area.</Empty>
        ) : !s.claims.claims ? (
          <Empty>No National Flood Insurance Program claims on record for ZIP {s.claims.zip}.</Empty>
        ) : (
          <>
            <Row k="ZIP code" v={s.claims.zip} />
            <Row k="Claims" v={`${s.claims.claims.toLocaleString('en-US')}${s.claims.partial ? '+' : ''}`} />
            <Row k="Total paid" v={usd(s.claims.totalPaidUsd)} />
            {s.claims.firstYear ? <Row k="Years covered" v={`${s.claims.firstYear} to ${s.claims.lastYear}`} /> : null}
            {s.claims.topYears.length ? (
              <Row k="Most claims" v={s.claims.topYears.map((y) => `${y.year} (${y.claims.toLocaleString('en-US')})`).join(', ')} />
            ) : null}
            <p className="map-meta">
              Claims only cover insured properties, so a low count can mean few people had flood insurance. Amounts are as paid, not adjusted for inflation.
            </p>
            <Fetched from="FEMA OpenFEMA (NFIP Redacted Claims v3)" />
          </>
        )}
      </Section>

      <Section title="Nearest reported flood" kind="historical"
        summary={line(floods, () => (near ? `${near.feature.properties.name}, ${fmtMiles(near.km)} away` : 'None within 500 miles'))}>
        {floods === 'error' ? <Failed what="worldwide flood reports" /> : !near ? (
          <Empty>
            No GDACS flood events within 500 miles in the past 30 days
            {nearest ? ` (the nearest is ${fmtMiles(nearest.km)} away)` : ''}. GDACS lists floods large enough for international
            notice, so local street flooding won't appear here.
          </Empty>
        ) : (
          <>
            <Row k="Event" v={near.feature.properties.name} />
            <Row k="Distance" v={fmtMiles(near.km)} />
            <Row k="Status" v={`${near.feature.properties.alertlevel} alert, ${near.feature.properties.active ? 'active' : `ended ${fmtDate(near.feature.properties.todate)}`}`} />
            <p className="map-meta">
              GDACS lists floods large enough for international notice, so local street flooding won't appear here.{' '}
              <a href={near.feature.properties.report} target="_blank" rel="noopener">Read the report</a>.
            </p>
            <Fetched from="GDACS" />
          </>
        )}
      </Section>
    </RetryContext.Provider>
  )
}

function RainBars({ rain }: { rain: NonNullable<Exclude<Report['rain'], 'error'>> }) {
  const max = Math.max(1, ...rain.precipitation_sum)
  return (
    <>
      <div className="rain-bars" aria-hidden="true">
        {rain.precipitation_sum.map((x, i) => (
          <span key={rain.time[i]} className="rain-bar" style={{ height: `${(x / max) * 100}%` }} />
        ))}
      </div>
      <div className="rain-bar-labels" aria-hidden="true">
        {rain.time.map((t) => <span key={t}>{weekday(t)}</span>)}
      </div>
      {rain.time.map((t, i) => (
        <Row key={t} k={weekday(t, 'long')}
          v={`${rain.precipitation_sum[i].toFixed(2)} in, ${rain.precipitation_probability_max?.[i] ?? '?'}% chance`} />
      ))}
      <Fetched from="Open-Meteo" />
    </>
  )
}
