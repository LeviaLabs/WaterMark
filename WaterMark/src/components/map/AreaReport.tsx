// The "Area" tab: every number shown names its source and fetch time, and every empty or failed
// state says what it means (no sensor is not the same as no flooding).
import type { ReactNode } from 'react'
import { EvidenceTag } from '../common/EvidenceTag'
import type { EvidenceKind } from '../../scripting/content/dataSources'
import { fmtDate, fmtMiles, fmtRadius, fmtTime, pct, weekday } from '../../scripting/format'
import { nearestFlood, summarizeSensors } from '../../scripting/geo'
import { HIGH_RISK_ZONES, ZONE_TEXT } from '../../scripting/mapTheme'
import { neighborhoodForZip, type ClaimsSummary } from '../../services/claims'
import type { AreaReport as Report, GlobalFloodCollection, Loadable, Selection, SensorCollection } from '../../scripting/types'

interface Props {
  selection: Selection
  report: Report
  sensors: Loadable<SensorCollection>
  floods: Loadable<GlobalFloodCollection>
  claims: ClaimsSummary | null | undefined
}

const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <p className="stat-row"><span>{k}</span><span className="report-stat-value">{v}</span></p>
)
const Loading = () => <p className="map-meta">Loading…</p>
const Failed = ({ what }: { what: string }) => (
  <p className="map-meta">Couldn't load {what} right now. The source may be down or blocking requests; try again in a minute.</p>
)
const Fetched = ({ from }: { from: string }) => <p className="map-meta">From {from}, fetched {fmtTime(new Date())}</p>
const Empty = ({ children }: { children: ReactNode }) => <p className="panel-empty">{children}</p>

// Every section names its kind of evidence with the same pill the landing page uses.
function Section({ title, kind, children }: { title: string; kind?: EvidenceKind; children: ReactNode }) {
  return (
    <section className="report-section">
      <header className="report-head">
        <h3 className="report-title">{title}</h3>
        {kind ? <EvidenceTag kind={kind} /> : null}
      </header>
      {children}
    </section>
  )
}

