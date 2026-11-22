// Sign in with Agentboxd, browser side (WM-CLAUDE-005). Fake fetch and storage only: no network.
// The server-side checks (signature, iss, aud, exp, nonce, replay) are tested in
// supabase/tests/agentboxd-auth/flow.test.ts.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  AGENT_SESSION_STORAGE_KEY,
  AgentboxdError,
  agentboxdConfigFromEnv,
  CALLBACK_STORAGE_KEY,
  createAgentboxdAdapter,
  createPkce,
  startAgentboxdSignIn,
  takeAgentboxdCallback,
  type AgentboxdConfig,
} from '../src/services/auth/agentboxd.ts'
import { createMojoAuthAdapter } from '../src/services/auth/mojoAuth.ts'
import {
  canUse,
  combineAdapters,
  GUEST,
  isAgentAccount,
  sanitizeState,
  type AgentboxdCallbackCredential,
  type AuthAdapter,
  type AuthState,
} from '../src/services/auth/session.ts'

const FN = 'https://ref.supabase.co/functions/v1/agentboxd-auth'
const STATE = 'S'.repeat(43)
const SESSION = 'T'.repeat(43)
const ACCOUNT = { id: 'agentboxd:pairwise-1', displayName: 'Research agent', kind: 'agent', expiresAt: Date.now() + 3_600_000 }

type Call = { url: string; body: Record<string, unknown> }
function fake(responses: Array<[number, unknown] | Error>, calls: Call[] = []): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : {} })
    const next = responses.shift() ?? [500, {}]
    if (next instanceof Error) throw next
    return new Response(JSON.stringify(next[1]), { status: next[0] })
  }) as typeof fetch
}
function memoryStorage() {
  const map = new Map<string, string>()
  return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) }
}
const cfg = (responses: Array<[number, unknown] | Error>, calls: Call[] = [], storage = memoryStorage()): AgentboxdConfig & { storage: ReturnType<typeof memoryStorage> } =>
  ({ authUrl: FN, fetcher: fake(responses, calls), storage })

function authorizeUrl(state: string, challenge: string, base = 'https://id.agentboxd.com/authorize') {
  const u = new URL(base)
  u.search = new URLSearchParams({ response_type: 'code', client_id: 'abxc_x', state, nonce: 'n'.repeat(43), code_challenge: challenge, code_challenge_method: 'S256' }).toString()
  return u.href
}
/** A fetcher for /start that echoes the challenge it was sent into the authorize URL. */
function startFetcher(calls: Call[], build: (challenge: string) => string = (c) => authorizeUrl(STATE, c), status = 200): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    calls.push({ url: String(url), body })
    return new Response(JSON.stringify({ authorizeUrl: build(body.codeChallenge), state: STATE }), { status })
  }) as typeof fetch
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

test('PKCE: 43-character verifier and its S256 challenge', async () => {
  const { verifier, challenge } = await createPkce()
  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  assert.equal(challenge, b64url(digest))
  assert.notEqual((await createPkce()).verifier, verifier)
})

test('start: sends only the challenge, checks the authorize URL, remembers the verifier, then redirects', async () => {
  const calls: Call[] = []
  const storage = memoryStorage()
  storage.setItem(CALLBACK_STORAGE_KEY, 'stale')
  let went = ''
  await startAgentboxdSignIn({ authUrl: FN, fetcher: startFetcher(calls), storage }, (url) => { went = url })
  assert.equal(calls[0].url, `${FN}/start`)
  assert.deepEqual(Object.keys(calls[0].body), ['codeChallenge'])
  const target = new URL(went)
  assert.equal(target.origin + target.pathname, 'https://id.agentboxd.com/authorize')
  const attempt = JSON.parse(storage.getItem('wm-agentboxd-attempt')!)
  assert.equal(attempt.state, STATE)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(attempt.verifier)))
  assert.equal(target.searchParams.get('code_challenge'), b64url(digest))
  assert.equal(storage.getItem(CALLBACK_STORAGE_KEY), null)
})

test('start: refuses to follow an authorize URL that is not Agentboxd or not this attempt (no open redirect)', async () => {
  for (const build of [
    (c: string) => authorizeUrl(STATE, c, 'https://evil.example/authorize'),
    (c: string) => authorizeUrl(STATE, c, 'https://id.agentboxd.com.evil.example/authorize'),
    (c: string) => authorizeUrl('X'.repeat(43), c),
    () => authorizeUrl(STATE, 'wrong-challenge'),
    () => 'javascript:alert(1)',
  ]) {
    const storage = memoryStorage()
    let went = ''
    await assert.rejects(
      startAgentboxdSignIn({ authUrl: FN, fetcher: startFetcher([], build), storage }, (url) => { went = url }),
      (e: unknown) => e instanceof AgentboxdError && e.code === 'provider-error',
    )
    assert.equal(went, '')
    assert.equal(storage.getItem('wm-agentboxd-attempt'), null)
  }
})

