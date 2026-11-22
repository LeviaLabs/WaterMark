// Optional sign-in, guest first. This file makes no network requests. It defines the session
// shape, the access rules, the guest-only adapter and the adapter that combines providers.
// The adapters that do make requests live in ./mojoAuth.ts (people, email code) and
// ./agentboxd.ts (AI agents, Sign in with Agentboxd) and plug into `AuthAdapter`.

export type AuthStatus = 'loading' | 'guest' | 'signed-in' | 'expired' | 'error'

/** 'mojoauth' is a person (email code); 'agentboxd' is an AI agent identity. */
export type AuthProviderId = 'mojoauth' | 'agentboxd'
const PROVIDERS: readonly string[] = ['mojoauth', 'agentboxd']

export interface Account {
  /** Stable id returned by the backend after it verifies the provider token. */
  id: string
  displayName: string | null
  provider: AuthProviderId
}

/** Agentboxd sessions are AI agents, never people. They get no extra access for it. */
export function isAgentAccount(account: Account | null | undefined): boolean {
  return account?.provider === 'agentboxd'
}

/** What the Agentboxd callback hands to `signIn`: the code plus this tab's PKCE verifier. */
export interface AgentboxdCallbackCredential {
  kind: 'agentboxd'
  state: string
  code: string
  codeVerifier: string
  iss: string | null
}

/** A MojoAuth access token (string) or an Agentboxd callback. */
export type SignInCredential = string | AgentboxdCallbackCredential

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
 * A sign-in provider. `signIn` receives the provider token from the login page, must have it
 * verified server-side (Supabase Edge Function `auth-verify`), and returns only the account
 * fields above. The browser never holds a provider secret.
 */
export interface AuthAdapter {
  /** False when no provider is configured; the UI then shows no sign-in button. */
  readonly canSignIn: boolean
  restore(): Promise<AuthState>
  signIn(credential: SignInCredential): Promise<AuthState>
  signOut(): Promise<void>
}

/**
 * One adapter over the configured providers. Only one identity is signed in at a time:
 * signing in with one provider signs the other out, and sign-out clears both.
 */
export function combineAdapters(human: AuthAdapter | null, agent: AuthAdapter | null): AuthAdapter {
  return {
    canSignIn: Boolean(human?.canSignIn || agent?.canSignIn),
    async restore() {
      if (agent) {
        const s = await agent.restore()
        if (s.status !== 'guest') return s
      }
      return human ? human.restore() : GUEST
    },
    async signIn(credential) {
      const [target, other] = typeof credential === 'string' ? [human, agent] : [agent, human]
      if (!target) return { ...GUEST, status: 'error', error: 'sign-in-disabled' }
      await other?.signOut().catch(() => {})
      return target.signIn(credential)
    },
    async signOut() {
      await Promise.allSettled([human?.signOut(), agent?.signOut()])
    },
  }
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
  // Minimum access for agents: a verified Agentboxd identity proves who the agent is, nothing
  // more. Account features (personal data such as saved places) stay for people.
  return s.status === 'signed-in' && s.account !== null && !isAgentAccount(s.account)
}

const STATUSES: readonly string[] = ['loading', 'guest', 'signed-in', 'expired', 'error']

/** Accept only well-formed adapter output; anything else becomes a guest with an error. */
export function sanitizeState(input: unknown): AuthState {
  if (!input || typeof input !== 'object') return { ...GUEST, error: 'invalid-state' }
  const s = input as Partial<AuthState>
  if (!s.status || !STATUSES.includes(s.status)) return { ...GUEST, error: 'invalid-state' }
  if (s.status === 'signed-in') {
    const a = s.account
    const validAccount = a && typeof a.id === 'string' && a.id.length > 0 && PROVIDERS.includes(a.provider)
    const validExpiry = s.expiresAt === null || (typeof s.expiresAt === 'number' && Number.isFinite(s.expiresAt))
    if (!validAccount || !validExpiry) return { ...GUEST, error: 'invalid-state' }
    const name = typeof a.displayName === 'string' ? a.displayName.trim().slice(0, 80) || null : null
    // Rebuild the object field by field so tokens or other extra fields never pass through.
    return { status: 'signed-in', account: { id: a.id, displayName: name, provider: a.provider }, expiresAt: s.expiresAt ?? null, error: null }
  }
  return { status: s.status, account: null, expiresAt: null, error: typeof s.error === 'string' ? s.error.slice(0, 40) : null }
}
