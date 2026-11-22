import type { ReactNode } from 'react'
import type { EvidenceKind } from '../../scripting/content/dataSources'
import { hasUsableData, type EnvironmentalResult } from '../../scripting/evidence/contract'
import { STATUS_TEXT, formatLocalTime } from '../../scripting/evidence/format'
import { EvidenceTag } from '../common/EvidenceTag'
import { Icon } from '../common/Icon'

type TimeField = 'forecastIssuedAt' | 'observedAt' | 'validFrom' | 'validTo' | 'fetchedAt' | 'sourceUpdatedAt'

const TIME_LABELS: Record<TimeField, string> = {
  forecastIssuedAt: 'Model issued',
  observedAt: 'Observed',
  validFrom: 'Valid from',
  validTo: 'Valid to',
  sourceUpdatedAt: 'Source updated',
  fetchedAt: 'Fetched by WaterMark',
}

type Props<T> = {
  title: string
  kind: EvidenceKind
  result: EnvironmentalResult<T>
  /** Which timestamps matter for this kind of evidence, in display order. */
  times: readonly TimeField[]
  /** Example data on the landing page: shows a clear "Example" badge. */
  isExample?: boolean
  timeZone?: string
  children: (data: T) => ReactNode
  className?: string
}

/**
 * Frame shared by every feature panel. It enforces the provenance rules in
 * AGENTS.md: the kind of evidence, the source and link, the relevant times
 * (each with its own meaning), one limitation, and an honest message for
 * stale, missing, unsupported or failed results. Unknown is never drawn as low.
 */
export function EvidencePanel<T>({ title, kind, result, times, isExample = false, timeZone, children, className = '' }: Props<T>) {
  const usable = hasUsableData(result)
  const status = STATUS_TEXT[result.status]

  return (
    <article className={`evidence-panel ${className}`} aria-label={isExample ? `${title}, example data` : title}>
      <header className="evidence-panel-head">
        <h3>{title}</h3>
        <span className="evidence-panel-tags">
          <EvidenceTag kind={kind} />
          {isExample && <span className="example-badge">Example data</span>}
        </span>
      </header>

      {result.status === 'stale' && (
        <p className="evidence-banner evidence-banner--stale" role="note">
          <Icon name="clock" size={16} /> {status.explain}
        </p>
      )}

      {usable ? (
        <div className="evidence-panel-body">{children(result.data)}</div>
      ) : (
        <p className={`evidence-empty evidence-empty--${result.status}`} role="status">
          <strong>{status.label}.</strong> {result.error?.message ?? status.explain}
        </p>
      )}

      <footer className="evidence-panel-foot">
        <dl className="evidence-times">
          {times.map((field) => (
            <div key={field}>
              <dt>{TIME_LABELS[field]}</dt>
              <dd>{formatLocalTime(result[field], { timeZone })}</dd>
            </div>
          ))}
        </dl>
        {result.limitations[0] && <p className="evidence-limit">{result.limitations[0]}</p>}
        <a className="evidence-source" href={result.source.url} target="_blank" rel="noreferrer">
          <span>Source: {result.source.name}</span>
          <Icon name="external" size={14} />
        </a>
      </footer>
    </article>
  )
}