test('start: rate limit, not configured and outage map to user-safe codes', async () => {
  const codeOf = async (responses: Array<[number, unknown] | Error>) => {
    try {
      await startAgentboxdSignIn(cfg(responses), () => {})
      return 'none'
    } catch (e) {
      return e instanceof AgentboxdError ? e.code : 'other'
    }
  }
  assert.equal(await codeOf([[429, { error: 'rate-limited' }]]), 'rate-limited')
  assert.equal(await codeOf([[503, { error: 'not-configured' }]]), 'misconfigured')
  assert.equal(await codeOf([[503, { error: 'provider-unavailable' }]]), 'network')
  assert.equal(await codeOf([new TypeError('offline')]), 'network')
})

function withAttempt(query: string, attempt: unknown = { state: STATE, verifier: 'v'.repeat(43), createdAt: 1_000 }) {
  const storage = memoryStorage()
  storage.setItem(CALLBACK_STORAGE_KEY, query)
  if (attempt) storage.setItem('wm-agentboxd-attempt', JSON.stringify(attempt))
  return storage
}

test('callback: valid code and matching state become a credential; both entries are deleted (single use)', () => {
  const storage = withAttempt(`code=abc123&state=${STATE}&iss=${encodeURIComponent('https://id.agentboxd.com')}`)
  const result = takeAgentboxdCallback(storage, 2_000)
  assert.deepEqual(result, { ok: true, credential: { kind: 'agentboxd', state: STATE, code: 'abc123', codeVerifier: 'v'.repeat(43), iss: 'https://id.agentboxd.com' } })
  assert.equal(storage.map.size, 0)
  assert.equal(takeAgentboxdCallback(storage, 2_000), null)
})

test('callback: cancelled, provider error, wrong or missing state, expired attempt, wrong iss', () => {
  const code = (storage: ReturnType<typeof memoryStorage>, now = 2_000) => {
    const r = takeAgentboxdCallback(storage, now)
    return r && !r.ok ? r.code : r?.ok ? 'ok' : 'none'
  }
  assert.equal(code(withAttempt(`error=access_denied&state=${STATE}`)), 'cancelled')
  assert.equal(code(withAttempt(`error=server_error&state=${STATE}`)), 'provider-error')
  assert.equal(code(withAttempt(`code=abc&state=${'X'.repeat(43)}`)), 'state-mismatch')
  assert.equal(code(withAttempt('code=abc')), 'state-mismatch')
  assert.equal(code(withAttempt(`code=abc&state=${STATE}`, null)), 'expired-attempt')
  assert.equal(code(withAttempt(`code=abc&state=${STATE}`), 1_000 + 11 * 60_000), 'expired-attempt')
  assert.equal(code(withAttempt(`code=abc&state=${STATE}&iss=https%3A%2F%2Fevil.example`)), 'provider-error')
  assert.equal(code(withAttempt(`state=${STATE}`)), 'provider-error')
  assert.equal(takeAgentboxdCallback(memoryStorage()), null)
})

const credential: AgentboxdCallbackCredential = { kind: 'agentboxd', state: STATE, code: 'abc', codeVerifier: 'v'.repeat(43), iss: 'https://id.agentboxd.com' }

test('adapter.signIn: posts the callback to /finish and keeps only the opaque session', async () => {
  const calls: Call[] = []
  const c = cfg([[200, { session: SESSION, account: ACCOUNT }]], calls)
  const state = await createAgentboxdAdapter(c).signIn(credential)
  assert.deepEqual(state, { status: 'signed-in', account: { id: ACCOUNT.id, displayName: 'Research agent', provider: 'agentboxd' }, expiresAt: ACCOUNT.expiresAt, error: null })
  assert.equal(calls[0].url, `${FN}/finish`)
  assert.deepEqual(calls[0].body, { state: STATE, code: 'abc', codeVerifier: 'v'.repeat(43), iss: 'https://id.agentboxd.com' })
  assert.equal(c.storage.getItem(AGENT_SESSION_STORAGE_KEY), SESSION)
})

