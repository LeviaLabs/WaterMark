// Unit tests for supabase/functions/agentboxd-auth (WM-CLAUDE-005).
// Real ES256 signatures from throwaway keys, a fake Agentboxd and an in-memory store with the
// same single-use semantics as the Postgres RPCs. No network, no real credentials.
// Run from the repo root: node --test supabase/tests/agentboxd-auth/flow.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { base64url, createHandler, pkceChallenge, randomToken, redirectFor } from '../../functions/agentboxd-auth/flow.ts'
import { AGENT_CLAIM, AgentboxdProvider, parseDiscovery, ProviderError } from '../../functions/agentboxd-auth/oidc.ts'
import { type AttemptInput, type AttemptRecord, type AuthStore, createRpcStore, type SessionRecord, StoreError } from '../../functions/agentboxd-auth/store.ts'

const ISSUER = 'https://id.agentboxd.com'
const CLIENT_ID = 'abxc_test_client'
const SITE = 'https://watermark.works'
const DEV = 'http://localhost:5173'
const REDIRECTS = `${SITE}/agentboxd-callback.html,${DEV}/agentboxd-callback.html`
const FN = 'https://ref.supabase.co/functions/v1/agentboxd-auth'
const NOW = Date.UTC(2026, 10, 22, 15, 0, 0)
const nowS = NOW / 1000