export function AreaReport({ selection, report, sensors, floods, claims }: Props) {
  const { center, radiusKm, circle } = selection
  const s = report

  const sensorSummary = sensors && sensors !== 'error' ? summarizeSensors(sensors, circle) : null
  const near = floods && floods !== 'error' ? nearestFlood(floods, center) : null
  const hood = claims && typeof s.zip === 'string' && s.zip !== 'none' ? neighborhoodForZip(claims, s.zip) : null
  const zone = s.zone && s.zone !== 'error' && s.zone !== 'none' ? s.zone : null
  const isHighRisk = (zone && HIGH_RISK_ZONES.has(zone.FLD_ZONE)) || (s.storm && s.storm !== 'error' && s.storm.deep > 1)
  const alertCount = Array.isArray(s.alerts) ? s.alerts.length : 0

  return (
    <>
      <p className="map-meta">Circle of {fmtRadius(radiusKm)} radius around {center[1].toFixed(4)}, {center[0].toFixed(4)}</p>

      <Section title="Street flooding measured by sensors" kind="observed">
        {sensors === 'error' ? <Failed what="FloodNet sensors" /> : sensors === null ? <Loading /> : !sensorSummary ? (
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

      <Section title="Nearest reported flood" kind="historical">
        {floods === 'error' ? <Failed what="worldwide flood reports" /> : floods === null ? <Loading /> : !near ? (
          <Empty>No floods reported worldwide in the past 30 days.</Empty>
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

      <Section title="Heavy-rain flood model" kind="scenario">
        {s.storm === null ? <Loading /> : s.storm === 'error' ? <Failed what="the NYC stormwater model" /> : s.storm.none ? (
          <Empty>No modeled heavy-rain flooding in this circle. The model covers New York City only.</Empty>
        ) : (
          <>
            <p className="map-meta">A scenario, not flooding today. If 2.13 inches of rain fell in an hour, this share of the area is modeled to flood:</p>
            <Row k="4 inches to 1 foot deep" v={pct(s.storm.nuisance)} />
            <Row k="1 foot or deeper" v={pct(s.storm.deep)} />
            {s.storm.partial ? <p className="map-meta">This area is large, so only part of the model was counted. Draw a smaller circle for an exact figure.</p> : null}
            <Fetched from="NYC Stormwater Flood Map" />
          </>
        )}
      </Section>

      <Section title="FEMA flood zone at the center" kind="reference">
        {s.zone === null ? <Loading /> : s.zone === 'error' ? <Failed what="FEMA flood zones" /> : s.zone === 'none' ? (
          <Empty>No FEMA flood zone is mapped at this point. FEMA maps cover the US only.</Empty>
        ) : (
          <>
            <Row k="Zone" v={s.zone.FLD_ZONE + (s.zone.ZONE_SUBTY ? ` (${s.zone.ZONE_SUBTY.toLowerCase()})` : '')} />
            {ZONE_TEXT[s.zone.FLD_ZONE] ? <p className="report-text">{ZONE_TEXT[s.zone.FLD_ZONE]}</p> : null}
            <Fetched from="FEMA NFHL" />
          </>
        )}
      </Section>

      <Section title="Rain in the next 3 days" kind="forecast">
        {s.rain === null ? <Loading /> : s.rain === 'error' ? <Failed what="the rain forecast" /> : (
          <RainBars rain={s.rain} />
        )}
      </Section>

      <Section title="Nearest river, next 7 days" kind="modeled">
        {s.river === null ? <Loading /> : s.river === 'error' ? <Failed what="the river forecast" /> : !s.river.river_discharge.some((x) => x != null) ? (
          <Empty>No modeled river near this point.</Empty>
        ) : (
          <RiverRows flows={s.river.river_discharge.filter((x): x is number => x != null)} />
        )}
      </Section>

      <Section title="Past flood insurance claims" kind="historical">
        {claims === undefined || s.zip === null ? <Loading /> : claims === null ? (
          <Empty>Claim history isn't loaded. Run scripts/watermark_data.py and copy its summary.json to WaterMark/public/data/.</Empty>
        ) : !hood ? (
          <Empty>No claim summary for ZIP {s.zip === 'error' ? 'unknown' : s.zip} yet. Add it to NEIGHBORHOODS in the data script.</Empty>
        ) : (
          <>
            <Row k="Neighborhood" v={hood[0]} />
            <Row k="Claims since 1978" v={hood[1].nfip.claims.toLocaleString('en-US')} />
            <Row k="Total paid" v={`$${hood[1].nfip.total_paid_usd.toLocaleString('en-US')}`} />
            <p className="map-meta">Claims only cover insured homes, so a low count can mean few people had flood insurance. Data generated {fmtDate(claims.generated_at_utc)}.</p>
          </>
        )}
      </Section>

      <Section title="What to do">
        {alertCount ? (
          <p className="callout callout-alert">
            <strong>There {alertCount === 1 ? 'is an active alert' : `are ${alertCount} active alerts`} here.</strong>{' '}
            Open the Alerts tab and follow the National Weather Service instructions.
          </p>
        ) : isHighRisk ? (
          <p className="callout callout-info">
            This area has a mapped flood risk. Check whether your home is covered: renters and owners can buy flood insurance through{' '}
            <a href="https://www.floodsmart.gov" target="_blank" rel="noopener">FloodSmart.gov</a>, and{' '}
            <a href="https://www.floodhelpny.org" target="_blank" rel="noopener">FloodHelpNY</a> explains your options in NYC.
          </p>
        ) : (
          <p className="report-text">No active alerts and no high-risk zone found here. Flooding can still happen in heavy rain, so keep drains clear and know your route to higher ground.</p>
        )}
      </Section>
    </>
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

function RiverRows({ flows }: { flows: number[] }) {
  return (
    <>
      <Row k="Today" v={`${flows[0].toLocaleString('en-US')} m³/s`} />
      <Row k="7-day peak" v={`${Math.max(...flows).toLocaleString('en-US')} m³/s`} />
      <p className="map-meta">Modeled flow of the nearest river cell. It does not include coastal surge or street flooding.</p>
      <Fetched from="GloFAS via Open-Meteo" />
    </>
  )
}
