// OpenID Connect pieces for Sign in with Agentboxd (WM-CLAUDE-005): discovery, JWKS and
// ID-token verification. WebCrypto only, so the same file runs in Deno (Edge Function) and in
// Node's test runner. Rules come from https://agentboxd.com/docs/agent-identity:
// ES256 only, iss exact, aud = our client_id, exp/iat with 30 s tolerance, exp - iat <= 300 s,
// nonce, unique jti, and the agent claim. Keys rotate; an unknown kid triggers one JWKS re-fetch.

export const AGENTBOXD_ISSUER = 'https://id.agentboxd.com'
export const AGENT_CLAIM = 'https://agentboxd.com/claims/agent'
const CLOCK_TOLERANCE_S = 30
const MAX_LIFETIME_S = 300
const MAX_TOKEN_LENGTH = 8192
const MAX_PROVIDER_BYTES = 65536
const JWKS_REFETCH_MS = 60_000
const DISCOVERY_TTL_MS = 3_600_000

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

export interface ProviderMetadata {
  issuer: string
  authorizationEndpoint: string
  tokenEndpoint: string
  jwksUri: string
  issParameterSupported: boolean
}

export class ProviderError extends Error {
  readonly kind: 'unavailable' | 'invalid'
  constructor(kind: 'unavailable' | 'invalid') {
    super(kind)
    this.kind = kind
  }
}

/** Fetch JSON with a timeout, no redirects and a size cap. Network failures are 'unavailable'. */
export async function fetchProviderJson(
  fetcher: Fetcher,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ status: number; body: unknown }> {
  let res: Response
  try {
    res = await fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) })
  } catch {
    throw new ProviderError('unavailable')
  }
  if (res.status >= 500) {
    await res.body?.cancel()
    throw new ProviderError('unavailable')
  }
  let text: string
  try {
    text = await res.text()
  } catch {
    throw new ProviderError('unavailable')
  }
  if (text.length > MAX_PROVIDER_BYTES) throw new ProviderError('invalid')
  try {
    return { status: res.status, body: JSON.parse(text) }
  } catch {
    return { status: res.status, body: null }
  }
}

function sameOriginUrl(value: unknown, origin: string): string | null {
  if (typeof value !== 'string') return null
  try {
    const u = new URL(value)
    return u.origin === origin && u.protocol === 'https:' && !u.username && !u.password ? u.href : null
  } catch {
    return null
  }
}

/** Validate a discovery document: issuer exact, endpoints on the issuer's own https origin, S256. */
export function parseDiscovery(doc: unknown, issuer: string = AGENTBOXD_ISSUER): ProviderMetadata {
  if (!doc || typeof doc !== 'object') throw new ProviderError('invalid')
  const d = doc as Record<string, unknown>
  if (d.issuer !== issuer) throw new ProviderError('invalid')
  const origin = new URL(issuer).origin
  const authorizationEndpoint = sameOriginUrl(d.authorization_endpoint, origin)
  const tokenEndpoint = sameOriginUrl(d.token_endpoint, origin)
  const jwksUri = sameOriginUrl(d.jwks_uri, origin)
  const methods = Array.isArray(d.code_challenge_methods_supported) ? d.code_challenge_methods_supported : []
  const algs = Array.isArray(d.id_token_signing_alg_values_supported) ? d.id_token_signing_alg_values_supported : []
  if (!authorizationEndpoint || !tokenEndpoint || !jwksUri || !methods.includes('S256') || !algs.includes('ES256')) {
    throw new ProviderError('invalid')
  }
  return {
    issuer,
    authorizationEndpoint,
    tokenEndpoint,
    jwksUri,
    issParameterSupported: d.authorization_response_iss_parameter_supported === true,
  }
}

interface Jwk {
  kty?: unknown
  crv?: unknown
  x?: unknown
  y?: unknown
  kid?: unknown
  use?: unknown
  alg?: unknown
}

/** Discovery and JWKS, cached per Edge Function instance. Caching keys is safe; replay state is not cached here. */
export class AgentboxdProvider {
  private metadata: { value: ProviderMetadata; at: number } | null = null
  private keys = new Map<string, CryptoKey>()
  private keysAt = -Infinity
  private readonly fetcher: Fetcher
  private readonly timeoutMs: number
  private readonly now: () => number
  readonly issuer: string

  constructor(fetcher: Fetcher = (input, init) => fetch(input, init), timeoutMs = 8000, now: () => number = Date.now, issuer: string = AGENTBOXD_ISSUER) {
    this.fetcher = fetcher
    this.timeoutMs = timeoutMs
    this.now = now
    this.issuer = issuer
  }

  async discover(): Promise<ProviderMetadata> {
    if (this.metadata && this.now() - this.metadata.at < DISCOVERY_TTL_MS) return this.metadata.value
    const { status, body } = await fetchProviderJson(
      this.fetcher,
      `${this.issuer}/.well-known/openid-configuration`,
      { headers: { Accept: 'application/json' } },
      this.timeoutMs,
    )
    if (status !== 200) throw new ProviderError('unavailable')
    const value = parseDiscovery(body, this.issuer)
    this.metadata = { value, at: this.now() }
    return value
  }