test('adapter.signIn: server rejections never sign in and store nothing', async () => {
  for (const [reply, error] of [
    [[401, { error: 'invalid-token' }], 'verify-failed'],
    [[401, { error: 'token-replayed' }], 'verify-failed'],
    [[400, { error: 'invalid-state' }], 'expired-attempt'],
    [[400, { error: 'pkce-mismatch' }], 'verify-failed'],
    [[503, { error: 'provider-unavailable' }], 'network'],
    [[200, { session: SESSION, account: { id: 'mojo-user' } }], 'verify-failed'],
    [new TypeError('offline'), 'network'],
  ] as const) {
    const c = cfg([reply as [number, unknown] | Error])
    const state = await createAgentboxdAdapter(c).signIn(credential)
    assert.equal(state.status, 'error')
    assert.equal(state.error, error)
    assert.equal(c.storage.getItem(AGENT_SESSION_STORAGE_KEY), null)
  }
  assert.equal((await createAgentboxdAdapter(cfg([])).signIn('a.b.c')).status, 'error')
})

test('adapter.restore (reload): re-checks the session; clears it when rejected; keeps it when offline', async () => {
  const c = cfg([[200, { account: ACCOUNT }]])
  assert.equal((await createAgentboxdAdapter(c).restore()).status, 'guest') // nothing stored, no request
  c.storage.setItem(AGENT_SESSION_STORAGE_KEY, SESSION)
  const calls: Call[] = []
  const ok = await createAgentboxdAdapter({ ...c, fetcher: fake([[200, { account: ACCOUNT }]], calls) }).restore()
  assert.equal(ok.status, 'signed-in')
  assert.ok(isAgentAccount(ok.account))
  assert.deepEqual(calls[0].body, { session: SESSION })
  await createAgentboxdAdapter({ ...c, fetcher: fake([[503, {}]]) }).restore()
  assert.equal(c.storage.getItem(AGENT_SESSION_STORAGE_KEY), SESSION)
  await createAgentboxdAdapter({ ...c, fetcher: fake([[401, { error: 'session-expired' }]]) }).restore()
  assert.equal(c.storage.getItem(AGENT_SESSION_STORAGE_KEY), null)
})

test('adapter.signOut (logout): clears locally even when the server call fails, and ends the server session', async () => {
  const calls: Call[] = []
  const c = cfg([[200, { ok: true }]], calls)
  c.storage.setItem(AGENT_SESSION_STORAGE_KEY, SESSION)
  await createAgentboxdAdapter(c).signOut()
  assert.equal(calls[0].url, `${FN}/logout`)
  assert.deepEqual(calls[0].body, { session: SESSION })
  assert.equal(c.storage.getItem(AGENT_SESSION_STORAGE_KEY), null)
  const offline = cfg([new TypeError('offline')])
  offline.storage.setItem(AGENT_SESSION_STORAGE_KEY, SESSION)
  await createAgentboxdAdapter(offline).signOut()
  assert.equal(offline.storage.getItem(AGENT_SESSION_STORAGE_KEY), null)
})

function recorder(name: string, result: AuthState) {
  const log: string[] = []
  const adapter: AuthAdapter = {
    canSignIn: true,
    restore: async () => { log.push(`${name}.restore`); return result },
    signIn: async () => { log.push(`${name}.signIn`); return result },
    signOut: async () => { log.push(`${name}.signOut`) },
  }
  return { adapter, log }
}
const humanState: AuthState = { status: 'signed-in', account: { id: 'u1', displayName: 'Ana', provider: 'mojoauth' }, expiresAt: null, error: null }
const agentState: AuthState = { status: 'signed-in', account: { id: 'agentboxd:s', displayName: 'Bot', provider: 'agentboxd' }, expiresAt: null, error: null }

test('combined adapter: MojoAuth tokens go to MojoAuth, Agentboxd callbacks to Agentboxd, one identity at a time', async () => {
  const human = recorder('human', humanState)
  const agent = recorder('agent', agentState)
  const both = combineAdapters(human.adapter, agent.adapter)
  assert.equal((await both.signIn('a.b.c')).account?.provider, 'mojoauth')
  assert.deepEqual([...agent.log, ...human.log], ['agent.signOut', 'human.signIn'])
  assert.equal((await both.signIn(credential)).account?.provider, 'agentboxd')
  assert.ok(human.log.includes('human.signOut'))
  await both.signOut()
  assert.equal(human.log.filter((l) => l === 'human.signOut').length, 2)
})

test('combined adapter: restore prefers a stored agent session, else the person, else guest', async () => {
  assert.equal((await combineAdapters(recorder('h', humanState).adapter, recorder('a', agentState).adapter).restore()).account?.provider, 'agentboxd')
  assert.equal((await combineAdapters(recorder('h', humanState).adapter, recorder('a', GUEST).adapter).restore()).account?.provider, 'mojoauth')
  assert.deepEqual(await combineAdapters(null, recorder('a', GUEST).adapter).restore(), GUEST)
  assert.equal((await combineAdapters(null, recorder('a', GUEST).adapter).signIn('a.b.c')).error, 'sign-in-disabled')
})

