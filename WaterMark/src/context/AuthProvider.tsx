import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthValue } from '../hooks/useAuth.ts'
import {
  canUse,
  evaluateSession,
  GUEST,
  guestAdapter,
  sanitizeState,
  watchExpiry,
  type AuthAdapter,
  type AuthState,
  type SignInCredential,
} from '../services/auth/session.ts'

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

  // Flip to "expired" the moment the session ends: a timer, plus a clock check when the tab
  // becomes visible or regains focus (hidden tabs and sleeping laptops fire timers late).
  // Access checks do not depend on it: canUse() compares against the clock on every call.
  useEffect(() => {
    if (state.status !== 'signed-in' || state.expiresAt === null) return
    return watchExpiry(state.expiresAt, () => setState((s) => evaluateSession(s)), [window, document])
  }, [state.status, state.expiresAt])

  // An expired session leaves nothing behind: delete the stored token as soon as expiry is seen,
  // not on the next reload. The nav and pages already show the signed-out state from `state`.
  useEffect(() => {
    if (state.status === 'expired') adapter.signOut().catch(() => {})
  }, [state.status, adapter])

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