  private async loadKeys(): Promise<void> {
    const { jwksUri } = await this.discover()
    const { status, body } = await fetchProviderJson(this.fetcher, jwksUri, { headers: { Accept: 'application/json' } }, this.timeoutMs)
    const list = status === 200 && body && typeof body === 'object' ? (body as { keys?: unknown }).keys : null
    if (!Array.isArray(list)) throw new ProviderError('unavailable')
    const next = new Map<string, CryptoKey>()
    for (const raw of list as Jwk[]) {
      if (raw?.kty !== 'EC' || raw.crv !== 'P-256' || typeof raw.kid !== 'string') continue
      if (raw.use !== undefined && raw.use !== 'sig') continue
      if (raw.alg !== undefined && raw.alg !== 'ES256') continue
      if (typeof raw.x !== 'string' || typeof raw.y !== 'string') continue
      try {
        next.set(
          raw.kid,
          await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: raw.x, y: raw.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']),
        )
      } catch { /* skip malformed key */ }
    }
    this.keys = next
    this.keysAt = this.now()
  }

  /** Key for a kid; re-fetches the JWKS once (at most once a minute) when the kid is unknown. */
  async key(kid: string): Promise<CryptoKey | null> {
    if (!this.keys.has(kid) && this.now() - this.keysAt >= JWKS_REFETCH_MS) await this.loadKeys()
    return this.keys.get(kid) ?? null
  }
}

export type TokenCheck =
  | { ok: true; claims: VerifiedClaims }
  | { ok: false; code: 'invalid-token' | 'expired-token' }

export interface VerifiedClaims {
  sub: string
  jti: string
  exp: number
  name: string | null
}

function b64urlBytes(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function decodeJson(part: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(new TextDecoder().decode(b64urlBytes(part)))
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Constant-time string comparison for nonce and similar values. */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

const B64URL_PART = /^[A-Za-z0-9_-]+$/

/**
 * Verify an Agentboxd ID token. Checks run before any claim is trusted: shape, header (ES256,
 * known kid, no crit), signature, then iss, aud, time, nonce, sub, jti and the agent claim.
 * Replay (jti already used) is checked by the caller against the shared store.
 */
export async function verifyIdToken(
  token: string,
  opts: { provider: AgentboxdProvider; audience: string; nonce: string; now: number },
): Promise<TokenCheck> {
  const bad = { ok: false, code: 'invalid-token' } as const
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) return bad
  const parts = token.split('.')
  if (parts.length !== 3 || !parts.every((p) => B64URL_PART.test(p))) return bad
  const header = decodeJson(parts[0])
  const claims = decodeJson(parts[1])
  if (!header || !claims) return bad
  if (header.alg !== 'ES256' || typeof header.kid !== 'string' || header.crit !== undefined) return bad
  if (header.typ !== undefined && header.typ !== 'JWT') return bad

  let key: CryptoKey | null
  try {
    key = await opts.provider.key(header.kid)
  } catch (err) {
    throw err instanceof ProviderError ? err : new ProviderError('unavailable')
  }
  if (!key) return bad
  let signature: Uint8Array<ArrayBuffer>
  try {
    signature = b64urlBytes(parts[2])
  } catch {
    return bad
  }
  if (signature.length !== 64) return bad // ES256 JWS signatures are raw r||s, 64 bytes
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signature, signed)
  if (!valid) return bad

  if (claims.iss !== opts.provider.issuer) return bad
  const aud = claims.aud
  if (!(aud === opts.audience || (Array.isArray(aud) && aud.length === 1 && aud[0] === opts.audience))) return bad

  const nowS = opts.now / 1000
  const { exp, iat, nbf } = claims
  if (typeof exp !== 'number' || typeof iat !== 'number' || !Number.isFinite(exp) || !Number.isFinite(iat)) return bad
  if (iat > nowS + CLOCK_TOLERANCE_S) return bad
  if (nbf !== undefined && (typeof nbf !== 'number' || nbf > nowS + CLOCK_TOLERANCE_S)) return bad
  if (exp - iat > MAX_LIFETIME_S || exp <= iat) return bad
  if (exp <= nowS - CLOCK_TOLERANCE_S) return { ok: false, code: 'expired-token' }

  if (typeof claims.nonce !== 'string' || !safeEqual(claims.nonce, opts.nonce)) return bad
  if (typeof claims.sub !== 'string' || claims.sub.length < 1 || claims.sub.length > 255) return bad
  if (typeof claims.jti !== 'string' || claims.jti.length < 1 || claims.jti.length > 255) return bad
  if (claims[AGENT_CLAIM] !== true) return bad
  if (claims.actor_type !== undefined && claims.actor_type !== 'agent') return bad

  const rawName = typeof claims.name === 'string' ? claims.name : typeof claims.preferred_username === 'string' ? claims.preferred_username : ''
  // Strip control characters; the UI renders it as text, never HTML.
  const printable = Array.from(rawName).filter((c) => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) !== 0x7f).join('')
  const name = printable.trim().slice(0, 80) || null
  return { ok: true, claims: { sub: claims.sub, jti: claims.jti, exp, name } }
}
