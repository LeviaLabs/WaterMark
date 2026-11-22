// The app's one sign-in setup, read from the Vite env. App.tsx passes `authAdapter` to
// <AuthProvider>; AuthPage uses `mojoAuthConfig` to send and check email codes, and
// `agentboxdConfig` to start Sign in with Agentboxd.
// Without any env values the app is guest-only (guestAdapter, no sign-in requests).
import { agentboxdConfigFromEnv, createAgentboxdAdapter } from './agentboxd'
import { createMojoAuthAdapter, mojoAuthConfigFromEnv } from './mojoAuth'
import { combineAdapters, guestAdapter } from './session'

export const mojoAuthConfig = mojoAuthConfigFromEnv(import.meta.env)
export const agentboxdConfig = agentboxdConfigFromEnv(import.meta.env)

const human = mojoAuthConfig ? createMojoAuthAdapter(mojoAuthConfig) : null
const agent = agentboxdConfig ? createAgentboxdAdapter(agentboxdConfig) : null

/** People sign in with MojoAuth, AI agents with Agentboxd; with neither configured, guest-only. */
export const authAdapter = human || agent ? combineAdapters(human, agent) : guestAdapter
