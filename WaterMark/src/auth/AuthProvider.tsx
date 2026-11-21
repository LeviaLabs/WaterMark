import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthValue } from './context.ts'
import { guestAdapter } from './guestAdapter.ts'
import { canUse, evaluateSession, sanitizeState } from './session.ts'
import { GUEST, type AuthAdapter, type AuthState } from './types.ts'

interface Props {
  children: ReactNode
  /** Sign-in provider. Defaults to guest-only (no provider configured). */
  adapter?: AuthAdapter
}

const EXPIRY_CHECK_MS = 30_000

/**
 * Optional sign-in state. Children always render, whatever the auth state, so the map and
 * warnings never wait on or depend on a login provider.
 */
export function AuthProvider({ children, adapter = guestAdapter }: Props) {
  const [state, setState] = useState<AuthState>(adapter.canSignIn ? { ...GUEST, status: 'loading' } : GUEST)

  useEffect(() => {
    let active = true
    adapter.restore()
      .then((s) => { if (active) setState(evaluateSession(sanitizeState(s))) })
      .catch(() => { if (active) setState({ ...GUEST, status: 'error', error: 'restore-failed' }) })
    return () => { active = false }
  }, [adapter])

  useEffect(() => {
    if (state.status !== 'signed-in' || state.expiresAt === null) return
    const id = window.setInterval(() => setState((s) => evaluateSession(s)), EXPIRY_CHECK_MS)
    return () => window.clearInterval(id)
  }, [state.status, state.expiresAt])

  const signIn = useCallback(async () => {
    if (!adapter.canSignIn) return
    setState((s) => ({ ...s, status: 'loading', error: null }))
    try {
      setState(evaluateSession(sanitizeState(await adapter.signIn())))
    } catch {
      setState({ ...GUEST, status: 'error', error: 'sign-in-failed' })
    }
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
