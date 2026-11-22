// Screened flood-alert email (Agentboxd alert inbox) as map evidence.
// Reads GET <VITE_WATERMARK_ALERTS_URL> from the alert-inbox Edge Function. Every value is
// validated here; the backend never sends email text, and readings come from USGS, not email.
// Ryan Lin's map can plot `site.latitude/longitude` from loadEmailAlerts() as its own layer.

export interface AlertReading {
  parameter: string
  label: string
  unit: string
  value: number
  time: string
  provisional: boolean
}

export interface EmailAlert {
  id: string
  receivedAt: string
  status: 'accepted' | 'quarantined'
  reason: string
  screening: { injection: number | null; phishing: number | null; state: string | null }
  site: { id: string; name: string | null; latitude: number | null; longitude: number | null } | null
  readings: AlertReading[]
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null)
const prob = (v: unknown) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : null)
const coord = (v: unknown, lim: number) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim ? v : null)
const isTime = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))

function readingOf(v: unknown): AlertReading | null {
  const r = (v ?? {}) as Record<string, unknown>
  if (typeof r.value !== 'number' || !Number.isFinite(r.value) || !isTime(r.time)) return null
  const label = str(r.label, 40)
  const unit = str(r.unit, 12)
  const parameter = str(r.parameter, 8)
  if (!label || !unit || !parameter) return null
  return { parameter, label, unit, value: r.value, time: r.time, provisional: r.provisional === true }
}

/** Keep only well-formed alerts; drop anything else rather than show a guess. */
export function parseEmailAlerts(body: unknown): EmailAlert[] {
  const list = (body as { alerts?: unknown })?.alerts
  if (!Array.isArray(list)) return []
  const out: EmailAlert[] = []
  for (const raw of list.slice(0, 200)) {
    const a = (raw ?? {}) as Record<string, unknown>
    const status = a.status === 'accepted' || a.status === 'quarantined' ? a.status : null
    const id = str(a.id, 100)
    const reason = str(a.reason, 40)
    if (!status || !id || !reason || !isTime(a.receivedAt)) continue
    const s = (a.screening ?? {}) as Record<string, unknown>
    const site = (a.site ?? null) as Record<string, unknown> | null
    const siteId = site && typeof site.id === 'string' && /^\d{8,15}$/.test(site.id) ? site.id : null
    out.push({
      id,
      receivedAt: a.receivedAt,
      status,
      reason,
      screening: { injection: prob(s.injection), phishing: prob(s.phishing), state: str(s.state, 40) },
      site: status === 'accepted' && site && siteId
        ? { id: siteId, name: str(site.name, 200), latitude: coord(site.latitude, 90), longitude: coord(site.longitude, 180) }
        : null,
      readings: status === 'accepted' && Array.isArray(a.readings) ? a.readings.map(readingOf).filter((r): r is AlertReading => r !== null) : [],
    })
  }
  return out
}

export async function loadEmailAlerts(url: string, fetcher: Fetcher = (i, init) => fetch(i, init)): Promise<EmailAlert[]> {
  const res = await fetcher(url, { headers: { Accept: 'application/json' }, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`alerts ${res.status}`)
  return parseEmailAlerts(await res.json())
}

const LOCAL_HOST = /^(localhost|.+\.localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1?\])$/i

/** VITE_WATERMARK_ALERTS_URL = <SUPABASE_URL>/functions/v1/alert-inbox/alerts. Production: HTTPS, not local. */
export function alertsUrlFromEnv(env: Record<string, unknown>): string | null {
  const raw = typeof env.VITE_WATERMARK_ALERTS_URL === 'string' ? env.VITE_WATERMARK_ALERTS_URL.trim() : ''
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (env.PROD === true && (u.protocol !== 'https:' || LOCAL_HOST.test(u.hostname))) return null
    return u.href
  } catch {
    return null
  }
}

/** Every feed carries this: gauge observations, never official warnings. */
export const OBSERVATION_NOTICE =
  'Observed USGS gauge readings (provisional data may be revised). Not official National Weather Service flood watches or warnings.'

/** Plain-language reasons, shown for accepted and quarantined mail. */
export const REASON_TEXT: Record<string, string> = {
  'screened-usgs-alert': 'Screened by Agentboxd; numbers fetched from USGS, not from the email',
  'injection-risk': 'Blocked: tried to instruct an AI (prompt injection)',
  'phishing-risk': 'Blocked: looked like phishing or impersonation',
  'check-failed': 'Held: the Agentboxd check failed',
  'not-checked': 'Held: not checked by Agentboxd',
  blocked: 'Blocked by the inbox block list',
  'sender-auth-failed': 'Held: sender failed email authentication (SPF or DMARC)',
  'sender-not-allowed': 'Held: sender is not an approved alert source',
  'no-usgs-site': 'Held: no USGS monitoring location in the alert',
}
