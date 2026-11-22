// The app's one sign-in setup, read from the Vite env. App.tsx passes `authAdapter` to
// <AuthProvider>; AuthPage uses `mojoAuthConfig` to send and check email codes.
// Without both env values the app is guest-only (guestAdapter, no sign-in requests).
import { createMojoAuthAdapter, mojoAuthConfigFromEnv } from './mojoAuth'
import { guestAdapter } from './session'

export const mojoAuthConfig = mojoAuthConfigFromEnv(import.meta.env)
export const authAdapter = mojoAuthConfig ? createMojoAuthAdapter(mojoAuthConfig) : guestAdapter
