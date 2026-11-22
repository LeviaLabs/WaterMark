import { createContext, useContext } from 'react'
import type { AuthState, Feature, SignInCredential } from '../services/auth/session.ts'

export interface AuthValue {
  state: AuthState
  canSignIn: boolean
  /** Finish sign-in with a MojoAuth token or an Agentboxd callback; resolves to the verified state. */
  signIn: (credential: SignInCredential) => Promise<AuthState>
  signOut: () => Promise<void>
  canUse: (feature: Feature) => boolean
}

/** Filled by <AuthProvider> in src/context. */
export const AuthContext = createContext<AuthValue | null>(null)

/** Sign-in state and access checks. Guest-only until a provider adapter is passed in. */
export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.')
  return value
}