const DISCOVERY = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/authorize`,
  token_endpoint: `${ISSUER}/token`,
  jwks_uri: `${ISSUER}/.well-known/jwks.json`,
  code_challenge_methods_supported: ['S256'],
  id_token_signing_alg_values_supported: ['ES256'],
  authorization_response_iss_parameter_supported: true,
}

const enc = new TextEncoder()
const b64json = (o: unknown) => base64url(enc.encode(JSON.stringify(o)))

async function keyPair() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  return { privateKey: pair.privateKey, jwk: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, use: 'sig', alg: 'ES256' } }
}
const SIGNER = await keyPair()
const OTHER = await keyPair()

async function sign(claims: Record<string, unknown>, opts: { key?: CryptoKey; header?: Record<string, unknown> } = {}) {
  const header = opts.header ?? { alg: 'ES256', kid: 'k1', typ: 'JWT' }
  const input = `${b64json(header)}.${b64json(claims)}`
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, opts.key ?? SIGNER.privateKey, enc.encode(input)))
  return `${input}.${base64url(sig)}`
}

function claimsFor(nonce: string, extra: Record<string, unknown> = {}) {
  return {
    iss: ISSUER,
    sub: 'pairwise-sub-123',
    aud: CLIENT_ID,
    iat: nowS - 5,
    exp: nowS + 295,
    auth_time: nowS - 5,
    jti: randomToken(),
    nonce,
    name: 'Research agent',
    [AGENT_CLAIM]: true,
    actor_type: 'agent',
    ...extra,
  }
}

class MemoryStore implements AuthStore {
  attempts = new Map<string, AttemptRecord & { clientKey: string; created: number; expires: number; consumed?: boolean }>()
  jtis = new Set<string>()
  sessions = new Map<string, SessionRecord>()
  down = false
  // Each method runs synchronously, like one SQL statement, so check-and-delete is atomic.
  begin(a: AttemptInput, ttl: number, perMinute: number) {
    if (this.down) return Promise.reject(new StoreError('unavailable'))
    const recent = [...this.attempts.values()].filter((r) => r.clientKey === a.clientKey && r.created > NOW - 60_000)
    if (recent.length >= perMinute) return Promise.resolve(false)
    this.attempts.set(a.state, { nonce: a.nonce, codeChallenge: a.codeChallenge, redirectUri: a.redirectUri, clientKey: a.clientKey, created: NOW, expires: NOW + ttl * 1000 })
    return Promise.resolve(true)
  }
  takeAttempt(state: string) {
    if (this.down) return Promise.reject(new StoreError('unavailable'))
    const row = this.attempts.get(state)
    if (row?.consumed) return Promise.resolve(null)
    if (row) row.consumed = true
    return Promise.resolve(row && row.expires > NOW ? { nonce: row.nonce, codeChallenge: row.codeChallenge, redirectUri: row.redirectUri } : null)
  }
  consumeJti(jti: string) {
    if (this.jtis.has(jti)) return Promise.resolve(false)
    this.jtis.add(jti)
    return Promise.resolve(true)
  }
  createSession(hash: string, subject: string, displayName: string | null, expiresAt: number) {
    this.sessions.set(hash, { subject, displayName, expiresAt })
    return Promise.resolve()
  }
  getSession(hash: string) {
    return Promise.resolve(this.sessions.get(hash) ?? null)
  }
  endSession(hash: string) {
    this.sessions.delete(hash)
    return Promise.resolve()
  }
}

type TokenReply = (form: URLSearchParams, attemptNonce: () => string, init?: RequestInit) => Promise<Response> | Response

function setup(opts: { token?: TokenReply; discovery?: () => Response; jwks?: () => Response; timeoutMs?: number; store?: MemoryStore | null; clientId?: string } = {}) {
  const store = opts.store === undefined ? new MemoryStore() : opts.store
  const calls: { url: string; body?: string }[] = []
  let lastNonce = ''
  const fetcher = async (url: string, init?: RequestInit) => {
    calls.push({ url, body: typeof init?.body === 'string' ? init.body : undefined })
    if (url === `${ISSUER}/.well-known/openid-configuration`) return opts.discovery?.() ?? Response.json(DISCOVERY)
    if (url === DISCOVERY.jwks_uri) return opts.jwks?.() ?? Response.json({ keys: [{ ...SIGNER.jwk, kid: 'k1' }] })
    if (url === DISCOVERY.token_endpoint) {
      const form = new URLSearchParams(String(init?.body))
      if (opts.token) return opts.token(form, () => lastNonce, init)
      return Response.json({ id_token: await sign(claimsFor(lastNonce)), access_token: 'abxat_x', token_type: 'Bearer', expires_in: 300 })
    }
    throw new Error(`unexpected fetch ${url}`)
  }
  const handler = createHandler({
    clientId: opts.clientId ?? CLIENT_ID,
    redirectUris: REDIRECTS,
    allowedOrigins: `${DEV},${SITE}`,
    store,
    fetcher,
    now: () => NOW,
    timeoutMs: opts.timeoutMs ?? 2000,
    provider: new AgentboxdProvider(fetcher, opts.timeoutMs ?? 2000, () => NOW),
  })
  const call = (route: string, body: unknown, headers: Record<string, string> = {}, method = 'POST') =>
    handler(new Request(`${FN}/${route}`, {
      method,
      headers: { Origin: SITE, 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.7', ...headers },
      body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }))
  async function begin(origin = SITE) {
    const verifier = randomToken() + randomToken()
    const res = await call('start', { codeChallenge: await pkceChallenge(verifier) }, { Origin: origin })
    assert.equal(res.status, 200)
    const { authorizeUrl, state } = await res.json()
    const url = new URL(authorizeUrl)
    lastNonce = url.searchParams.get('nonce')!
    return { verifier, state, url, nonce: lastNonce }
  }
  const finish = (state: string, verifier: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
    call('finish', { state, code: 'code-abc', codeVerifier: verifier, iss: ISSUER, ...extra }, headers)
  return { store, calls, call, begin, finish, setNonce: (n: string) => { lastNonce = n } }
}

async function errorOf(res: Response) {
  return { status: res.status, error: (await res.json()).error }
}

// 1. Valid login, session, reload and logout.
test('valid Agentboxd login: authorize URL, code exchange, session, reload and logout', async () => {
  const t = setup()
  const { verifier, state, url, nonce } = await t.begin()
  assert.equal(url.origin + url.pathname, `${ISSUER}/authorize`)
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('client_id'), CLIENT_ID)
  assert.equal(url.searchParams.get('redirect_uri'), `${SITE}/agentboxd-callback.html`)
  assert.equal(url.searchParams.get('scope'), 'openid profile')
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(url.searchParams.get('code_challenge'), await pkceChallenge(verifier))
  assert.equal(url.searchParams.get('state'), state)
  assert.match(state, /^[A-Za-z0-9_-]{43}$/)
  assert.match(nonce, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(state, nonce)

  const res = await t.finish(state, verifier)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.equal(res.headers.get('access-control-allow-origin'), SITE)
  const body = await res.json()
  assert.deepEqual(Object.keys(body).sort(), ['account', 'session'])
  assert.deepEqual(body.account, { id: 'agentboxd:pairwise-sub-123', displayName: 'Research agent', kind: 'agent', expiresAt: NOW + 3_600_000 })
  assert.match(body.session, /^[A-Za-z0-9_-]{43}$/)

  // Public client: verifier and client_id sent, no secret, exact redirect_uri.
  const tokenCall = t.calls.find((c) => c.url === DISCOVERY.token_endpoint)!
  const form = new URLSearchParams(tokenCall.body)
  assert.equal(form.get('grant_type'), 'authorization_code')
  assert.equal(form.get('code_verifier'), verifier)
  assert.equal(form.get('client_id'), CLIENT_ID)
  assert.equal(form.get('redirect_uri'), `${SITE}/agentboxd-callback.html`)
  assert.equal(form.get('client_secret'), null)

  // Only a hash of the session is stored.
  assert.ok(![...t.store!.sessions.keys()].includes(body.session))

  const reload = await t.call('session', { session: body.session })
  assert.equal(reload.status, 200)
  assert.deepEqual((await reload.json()).account.id, 'agentboxd:pairwise-sub-123')

  assert.equal((await t.call('logout', { session: body.session })).status, 200)
  assert.deepEqual(await errorOf(await t.call('session', { session: body.session })), { status: 401, error: 'session-expired' })
})

test('dev origin gets the localhost redirect URI; the browser never chooses it', async () => {
  const t = setup()
  const { url } = await t.begin(DEV)
  assert.equal(url.searchParams.get('redirect_uri'), `${DEV}/agentboxd-callback.html`)
  assert.equal(redirectFor('https://evil.example', REDIRECTS), null)
  assert.equal(redirectFor(SITE, 'http://watermark.works/cb'), null) // plain http off localhost
  assert.equal(redirectFor(SITE, `${SITE}/cb#frag`), null)
})