test('existing MojoAuth sign-in still works through the combined adapter', async () => {
  const storage = memoryStorage()
  const mojo = createMojoAuthAdapter({
    apiKey: 'public-key-not-real',
    verifyUrl: 'https://backend.test/functions/v1/auth-verify',
    fetcher: (async () => new Response(JSON.stringify({ account: { id: 'user-1', displayName: 'Ana', expiresAt: Date.now() + 60_000 } }))) as typeof fetch,
    storage,
  })
  const agent = createAgentboxdAdapter(cfg([]))
  const state = await combineAdapters(mojo, agent).signIn('a.b.c')
  assert.equal(state.status, 'signed-in')
  assert.equal(state.account?.provider, 'mojoauth')
  assert.ok(!isAgentAccount(state.account))
  assert.equal(JSON.parse(storage.getItem('wm-auth') ?? '{}').token, 'a.b.c')
})

test('access: guests keep every public feature; agents get public features only, never account features', () => {
  for (const s of [GUEST, agentState, humanState]) assert.ok(canUse(s, 'map') && canUse(s, 'alerts'))
  assert.equal(canUse(GUEST, 'savedPlaces'), false)
  assert.equal(canUse(agentState, 'savedPlaces'), false)
  assert.equal(canUse(agentState, 'notificationPrefs'), false)
  assert.equal(canUse(humanState, 'savedPlaces'), true)
})

test('session state accepts Agentboxd accounts and drops extra fields', () => {
  const s = sanitizeState({ ...agentState, account: { ...agentState.account, kind: 'admin', idToken: 'leak' } })
  assert.deepEqual(s.account, { id: 'agentboxd:s', displayName: 'Bot', provider: 'agentboxd' })
  assert.equal(sanitizeState({ ...agentState, account: { id: 'x', provider: 'google' } }).status, 'guest')
})

test('config from env: function URL required; production needs HTTPS and not localhost', () => {
  assert.equal(agentboxdConfigFromEnv({}), null)
  assert.deepEqual(agentboxdConfigFromEnv({ VITE_AGENTBOXD_AUTH_URL: `${FN}/` }), { authUrl: FN })
  assert.equal(agentboxdConfigFromEnv({ VITE_AGENTBOXD_AUTH_URL: 'ftp://x' }), null)
  assert.equal(agentboxdConfigFromEnv({ VITE_AGENTBOXD_AUTH_URL: `${FN}?next=evil` }), null)
  assert.ok(agentboxdConfigFromEnv({ VITE_AGENTBOXD_AUTH_URL: 'http://127.0.0.1:54321/functions/v1/agentboxd-auth' }))
  assert.equal(agentboxdConfigFromEnv({ PROD: true, VITE_AGENTBOXD_AUTH_URL: 'http://127.0.0.1:54321/functions/v1/agentboxd-auth' }), null)
  assert.equal(agentboxdConfigFromEnv({ PROD: true, VITE_AGENTBOXD_AUTH_URL: 'https://localhost/functions/v1/agentboxd-auth' }), null)
  assert.ok(agentboxdConfigFromEnv({ PROD: true, VITE_AGENTBOXD_AUTH_URL: FN }))
})

// GitHub Pages: the redirect URI is a real static file, so it answers 200 without the SPA
// 404.html fallback. Run its inline script against fake browser globals.
test('GitHub Pages callback page saves the query for /login and leaves via a relative URL', () => {
  const html = readFileSync(fileURLToPath(new URL('../public/agentboxd-callback.html', import.meta.url)), 'utf8')
  assert.ok(!/<script[^>]+src=/i.test(html), 'no external scripts')
  assert.match(html, /<meta name="referrer" content="no-referrer"/)
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1]
  for (const base of ['', '/WaterMark']) {
    const storage = memoryStorage()
    let replaced = ''
    const location = {
      search: `?code=abc&state=${STATE}&iss=https%3A%2F%2Fid.agentboxd.com`,
      replace: (to: string) => { replaced = new URL(to, `https://watermark.works${base}/agentboxd-callback.html`).pathname },
    }
    new Function('sessionStorage', 'location', script)(storage, location)
    assert.equal(storage.getItem(CALLBACK_STORAGE_KEY), `code=abc&state=${STATE}&iss=https%3A%2F%2Fid.agentboxd.com`)
    assert.equal(replaced, `${base}/login`)
    // /login picks it up; with no attempt from this tab it is refused, never used.
    assert.deepEqual(takeAgentboxdCallback(storage), { ok: false, code: 'expired-attempt' })
  }
})
