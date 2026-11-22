// Sign in with Agentboxd for AI agents (WM-CLAUDE-005), browser side.
// Authorization code + PKCE (S256) with a public client. The browser never sees a client
// secret (there is none) and never trusts a token itself: the Supabase Edge Function
// `agentboxd-auth` owns state and nonce, exchanges the code, verifies the ID token against
// Agentboxd's keys and returns WaterMark's own session. This file only:
//   1. makes the PKCE verifier and keeps it in this tab's sessionStorage,
//   2. sends the browser to the authorize URL the function built (after checking it),
//   3. reads the callback that public/agentboxd-callback.html saved and checks its state,
//   4. keeps the opaque WaterMark session token in sessionStorage (never localStorage).
// Config: VITE_AGENTBOXD_AUTH_URL = <SUPABASE_URL>/functions/v1/agentboxd-auth (public value).
import { GUEST, sanitizeState, type AgentboxdCallbackCredential, type AuthAdapter, type AuthState, type SignInCredential } from './session.ts'

export const AGENTBOXD_AUTHORIZE_URL = 'https://id.agentboxd.com/authorize'
export const AGENTBOXD_ISSUER = 'https://id.agentboxd.com'
/** Written by public/agentboxd-callback.html: the raw callback query string. */
export const CALLBACK_STORAGE_KEY = 'wm-agentboxd-callback'
const ATTEMPT_STORAGE_KEY = 'wm-agentboxd-attempt'
export const AGENT_SESSION_STORAGE_KEY = 'wm-agentboxd-session'
/** Matches the server's attempt lifetime; Agentboxd codes themselves live 60 seconds. */
const ATTEMPT_MAX_AGE_MS = 10 * 60 * 1000
const TIMEOUT_MS = 10_000
const B64URL_43 = /^[A-Za-z0-9_-]{43}$/

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface AgentboxdConfig {
  /** Base URL of the agentboxd-auth Edge Function. */
  authUrl: string
  fetcher?: Fetcher
  storage?: StorageLike | null
}

/** User-facing error keys; AuthPage maps them to text. Never a token or provider message. */
export type AgentboxdErrorCode =
  | 'cancelled'
  | 'state-mismatch'
  | 'expired-attempt'
  | 'provider-error'
  | 'rate-limited'
  | 'network'
  | 'verify-failed'
  | 'misconfigured'

export class AgentboxdError extends Error {
  readonly code: AgentboxdErrorCode
  constructor(code: AgentboxdErrorCode) {
    super(code)
    this.name = 'AgentboxdError'
    this.code = code
  }
}

