// Optional sign-in. Guests can use everything public; see session.ts for the access rules.

export type AuthStatus = 'loading' | 'guest' | 'signed-in' | 'expired' | 'error'

export interface Account {
  /** Stable id from the backend after token verification (Supabase user id). */
  id: string
  displayName: string | null
  provider: 'mojoauth'
}

export interface AuthState {
  status: AuthStatus
  account: Account | null
  /** Epoch milliseconds when the session ends, if known. */
  expiresAt: number | null
  /** Short, user-safe error code. Never a token or provider message with secrets. */
  error: string | null
}

export const GUEST: AuthState = { status: 'guest', account: null, expiresAt: null, error: null }

/**
 * A sign-in provider. The real MojoAuth adapter will verify tokens on the server
 * (Supabase Edge Function owned by Codex) and return only the account fields above.
 * The browser never stores a provider secret.
 */
export interface AuthAdapter {
  readonly name: string
  /** False when no provider is configured; the UI then shows no sign-in button. */
  readonly canSignIn: boolean
  restore(): Promise<AuthState>
  signIn(): Promise<AuthState>
  signOut(): Promise<void>
}
