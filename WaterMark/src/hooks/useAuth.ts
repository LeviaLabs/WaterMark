import { createContext, useContext } from 'react'
import type { AuthState, Feature } from '../services/auth/session.ts'

export interface AuthValue {
  state: AuthState
  canSignIn: boolean
  /** Finish sign-in with a provider token; resolves to the verified state. */
  signIn: (providerToken: string) => Promise<AuthState>
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
