import { createContext } from 'react'
import type { Feature } from './session.ts'
import type { AuthState } from './types.ts'

export interface AuthValue {
  state: AuthState
  canSignIn: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  canUse: (feature: Feature) => boolean
}

export const AuthContext = createContext<AuthValue | null>(null)
