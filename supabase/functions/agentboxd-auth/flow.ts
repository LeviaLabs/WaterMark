// Sign in with Agentboxd, server side (WM-CLAUDE-005). Authorization code + PKCE (S256) with a
// registered *public* client: no client secret exists anywhere. The browser keeps only the PKCE
// verifier; this function owns state and nonce, exchanges the code, verifies the ID token and
// issues WaterMark's own short session. Runs in Deno and in Node's test runner (no Deno APIs).
//
//   POST /start    { codeChallenge }                        -> { authorizeUrl, state }
//   POST /finish   { state, code, codeVerifier, iss }        -> { session, account }
//   POST /session  { session }                               -> { account }
//   POST /logout   { session }                               -> { ok: true }
//
// Logs carry an error code only: never a code, token, verifier, nonce, session or claim.
import { AgentboxdProvider, type Fetcher, fetchProviderJson, ProviderError, safeEqual, verifyIdToken } from './oidc.ts'
import { type AuthStore, StoreError } from './store.ts'

const MAX_BODY_BYTES = 4096
const ATTEMPT_TTL_S = 600
const ATTEMPTS_PER_MINUTE = 10
const DEFAULT_SESSION_MS = 3_600_000
const SCOPE = 'openid profile' // no email: identity is the pairwise sub, never an address
const B64URL_43 = /^[A-Za-z0-9_-]{43}$/
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/
const CODE = /^[\x21-\x7e]{1,512}$/
const LOCAL_HOST = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i

export interface HandlerConfig {
  /** Agentboxd client_id (public client). Also the required `aud` of every ID token. */
  clientId: string
  /** Comma-separated exact redirect URIs registered at Agentboxd, one per site origin. */
  redirectUris: string
  /** Exact comma-separated browser origins (shared WATERMARK_ALLOWED_ORIGINS). */
  allowedOrigins: string
  store: AuthStore | null
  provider?: AgentboxdProvider
  fetcher?: Fetcher
  now?: () => number
  timeoutMs?: number
  sessionTtlMs?: number
}

type Reply = (status: number, payload: unknown) => Response

const enc = new TextEncoder()

export function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function randomToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)))
}

export async function pkceChallenge(verifier: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(verifier))))
}

async function sha256Hex(value: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value)))
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('')
}

