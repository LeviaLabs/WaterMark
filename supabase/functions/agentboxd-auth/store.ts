// Shared state for agentboxd-auth (WM-CLAUDE-005), backed by Postgres RPCs from
// supabase/migrations/20261122150000_agentboxd_auth.sql. Every Edge Function instance uses the
// same rows, so attempt single use and jti replay rejection hold across instances. The RPCs
// are service_role only; the browser never talks to them.
import { readBounded } from './limits.ts'

export interface AttemptInput {
  state: string
  nonce: string
  codeChallenge: string
  redirectUri: string
  clientKey: string
}
export interface AttemptRecord {
  nonce: string
  codeChallenge: string
  redirectUri: string
}
export interface SessionRecord {
  subject: string
  displayName: string | null
  expiresAt: number
}

export interface AuthStore {
  /** False when the client is over its per-minute limit; nothing is stored then. */
  begin(attempt: AttemptInput, ttlSeconds: number, perMinute: number): Promise<boolean>
  /** Atomically consume and return a live attempt. Unknown, used or expired: null. */
  takeAttempt(state: string): Promise<AttemptRecord | null>
  /** True the first time a jti is seen, false for a replay. */
  consumeJti(jti: string, expiresAtMs: number): Promise<boolean>
  createSession(tokenHash: string, subject: string, displayName: string | null, expiresAtMs: number): Promise<void>
  getSession(tokenHash: string): Promise<SessionRecord | null>
  endSession(tokenHash: string): Promise<void>
}

export class StoreError extends Error {}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

/** Store over PostgREST RPC with the server credential (same pattern as watermark-v1). */
export function createRpcStore(baseUrl: string, key: string, fetcher: Fetcher = (i, init) => fetch(i, init), timeoutMs = 4000): AuthStore {
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' }
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`
  async function rpc(name: string, body: Record<string, unknown>): Promise<unknown> {
    const deadline = Date.now() + timeoutMs
    let res: Response
    try {
      res = await fetcher(`${baseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
      throw new StoreError('unavailable')
    }
    if (!res.ok) {
      void res.body?.cancel().catch(() => {})
      throw new StoreError('rejected') // body may describe the schema; never surfaced
    }
    const text = await readBounded(res, 16384, Math.max(1, deadline - Date.now()))
    if (text === null) throw new StoreError('invalid')
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      throw new StoreError('invalid')
    }
  }
  const iso = (ms: number) => new Date(ms).toISOString()
  return {
    async begin(a, ttlSeconds, perMinute) {
      const ok = await rpc('watermark_agentboxd_begin', {
        p_state: a.state,
        p_nonce: a.nonce,
        p_code_challenge: a.codeChallenge,
        p_redirect_uri: a.redirectUri,
        p_client_key: a.clientKey,
        p_ttl_seconds: ttlSeconds,
        p_per_minute: perMinute,
      })
      if (typeof ok !== 'boolean') throw new StoreError('invalid')
      return ok
    },
    async takeAttempt(state) {
      const row = await rpc('watermark_agentboxd_take_attempt', { p_state: state })
      if (row === null) return null
      const r = row as Record<string, unknown>
      if (typeof r.nonce !== 'string' || typeof r.code_challenge !== 'string' || typeof r.redirect_uri !== 'string') {
        throw new StoreError('invalid')
      }
      return { nonce: r.nonce, codeChallenge: r.code_challenge, redirectUri: r.redirect_uri }
    },
    async consumeJti(jti, expiresAtMs) {
      const ok = await rpc('watermark_agentboxd_consume_jti', { p_jti: jti, p_expires_at: iso(expiresAtMs) })
      if (typeof ok !== 'boolean') throw new StoreError('invalid')
      return ok
    },
    async createSession(tokenHash, subject, displayName, expiresAtMs) {
      await rpc('watermark_agentboxd_create_session', {
        p_token_hash: tokenHash,
        p_subject: subject,
        p_display_name: displayName,
        p_expires_at: iso(expiresAtMs),
      })
    },
    async getSession(tokenHash) {
      const row = await rpc('watermark_agentboxd_get_session', { p_token_hash: tokenHash })
      if (row === null) return null
      const r = row as Record<string, unknown>
      if (typeof r.subject !== 'string' || typeof r.expires_at !== 'number') throw new StoreError('invalid')
      return { subject: r.subject, displayName: typeof r.display_name === 'string' ? r.display_name : null, expiresAt: r.expires_at }
    },
    async endSession(tokenHash) {
      await rpc('watermark_agentboxd_end_session', { p_token_hash: tokenHash })
    },
  }
}
