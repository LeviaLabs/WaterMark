// Core of the auth-verify Edge Function (WM-CLAUDE-002).
//
// The browser sends the MojoAuth access token it received after email OTP. This code asks
// MojoAuth to verify it (POST https://api.mojoauth.com/token/verify, documented in MojoAuth's
// OpenAPI spec) and returns only { id, displayName, expiresAt }. It never stores, logs or echoes
// the token or the email address.
//
// No Deno globals here, so the same file runs in the Supabase Edge Runtime and in Node tests.

export const MOJOAUTH_VERIFY_URL = 'https://api.mojoauth.com/token/verify'

const MAX_TOKEN_LENGTH = 4096
const MAX_BODY_BYTES = 8192
const MAX_PROVIDER_BYTES = 65536
const CLOCK_SKEW_MS = 60_000
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

export interface VerifiedAccount {
  /** Stable MojoAuth user id (the token's `sub`), or a hash of the identifier if `sub` is absent. */
  id: string
  /** The email the user signed in with, shown back only to that user. */
  displayName: string | null
  /** Epoch milliseconds when the MojoAuth token expires. */
  expiresAt: number
}

export type VerifyResult =
  | { ok: true; account: VerifiedAccount }
  | { ok: false; status: number; code: ErrorCode }

export type ErrorCode =
  | 'invalid-request'
  | 'invalid-token'
  | 'expired-token'
  | 'provider-unavailable'
  | 'not-configured'
  | 'origin-not-allowed'
  | 'method-not-allowed'

export interface VerifyOptions {
  apiKey: string
  /** Optional exact `iss` value to require. Empty means MojoAuth's own check is trusted. */
  expectedIssuer?: string
  fetcher?: typeof fetch
  now?: number
  timeoutMs?: number
}

/** Accept only a compact JWT of sane length. */
export function parseToken(value: unknown): string | null {
  return typeof value === 'string' && value.length <= MAX_TOKEN_LENGTH && JWT_SHAPE.test(value)
    ? value
    : null
}

/** Read the JWT payload. Only trusted after MojoAuth has said the token is valid. */
export function decodeClaims(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return claims && typeof claims === 'object' && !Array.isArray(claims)
      ? (claims as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

const str = (v: unknown, max = 256): string | null =>
  typeof v === 'string' && v.length > 0 && v.length <= max ? v : null
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export async function verifyMojoAuthToken(token: string, options: VerifyOptions): Promise<VerifyResult> {
  const { apiKey, expectedIssuer = '', fetcher = fetch, now = Date.now(), timeoutMs = 5000 } = options
  if (!apiKey) return { ok: false, status: 503, code: 'not-configured' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let body: Record<string, unknown>
  try {
    const response = await fetcher(MOJOAUTH_VERIFY_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error',
      signal: controller.signal,
    })
    const text = await response.text()
    if (response.status >= 500) return { ok: false, status: 502, code: 'provider-unavailable' }
    if (!response.ok) return { ok: false, status: 401, code: 'invalid-token' }
    if (text.length > MAX_PROVIDER_BYTES) return { ok: false, status: 502, code: 'provider-unavailable' }
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object') return { ok: false, status: 502, code: 'provider-unavailable' }
    body = parsed as Record<string, unknown>
  } catch {
    return { ok: false, status: 502, code: 'provider-unavailable' }
  } finally {
    clearTimeout(timer)
  }

  if (body.isValid !== true) return { ok: false, status: 401, code: 'invalid-token' }

  const user = body.user && typeof body.user === 'object' ? (body.user as Record<string, unknown>) : {}
  const claims = decodeClaims(token)
  if (!claims) return { ok: false, status: 401, code: 'invalid-token' }

  const exp = num(user.exp) ?? num(claims.exp)
  if (exp === null) return { ok: false, status: 401, code: 'invalid-token' }
  if (exp * 1000 <= now) return { ok: false, status: 401, code: 'expired-token' }
  const nbf = num(user.nbf) ?? num(claims.nbf)
  if (nbf !== null && nbf * 1000 > now + CLOCK_SKEW_MS) return { ok: false, status: 401, code: 'invalid-token' }

  // MojoAuth sets `aud` to the project's API key (seen on a live token, 2026-11-21). Requiring it
  // rejects tokens that another MojoAuth project issued, even though MojoAuth calls them valid.
  const aud = user.aud ?? claims.aud
  const audiences = Array.isArray(aud) ? aud : [aud]
  if (!audiences.includes(apiKey)) return { ok: false, status: 401, code: 'invalid-token' }

  if (expectedIssuer) {
    const iss = str(user.iss) ?? str(claims.iss)
    if (iss !== expectedIssuer) return { ok: false, status: 401, code: 'invalid-token' }
  }

  const identifier = str(user.identifier, 254) ?? str(claims.email, 254)
  const sub = str(claims.sub) ?? str(claims.user_id)
  const id = sub ?? (identifier ? `idh_${await sha256Hex(identifier.toLowerCase())}` : null)
  if (!id) return { ok: false, status: 401, code: 'invalid-token' }

  return { ok: true, account: { id, displayName: identifier, expiresAt: exp * 1000 } }
}

export interface HandlerConfig extends VerifyOptions {
  /** Exact comma-separated browser origins, e.g. "http://localhost:5173,https://watermark.xyz". */
  allowedOrigins: string
}

function corsHeaders(origin: string | null, allowed: readonly string[]): Record<string, string> {
  if (!origin || !allowed.includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, apikey, x-client-info, authorization',
    'Access-Control-Max-Age': '600',
  }
}

/** HTTP wrapper: CORS, method, body limits. Responds { account } or { error }. */
export async function handleRequest(request: Request, config: HandlerConfig): Promise<Response> {
  const allowed = config.allowedOrigins.split(',').map((s) => s.trim()).filter(Boolean)
  const origin = request.headers.get('origin')
  const cors = corsHeaders(origin, allowed)
  const reply = (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' },
    })

  // Browsers always send Origin on cross-origin POST; reject origins that are not listed.
  if (origin && !cors['Access-Control-Allow-Origin']) return reply(403, { error: 'origin-not-allowed' })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, Vary: 'Origin' } })
  if (request.method !== 'POST') return reply(405, { error: 'method-not-allowed' })

  let token: string | null = null
  try {
    const raw = await request.text()
    if (raw.length <= MAX_BODY_BYTES) token = parseToken((JSON.parse(raw) as { token?: unknown })?.token)
  } catch {
    token = null
  }
  if (!token) return reply(400, { error: 'invalid-request' })

  const result = await verifyMojoAuthToken(token, config)
  if (!result.ok) {
    console.warn(`auth-verify rejected: ${result.code}`) // code only, never the token or email
    return reply(result.status, { error: result.code })
  }
  return reply(200, { account: result.account })
}
