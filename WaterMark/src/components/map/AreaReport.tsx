// The "Area" tab for a selected spot. It leads with what works everywhere on Earth: a few headline
// figures, then charts of rain and river flow (the last weeks, the forecast and decades of history).
// Datasets that only cover the US or New York City appear below as folded rows, and only where they
// cover the spot: a spot in Lyon never shows an empty "US only" row. Every figure names its source,
// whether it is observed, modeled, forecast or historical, and what it cannot tell you.
import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import { usePresence } from '../../hooks/usePresence'
import { EvidenceTag } from '../common/EvidenceTag'
import { RainOutlookChart, FlowChart, YearBars } from './Charts'
import type { EvidenceKind } from '../../scripting/content/dataSources'
import { fmtDate, fmtDepthIn, fmtDistance, fmtRadius, fmtRain, fmtTime, fmtUsd, pct, UNITS } from '../../scripting/format'
import { cellWidthKm, countIn, howOften, type CellProps } from '../../scripting/cells'
import { causeRows } from '../../scripting/causes'
import type { CellMeta } from '../../services/floodHistory'
import { nearestFlood, summarizeSensors } from '../../scripting/geo'
import { touchesNYC } from '../../scripting/region'
import { percentileOf, peaksByYear, rainByYear, seasonalMedian, todayIndex } from '../../scripting/climate'
import { HIGH_RISK_ZONES, ZONE_TEXT } from '../../scripting/mapTheme'
import type { AreaReport as Report, Coverable, GlobalFloodCollection, Selection, SensorCollection } from '../../scripting/types'

interface Props {
  selection: Selection
  report: Report
  /** Reruns the lookups that failed. */
  onRetry: () => void
  sensors: Coverable<SensorCollection>
  floods: Coverable<GlobalFloodCollection>
  /** The grid a picked square belongs to (years, sizes, source). */
  cellMeta?: CellMeta | null
  /** The time slider's year, or null for all years. */
  year?: number | null
}

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const flow = (v: number) => `${v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(v >= 10 ? 0 : 1)} m³/s`
const rain = (mm: number) => fmtRain(mm, UNITS)
const height = (m: number) => (UNITS === 'metric' ? `${Math.round(m).toLocaleString('en-US')} m` : `${Math.round(m * 3.281).toLocaleString('en-US')} ft`)
// GDACS lists floods worldwide; farther than this, "nearest" says nothing useful about the area.
const NEAR_FLOOD_KM = UNITS === 'metric' ? 800 : 804.672 // a round 800 km or 500 mi
// A heavy-rain day: 50 mm, or a round 2 inches for imperial readers.
const HEAVY_MM = UNITS === 'metric' ? 50 : 50.8
const ready = <T,>(v: Coverable<T>): v is T => v !== null && v !== 'error' && v !== 'unsupported'

const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <p className="stat-row"><span>{k}</span><span className="report-stat-value">{v}</span></p>
)

const RetryContext = createContext<() => void>(() => {})
function Failed({ what }: { what: string }) {
  const retry = useContext(RetryContext)
  return (
    <p className="panel-failed">
      Couldn't load {what}. The source may be busy.{' '}
      <button type="button" className="panel-retry" onClick={retry}>Try again</button>
    </p>
  )
}
const Fetched = ({ from }: { from: string }) => <p className="map-meta">From {from}, fetched {fmtTime(new Date())}</p>
const Empty = ({ children }: { children: ReactNode }) => <p className="panel-empty">{children}</p>
const Loading = ({ what }: { what: string }) => <p className="report-skeleton" aria-busy="true">Loading {what}…</p>

/** The one-line answer for a folded row, from its loading state. */
function line<T>(v: Coverable<T>, done: (v: T) => string): ReactNode {
  if (v === null) return <span className="report-loading">Loading…</span>
  if (v === 'error') return <span className="report-error">Couldn't load. Open to retry.</span>
  if (v === 'unsupported') return null
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
        <div id={id} className={body.isClosing ? 'report-body is-closing' : 'report-body'} {...body.bind}>
          {children}
        </div>
      ) : null}
    </section>
  )
}

