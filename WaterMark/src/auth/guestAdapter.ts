import { GUEST, type AuthAdapter } from './types.ts'

/** Default adapter: no provider configured. Everyone is a guest; nothing is stored. */
export const guestAdapter: AuthAdapter = {
  name: 'guest',
  canSignIn: false,
  restore: async () => GUEST,
  signIn: async () => ({ ...GUEST, status: 'error', error: 'sign-in-disabled' }),
  signOut: async () => {},
}