// 2. Forged tokens.
test('forged JWT signed by another key is rejected', async () => {
  const t = setup({ token: async (_f, n) => Response.json({ id_token: await sign(claimsFor(n()), { key: OTHER.privateKey }) }) })
  const { state, verifier } = await t.begin()
  assert.deepEqual(await errorOf(await t.finish(state, verifier)), { status: 401, error: 'invalid-token' })
})

test('alg none, HS256, unknown kid, crit header and garbage are rejected', async () => {
  const cases: Array<(n: string) => Promise<string> | string> = [
    (n) => `${b64json({ alg: 'none', kid: 'k1' })}.${b64json(claimsFor(n))}.`,
    (n) => sign(claimsFor(n), { header: { alg: 'HS256', kid: 'k1' } }),
    (n) => sign(claimsFor(n), { header: { alg: 'ES256', kid: 'nope' } }),
    (n) => sign(claimsFor(n), { header: { alg: 'ES256', kid: 'k1', crit: ['exp'] } }),
    () => 'not.a.jwt',
  ]
  for (const make of cases) {
    const t = setup({ token: async (_f, n) => Response.json({ id_token: await make(n()) }) })
    const { state, verifier } = await t.begin()
    assert.deepEqual(await errorOf(await t.finish(state, verifier)), { status: 401, error: 'invalid-token' })
  }
})

// 3. Issuer and audience.
for (const [name, extra] of [
  ['wrong issuer', { iss: 'https://id.agentboxd.evil' }],
  ['wrong audience', { aud: 'another-app' }],
  ['multiple audiences', { aud: [CLIENT_ID, 'another-app'] }],
  ['agent claim missing', { [AGENT_CLAIM]: undefined }],
  ['agent claim false', { [AGENT_CLAIM]: false }],
  ['actor_type human', { actor_type: 'human' }],
  ['missing sub', { sub: undefined }],
  ['missing jti', { jti: undefined }],
] as const) {
  test(`${name} -> 401 invalid-token`, async () => {
    const t = setup({ token: async (_f, n) => Response.json({ id_token: await sign(claimsFor(n(), extra as Record<string, unknown>)) }) })
    const { state, verifier } = await t.begin()
    assert.deepEqual(await errorOf(await t.finish(state, verifier)), { status: 401, error: 'invalid-token' })
  })
}

// 4. Time checks.
for (const [name, extra, error] of [
  ['expired token', { iat: nowS - 400, exp: nowS - 100 }, 'expired-token'],
  ['issued in the future', { iat: nowS + 120, exp: nowS + 400 }, 'invalid-token'],
  ['not yet valid (nbf)', { nbf: nowS + 120 }, 'invalid-token'],
  ['lifetime over 300 s', { iat: nowS - 5, exp: nowS + 3600 }, 'invalid-token'],
] as const) {
  test(`${name} -> 401 ${error}`, async () => {
    const t = setup({ token: async (_f, n) => Response.json({ id_token: await sign(claimsFor(n(), extra)) }) })
    const { state, verifier } = await t.begin()
    assert.deepEqual(await errorOf(await t.finish(state, verifier)), { status: 401, error })
  })
}

