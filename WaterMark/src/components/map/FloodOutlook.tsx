// The flood outlook at the top of a selected place's panel: what the next days' official alerts and
// forecasts show, when a flood is most likely here from its past record, and a short AI summary of
// both. The figures are worked out in code (scripting/outlook.ts); the AI only words them, and a
// summary quoting any number not in those figures is dropped (services/outlook/summary.ts).
import { EvidenceTag } from '../common/EvidenceTag'
import { Icon } from '../common/Icon'
import type { FloodOutlook as Outlook, OutlookLevel } from '../../scripting/outlook'
import type { SummaryState } from '../../hooks/useFloodOutlook'

const LEVEL_LABEL: Record<OutlookLevel, string> = {
  warning: 'Flood warning',
  watch: 'Flood watch',
  elevated: 'Flooding possible',
  quiet: 'No signs in forecasts',
  unknown: 'Not checked',
}

function AiSummary({ state }: { state: SummaryState }) {
  if (state.status === 'idle') return null
  if (state.status === 'loading') {
    return (
      <p className="outlook-ai is-loading" role="status">
        <span className="assistant-dots" aria-hidden="true"><span /><span /><span /></span>
        Writing an AI summary…
      </p>
    )
  }
  if (state.status === 'error') {
    return state.code === 'NOT_CONFIGURED' ? null : <p className="map-meta outlook-ai-error">{state.message}</p>
  }
  return (
    <figure className="outlook-ai">
      <blockquote><p>{state.summary.text}</p></blockquote>
      <figcaption className="map-meta">
        <Icon name="spark" size={14} /> AI summary by {state.summary.model} of the figures below, checked to quote only them.
        AI can make mistakes.
      </figcaption>
    </figure>
  )
}

export function FloodOutlook({ outlook, summary }: { outlook: Outlook; summary: SummaryState }) {
  const r = outlook.recurrence
  return (
    <section className={`outlook outlook--${outlook.level}`} aria-label="Flood outlook">
      <header className="outlook-head">
        <p className="outlook-eyebrow">Flood outlook</p>
        {outlook.isPending ? null : (
          <span className={`outlook-level outlook-level--${outlook.level}`}>
            <span className="outlook-dot" aria-hidden="true" />{LEVEL_LABEL[outlook.level]}
          </span>
        )}
      </header>
      <p className="outlook-headline" aria-live="polite">{outlook.headline}</p>
      <AiSummary state={summary} />

      <h3 className="outlook-sub">When the next flood is likely <EvidenceTag kind="historical" /></h3>
      {r === null ? (
        <p className="map-meta">{outlook.isPending ? 'Loading the flood record…' : 'No flood record covers this spot.'}</p>
      ) : r.total === 0 ? (
        <p className="outlook-next-note">
          No floods recorded in {r.place}, {r.period}. That is not the same as no risk: the record lists only floods large
          enough to be reported.
          {r.season && r.nextWindow ? ` Nearby, most floods in ${r.season.from} began in ${r.season.months}; that season next comes in ${r.nextWindow}.` : ''}
        </p>
      ) : (
        <>
          {r.nextWindow ? (
            <p className="outlook-next">
              <span className="outlook-next-label">{r.isInSeason ? 'Busy season now' : 'Next busy season'}</span>
              <span className="outlook-next-when">{r.nextWindow}</span>
            </p>
          ) : null}
          <dl className="outlook-facts">
            <div><dt>How often</dt><dd>{r.rate[0].toUpperCase() + r.rate.slice(1)} ({r.total.toLocaleString('en-US')} in {r.period}, {r.yearsWithAny} of {r.years} years)</dd></div>
            {r.last ? <div><dt>Last flood began</dt><dd>{r.last} ({r.sinceLast})</dd></div> : null}
            <div>
              <dt>Busiest season</dt>
              <dd>{r.season ? `${r.season.months}: ${r.season.sharePercent}% of past floods in ${r.season.from} began then` : 'No clear season: floods have begun in any month.'}</dd>
            </div>
          </dl>
          <p className="map-meta">
            A pattern from past floods in {r.place} ({r.unit}), not a forecast: a flood can come in any month.{' '}
            <a href={r.url} target="_blank" rel="noopener">{r.source}</a>.
          </p>
        </>
      )}
      <h3 className="outlook-sub">Next {outlook.days} days <EvidenceTag kind="forecast" /></h3>
      {outlook.signals.length ? (
        <ul className="outlook-signals">
          {outlook.signals.map((s, i) => (
            <li key={`${s.kind}-${i}`} className={`outlook-signal outlook-signal--${s.level}`}>
              <span className="outlook-dot" aria-hidden="true" />
              <span>
                {s.text}
                <a className="outlook-source" href={s.url} target="_blank" rel="noopener">{s.source}</a>
              </span>
            </li>
          ))}
        </ul>
      ) : outlook.isPending ? <p className="map-meta">Loading the forecasts…</p> : null}
      {outlook.notes.map((n) => <p key={n} className="map-meta">{n}</p>)}

    </section>
  )
}
