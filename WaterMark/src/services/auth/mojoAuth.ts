// MojoAuth email one-time code sign-in (WM-CLAUDE-002).
//
// Browser calls, from MojoAuth's OpenAPI spec (https://mojoauth.com/docs/api/mojoauthapi.yaml):
//   POST https://api.mojoauth.com/users/emailotp         { email }          -> { state_id }
//   POST https://api.mojoauth.com/users/emailotp/verify  OTP, state_id      -> { oauth.access_token }
//   POST https://api.mojoauth.com/users/emailotp/resend  { state_id }       -> { state_id }
// They use the project's public MojoAuth API key (VITE_MOJOAUTH_API_KEY), the same key MojoAuth's
// own browser SDK puts in the page. No API secret is used anywhere.
//
// The access token is then checked by our Supabase Edge Function `auth-verify`
// (VITE_WATERMARK_AUTH_VERIFY_URL). Only after that does the app treat the user as signed in.

import type { LocaleCode } from '../../scripting/localization/localize.ts'
import { GUEST, sanitizeState, type AuthAdapter, type AuthState } from './session.ts'

const MOJOAUTH_API = 'https://api.mojoauth.com'
const TIMEOUT_MS = 10_000
/** sessionStorage: cleared when the tab closes, never shared with other tabs or sites. */
export const SESSION_STORAGE_KEY = 'wm-auth'

export interface MojoAuthConfig {
  apiKey: string
  verifyUrl: string
  fetcher?: typeof fetch
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
}

/** Short, user-safe error codes. The UI maps each one to a translated message. */
export type MojoAuthErrorCode =
  | 'invalid-email'
  | 'invalid-code'
  | 'rate-limited'
  | 'network'
  | 'verify-failed'
  | 'misconfigured'

/** MojoAuth error codes (HTTP 400 body `code`) for a missing or invalid API key. */
const API_KEY_ERRORS = new Set([904, 905])

export class MojoAuthError extends Error {
  readonly code: MojoAuthErrorCode
  constructor(code: MojoAuthErrorCode) {
    super(code)
    this.code = code
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isEmail = (value: string) => value.length <= 254 && EMAIL.test(value)
/** MojoAuth sends six digits; accept 4 to 10 to stay safe if the dashboard length changes. */
export const isOtp = (value: string) => /^\d{4,10}$/.test(value)

/** MojoAuth `language` for the email. Unverified codes fall back to English on MojoAuth's side. */
const MOJOAUTH_LANGUAGE: Record<LocaleCode, string> = { en: 'en', es: 'es', 'zh-Hans': 'zh', ru: 'ru', hi: 'hi' }

async function call(
  config: MojoAuthConfig,
  url: string,
  init: RequestInit,
  badRequest: MojoAuthErrorCode,
): Promise<Record<string, unknown>> {
  const fetcher = config.fetcher ?? fetch
  let response: Response
  try {
    response = await fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new MojoAuthError('network')
  }
  if (response.status === 429) throw new MojoAuthError('rate-limited')
  if (response.status >= 500) throw new MojoAuthError('network')
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { code?: unknown } | null
    throw new MojoAuthError(API_KEY_ERRORS.has(Number(body?.code)) ? 'misconfigured' : badRequest)
  }
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object') return body as Record<string, unknown>
  } catch {
    // fall through
  }
  throw new MojoAuthError('network')
}

function stateId(body: Record<string, unknown>): string {
  if (typeof body.state_id === 'string' && body.state_id.length > 0 && body.state_id.length < 512) return body.state_id
  throw new MojoAuthError('network')
}

/** Step 1: email the user a one-time code. Returns MojoAuth's state id for step 2. */
export async function sendEmailCode(config: MojoAuthConfig, email: string, locale: LocaleCode): Promise<string> {
  const clean = email.trim()
  if (!isEmail(clean)) throw new MojoAuthError('invalid-email')
  const url = `${MOJOAUTH_API}/users/emailotp?language=${encodeURIComponent(MOJOAUTH_LANGUAGE[locale])}`
  const body = await call(config, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
    body: JSON.stringify({ email: clean }),
  }, 'invalid-email')
  return stateId(body)
}