test('30 s clock tolerance: token that expired 10 s ago is still accepted', async () => {
  const t = setup({ token: async (_f, n) => Response.json({ id_token: await sign(claimsFor(n(), { iat: nowS - 300, exp: nowS - 10 })) }) })
  const { state, verifier } = await t.begin()
  assert.equal((await t.finish(state, verifier)).status, 200)
})

// 5. State and nonce.
test('missing, malformed, unknown and expired state are rejected', async () => {
  const t = setup()
  const { verifier } = await t.begin()
  assert.deepEqual(await errorOf(await t.call('finish', { code: 'c', codeVerifier: verifier, iss: ISSUER })), { status: 400, error: 'invalid-request' })
  assert.deepEqual(await errorOf(await t.finish('short', verifier)), { status: 400, error: 'invalid-request' })
  assert.deepEqual(await errorOf(await t.finish(randomToken(), verifier)), { status: 400, error: 'invalid-state' })

  const { state } = await t.begin()
  t.store!.attempts.get(state)!.expires = NOW - 1
  assert.deepEqual(await errorOf(await t.finish(state, verifier)), { status: 400, error: 'invalid-state' })
})

test('state started on one origin cannot be finished from another', async () => {
  const t = setup()
  const { state, verifier } = await t.begin(SITE)
  assert.deepEqual(await errorOf(await t.finish(state, verifier, {}, { Origin: DEV })), { status: 400, error: 'invalid-state' })
})

test('wrong or missing nonce in the ID token is rejected', async () => {
  for (const nonce of ['some-other-nonce', undefined]) {
    const t = setup({ token: async () => Response.json({ id_token: await sign(claimsFor('x', { nonce })) }) })
    const { state, verifier } = await t.begin()
    assert.deepEqual(await errorOf(await t.finish(state, verifier)), { status: 401, error: 'invalid-token' })
  }
})

test('authorization response iss (RFC 9207) must be present and exact', async () => {
  const t = setup()
  const a = await t.begin()
  assert.deepEqual(await errorOf(await t.finish(a.state, a.verifier, { iss: undefined })), { status: 400, error: 'invalid-issuer' })
  const b = await t.begin()
  assert.deepEqual(await errorOf(await t.finish(b.state, b.verifier, { iss: 'https://evil.example' })), { status: 400, error: 'invalid-issuer' })
})

// 6. PKCE.
test('wrong PKCE verifier is rejected before the code reaches Agentboxd', async () => {
  const t = setup()
  const { state } = await t.begin()
  assert.deepEqual(await errorOf(await t.finish(state, randomToken() + randomToken())), { status: 400, error: 'pkce-mismatch' })
  assert.equal(t.calls.filter((c) => c.url === DISCOVERY.token_endpoint).length, 0)
})

test('malformed verifier or code challenge is rejected', async () => {
  const t = setup()
  assert.deepEqual(await errorOf(await t.call('start', { codeChallenge: 'plain-text' })), { status: 400, error: 'invalid-request' })
  const { state } = await t.begin()
  assert.deepEqual(await errorOf(await t.finish(state, 'short')), { status: 400, error: 'invalid-request' })
})

test('provider PKCE rejection (invalid_grant) -> 401 invalid-grant', async () => {
  const t = setup({ token: () => Response.json({ error: 'invalid_grant' }, { status: 400 }) })
  const { state, verifier } = await t.begin()
  assert.deepEqual(await errorOf(await t.finish(state, verifier)), { status: 401, error: 'invalid-grant' })
})

// 7. Replay.
test('a state works once: the second callback is rejected', async () => {
  const t = setup()
  const { state, verifier } = await t.begin()
  assert.equal((await t.finish(state, verifier)).status, 200)
  assert.deepEqual(await errorOf(await t.finish(state, verifier)), { status: 400, error: 'invalid-state' })
})

test('concurrent callbacks with one state: exactly one succeeds', async () => {
  const t = setup()
  const { state, verifier } = await t.begin()
  const results = await Promise.all([t.finish(state, verifier), t.finish(state, verifier), t.finish(state, verifier)])
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400, 400])
})