function list(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

/** The registered redirect URI for a site origin, or null. The browser never chooses it. */
export function redirectFor(origin: string, redirectUris: string): string | null {
  for (const raw of list(redirectUris)) {
    try {
      const u = new URL(raw)
      const secure = u.protocol === 'https:' || (u.protocol === 'http:' && LOCAL_HOST.test(u.hostname))
      if (!secure || u.hash || u.username || u.password || u.search) continue
      if (u.origin === origin) return u.href
    } catch { /* ignore malformed entries */ }
  }
  return null
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

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES) return null
  try {
    const raw = await request.text()
    if (raw.length > MAX_BODY_BYTES) return null
    const v: unknown = JSON.parse(raw)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function clientKey(request: Request): Promise<string> {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return sha256Hex(forwarded || request.headers.get('cf-connecting-ip') || 'unknown')
}

const str = (v: unknown, re: RegExp): string | null => (typeof v === 'string' && re.test(v) ? v : null)

export function createHandler(config: HandlerConfig): (request: Request) => Promise<Response> {
  const fetcher: Fetcher = config.fetcher ?? ((i, init) => fetch(i, init))
  const now = config.now ?? Date.now
  const timeoutMs = config.timeoutMs ?? 8000
  const provider = config.provider ?? new AgentboxdProvider(fetcher, timeoutMs, now)
  const sessionTtlMs = config.sessionTtlMs ?? DEFAULT_SESSION_MS
  const allowed = list(config.allowedOrigins)

  async function start(body: Record<string, unknown>, origin: string, request: Request, reply: Reply) {
    const codeChallenge = str(body.codeChallenge, B64URL_43)
    if (!codeChallenge) return reply(400, { error: 'invalid-request' })
    const redirectUri = redirectFor(origin, config.redirectUris)
    if (!redirectUri) return reply(503, { error: 'not-configured' })
    const meta = await provider.discover()
    const state = randomToken()
    const nonce = randomToken()
    const ok = await config.store!.begin(
      { state, nonce, codeChallenge, redirectUri, clientKey: await clientKey(request) },
      ATTEMPT_TTL_S,
      ATTEMPTS_PER_MINUTE,
    )
    if (!ok) return reply(429, { error: 'rate-limited' })
    const url = new URL(meta.authorizationEndpoint)
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: SCOPE,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }).toString()
    return reply(200, { authorizeUrl: url.href, state })
  }

  async function finish(body: Record<string, unknown>, origin: string, reply: Reply) {
    const state = str(body.state, B64URL_43)
    const code = str(body.code, CODE)
    const verifier = str(body.codeVerifier, VERIFIER)
    if (!state || !code || !verifier) return reply(400, { error: 'invalid-request' })
    const iss = body.iss === undefined || body.iss === null ? null : typeof body.iss === 'string' ? body.iss : ''

    // Single use: the attempt row is deleted here whether or not the rest succeeds.
    const attempt = await config.store!.takeAttempt(state)
    if (!attempt || attempt.redirectUri !== redirectFor(origin, config.redirectUris)) {
      return reply(400, { error: 'invalid-state' })
    }
    const meta = await provider.discover()
    // RFC 9207: the response must name our issuer (mix-up defence). Agentboxd always sends it.
    if ((iss === null && meta.issParameterSupported) || (iss !== null && iss !== meta.issuer)) {
      return reply(400, { error: 'invalid-issuer' })
    }
    // Check PKCE locally too, so a wrong verifier never reaches the provider.
    if (!safeEqual(await pkceChallenge(verifier), attempt.codeChallenge)) return reply(400, { error: 'pkce-mismatch' })

    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: attempt.redirectUri,
      client_id: config.clientId,
      code_verifier: verifier,
    })
    const { status, body: tokens } = await fetchProviderJson(
      fetcher,
      meta.tokenEndpoint,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: form.toString() },
      timeoutMs,
    )
    const t = (tokens ?? {}) as Record<string, unknown>
    if (status !== 200) {
      return t.error === 'invalid_grant' ? reply(401, { error: 'invalid-grant' }) : reply(502, { error: 'provider-error' })
    }
    if (typeof t.id_token !== 'string') return reply(502, { error: 'provider-error' })

    const checked = await verifyIdToken(t.id_token, { provider, audience: config.clientId, nonce: attempt.nonce, now: now() })
    if (!checked.ok) return reply(401, { error: checked.code })
    if (!(await config.store!.consumeJti(checked.claims.jti, checked.claims.exp * 1000))) {
      return reply(401, { error: 'token-replayed' })
    }

    const session = randomToken()
    const expiresAt = now() + sessionTtlMs
    await config.store!.createSession(await sha256Hex(session), checked.claims.sub, checked.claims.name, expiresAt)
    return reply(200, { session, account: account(checked.claims.sub, checked.claims.name, expiresAt) })
  }

  async function session(body: Record<string, unknown>, reply: Reply) {
    const token = str(body.session, B64URL_43)
    if (!token) return reply(400, { error: 'invalid-request' })
    const row = await config.store!.getSession(await sha256Hex(token))
    if (!row || row.expiresAt <= now()) return reply(401, { error: 'session-expired' })
    return reply(200, { account: account(row.subject, row.displayName, row.expiresAt) })
  }

  async function logout(body: Record<string, unknown>, reply: Reply) {
    const token = str(body.session, B64URL_43)
    if (!token) return reply(400, { error: 'invalid-request' })
    await config.store!.endSession(await sha256Hex(token))
    return reply(200, { ok: true })
  }

  return async function handle(request: Request): Promise<Response> {
    const origin = request.headers.get('origin')
    const cors = corsHeaders(origin, allowed)
    const reply: Reply = (status, payload) => {
      const error = (payload as { error?: unknown }).error
      if (status >= 400 && typeof error === 'string') console.warn(`agentboxd-auth rejected: ${status} ${error}`)
      return new Response(JSON.stringify(payload), {
        status,
        headers: {
          ...cors,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          Vary: 'Origin',
        },
      })
    }

    // Browser-only flow: every call must come from an allowed site origin.
    if (!origin || !cors['Access-Control-Allow-Origin']) return reply(403, { error: 'origin-not-allowed' })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, Vary: 'Origin' } })
    if (request.method !== 'POST') return reply(405, { error: 'method-not-allowed' })

    const route = new URL(request.url).pathname.replace(/\/+$/, '').split('/').pop()
    if (route !== 'start' && route !== 'finish' && route !== 'session' && route !== 'logout') {
      return reply(404, { error: 'not-found' })
    }
    if (!config.clientId || !config.store) return reply(503, { error: 'not-configured' })
    const body = await readBody(request)
    if (!body) return reply(400, { error: 'invalid-request' })

    try {
      if (route === 'start') return await start(body, origin, request, reply)
      if (route === 'finish') return await finish(body, origin, reply)
      if (route === 'session') return await session(body, reply)
      return await logout(body, reply)
    } catch (err) {
      const code = err instanceof ProviderError
        ? 'provider-unavailable'
        : err instanceof StoreError
        ? 'store-unavailable'
        : 'internal-error'
      return reply(code === 'internal-error' ? 500 : 503, { error: code })
    }
  }
}

function account(sub: string, name: string | null, expiresAt: number) {
  // Prefix keeps agent ids apart from MojoAuth ids. sub is pairwise: stable for WaterMark only.
  return { id: `agentboxd:${sub}`, displayName: name, kind: 'agent', expiresAt }
}
