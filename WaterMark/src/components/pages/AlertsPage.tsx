import { useEffect, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { EvidenceTag } from '../common/EvidenceTag'
import { RouterLink } from '../common/RouterLink'
import { alertsUrlFromEnv, loadEmailAlerts, REASON_TEXT, type EmailAlert } from '../../services/emailAlerts'

const ALERTS_URL = alertsUrlFromEnv(import.meta.env)

type Load = { state: 'loading' } | { state: 'ready'; alerts: EmailAlert[] } | { state: 'error' } | { state: 'off' }

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const pct = (p: number | null) => (p === null ? 'n/a' : `${Math.round(p * 100)}%`)

/**
 * Gauge alerts that arrived by email. WaterMark's Agentboxd inbox receives USGS WaterAlert mail;
 * Agentboxd screens it for prompt injection and phishing, the alert-inbox function accepts only
 * approved senders, and the reading shown is fetched from USGS, never taken from the email.
 */
export function AlertsPage() {
  const [load, setLoad] = useState<Load>(ALERTS_URL ? { state: 'loading' } : { state: 'off' })

  useEffect(() => {
    if (!ALERTS_URL) return
    let active = true
    loadEmailAlerts(ALERTS_URL)
      .then((alerts) => { if (active) setLoad({ state: 'ready', alerts }) })
      .catch(() => { if (active) setLoad({ state: 'error' }) })
    return () => { active = false }
  }, [])

  const accepted = load.state === 'ready' ? load.alerts.filter((a) => a.status === 'accepted') : []
  const held = load.state === 'ready' ? load.alerts.filter((a) => a.status === 'quarantined') : []

  return (
    <section className="alerts-page" aria-labelledby="alerts-title">
      <header className="alerts-head">
        <h1 id="alerts-title">Screened gauge alerts</h1>
        <p>
          USGS WaterAlert emails sent to WaterMark’s Agentboxd inbox. Agentboxd screens every message for prompt
          injection and phishing. We accept only approved senders, and every number below comes straight from USGS,
          not from the email.
        </p>
      </header>

      <p className="alerts-status" role="status" aria-live="polite">
        {load.state === 'loading' && 'Loading alerts…'}
        {load.state === 'error' && 'Could not load alerts right now. The map and other data are unaffected.'}
        {load.state === 'off' && 'The alert inbox is not connected on this site yet.'}
        {load.state === 'ready' && `${accepted.length} accepted · ${held.length} held back in the last 7 days`}
      </p>

      {load.state === 'ready' && accepted.length > 0 && (
        <ul className="alerts-list" aria-label="Accepted alerts">
          {accepted.map((a) => (
            <li key={a.id} className="alert-card glass-panel">
              <div className="alert-card-top">
                <EvidenceTag kind="observed" />
                <span className="alert-time">Alert received {when(a.receivedAt)}</span>
              </div>
              <h2 className="alert-site">{a.site?.name ?? `USGS ${a.site?.id ?? ''}`}</h2>
              <p className="alert-meta">
                USGS monitoring location {a.site?.id}
                {a.site?.latitude !== null && a.site?.longitude !== null && a.site
                  ? ` · ${a.site.latitude.toFixed(4)}, ${a.site.longitude.toFixed(4)}`
                  : ''}
              </p>
              {a.readings.length > 0 ? (
                <dl className="alert-readings">
                  {a.readings.map((r) => (
                    <div key={r.parameter}>
                      <dt>{r.label}</dt>
                      <dd>
                        {r.value} {r.unit}
                        <span className="alert-reading-time">
                          {' '}at {when(r.time)}{r.provisional ? ' · provisional' : ''}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="alert-meta">USGS reading not available yet.</p>
              )}
              <p className="alert-screen">
                {REASON_TEXT[a.reason]} · injection {pct(a.screening.injection)} · phishing {pct(a.screening.phishing)}
              </p>
              {a.site && (
                <a className="alert-link" href={`https://waterdata.usgs.gov/monitoring-location/${a.site.id}/`} target="_blank" rel="noopener noreferrer">
                  Open on USGS Water Data
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {load.state === 'ready' && held.length > 0 && (
        <section className="alerts-held" aria-labelledby="alerts-held-title">
          <h2 id="alerts-held-title">Held back</h2>
          <p className="alert-meta">These emails never reached the map. Their content is not stored or shown.</p>
          <ul className="alerts-held-list">
            {held.map((a) => (
              <li key={a.id}>
                <span>{REASON_TEXT[a.reason] ?? 'Held'}</span>
                <span className="alert-meta">
                  {when(a.receivedAt)} · injection {pct(a.screening.injection)} · phishing {pct(a.screening.phishing)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Button label="Open the map" variant="secondary" href="/map" as={RouterLink} />
    </section>
  )
}