function storageOf(config: AgentboxdConfig): StorageLike | null {
  if (config.storage !== undefined) return config.storage
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}
const get = (s: StorageLike | null, k: string) => { try { return s?.getItem(k) ?? null } catch { return null } }
const set = (s: StorageLike | null, k: string, v: string) => { try { s?.setItem(k, v) } catch { /* private mode */ } }
const del = (s: StorageLike | null, k: string) => { try { s?.removeItem(k) } catch { /* private mode */ } }

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** RFC 7636 S256: 32 random bytes as the verifier, base64url(SHA-256(verifier)) as the challenge. */
export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: base64url(new Uint8Array(digest)) }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function post(config: AgentboxdConfig, route: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  let res: Response
  try {
    res = await (config.fetcher ?? fetch)(`${config.authUrl.replace(/\/+$/, '')}/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'error',
      credentials: 'omit',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new AgentboxdError('network')
  }
  let parsed: unknown = null
  try {
    parsed = await res.json()
  } catch { /* checked by callers */ }
  return { status: res.status, body: parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {} }
}

/**
 * Step 1: ask the function for an authorize URL bound to a fresh PKCE challenge, check it really
 * points at Agentboxd with our state and challenge, remember the verifier, then leave the page.
 */
export async function startAgentboxdSignIn(config: AgentboxdConfig, go: (url: string) => void = (url) => window.location.assign(url)): Promise<void> {
  const storage = storageOf(config)
  const { verifier, challenge } = await createPkce()
  const { status, body } = await post(config, 'start', { codeChallenge: challenge })
  if (status === 429) throw new AgentboxdError('rate-limited')
  if (status === 503 && body.error === 'not-configured') throw new AgentboxdError('misconfigured')
  if (status !== 200) throw new AgentboxdError('network')
  const state = typeof body.state === 'string' && B64URL_43.test(body.state) ? body.state : null
  let url: URL
  try {
    url = new URL(String(body.authorizeUrl))
  } catch {
    throw new AgentboxdError('provider-error')
  }
  // Never follow a redirect the backend did not build for this attempt (no open redirect).
  if (
    !state ||
    `${url.origin}${url.pathname}` !== AGENTBOXD_AUTHORIZE_URL ||
    url.searchParams.get('state') !== state ||
    url.searchParams.get('code_challenge') !== challenge ||
    url.searchParams.get('code_challenge_method') !== 'S256'
  ) {
    throw new AgentboxdError('provider-error')
  }
  set(storage, ATTEMPT_STORAGE_KEY, JSON.stringify({ state, verifier, createdAt: Date.now() }))
  del(storage, CALLBACK_STORAGE_KEY)
  go(url.href)
}

export type AgentboxdCallback =
  | { ok: true; credential: AgentboxdCallbackCredential }
  | { ok: false; code: AgentboxdErrorCode }

function parseAttempt(raw: string | null): { state?: unknown; verifier?: unknown; createdAt?: unknown } | null {
  try {
    const v: unknown = raw ? JSON.parse(raw) : null
    return v && typeof v === 'object' ? v : null
  } catch {
    return null
  }
}

/** Delete the saved callback and attempt, so a callback is used at most once. */
export function clearAgentboxdCallback(storage: StorageLike | null): void {
  del(storage, CALLBACK_STORAGE_KEY)
  del(storage, ATTEMPT_STORAGE_KEY)
}

/** Read and delete the callback: see readAgentboxdCallback. */
export function takeAgentboxdCallback(storage: StorageLike | null, now: number = Date.now()): AgentboxdCallback | null {
  const result = readAgentboxdCallback(storage, now)
  if (result) clearAgentboxdCallback(storage)
  return result
}

/**
 * Step 2, on /login: check the callback saved by public/agentboxd-callback.html against the
 * attempt saved in step 1, without changing storage (pair it with clearAgentboxdCallback).
 * Null when there is no callback. The state must match this tab's attempt, so a callback
 * started elsewhere (login CSRF) is refused before any network call.
 */
export function readAgentboxdCallback(storage: StorageLike | null, now: number = Date.now()): AgentboxdCallback | null {
  const raw = get(storage, CALLBACK_STORAGE_KEY)
  if (raw === null) return null
  const params = new URLSearchParams(raw.slice(0, 4096))
  const error = params.get('error')
  if (error) return { ok: false, code: error === 'access_denied' ? 'cancelled' : 'provider-error' }

  const attempt = parseAttempt(get(storage, ATTEMPT_STORAGE_KEY))
  if (
    !attempt || typeof attempt.state !== 'string' || typeof attempt.verifier !== 'string' ||
    typeof attempt.createdAt !== 'number' || now - attempt.createdAt > ATTEMPT_MAX_AGE_MS || now < attempt.createdAt
  ) {
    return { ok: false, code: 'expired-attempt' }
  }
  const state = params.get('state')
  if (!state || !safeEqual(state, attempt.state)) return { ok: false, code: 'state-mismatch' }
  const iss = params.get('iss')
  if (iss !== null && iss !== AGENTBOXD_ISSUER) return { ok: false, code: 'provider-error' }
  const code = params.get('code')
  if (!code) return { ok: false, code: 'provider-error' }
  return { ok: true, credential: { kind: 'agentboxd', state, code, codeVerifier: attempt.verifier, iss } }
}

function signedIn(body: Record<string, unknown>): AuthState {
  const a = (body.account ?? {}) as Record<string, unknown>
  if (typeof a.id !== 'string' || !a.id.startsWith('agentboxd:')) return { ...GUEST, status: 'error', error: 'verify-failed' }
  return sanitizeState({
    status: 'signed-in',
    account: { id: a.id, displayName: typeof a.displayName === 'string' ? a.displayName : null, provider: 'agentboxd' },
    expiresAt: typeof a.expiresAt === 'number' ? a.expiresAt : null,
    error: null,
  })
}

/** Server error codes that are safe to show as-is; anything else becomes 'verify-failed'. */
const FINISH_ERRORS: Record<string, AgentboxdErrorCode> = {
  'invalid-state': 'expired-attempt',
  'invalid-grant': 'expired-attempt',
  'rate-limited': 'rate-limited',
  'not-configured': 'misconfigured',
  'provider-unavailable': 'network',
  'store-unavailable': 'network',
}

/** AuthAdapter for agent identities. One WaterMark session per tab, re-checked on reload. */
export function createAgentboxdAdapter(config: AgentboxdConfig): AuthAdapter {
  const storage = storageOf(config)
  return {
    canSignIn: true,
    async restore() {
      const session = get(storage, AGENT_SESSION_STORAGE_KEY)
      if (!session) return GUEST
      try {
        const { status, body } = await post(config, 'session', { session })
        if (status === 200) return signedIn(body)
        if (status === 401 || status === 400) {
          del(storage, AGENT_SESSION_STORAGE_KEY)
          return GUEST
        }
        return GUEST // keep the session; the backend may just be unreachable right now
      } catch {
        return GUEST
      }
    },
    async signIn(credential: SignInCredential) {
      if (typeof credential === 'string' || credential.kind !== 'agentboxd') return { ...GUEST, status: 'error', error: 'verify-failed' }
      let result: { status: number; body: Record<string, unknown> }
      try {
        result = await post(config, 'finish', {
          state: credential.state,
          code: credential.code,
          codeVerifier: credential.codeVerifier,
          iss: credential.iss,
        })
      } catch {
        return { ...GUEST, status: 'error', error: 'network' }
      }
      const { status, body } = result
      if (status === 200 && typeof body.session === 'string' && B64URL_43.test(body.session)) {
        const state = signedIn(body)
        if (state.status === 'signed-in') set(storage, AGENT_SESSION_STORAGE_KEY, body.session)
        return state
      }
      const code = typeof body.error === 'string' ? FINISH_ERRORS[body.error] : undefined
      return { ...GUEST, status: 'error', error: code ?? 'verify-failed' }
    },
    async signOut() {
      const session = get(storage, AGENT_SESSION_STORAGE_KEY)
      del(storage, AGENT_SESSION_STORAGE_KEY)
      if (session) await post(config, 'logout', { session }).catch(() => {})
    },
  }
}

const LOCAL_HOST = /^(localhost|.+\.localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1?\])$/i

/**
 * Reads the Vite env. Null (no Agentboxd button action) unless VITE_AGENTBOXD_AUTH_URL is set.
 * A production build accepts only an HTTPS URL that is not on this machine.
 */
export function agentboxdConfigFromEnv(env: Record<string, unknown>): AgentboxdConfig | null {
  const raw = typeof env.VITE_AGENTBOXD_AUTH_URL === 'string' ? env.VITE_AGENTBOXD_AUTH_URL.trim() : ''
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.search || url.hash || url.username || url.password) return null
  if (env.PROD === true && (url.protocol !== 'https:' || LOCAL_HOST.test(url.hostname))) return null
  return { authUrl: url.href.replace(/\/+$/, '') }
}
