// Agentboxd alert inbox, HTTP side.
//   POST /webhook  Agentboxd webhook (message.enriched, message.released), HMAC-signed.
//   GET  /alerts   Public evidence: accepted alerts with their USGS reading, and quarantined
//                  alerts with only the reason and screening scores.
// Logs carry status and a short code only, never sender, subject or body.
import { decide, verifySignature } from './gate.ts'
import { type AlertRow, type AlertStore, StoreError } from './store.ts'
import { fetchSiteReading, type SiteReading } from './usgs.ts'

const MAX_WEBHOOK_BYTES = 1_000_000
const RECENT_DAYS = 7
const RECENT_LIMIT = 100

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

export interface HandlerConfig {
  /** Agentboxd webhook signing secret (shown once when the webhook is created). */
  webhookSecret: string
  /** Comma-separated sender addresses or domains whose alerts may be accepted. */
  senderAllowlist: string
  /** Exact comma-separated site origins for GET /alerts (shared WATERMARK_ALLOWED_ORIGINS). */
  allowedOrigins: string
  store: AlertStore | null
  fetcher?: Fetcher
  now?: () => number
  /** Run work after the response (EdgeRuntime.waitUntil); tests leave it out and work runs inline. */
  defer?: (work: Promise<unknown>) => void
  usgsTimeoutMs?: number
}

export interface PublicAlert {
  id: string
  receivedAt: string
  status: 'accepted' | 'quarantined'
  reason: string
  screening: { injection: number | null; phishing: number | null; state: string | null }
  site: { id: string; name: string | null; latitude: number | null; longitude: number | null } | null
  readings: SiteReading['readings']
}

export function toPublic(row: AlertRow): PublicAlert {
  const accepted = row.status === 'accepted'
  return {
    id: row.message_id,
    receivedAt: row.received_at,
    status: row.status,
    reason: row.reason,
    screening: { injection: row.injection, phishing: row.phishing, state: row.screening_state },
    site: accepted && row.site_id
      ? { id: row.site_id, name: row.site_name, latitude: row.latitude, longitude: row.longitude }
      : null,
    readings: accepted && Array.isArray(row.readings) ? (row.readings as SiteReading['readings']) : [],
  }
}

export function createHandler(config: HandlerConfig): (request: Request) => Promise<Response> {
  const now = config.now ?? Date.now
  const allowed = config.allowedOrigins.split(',').map((s) => s.trim()).filter(Boolean)
  const log = (status: number, code: string) => {
    if (status >= 400) console.warn(`alert-inbox ${status} ${code}`)
  }

  async function webhook(request: Request): Promise<Response> {
    const empty = (status: number, code: string) => {
      log(status, code)
      return new Response(null, { status })
    }
    if (request.method !== 'POST') return empty(405, 'method-not-allowed')
    if (!config.webhookSecret || !config.store) return empty(503, 'not-configured')
    if (Number(request.headers.get('content-length') ?? '0') > MAX_WEBHOOK_BYTES) return empty(413, 'too-large')
    const raw = await request.text()
    if (raw.length > MAX_WEBHOOK_BYTES) return empty(413, 'too-large')
    const signed = await verifySignature(
      config.webhookSecret,
      request.headers.get('x-mailroom-signature'),
      request.headers.get('x-mailroom-timestamp'),
      raw,
      now(),
    )
    if (!signed) return empty(401, 'bad-signature')
    let event: unknown
    try {
      event = JSON.parse(raw)
    } catch {
      return empty(400, 'invalid-json')
    }
    const decision = decide(event, config.senderAllowlist)
    if (decision.kind === 'ignore') return empty(204, decision.why)
    const store = config.store
    try {
      const fresh = await store.record(decision)
      if (fresh && decision.status === 'accepted' && decision.siteId) {
        const siteId = decision.siteId
        const work = fetchSiteReading(siteId, config.fetcher, config.usgsTimeoutMs)
          .then((r) => (r ? store.setReading(decision.messageId, r) : undefined))
          .catch(() => console.warn('alert-inbox usgs-unavailable')) // alert stays, without a reading
        if (config.defer) config.defer(work)
        else await work
      }
    } catch (err) {
      // 5xx makes Agentboxd retry; the message id makes the retry safe.
      return empty(503, err instanceof StoreError ? 'store-unavailable' : 'internal-error')
    }
    return empty(204, decision.status)
  }

  async function alerts(request: Request): Promise<Response> {
    const origin = request.headers.get('origin')
    const cors: Record<string, string> = origin && allowed.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '600' }
      : {}
    const reply = (status: number, payload: unknown, cache = 'no-store') => {
      const error = (payload as { error?: unknown }).error
      if (typeof error === 'string') log(status, error)
      return new Response(JSON.stringify(payload), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' },
      })
    }
    if (origin && !cors['Access-Control-Allow-Origin']) return reply(403, { error: 'origin-not-allowed' })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, Vary: 'Origin' } })
    if (request.method !== 'GET') return reply(405, { error: 'method-not-allowed' })
    if (!config.store) return reply(503, { error: 'not-configured' })
    try {
      const rows = await config.store.recent(RECENT_DAYS, RECENT_LIMIT)
      return reply(200, { source: 'Agentboxd-screened email, readings from USGS Water Services', alerts: rows.map(toPublic) }, 'public, max-age=60')
    } catch {
      return reply(503, { error: 'store-unavailable' })
    }
  }

  return (request: Request) => {
    const route = new URL(request.url).pathname.replace(/\/+$/, '').split('/').pop()
    if (route === 'webhook') return webhook(request)
    if (route === 'alerts') return alerts(request)
    return Promise.resolve(new Response(JSON.stringify({ error: 'not-found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }))
  }
}