export async function resendEmailCode(config: MojoAuthConfig, state: string, locale: LocaleCode): Promise<string> {
  const url = `${MOJOAUTH_API}/users/emailotp/resend?language=${encodeURIComponent(MOJOAUTH_LANGUAGE[locale])}`
  const body = await call(config, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
    body: JSON.stringify({ state_id: state }),
  }, 'invalid-code')
  return stateId(body)
}

/** Step 2: exchange the code for a MojoAuth access token. The token is not trusted yet. */
export async function verifyEmailCode(config: MojoAuthConfig, state: string, code: string): Promise<string> {
  const clean = code.trim()
  if (!isOtp(clean)) throw new MojoAuthError('invalid-code')
  const body = await call(config, `${MOJOAUTH_API}/users/emailotp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-api-key': config.apiKey },
    body: new URLSearchParams({ OTP: clean, state_id: state }).toString(),
  }, 'invalid-code')
  const oauth = body.oauth as Record<string, unknown> | undefined
  const token = oauth && typeof oauth.access_token === 'string' ? oauth.access_token : null
  if (body.authenticated !== true || !token) throw new MojoAuthError('invalid-code')
  return token
}

/** Step 3: our Edge Function verifies the token with MojoAuth and returns the account. */
export async function verifyWithBackend(config: MojoAuthConfig, token: string): Promise<AuthState> {
  const fetcher = config.fetcher ?? fetch
  let response: Response
  try {
    response = await fetcher(config.verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new MojoAuthError('network')
  }
  if (response.status === 401) return { ...GUEST, status: 'expired' }
  if (!response.ok) throw new MojoAuthError('verify-failed')
  const body = (await response.json().catch(() => null)) as { account?: Record<string, unknown> } | null
  const account = body?.account
  return sanitizeState({
    status: 'signed-in',
    account: account && { id: account.id, displayName: account.displayName ?? null, provider: 'mojoauth' },
    expiresAt: account?.expiresAt,
  })
}

/**
 * AuthAdapter backed by MojoAuth + auth-verify. Keeps the verified token in sessionStorage so a
 * reload stays signed in until the tab closes or the token expires. Nothing goes in localStorage.
 */
export function createMojoAuthAdapter(config: MojoAuthConfig): AuthAdapter {
  const storage = config.storage === undefined ? safeSessionStorage() : config.storage
  const read = () => { try { return storage?.getItem(SESSION_STORAGE_KEY) ?? null } catch { return null } }
  const write = (v: string) => { try { storage?.setItem(SESSION_STORAGE_KEY, v) } catch { /* private mode */ } }
  const clear = () => { try { storage?.removeItem(SESSION_STORAGE_KEY) } catch { /* private mode */ } }

  return {
    canSignIn: true,
    async restore() {
      const token = read()
      if (!token) return GUEST
      try {
        const state = await verifyWithBackend(config, token)
        if (state.status !== 'signed-in') clear()
        return state.status === 'expired' ? GUEST : state
      } catch {
        return GUEST // keep the token; the backend may just be unreachable right now
      }
    },
    async signIn(token: string) {
      const state = await verifyWithBackend(config, token)
      if (state.status === 'signed-in') write(token)
      else clear()
      return state
    },
    async signOut() {
      clear()
    },
  }
}

function safeSessionStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

const LOCAL_HOST = /^(localhost|.+\.localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1?\])$/i

/**
 * Reads the Vite env. Returns null (guest-only) unless both values are set. A production build
 * (`PROD`) accepts only an HTTPS verify URL that is not on this machine, so a deployed site can
 * never depend on a developer's localhost function.
 */
export function mojoAuthConfigFromEnv(env: Record<string, unknown>): MojoAuthConfig | null {
  const read = (name: string) => (typeof env[name] === 'string' ? (env[name] as string).trim() : '')
  const apiKey = read('VITE_MOJOAUTH_API_KEY')
  const verifyUrl = read('VITE_WATERMARK_AUTH_VERIFY_URL')
  if (!apiKey || !verifyUrl) return null
  let url: URL
  try {
    url = new URL(verifyUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (env.PROD === true && (url.protocol !== 'https:' || LOCAL_HOST.test(url.hostname))) return null
  return { apiKey, verifyUrl }
}