test('an ID token jti accepted once is rejected on a later attempt', async () => {
  const jti = randomToken()
  const t = setup({ token: async (_f, n) => Response.json({ id_token: await sign(claimsFor(n(), { jti })) }) })
  const a = await t.begin()
  assert.equal((await t.finish(a.state, a.verifier)).status, 200)
  const b = await t.begin()
  assert.deepEqual(await errorOf(await t.finish(b.state, b.verifier)), { status: 401, error: 'token-replayed' })
})

test('per-client rate limit on starting sign-in', async () => {
  const t = setup()
  for (let i = 0; i < 10; i++) await t.begin()
  const res = await t.call('start', { codeChallenge: await pkceChallenge(randomToken() + randomToken()) })
  assert.deepEqual(await errorOf(res), { status: 429, error: 'rate-limited' })
  // Another client is unaffected.
  const other = await t.call('start', { codeChallenge: await pkceChallenge(randomToken() + randomToken()) }, { 'x-forwarded-for': '198.51.100.9' })
  assert.equal(other.status, 200)
})

test('consuming failed attempts cannot reset the rolling start limit', async () => {
  const t = setup()
  for (let i = 0; i < 10; i++) {
    const a = await t.begin()
    assert.equal((await t.finish(a.state, randomToken() + randomToken())).status, 400)
  }
  assert.deepEqual(await errorOf(await t.call('start', { codeChallenge: 'A'.repeat(43) })), { status: 429, error: 'rate-limited' })
})

test('supplemental ingress limit rejects before reading a body or calling a provider', async () => {
  const t = setup()
  for (let i = 0; i < 60; i++) assert.equal((await t.call('session', {})).status, 400)
  const res = await t.call('start', { codeChallenge: 'A'.repeat(43) })
  assert.equal(res.status, 429)
  assert.equal(res.headers.get('retry-after'), '60')
  assert.equal(t.calls.length, 0)
})

// 9. Outage and timeout.
test('Agentboxd discovery outage -> 503 provider-unavailable', async () => {
  const t = setup({ discovery: () => new Response('down', { status: 503 }) })
  const res = await t.call('start', { codeChallenge: await pkceChallenge(randomToken() + randomToken()) })
  assert.deepEqual(await errorOf(res), { status: 503, error: 'provider-unavailable' })
})

test('token endpoint timeout -> 503 provider-unavailable', async () => {
  // Never answers; like real fetch, it rejects only when the handler's abort signal fires.
  const t = setup({
    timeoutMs: 50,
    token: (_f, _n, init) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('timeout', 'TimeoutError')))),
  })
  const { state, verifier } = await t.begin()
  const started = Date.now()
  assert.deepEqual(await errorOf(await t.finish(state, verifier)), { status: 503, error: 'provider-unavailable' })
  assert.ok(Date.now() - started < 1000)
})

test('token endpoint network failure and 5xx -> 503; JWKS outage -> 503', async () => {
  for (const token of [() => { throw new TypeError('network') }, () => new Response('', { status: 502 })] as TokenReply[]) {
    const t = setup({ token })
    const { state, verifier } = await t.begin()
    assert.deepEqual(await errorOf(await t.finish(state, verifier)), { status: 503, error: 'provider-unavailable' })
  }
  const t = setup({ jwks: () => new Response('', { status: 503 }) })
  const { state, verifier } = await t.begin()
  assert.deepEqual(await errorOf(await t.finish(state, verifier)), { status: 503, error: 'provider-unavailable' })
})

test('abort signal is passed to every provider request', async () => {
  const signals: unknown[] = []
  const provider = new AgentboxdProvider((url, init) => {
    signals.push(init?.signal)
    return Promise.resolve(url.endsWith('openid-configuration') ? Response.json(DISCOVERY) : Response.json({ keys: [] }))
  }, 1000, () => NOW)
  await provider.key('k1')
  assert.equal(signals.length, 2)
  assert.ok(signals.every((s) => s instanceof AbortSignal))
})

test('key rotation: unknown kid triggers a JWKS re-fetch', async () => {
  let keys = [{ ...SIGNER.jwk, kid: 'old' }]
  let clock = NOW
  const fetcher = (url: string) => Promise.resolve(url.endsWith('openid-configuration') ? Response.json(DISCOVERY) : Response.json({ keys }))
  const provider = new AgentboxdProvider(fetcher, 1000, () => clock)
  assert.ok(await provider.key('old'))
  keys = [{ ...SIGNER.jwk, kid: 'new' }]
  clock += 61_000
  assert.ok(await provider.key('new'))
})

