// The flood record of the focused country, province, US state or county, at the top of the Area tab:
// a spaced eyebrow (level and period), the name, one sentence in plain words, headline figures for
// what the floods did (deaths, injuries and damage in the US; serious floods and the largest flood
// elsewhere), a year chart you can switch between those measures, floods by month, and where the
// numbers come from. Before anything is clicked it explains the map.
import { useState } from 'react'
import { EvidenceTag } from '../common/EvidenceTag'
import { MetricSwitch, MonthBars, YearBars } from './Charts'
import { busiestMonths } from '../../scripting/climate'
import { howOften } from '../../scripting/cells'
import { fmtUsd } from '../../scripting/format'
import type { FloodHistoryIndex } from '../../services/floodHistory'
import type { Loadable, RegionPick, RegionProps } from '../../scripting/types'

interface Props {
  region: RegionPick | null
  index: FloodHistoryIndex | null
  status: Loadable<true>
  /** The time slider's year, or null for all years. */
  year?: number | null
}

const EYEBROW: Record<RegionPick['level'], string> = { country: 'Country', admin1: 'Region', state: 'US state', county: 'US county' }

const NEXT: Record<RegionPick['level'], string> = {
  country: 'Click a region on the map to see its own record.',
  admin1: 'Click inside it to pick a square: its own record, plus the rain and river forecast there.',
  state: 'Click a county on the map to see its flood reports.',
  county: 'Click inside it to pick a square: its own record, plus the forecasts, alerts and flood maps there.',
}

type Metric = 'floods' | 'serious' | 'deaths' | 'injuries' | 'damage'
const sum = (xs?: number[]) => (xs ?? []).reduce((a, b) => a + b, 0)

interface MetricSeries { id: Metric; label: string; values: number[]; format: (v: number) => string }

function metricsFor(p: RegionProps, isNoaa: boolean): MetricSeries[] {
  const count = (unit: string) => (v: number) => `${v.toLocaleString('en-US')} ${unit}`
  const list: MetricSeries[] = [{ id: 'floods', label: isNoaa ? 'Reports' : 'Floods', values: p.y, format: count(isNoaa ? 'reports' : 'floods') }]
  if (isNoaa) {
    if (sum(p.d)) list.push({ id: 'deaths', label: 'Deaths', values: p.d!, format: count('deaths') })
    if (sum(p.i)) list.push({ id: 'injuries', label: 'Injuries', values: p.i!, format: count('injuries') })
    if (sum(p.$)) list.push({ id: 'damage', label: 'Damage', values: p.$!, format: fmtUsd })
  } else if (sum(p.x)) {
    list.push({ id: 'serious', label: 'Serious', values: p.x!, format: count('serious floods') })
  }
  return list
}

