// Postgres RPCs for the alert inbox (migration 20261122170000_agentboxd_alert_inbox.sql).
// service_role only; the browser reads alerts through this function's GET /alerts, never the DB.
import type { Decision } from './gate.ts'
import type { SiteReading } from './usgs.ts'

export type RecordInput = Extract<Decision, { kind: 'record' }>

export interface AlertRow {
  message_id: string
  received_at: string
  status: 'accepted' | 'quarantined'
  reason: string
  injection: number | null
  phishing: number | null
  screening_state: string | null
  site_id: string | null
  site_name: string | null
  latitude: number | null
  longitude: number | null
  readings: unknown[] | null
}

export interface AlertStore {
  /** True when this message id is new; false for a repeat delivery. */
  record(d: RecordInput): Promise<boolean>
  setReading(messageId: string, reading: SiteReading): Promise<void>
  recent(days: number, limit: number): Promise<AlertRow[]>
}

export class StoreError extends Error {}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

export function createRpcStore(baseUrl: string, key: string, fetcher: Fetcher = (i, init) => fetch(i, init), timeoutMs = 4000): AlertStore {
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' }
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`
  async function rpc(name: string, body: Record<string, unknown>): Promise<unknown> {
    let res: Response
    try {
      res = await fetcher(`${baseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
      throw new StoreError('unavailable')
    }
    const text = await res.text().catch(() => '')
    if (!res.ok) throw new StoreError('rejected')
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      throw new StoreError('invalid')
    }
  }
  return {
    async record(d) {
      const ok = await rpc('watermark_email_alert_record', {
        p_message_id: d.messageId,
        p_received_at: d.receivedAt,
        p_status: d.status,
        p_reason: d.reason,
        p_sender_domain: d.senderDomain,
        p_injection: d.injection,
        p_phishing: d.phishing,
        p_screening_state: d.screeningState,
        p_site_id: d.siteId,
      })
      if (typeof ok !== 'boolean') throw new StoreError('invalid')
      return ok
    },
    async setReading(messageId, r) {
      await rpc('watermark_email_alert_set_reading', {
        p_message_id: messageId,
        p_site_name: r.siteName,
        p_latitude: r.latitude,
        p_longitude: r.longitude,
        p_readings: r.readings,
      })
    },
    async recent(days, limit) {
      const rows = await rpc('watermark_email_alerts_recent', { p_days: days, p_limit: limit })
      if (!Array.isArray(rows)) throw new StoreError('invalid')
      return rows as AlertRow[]
    },
  }
}