/** An always-open block for the worldwide charts. */
function Block({ kind, children }: { kind: EvidenceKind; children: ReactNode }) {
  return <section className="report-block"><span className="report-block-tag"><EvidenceTag kind={kind} /></span>{children}</section>
}

function Tile({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <p className="report-tile">
      <span className="report-tile-label">{label}</span>
      <span className="report-tile-value">{value}</span>
      {note ? <span className="report-tile-note">{note}</span> : null}
    </p>
  )
}
const pending = (v: Coverable<unknown>) => (v === null ? <span className="report-loading">…</span> : v === 'error' ? '—' : null)

/** The flood record of a picked grid square, like the reference's "square you picked". */
function CellRecord({ cell, meta, year, finer }: { cell: CellProps; meta: CellMeta; year: number | null; finer: boolean }) {
  const span = meta.years[1] - meta.years[0] + 1
  const isUS = cell.grid === 'us'
  const unit = 'floods'
  const [w, s0] = cell.bounds
  const lat = `${Math.abs(s0 + meta.size / 2).toFixed(2)}°${s0 >= 0 ? 'N' : 'S'}`
  const lon = `${Math.abs(w + meta.size / 2).toFixed(2)}°${w >= 0 ? 'E' : 'W'}`
  return (
    <section className="cell-record">
      <p className="region-eyebrow">Square you picked · {lat}, {lon}</p>
      <p className="cell-record-lede">
        {cell.e
          ? <>{cell.e.toLocaleString('en-US')} {unit} recorded here since {meta.years[0]}, {howOften(cell.e, span)}.</>
          : <>No {unit} recorded in this square since {meta.years[0]}. That is not a sign it is safe: small and local floods often go unlisted.</>}
      </p>
      {year != null && year >= meta.years[0] && year <= meta.years[1] ? (
        <Row k={`Floods in ${year}`} v={countIn(cell, year).toLocaleString('en-US')} />
      ) : null}
      {cell.e ? (
        <>
          <Row k="Years with a flood" v={`${cell.n} of ${span}`} />
          <Row k="Worst year here" v={`${cell.wy} (${cell.wn.toLocaleString('en-US')})`} />
          {isUS ? (
            <>
              {causeRows(cell.causes).length ? (
                <Row k="Main causes" v={causeRows(cell.causes).slice(0, 2).map((r) => `${r.short} ${r.count}`).join(' · ')} />
              ) : null}
              <Row k="Deaths in these floods" v={cell.a.toLocaleString('en-US')} />
              <Row k="Damage to property and crops" v={cell.b ? fmtUsd(cell.b) : 'None reported'} />
            </>
          ) : (
            <>
              <Row k="Serious floods (orange or red alert)" v={cell.a.toLocaleString('en-US')} />
              {cell.b ? <Row k="Largest flood magnitude" v={cell.b.toFixed(1)} /> : null}
            </>
          )}
        </>
      ) : null}
      <p className="map-meta">
        A {meta.size}° square (about {Math.round(meta.size * 111 * Math.cos(((s0 + meta.size / 2) * Math.PI) / 180))} km across).
        Counts {isUS ? 'NOAA flood episodes (each storm once, however many reports it has here)' : 'GDACS flood events'} by
        where they were reported, {meta.years[0]} to {meta.years[1]}.{isUS ? '' : ' GDACS does not record causes.'}
        {finer ? ' The smaller block on the map is only the spot being inspected. These counts still belong to the whole square.' : ''}
      </p>
    </section>
  )
}

