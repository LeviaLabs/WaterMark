// Agentboxd alert inbox: webhook signature and the screening gate (no network, no storage).
// Runs in Deno (Edge Function) and in Node's test runner.
//
// Trust model: the email is untrusted input. Agentboxd screens it (JEV injection and phishing
// scores, SPF/DKIM/DMARC as input, local checks), and this gate adds WaterMark's own rules. An
// accepted email contributes ONE thing: a USGS monitoring-location id. Every number shown on the
// map comes from the USGS API, never from the email, and no model ever reads the email here.
// Rules from https://agentboxd.com/docs/webhooks and https://agentboxd.com/docs/api.

export const MAX_SKEW_S = 300
export const RISK_THRESHOLD = 0.5
const MAIL_EVENTS = new Set(['message.enriched', 'message.released'])
const RISK_LABELS = ['ai:injection-risk', 'ai:phishing', 'local:injection-risk', 'blocked']
const SITE_SCAN_CHARS = 3000

const enc = new TextEncoder()

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** X-Mailroom-Signature = hex(HMAC-SHA256(secret, "<timestamp>.<raw body>")), timestamp within 300 s. */
export async function verifySignature(
  secret: string,
  signature: string | null,
  timestamp: string | null,
  rawBody: string,
  nowMs: number,
): Promise<boolean> {
  if (!secret || !signature || !timestamp || !/^\d{1,12}$/.test(timestamp) || !/^[0-9a-f]{64}$/i.test(signature)) return false
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > MAX_SKEW_S) return false
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${rawBody}`)))
  const given = signature.toLowerCase()
  let diff = 0
  for (let i = 0; i < 64; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i)
  return diff === 0
}

/** Lower-case address from "Name <addr@host>" or "addr@host"; null when there is none. */
export function senderAddress(from: unknown): string | null {
  if (typeof from !== 'string') return null
  const m = from.match(/<([^<>\s]+@[^<>\s]+)>\s*$/) ?? from.trim().match(/^([^<>\s]+@[^<>\s]+)$/)
  return m ? m[1].toLowerCase() : null
}

/** Allowlist entries are exact addresses ("alerts@usgs.gov") or domains ("usgs.gov", subdomains included). */
export function senderAllowed(address: string, allowlist: string): boolean {
  const domain = address.split('@')[1] ?? ''
  for (const raw of allowlist.split(',')) {
    const entry = raw.trim().toLowerCase()
    if (!entry) continue
    if (entry.includes('@') ? address === entry : domain === entry || domain.endsWith(`.${entry}`)) return true
  }
  return false
}

// USGS site numbers are 8 to 15 digits. Only accept them in an unambiguous context.
const SITE_PATTERNS = [
  /monitoring-location\/(?:USGS-)?(\d{8,15})(?!\d)/i,
  /\bUSGS[- ](\d{8,15})(?!\d)/,
  /[?&](?:site_no|sites?)=(\d{8,15})(?!\d)/i,
  /\b(?:site|monitoring location)(?: number| no\.?| id)?[: #]+(\d{8,15})(?!\d)/i,
]

/** First USGS monitoring-location id in the subject or the start of the new text, else null. */
export function extractSiteId(subject: unknown, text: unknown): string | null {
  const haystack = `${typeof subject === 'string' ? subject.slice(0, 300) : ''}\n${typeof text === 'string' ? text.slice(0, SITE_SCAN_CHARS) : ''}`
  for (const re of SITE_PATTERNS) {
    const m = haystack.match(re)
    if (m) return m[1]
  }
  return null
}

export type Decision =
  | { kind: 'ignore'; why: string } // not recorded: wrong event, withheld until screened, outbound
  | {
    kind: 'record'
    messageId: string
    receivedAt: string
    status: 'accepted' | 'quarantined'
    reason: string
    senderDomain: string | null
    injection: number | null
    phishing: number | null
    screeningState: string | null
    siteId: string | null
  }

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null)
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** Decide what one webhook event means for the map. Pure: same input, same output. */
export function decide(event: unknown, allowlist: string): Decision {
  const e = obj(event)
  if (typeof e.type !== 'string' || !MAIL_EVENTS.has(e.type)) return { kind: 'ignore', why: 'event-type' }
  const m = obj(obj(e.data).message)
  if (m.withheld) return { kind: 'ignore', why: 'withheld' } // a later event brings the screened content
  if (typeof m.id !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(m.id)) return { kind: 'ignore', why: 'no-message-id' }
  if (m.direction !== 'inbound') return { kind: 'ignore', why: 'not-inbound' }
  if (!('extracted_text' in m) && !('text' in m)) return { kind: 'ignore', why: 'envelope-payload' }

  const received = typeof m.received_at === 'string' && !Number.isNaN(Date.parse(m.received_at)) ? new Date(m.received_at).toISOString() : new Date().toISOString()
  const ai = obj(m.ai)
  const risk = obj(ai.risk)
  const injection = num(risk.injection)
  const phishing = num(risk.phishing)
  const address = senderAddress(m.from)
  const screeningState = typeof obj(m.screening).state === 'string' ? String(obj(m.screening).state).slice(0, 40) : null
  const labels = Array.isArray(m.labels) ? m.labels.filter((l): l is string => typeof l === 'string') : []
  const base = {
    kind: 'record' as const,
    messageId: m.id,
    receivedAt: received,
    senderDomain: address ? address.split('@')[1].slice(0, 253) : null,
    injection,
    phishing,
    screeningState,
    siteId: null as string | null,
  }
  const quarantine = (reason: string) => ({ ...base, status: 'quarantined' as const, reason })

  // Order matters for the reason shown: Agentboxd's verdict first, then WaterMark's rules.
  if (ai.enrichment_error || obj(m.analysis).state === 'failed') return quarantine('check-failed')
  if (obj(m.analysis).state !== 'completed' || injection === null || phishing === null) return quarantine('not-checked')
  if (injection >= RISK_THRESHOLD || labels.includes('ai:injection-risk') || labels.includes('local:injection-risk')) {
    return quarantine('injection-risk')
  }
  if (phishing >= RISK_THRESHOLD || labels.includes('ai:phishing')) return quarantine('phishing-risk')
  if (RISK_LABELS.some((l) => labels.includes(l))) return quarantine('blocked')
  if (!address || !senderAllowed(address, allowlist)) return quarantine('sender-not-allowed')
  const siteId = extractSiteId(m.subject, m.extracted_text ?? m.text)
  if (!siteId) return quarantine('no-usgs-site')
  return { ...base, status: 'accepted', reason: 'screened-usgs-alert', siteId }
}