test('store outage -> 503 store-unavailable', async () => {
  const store = new MemoryStore()
  store.down = true
  const t = setup({ store })
  const res = await t.call('start', { codeChallenge: await pkceChallenge(randomToken() + randomToken()) })
  assert.deepEqual(await errorOf(res), { status: 503, error: 'store-unavailable' })
})

test('discovery document is validated', () => {
  assert.throws(() => parseDiscovery({ ...DISCOVERY, issuer: 'https://evil.example' }), ProviderError)
  assert.throws(() => parseDiscovery({ ...DISCOVERY, token_endpoint: 'https://evil.example/token' }), ProviderError)
  assert.throws(() => parseDiscovery({ ...DISCOVERY, code_challenge_methods_supported: ['plain'] }), ProviderError)
  assert.throws(() => parseDiscovery({ ...DISCOVERY, id_token_signing_alg_values_supported: ['RS256'] }), ProviderError)
  assert.equal(parseDiscovery(DISCOVERY).tokenEndpoint, `${ISSUER}/token`)
})

// 14. CORS, origin and request limits.
test('CORS and request restrictions', async () => {
  const t = setup()
  const noOrigin = await setup().call('start', {}, { Origin: '' })
  assert.deepEqual(await errorOf(noOrigin), { status: 403, error: 'origin-not-allowed' })
  const evil = await t.call('start', {}, { Origin: 'https://evil.example' })
  assert.deepEqual(await errorOf(evil), { status: 403, error: 'origin-not-allowed' })
  assert.equal(evil.headers.get('access-control-allow-origin'), null)
  const pre = await t.call('start', null, { 'Access-Control-Request-Method': 'POST' }, 'OPTIONS')
  assert.equal(pre.status, 204)
  assert.equal(pre.headers.get('access-control-allow-origin'), SITE)
  assert.deepEqual(await errorOf(await t.call('start', null, {}, 'GET')), { status: 405, error: 'method-not-allowed' })
  assert.deepEqual(await errorOf(await t.call('admin', {})), { status: 404, error: 'not-found' })
  assert.deepEqual(await errorOf(await t.call('start', 'not json')), { status: 400, error: 'invalid-request' })
  assert.deepEqual(await errorOf(await t.call('start', { codeChallenge: 'a'.repeat(5000) })), { status: 400, error: 'invalid-request' })
})

test('not configured -> 503, never a partial flow', async () => {
  assert.deepEqual(await errorOf(await setup({ clientId: '' }).call('start', {})), { status: 503, error: 'not-configured' })
  assert.deepEqual(await errorOf(await setup({ store: null }).call('start', {})), { status: 503, error: 'not-configured' })
})

test('responses never echo the code, verifier or ID token', async () => {
  let idToken = ''
  const t = setup({ token: async (_f, n) => { idToken = await sign(claimsFor(n())); return Response.json({ id_token: idToken }) } })
  const { state, verifier } = await t.begin()
  const text = await (await t.finish(state, verifier)).text()
  for (const secret of [verifier, idToken, 'code-abc', state]) assert.ok(!text.includes(secret))
})

test('RPC store calls the service-role RPCs and maps null to "no attempt"', async () => {
  const seen: { url: string; headers: Headers }[] = []
  const store = createRpcStore('https://ref.supabase.co', 'sb_secret_test', (url, init) => {
    seen.push({ url, headers: new Headers(init?.headers) })
    return Promise.resolve(url.endsWith('take_attempt') ? new Response('null') : new Response('true'))
  })
  assert.equal(await store.takeAttempt('s'), null)
  assert.equal(await store.consumeJti('j', NOW), true)
  assert.equal(seen[0].url, 'https://ref.supabase.co/rest/v1/rpc/watermark_agentboxd_take_attempt')
  assert.equal(seen[0].headers.get('apikey'), 'sb_secret_test')
  assert.equal(seen[0].headers.get('authorization'), null)
  const failing = createRpcStore('https://ref.supabase.co', 'k', () => Promise.resolve(new Response('{"message":"schema"}', { status: 500 })))
  await assert.rejects(failing.consumeJti('j', NOW), StoreError)
})
