// Pure session rules. No React, so they run under `node --test`.

import { GUEST, type AuthState } from './types.ts'

/** Features that never need an account. The map and warnings stay public in every state. */
export const PUBLIC_FEATURES = ['map', 'alerts', 'forecasts', 'sources', 'search', 'voice'] as const
/** Features that need a verified account. */
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

/** Accept only well-formed states from an adapter; anything else becomes a guest with an error. */
export function sanitizeState(input: unknown): AuthState {
  if (!input || typeof input !== 'object') return { ...GUEST, error: 'invalid-state' }
  const s = input as Partial<AuthState>
  const statuses = ['loading', 'guest', 'signed-in', 'expired', 'error']
  if (!s.status || !statuses.includes(s.status)) return { ...GUEST, error: 'invalid-state' }
  if (s.status === 'signed-in') {
    const a = s.account
    const validAccount = a && typeof a.id === 'string' && a.id.length > 0 && a.provider === 'mojoauth'
    const validExpiry = s.expiresAt === null || (typeof s.expiresAt === 'number' && Number.isFinite(s.expiresAt))
    if (!validAccount || !validExpiry) return { ...GUEST, error: 'invalid-state' }
    const name = typeof a.displayName === 'string' ? a.displayName.trim().slice(0, 80) || null : null
    return { status: 'signed-in', account: { id: a.id, displayName: name, provider: 'mojoauth' }, expiresAt: s.expiresAt ?? null, error: null }
  }
  return { status: s.status, account: null, expiresAt: null, error: typeof s.error === 'string' ? s.error.slice(0, 40) : null }
}
