// Optional sign-in, guest first. No provider is connected: MojoAuth is not integrated and this
// file makes no network requests. It defines the session shape, the access rules, and the
// guest-only adapter the app uses today. A future MojoAuth adapter plugs into `AuthAdapter`.

export type AuthStatus = 'loading' | 'guest' | 'signed-in' | 'expired' | 'error'

export interface Account {
  /** Stable id returned by the backend after it verifies the provider token. */
  id: string
  displayName: string | null
  provider: 'mojoauth'
}

export interface AuthState {
  status: AuthStatus
  account: Account | null
  /** Epoch milliseconds when the session ends, if known. */
  expiresAt: number | null
  /** Short, user-safe error code. Never a token or a raw provider message. */
  error: string | null
}

export const GUEST: AuthState = { status: 'guest', account: null, expiresAt: null, error: null }

/**
 * A sign-in provider. A real MojoAuth adapter must send the MojoAuth token to a server-side
 * verification function (planned Supabase Edge Function) and return only the account fields
 * above. The browser never holds a provider secret or keeps the raw token.
 */
export interface AuthAdapter {
  /** False when no provider is configured; the UI then shows no sign-in button. */
  readonly canSignIn: boolean
  restore(): Promise<AuthState>
  signIn(): Promise<AuthState>
  signOut(): Promise<void>
}

/** What the app uses today: everyone is a guest, nothing is stored, nothing is fetched. */
export const guestAdapter: AuthAdapter = {
  canSignIn: false,
  restore: async () => GUEST,
  signIn: async () => ({ ...GUEST, status: 'error', error: 'sign-in-disabled' }),
  signOut: async () => {},
}

/** Features that never need an account. The map and warnings stay public in every state. */
export const PUBLIC_FEATURES = ['map', 'alerts', 'forecasts', 'sources', 'search', 'voice'] as const
/** Features that need a verified account (not built yet). */
export const ACCOUNT_FEATURES = ['savedPlaces', 'notificationPrefs'] as const

export type Feature = (typeof PUBLIC_FEATURES)[number] | (typeof ACCOUNT_FEATURES)[number]

/** Turn a signed-in state into 'expired' once its expiry time has passed. */
export function evaluateSession(state: AuthState, now: number = Date.now()): AuthState {
  if (state.status === 'signed-in' && state.expiresAt !== null && state.expiresAt <= now) {
    return { status: 'expired', account: null, expiresAt: null, error: null }
  }
  return state
}

export function canUse(state: AuthState, feature: Feature, now: number = Date.now()): boolean {
  if ((PUBLIC_FEATURES as readonly string[]).includes(feature)) return true
  const s = evaluateSession(state, now)
  return s.status === 'signed-in' && s.account !== null
}

const STATUSES: readonly string[] = ['loading', 'guest', 'signed-in', 'expired', 'error']

/** Accept only well-formed adapter output; anything else becomes a guest with an error. */
export function sanitizeState(input: unknown): AuthState {
  if (!input || typeof input !== 'object') return { ...GUEST, error: 'invalid-state' }
  const s = input as Partial<AuthState>
  if (!s.status || !STATUSES.includes(s.status)) return { ...GUEST, error: 'invalid-state' }
  if (s.status === 'signed-in') {
    const a = s.account
    const validAccount = a && typeof a.id === 'string' && a.id.length > 0 && a.provider === 'mojoauth'
    const validExpiry = s.expiresAt === null || (typeof s.expiresAt === 'number' && Number.isFinite(s.expiresAt))
    if (!validAccount || !validExpiry) return { ...GUEST, error: 'invalid-state' }
    const name = typeof a.displayName === 'string' ? a.displayName.trim().slice(0, 80) || null : null
    // Rebuild the object field by field so tokens or other extra fields never pass through.
    return { status: 'signed-in', account: { id: a.id, displayName: name, provider: 'mojoauth' }, expiresAt: s.expiresAt ?? null, error: null }
  }
  return { status: s.status, account: null, expiresAt: null, error: typeof s.error === 'string' ? s.error.slice(0, 40) : null }
}
