import type { CSSProperties } from 'react'
import type { EnvironmentalResult, OfficialAlert } from '../../scripting/evidence/contract'
import { formatLocalTime } from '../../scripting/evidence/format'
import { Icon } from '../common/Icon'
import { EvidencePanel } from './EvidencePanel'

const TIMING_LABELS: Record<OfficialAlert['hazardTiming'], string> = {
  upcoming: 'Starts later',
  active: 'In effect now',
  ended: 'Expected to have ended',
  unknown: 'Timing unknown',
}

type Props = {
  result: EnvironmentalResult<OfficialAlert[]>
  isExample?: boolean
  timeZone?: string
}

/**
 * Official NWS alerts for a point, shown exactly as issued: event name, the
 * agency's own severity / urgency / certainty, its times, area and words.
 * An empty list says plainly that it is not an all-clear.
 */
export function AlertList({ result, isExample, timeZone }: Props) {
  return (
    <EvidencePanel
      title="Official alerts"
      kind="official"
      result={result}
      times={['sourceUpdatedAt', 'fetchedAt']}
      isExample={isExample}
      timeZone={timeZone}
    >
      {(alerts) =>
        alerts.length === 0 ? (
          <p className="alert-none">
            <Icon name="shield" size={20} />
            <span>
              <strong>No flood or heavy-rain alerts were returned for this point.</strong> That is not an all-clear.
              Alerts can lag fast-changing conditions, so keep watching official channels.
            </span>
          </p>
        ) : (
          <ul className="alert-list">
            {alerts.map((alert, index) => (
              <li
                key={alert.id}
                className={`alert alert--${alert.hazardTiming}`}
                style={{ '--i': index } as CSSProperties}
              >
                <p className="alert-event">
                  <Icon name="bell" size={18} />
                  {alert.event}
                  <span className={`alert-timing alert-timing--${alert.hazardTiming}`}>
                    {TIMING_LABELS[alert.hazardTiming]}
                  </span>
                </p>
                <dl className="alert-cap" aria-label="As issued by the NWS">
                  <div>
                    <dt>Severity</dt>
                    <dd>{alert.severity}</dd>
                  </div>
                  <div>
                    <dt>Urgency</dt>
                    <dd>{alert.urgency}</dd>
                  </div>
                  <div>
                    <dt>Certainty</dt>
                    <dd>{alert.certainty}</dd>
                  </div>
                </dl>
                <p className="alert-window">
                  <Icon name="clock" size={16} />
                  {formatLocalTime(alert.onset ?? alert.effective, { timeZone })} →{' '}
                  {formatLocalTime(alert.ends ?? alert.expires, { timeZone })}
                </p>
                <p className="alert-area">{alert.areaDescription}</p>
                {alert.headline && <p className="alert-headline">“{alert.headline}”</p>}
                {alert.floodRelevance === 'multi_hazard_context' && (
                  <p className="alert-context">Storm alert shown for context. It is not direct evidence of flooding.</p>
                )}
                {alert.instruction && (
                  <details className="alert-instruction">
                    <summary>Agency instructions</summary>
                    <p>{alert.instruction}</p>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )
      }
    </EvidencePanel>
  )
}