export function RegionSummary({ region, index, status, year = null }: Props) {
  const [metric, setMetric] = useState<Metric>('floods')
  if (!region) {
    return (
      <section className="region-summary">
        <p className="region-eyebrow">World · flood record</p>
        <h3 className="region-name">Floods around the world</h3>
        {status === 'error' ? (
          <p className="panel-failed">Couldn't load the flood history map. Reload the page to try again.</p>
        ) : (
          <p className="region-lede">
            Each square is shaded by how many floods were recorded inside it. Click a country to focus it, then keep
            clicking down to a single square.
          </p>
        )}
        {index ? (
          <p className="map-meta">
            Outside the US: {index.cells.world.source}, {index.cells.world.years[0]} to {index.cells.world.years[1]}, in{' '}
            {index.cells.world.size}° squares. US: {index.cells.us.source}, {index.cells.us.years[0]} to {index.cells.us.years[1]}, in{' '}
            {index.cells.us.size}° squares. An empty square means none recorded, not no risk.
          </p>
        ) : null}
      </section>
    )
  }

  const { level, props: p } = region
  const meta = index?.[level]
  const isNoaa = level === 'state' || level === 'county'
  const unit = isNoaa ? 'flood reports' : 'floods'
  const years = meta ? Array.from({ length: p.y.length }, (_, i) => meta.years[0] + i) : []
  const span = years.length || 1
  const worst = years.map((year, i) => ({ year, n: p.y[i] })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n || b.year - a.year).slice(0, 3)
  const months = busiestMonths(p.m)
  const name = level === 'county' ? `${p.n} County` : p.n
  const parent = p.s ? (level === 'admin1' && p.t ? `${p.t} of ${p.s}` : p.s) : null
  const metrics = metricsFor(p, isNoaa)
  const shown = metrics.find((m) => m.id === metric) ?? metrics[0]
  const deaths = sum(p.d)
  const injuries = sum(p.i)
  const damage = sum(p.$)
  const serious = sum(p.x)

  return (
    <section className="region-summary">
      <p className="region-eyebrow">
        {EYEBROW[level]}{parent ? ` · ${parent}` : ''}{years.length ? ` · ${years[0]}–${years.at(-1)}` : ''}
      </p>
      <h3 className="region-name">{name}</h3>
      <p className="region-lede">
        {p.e ? (
          <>
            {p.e.toLocaleString('en-US')} {unit} since {years[0]}, {howOften(p.e, span)}
            {months ? <>, most often in {months}</> : null}.
            {worst[0] && worst[0].n > 1 ? <> The worst year was {worst[0].year}.</> : null}
          </>
        ) : (
          <>No {unit} recorded here since {years[0]}. Small and local floods often go unlisted, so this is not a sign the area is safe.</>
        )}
      </p>

      {year != null && meta ? (() => {
        const k = year - meta.years[0]
        if (k < 0 || k >= p.y.length) {
          return <p className="region-year">No {isNoaa ? 'NOAA reports' : 'GDACS figures'} for {year} here: they start in {meta.years[0]}.</p>
        }
        const extra = [
          isNoaa && p.d?.[k] ? `${p.d[k].toLocaleString('en-US')} ${p.d[k] === 1 ? 'death' : 'deaths'}` : null,
          isNoaa && p.$?.[k] ? `${fmtUsd(p.$[k])} damage` : null,
          !isNoaa && p.x?.[k] ? `${p.x[k]} serious` : null,
        ].filter(Boolean)
        return (
          <p className="region-year">
            <span className="region-year-label">In {year}</span>
            <strong>{p.y[k].toLocaleString('en-US')} {p.y[k] === 1 ? unit.replace(/s$/, '') : unit}</strong>
            {extra.length ? <> · {extra.join(' · ')}</> : null}
          </p>
        )
      })() : null}

      {p.e ? (
        <div className="report-tiles">
          <p className="report-tile">
            <span className="report-tile-label">{isNoaa ? 'Flood reports' : 'Floods recorded'}</span>
            <span className="report-tile-value">{p.e.toLocaleString('en-US')}</span>
            <span className="report-tile-note">{howOften(p.e, span)}</span>
          </p>
          {isNoaa ? (
            <>
              <p className="report-tile">
                <span className="report-tile-label">Deaths</span>
                <span className="report-tile-value">{deaths.toLocaleString('en-US')}</span>
                <span className="report-tile-note">{injuries ? `${injuries.toLocaleString('en-US')} injured` : 'none injured on record'}</span>
              </p>
              <p className="report-tile report-tile--wide">
                <span className="report-tile-label">Damage to property and crops</span>
                <span className="report-tile-value">{damage ? fmtUsd(damage) : 'None reported'}</span>
                <span className="report-tile-note">as estimated in the reports, not adjusted for inflation</span>
              </p>
            </>
          ) : (
            <>
              <p className="report-tile">
                <span className="report-tile-label">Serious floods</span>
                <span className="report-tile-value">{serious.toLocaleString('en-US')}</span>
                <span className="report-tile-note">orange or red GDACS alert</span>
              </p>
              {p.g ? (
                <p className="report-tile report-tile--wide">
                  <span className="report-tile-label">Largest flood magnitude</span>
                  <span className="report-tile-value">{p.g.toFixed(1)}</span>
                  <span className="report-tile-note">GDACS scale from how long, how severe and how wide a flood was; 6 and up is very large</span>
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {p.e && shown ? (
        <section className="report-block report-block--flush">
          <span className="report-block-tag"><EvidenceTag kind="historical" /></span>
          {metrics.length > 1 ? (
            <MetricSwitch label="Chart" value={shown.id} options={metrics.map((m) => ({ id: m.id, label: m.label }))}
              onChange={(id) => setMetric(id as Metric)} />
          ) : null}
          <YearBars key={shown.id} title={`${shown.label}, each year`} data={years.map((year, i) => ({ year, value: shown.values[i] ?? 0 }))}
            format={shown.format} summary={`Total ${shown.format(sum(shown.values))}`} highlight={year} />
          {p.m && p.m.some((x) => x > 0) ? <MonthBars counts={p.m} summary={months ? `Most in ${months.split(/,| and /)[0]}` : ''} /> : null}
        </section>
      ) : null}

      <p className="map-meta">
        {isNoaa
          ? 'NOAA Storm Events Database: one report for each county or coastal zone a flood, flash flood, coastal or lakeshore flood touched, filed by National Weather Service offices, with the deaths, injuries and damage those reports list.'
          : level === 'admin1'
            ? 'GDACS flood archive (UN and European Commission), each event placed by its reported location, so a flood across several regions counts in one. GDACS lists floods large enough for international notice; local street flooding is not counted.'
            : 'GDACS flood archive (UN and European Commission). GDACS lists floods large enough for international notice and recorded about three times as many a year from 2019 on, so compare places rather than years.'}
        {meta?.url ? <> <a href={meta.url} target="_blank" rel="noopener">Source</a>.</> : null}
      </p>
      <p className="region-next">{NEXT[level]}</p>
    </section>
  )
}