export function AreaReport({ selection, report: s, onRetry, sensors: sensorsIn, floods, cellMeta, year = null }: Props) {
  const { center, radiusKm, circle } = selection
  const sensors: Coverable<SensorCollection> = touchesNYC(circle) ? sensorsIn : 'unsupported'
  const isUS = s.alerts !== 'unsupported'

  const sensorSummary = ready(sensors) ? summarizeSensors(sensors, circle) : null
  const nearest = ready(floods) ? nearestFlood(floods, center) : null
  const near = nearest && nearest.km <= NEAR_FLOOD_KM ? nearest : null
  const zones = ready(s.zone) ? s.zone : null
  const highZones = zones ? zones.inArea.filter((z) => HIGH_RISK_ZONES.has(z)) : []
  const isHighRisk = highZones.length > 0 || (ready(s.storm) && s.storm.deep > 1)
  const alertCount = Array.isArray(s.alerts) ? s.alerts.length : 0

  // Worldwide figures.
  const rainToday = ready(s.rain) ? todayIndex(s.rain.time, new Date(new Date().toLocaleString('en-US', { timeZone: s.rain.timezone }))) : -1
  const next7 = ready(s.rain) && rainToday >= 0 ? s.rain.mm.slice(rainToday, rainToday + 7).reduce((a, b) => a + b, 0) : null
  const last30 = ready(s.rain) && rainToday > 0 ? s.rain.mm.slice(Math.max(0, rainToday - 30), rainToday).reduce((a, b) => a + b, 0) : null
  const rainYears = ready(s.rainHistory) ? rainByYear(s.rainHistory, HEAVY_MM) : null
  const heavyTotal = rainYears && rainYears.heavyDays.length ? rainYears.heavyDays.reduce((a, b) => a + b.value, 0) : null
  const riverToday = ready(s.river) ? todayIndex(s.river.time) : -1
  const riverNow = ready(s.river) && riverToday >= 0 ? s.river.flow[riverToday] : null
  const riverPeakAhead = ready(s.river) && riverToday >= 0
    ? Math.max(...s.river.flow.slice(riverToday).filter((v): v is number => v != null), 0) : null
  const typical = ready(s.riverHistory) && ready(s.river) && riverToday >= 0 ? seasonalMedian(s.river.time[riverToday], s.riverHistory) : null
  const peakRank = ready(s.riverHistory) && riverPeakAhead ? percentileOf(riverPeakAhead, s.riverHistory.values) : null
  const riverPeaks = ready(s.riverHistory) ? peaksByYear(s.riverHistory) : []
  const hasRiver = ready(s.river) && s.river.flow.some((v) => v != null && v > 0)

  return (
    <RetryContext.Provider value={onRetry}>
      {selection.cell && cellMeta ? <CellRecord cell={selection.cell} meta={cellMeta} year={year} finer={radiusKm * 2 < cellWidthKm(selection.cell.bounds) * 0.75} /> : null}
      <p className="map-meta report-where">
        {selection.cell ? 'Forecasts and history at the middle of the block you picked' : <>{center[1].toFixed(4)}, {center[0].toFixed(4)} · circle of {fmtRadius(radiusKm, UNITS)} radius</>}
        {ready(s.elevation) && s.elevation != null ? <> · {height(s.elevation)} above sea level</> : null}
      </p>

      {alertCount ? (
        <p className="callout callout-alert">
          <strong>There {alertCount === 1 ? 'is an active alert' : `are ${alertCount} active alerts`} here.</strong>{' '}
          Open the Alerts tab and follow the National Weather Service instructions.
        </p>
      ) : !isUS ? (
        <p className="callout callout-info">
          For official warnings here, check the national weather service (listed by the{' '}
          <a href="https://severeweather.wmo.int" target="_blank" rel="noopener">WMO</a>). The figures below are models and history, not warnings.
        </p>
      ) : isHighRisk ? (
        <p className="callout callout-info">
          This area has a mapped flood risk. Renters and owners can buy flood insurance through{' '}
          <a href="https://www.floodsmart.gov" target="_blank" rel="noopener">FloodSmart.gov</a>.
        </p>
      ) : s.alerts === 'error' ? (
        <p className="callout callout-info">
          Couldn't check weather alerts right now, so this is not an all-clear. See{' '}
          <a href="https://www.weather.gov" target="_blank" rel="noopener">weather.gov</a>.
        </p>
      ) : s.alerts === null ? null : (
        <p className="callout callout-info">No active alerts here. Flooding can still happen in heavy rain.</p>
      )}

      <div className="report-tiles">
        <Tile label="Rain, next 7 days" value={next7 != null ? rain(next7) : pending(s.rain)}
          note={last30 != null ? `${rain(last30)} in the last 30` : undefined} />
        <Tile label="River now" value={riverNow != null && hasRiver ? flow(riverNow) : ready(s.river) ? 'No river' : pending(s.river)}
          note={typical != null && riverNow != null && hasRiver ? `typical ${flow(typical)}` : undefined} />
        <Tile label="Wettest day since 1991" value={rainYears?.wettest ? rain(rainYears.wettest.mm) : pending(s.rainHistory)}
          note={rainYears?.wettest ? fmtDate(rainYears.wettest.day) : undefined} />
        <Tile label={`Days over ${UNITS === 'metric' ? '50 mm' : '2 in'}`} value={heavyTotal != null ? heavyTotal.toLocaleString('en-US') : pending(s.rainHistory)}
          note={rainYears && heavyTotal != null
            ? `since ${rainYears.maxDay[0]?.year}, ${howOften(heavyTotal, rainYears.heavyDays.length).replace('none recorded', 'none')}`
            : undefined} />
      </div>

      <Block kind="forecast">
        {s.rain === 'error' ? <Failed what="the rain forecast" /> : !ready(s.rain) ? <Loading what="the rain forecast" /> : (
          <>
            <RainOutlookChart time={s.rain.time} mm={s.rain.mm} today={rainToday} format={rain}
              summary={next7 != null ? `${rain(next7)} in the next 7 days` : ''} />
            <p className="map-meta">
              Open-Meteo, local days ({s.rain.timezone}). Days before today are model analysis, not rain gauges; forecasts past a week are rough.
            </p>
          </>
        )}
      </Block>

      <Block kind="modeled">
        {s.river === 'error' ? <Failed what="the river forecast" /> : !ready(s.river) ? <Loading what="the river forecast" /> : !hasRiver ? (
          <Empty>No modeled river at this spot. GloFAS covers rivers on a 5 km grid, not streets or the coast.</Empty>
        ) : (
          <>
            <FlowChart time={s.river.time} flow={s.river.flow} p25={s.river.p25} p75={s.river.p75} min={s.river.min} max={s.river.max}
              today={riverToday} format={flow}
              summary={riverPeakAhead ? `Peak ahead ${flow(riverPeakAhead)}` : ''} />
            {peakRank != null && riverPeakAhead ? (
              <Row k="Forecast peak vs. every day since 1984" v={`higher than ${Math.min(99.9, peakRank).toFixed(peakRank > 99 ? 1 : 0)}%`} />
            ) : null}
            <p className="map-meta">
              GloFAS v4 (Copernicus) via Open-Meteo: modeled flow in the river cell nearest the spot, which may be a small stream.
              Shading is the forecast range (darker: middle half of runs). Not flood depth, and no coastal surge.
            </p>
          </>
        )}
      </Block>

      <Block kind="historical">
        {s.rainHistory === 'error' ? <Failed what="the rain history" /> : !rainYears ? <Loading what="35 years of rain" /> : (
          <>
            <YearBars title="Heaviest day of rain, each year" data={rainYears.maxDay} format={rain}
              summary={rainYears.wettest ? `Record ${rain(rainYears.wettest.mm)}` : ''} />
            <p className="map-meta">ERA5 reanalysis (Copernicus / ECMWF) via Open-Meteo, a roughly 25 km model grid. Local downpours can be heavier.</p>
          </>
        )}
      </Block>

      {hasRiver && riverPeaks.length ? (
        <Block kind="modeled">
          <YearBars title="Highest river flow, each year" data={riverPeaks} format={flow}
            summary={`Record ${flow(Math.max(...riverPeaks.map((p) => p.value)))}`} />
          <p className="map-meta">GloFAS reanalysis since 1984. Tall bars are the years this river ran highest.</p>
        </Block>
      ) : null}

      {/* Local datasets: only where they cover the spot. */}
      {sensors !== 'unsupported' ? (
        <Section title="Street flooding sensors" kind="observed"
          summary={line(sensors, () => (sensorSummary
            ? `${sensorSummary.count} sensor${sensorSummary.count === 1 ? '' : 's'}, ${sensorSummary.events.toLocaleString('en-US')} floods recorded`
            : 'No sensors in this area'))}>
          {sensors === 'error' ? <Failed what="FloodNet sensors" /> : !sensorSummary ? (
            <Empty>No FloodNet sensors in this area. Sensors cover parts of NYC, so no sensor does not mean no flooding.</Empty>
          ) : (
            <>
              <Row k="Sensors in area" v={sensorSummary.count} />
              <Row k="Monitoring since" v={fmtDate(sensorSummary.since)} />
              <Row k="Floods recorded" v={sensorSummary.events.toLocaleString('en-US')} />
              <Row k="Deepest flood" v={sensorSummary.events ? fmtDepthIn(sensorSummary.deepestIn, UNITS) : 'none yet'} />
              <Row k="Most recent flood" v={fmtDate(sensorSummary.lastFlood)} />
            </>
          )}
          {ready(sensors) ? <Fetched from="FloodNet NYC" /> : null}
        </Section>
      ) : null}

      {s.storm !== 'unsupported' ? (
        <Section title="Heavy-rain flood model" kind="scenario"
          summary={line(s.storm, (v) => (v.none ? 'No modeled flooding here' : `${pct(v.nuisance)} shallow, ${pct(v.deep)} deep`))}>
          {s.storm === 'error' ? <Failed what="the NYC stormwater model" /> : s.storm === null ? null : s.storm.none ? (
            <Empty>No modeled heavy-rain flooding in this circle.</Empty>
          ) : (
            <>
              <p className="map-meta">A scenario, not flooding today. If 2.13 inches of rain fell in an hour, this share of the area is modeled to flood:</p>
              <Row k="4 inches to 1 foot deep" v={pct(s.storm.nuisance)} />
              <Row k="1 foot or deeper" v={pct(s.storm.deep)} />
              {s.storm.partial ? <p className="map-meta">Measured on simplified tiles; draw a smaller circle for a more exact figure.</p> : null}
              <p className="map-meta">NYC Stormwater Flood Map (NYC Open Data, updated July 3, 2024).</p>
            </>
          )}
        </Section>
      ) : null}

      {s.zone !== 'unsupported' ? (
        <Section title="FEMA flood zones" kind="reference"
          summary={line(s.zone, (v) => (!v.inArea.length ? 'No zone mapped here'
            : highZones.length ? `High-risk zone ${highZones.join(', ')} in this area` : `Zone ${v.inArea.join(', ')}, outside high risk`))}>
          {s.zone === 'error' ? <Failed what="FEMA flood zones" /> : s.zone === null ? null : !s.zone.inArea.length ? (
            <Empty>No FEMA flood zone is mapped in this area; some areas are unmapped.</Empty>
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
      ) : null}

      {s.claims !== 'unsupported' ? (
        <Section title="Past insurance claims" kind="historical"
          summary={line(s.claims, (v) => (v === 'none' ? 'No US ZIP code here' : `${v.claims.toLocaleString('en-US')} claims in ZIP ${v.zip}`))}>
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
              <p className="map-meta">Claims only cover insured properties, so a low count can mean few people had flood insurance.</p>
              <Fetched from="FEMA OpenFEMA (NFIP Redacted Claims v3)" />
            </>
          )}
        </Section>
      ) : null}

      <Section title="Nearest reported flood" kind="historical"
        summary={line(floods, () => (near ? `${near.feature.properties.name}, ${fmtDistance(near.km, UNITS)} away` : `None within ${fmtDistance(NEAR_FLOOD_KM, UNITS)}`))}>
        {floods === 'error' ? <Failed what="worldwide flood reports" /> : !near ? (
          <Empty>
            No GDACS flood events within {fmtDistance(NEAR_FLOOD_KM, UNITS)} in the past 30 days
            {nearest ? ` (the nearest is ${fmtDistance(nearest.km, UNITS)} away)` : ''}. GDACS lists floods large enough for international notice.
          </Empty>
        ) : (
          <>
            <Row k="Event" v={near.feature.properties.name} />
            <Row k="Distance" v={fmtDistance(near.km, UNITS)} />
            <Row k="Status" v={`${near.feature.properties.alertlevel} alert, ${near.feature.properties.active ? 'active' : `ended ${fmtDate(near.feature.properties.todate)}`}`} />
            <p className="map-meta">
              <a href={near.feature.properties.report} target="_blank" rel="noopener">Read the GDACS report</a>.
            </p>
          </>
        )}
      </Section>
    </RetryContext.Provider>
  )
}
