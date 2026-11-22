import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthValue } from '../hooks/useAuth.ts'
import {
  canUse,
  evaluateSession,
  GUEST,
  guestAdapter,
  sanitizeState,
  type AuthAdapter,
  type AuthState,
  type SignInCredential,
} from '../services/auth/session.ts'

/** Longest delay setTimeout accepts (about 24.8 days). */
const MAX_TIMEOUT_MS = 2 ** 31 - 1

/**
 * Optional sign-in state. Children always render whatever the auth state, so the map and
 * warnings never wait on a login provider. With no `adapter` the app is guest-only.
 */
export function AuthProvider({ children, adapter = guestAdapter }: { children: ReactNode; adapter?: AuthAdapter }) {
  const [state, setState] = useState<AuthState>(adapter.canSignIn ? { ...GUEST, status: 'loading' } : GUEST)

  useEffect(() => {
    let active = true
    adapter.restore()
      .then((s) => { if (active) setState(evaluateSession(sanitizeState(s))) })
      .catch(() => { if (active) setState({ ...GUEST, status: 'error', error: 'restore-failed' }) })
    return () => { active = false }
  }, [adapter])

  // One timer at the session's expiry time, so the status text changes to "expired" on time.
  // Access checks do not depend on it: canUse() compares against the clock on every call.
  useEffect(() => {
    if (state.status !== 'signed-in' || state.expiresAt === null) return
    const delay = Math.min(Math.max(state.expiresAt - Date.now(), 0), MAX_TIMEOUT_MS)
    const id = window.setTimeout(() => setState((s) => evaluateSession(s)), delay)
    return () => window.clearTimeout(id)
  }, [state.status, state.expiresAt])

  const signIn = useCallback(async (credential: SignInCredential) => {
    if (!adapter.canSignIn) return { ...GUEST, status: 'error', error: 'sign-in-disabled' } satisfies AuthState
    setState((s) => ({ ...s, status: 'loading', error: null }))
    let next: AuthState
    try {
      next = evaluateSession(sanitizeState(await adapter.signIn(credential)))
    } catch {
      next = { ...GUEST, status: 'error', error: 'sign-in-failed' }
    }
    setState(next)
    return next
  }, [adapter])

  const signOut = useCallback(async () => {
    try { await adapter.signOut() } finally { setState(GUEST) }
  }, [adapter])

  const value = useMemo<AuthValue>(() => ({
    state,
    canSignIn: adapter.canSignIn,
    signIn,
    signOut,
    canUse: (feature) => canUse(state, feature),
  }), [state, adapter.canSignIn, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
