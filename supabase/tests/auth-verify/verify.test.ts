// Unit tests for supabase/functions/auth-verify (WM-CLAUDE-002).
// Synthetic tokens and a fake fetch only: no network, no real credentials.
// Run from the repo root: node --test supabase/tests/auth-verify/verify.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  decodeClaims,
  handleRequest,
  MOJOAUTH_VERIFY_URL,
  parseToken,
  verifyMojoAuthToken,
} from '../../functions/auth-verify/verify.ts'
import { createLimits } from '../../functions/auth-verify/verify.ts'
import { RateLimiter, readBounded } from '../../functions/auth-verify/limits.ts'

const NOW = Date.UTC(2026, 10, 21, 20, 0, 0)
const b64url = (o: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwt = (claims: Record<string, unknown>) => `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(claims)}.c2ln`
const API_KEY = 'test-api-key-not-real'
const CLAIMS = { sub: 'user-123', iss: 'https://www.mojoauth.com', aud: API_KEY, exp: NOW / 1000 + 3600, email: 'river@example.test' }
const TOKEN = jwt(CLAIMS)

type Call = { url: string; init: RequestInit }
function fakeFetch(status: number, body: unknown, calls: Call[] = []): typeof fetch {
  return ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }))
  }) as typeof fetch
}
const valid = (user: Record<string, unknown> = {}) => ({
  isValid: true,
  user: { identifier: 'river@example.test', exp: CLAIMS.exp, iss: CLAIMS.iss, aud: API_KEY, ...user },
})

test('parseToken accepts compact JWTs only', () => {
  assert.equal(parseToken(TOKEN), TOKEN)
  for (const bad of ['', 'abc', 'a.b', 'a.b.c.d', 'a b.c.d', 42, null, 'a.b.' + 'c'.repeat(5000)]) {
    assert.equal(parseToken(bad), null, String(bad).slice(0, 20))
  }
})

test('decodeClaims reads the payload, including non-ASCII', () => {
  assert.deepEqual(decodeClaims(jwt({ sub: 'x', name: 'Río 河' })), { sub: 'x', name: 'Río 河' })
  assert.equal(decodeClaims('a.!!!.c'), null)
  assert.equal(decodeClaims(`a.${b64url([1, 2])}.c`), null)
})

test('valid token: calls MojoAuth /token/verify with the API key and returns the account', async () => {
  const calls: Call[] = []
  const r = await verifyMojoAuthToken(TOKEN, { apiKey: API_KEY, now: NOW, fetcher: fakeFetch(200, valid(), calls) })
  assert.deepEqual(r, { ok: true, account: { id: 'user-123', displayName: 'river@example.test', expiresAt: CLAIMS.exp * 1000 } })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, MOJOAUTH_VERIFY_URL)
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.redirect, 'error')
  const headers = calls[0].init.headers as Record<string, string>
  assert.equal(headers['x-api-key'], API_KEY)
  assert.equal(headers.Authorization, `Bearer ${TOKEN}`)
})

test('rejections: isValid false, 4xx, expired, not-yet-valid, issuer mismatch, no identity', async () => {
  const run = (status: number, body: unknown, token = TOKEN, extra = {}) =>
    verifyMojoAuthToken(token, { apiKey: API_KEY, now: NOW, fetcher: fakeFetch(status, body), ...extra })
  assert.deepEqual(await run(200, { isValid: false }), { ok: false, status: 401, code: 'invalid-token' })
  assert.deepEqual(await run(401, { code: 1 }), { ok: false, status: 401, code: 'invalid-token' })
  assert.deepEqual(await run(200, valid({ exp: NOW / 1000 - 1 })), { ok: false, status: 401, code: 'expired-token' })
  assert.deepEqual(await run(200, valid({ nbf: NOW / 1000 + 600 })), { ok: false, status: 401, code: 'invalid-token' })
  assert.deepEqual(
    await run(200, valid(), TOKEN, { expectedIssuer: 'https://api.mojoauth.com' }),
    { ok: false, status: 401, code: 'invalid-token' },
  )
  assert.equal((await run(200, valid(), TOKEN, { expectedIssuer: CLAIMS.iss })).ok, true)
  const anonymous = jwt({ exp: CLAIMS.exp })
  assert.deepEqual(await run(200, { isValid: true, user: { exp: CLAIMS.exp } }, anonymous), {
    ok: false, status: 401, code: 'invalid-token',
  })
})

test('audience: token must be issued for this project (aud = our API key)', async () => {
  const run = (user: Record<string, unknown>, token = TOKEN) =>
    verifyMojoAuthToken(token, { apiKey: API_KEY, now: NOW, fetcher: fakeFetch(200, valid(user)) })
  const rejected = { ok: false, status: 401, code: 'invalid-token' }
  assert.deepEqual(await run({ aud: 'another-project-key' }), rejected)
  assert.equal((await run({ aud: ['other', API_KEY] })).ok, true)
  const noAud = jwt({ sub: 'user-123', exp: CLAIMS.exp })
  assert.deepEqual(await run({ aud: undefined }, noAud), rejected)
  assert.equal((await run({ aud: undefined })).ok, true) // falls back to the token's own aud claim
})

test('no sub claim: id is a stable hash of the identifier, never the raw email', async () => {
  const token = jwt({ exp: CLAIMS.exp })
  const opts = { apiKey: API_KEY, now: NOW }
  const a = await verifyMojoAuthToken(token, { ...opts, fetcher: fakeFetch(200, valid({ identifier: 'River@Example.test' })) })
  const b = await verifyMojoAuthToken(token, { ...opts, fetcher: fakeFetch(200, valid({ identifier: 'river@example.test' })) })
  assert.ok(a.ok && b.ok)
  assert.match(a.account.id, /^idh_[0-9a-f]{64}$/)
  assert.equal(a.account.id, b.account.id)
})

test('provider failures and missing configuration fail closed', async () => {
  const opts = { apiKey: API_KEY, now: NOW }
  assert.deepEqual(await verifyMojoAuthToken(TOKEN, { ...opts, fetcher: fakeFetch(503, 'down') }), {
    ok: false, status: 502, code: 'provider-unavailable',
  })
  assert.deepEqual(await verifyMojoAuthToken(TOKEN, { ...opts, fetcher: fakeFetch(200, 'not json') }), {
    ok: false, status: 502, code: 'provider-unavailable',
  })
  const throwing = (() => Promise.reject(new TypeError('network'))) as typeof fetch
  assert.equal((await verifyMojoAuthToken(TOKEN, { ...opts, fetcher: throwing })).ok, false)
  const hanging = ((_u: unknown, init?: RequestInit) =>
    new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as typeof fetch
  assert.deepEqual(await verifyMojoAuthToken(TOKEN, { ...opts, fetcher: hanging, timeoutMs: 20 }), {
    ok: false, status: 502, code: 'provider-unavailable',
  })
  const calls: Call[] = []
  assert.deepEqual(await verifyMojoAuthToken(TOKEN, { apiKey: '', fetcher: fakeFetch(200, valid(), calls) }), {
    ok: false, status: 503, code: 'not-configured',
  })
  assert.equal(calls.length, 0)
})

const ORIGIN = 'http://localhost:5173'
const config = (fetcher: typeof fetch) => ({ apiKey: API_KEY, allowedOrigins: `${ORIGIN}, https://watermark.example`, now: NOW, fetcher })
const post = (body: unknown, origin: string | null = ORIGIN) =>
  new Request('http://local/auth-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

test('handler: allowed origin gets CORS headers and only the account fields', async () => {
  const res = await handleRequest(post({ token: TOKEN }), config(fakeFetch(200, valid())))
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN)
  assert.equal(res.headers.get('cache-control'), 'no-store')
  const text = await res.text()
  assert.deepEqual(JSON.parse(text), { account: { id: 'user-123', displayName: 'river@example.test', expiresAt: CLAIMS.exp * 1000 } })
  assert.ok(!text.includes(TOKEN), 'token must never be echoed')
})

test('handler: preflight, bad origin, bad method, bad body, invalid token', async () => {
  const f = fakeFetch(200, { isValid: false })
  const pre = await handleRequest(new Request('http://local', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), config(f))
  assert.equal(pre.status, 204)
  assert.match(pre.headers.get('access-control-allow-methods') ?? '', /POST/)

  const evil = await handleRequest(post({ token: TOKEN }, 'https://evil.example'), config(f))
  assert.equal(evil.status, 403)
  assert.equal(evil.headers.get('access-control-allow-origin'), null)

  const get = await handleRequest(new Request('http://local', { headers: { Origin: ORIGIN } }), config(f))
  assert.equal(get.status, 405)

  for (const body of ['not json', { token: 'nope' }, {}, 'x'.repeat(9000)]) {
    assert.equal((await handleRequest(post(body), config(f))).status, 400)
  }

  const bad = await handleRequest(post({ token: TOKEN }), config(f))
  assert.equal(bad.status, 401)
  assert.deepEqual(await bad.json(), { error: 'invalid-token' })
})

test('handler: empty allowed-origins list rejects every browser origin', async () => {
  const res = await handleRequest(post({ token: TOKEN }), { ...config(fakeFetch(200, valid())), allowedOrigins: '' })
  assert.equal(res.status, 403)
})

// --- Abuse limits (WM-CODEX-003 review) ---

const streamOf = (chunks: Uint8Array[], onCancel?: () => void) => {
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(c) {
      if (i < chunks.length) c.enqueue(chunks[i++])
      else c.close()
    },
    cancel() {
      onCancel?.()
    },
  })
}

test('readBounded: stops reading once the limit is passed, without buffering the rest', async () => {
  let pulled = 0
  let cancelled = false
  const big = new ReadableStream<Uint8Array>({
    pull(c) {
      pulled += 1
      c.enqueue(new Uint8Array(1024))
    }, // endless body
    cancel() {
      cancelled = true
    },
  })
  assert.equal(await readBounded({ body: big, headers: new Headers() }, 4096), null)
  assert.ok(cancelled, 'stream is cancelled')
  assert.ok(pulled <= 6, `read ${pulled} chunks; must stop near the limit`)

  const small = streamOf([new TextEncoder().encode('{"a":'), new TextEncoder().encode('1}')])
  assert.equal(await readBounded({ body: small, headers: new Headers() }, 4096), '{"a":1}')
  assert.equal(await readBounded({ body: null, headers: new Headers() }, 10), '')
})

test('readBounded: rejects an oversized Content-Length before reading, a slow body, and bad UTF-8', async () => {
  let cancelled = false
  const declared = streamOf([new Uint8Array(1)], () => (cancelled = true))
  assert.equal(await readBounded({ body: declared, headers: new Headers({ 'content-length': '999999' }) }, 8192), null)
  assert.ok(cancelled)

  const stalled = new ReadableStream<Uint8Array>({ pull: () => new Promise(() => {}) })
  const started = Date.now()
  assert.equal(await readBounded({ body: stalled, headers: new Headers() }, 8192, 30), null)
  assert.ok(Date.now() - started < 1000)

  assert.equal(await readBounded({ body: streamOf([new Uint8Array([0xff, 0xfe])]), headers: new Headers() }, 10), null)
})

test('provider response is read with a cap: an oversized MojoAuth body fails closed', async () => {
  const huge = (() =>
    Promise.resolve(
      new Response(streamOf(Array.from({ length: 200 }, () => new Uint8Array(1024).fill(32))), { status: 200 }),
    )) as typeof fetch
  assert.deepEqual(await verifyMojoAuthToken(TOKEN, { apiKey: API_KEY, now: NOW, fetcher: huge }), {
    ok: false, status: 502, code: 'provider-unavailable',
  })
})

test('expired, foreign-project or undecodable tokens are rejected without a MojoAuth call', async () => {
  const calls: Call[] = []
  const run = (token: string) =>
    verifyMojoAuthToken(token, { apiKey: API_KEY, now: NOW, fetcher: fakeFetch(200, valid(), calls) })
  assert.deepEqual(await run(jwt({ ...CLAIMS, exp: NOW / 1000 - 1 })), { ok: false, status: 401, code: 'expired-token' })
  assert.deepEqual(await run(jwt({ ...CLAIMS, aud: 'other-project' })), { ok: false, status: 401, code: 'invalid-token' })
  assert.deepEqual(await run('bm90.anNvbg.c2ln'), { ok: false, status: 401, code: 'invalid-token' })
  assert.equal(calls.length, 0, 'MojoAuth must not be called')
  assert.equal((await run(TOKEN)).ok, true)
  assert.equal(calls.length, 1)
})

test('RateLimiter: fixed window per key, reports seconds to wait, keeps memory bounded', () => {
  const rl = new RateLimiter(2, 60_000, 3)
  assert.equal(rl.hit('a', 0), 0)
  assert.equal(rl.hit('a', 1000), 0)
  assert.equal(rl.hit('a', 2000), 58)
  assert.equal(rl.hit('b', 2000), 0, 'other keys are independent')
  assert.equal(rl.hit('a', 60_000), 0, 'new window')
  for (const k of ['c', 'd', 'e', 'f']) rl.hit(k, 61_000)
  assert.ok((rl as unknown as { windows: Map<string, unknown> }).windows.size <= 3)
})

test('handler: rate limit answers 429 with Retry-After before reading the body or calling MojoAuth', async () => {
  const calls: Call[] = []
  const limits = { perClient: new RateLimiter(2, 60_000), global: new RateLimiter(100, 60_000) }
  const cfg = { ...config(fakeFetch(200, valid(), calls)), limits }
  const from = (ip: string) => {
    const r = post({ token: TOKEN })
    r.headers.set('x-forwarded-for', `${ip}, 10.0.0.1`)
    return r
  }
  assert.equal((await handleRequest(from('203.0.113.7'), cfg)).status, 200)
  assert.equal((await handleRequest(from('203.0.113.7'), cfg)).status, 200)
  const limited = await handleRequest(from('203.0.113.7'), cfg)
  assert.equal(limited.status, 429)
  assert.equal(limited.headers.get('retry-after'), '60')
  assert.equal(limited.headers.get('access-control-allow-origin'), ORIGIN, 'browser can read the 429')
  assert.deepEqual(await limited.json(), { error: 'rate-limited' })
  assert.equal(calls.length, 2, 'the limited request never reached MojoAuth')
  assert.equal((await handleRequest(from('198.51.100.9'), cfg)).status, 200, 'another client is unaffected')

  // The instance-wide cap holds even when every request claims a different address.
  const tight = { ...config(fakeFetch(200, valid())), limits: { perClient: new RateLimiter(100, 60_000), global: new RateLimiter(3, 60_000) } }
  const statuses = []
  for (let i = 0; i < 5; i++) statuses.push((await handleRequest(from(`192.0.2.${i}`), tight)).status)
  assert.deepEqual(statuses, [200, 200, 200, 429, 429])
})

test('handler: an oversized request body is refused without buffering it', async () => {
  const res = await handleRequest(
    new Request('http://local/auth-verify', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: streamOf(Array.from({ length: 64 }, () => new Uint8Array(1024).fill(32))),
      duplex: 'half',
    } as RequestInit),
    { ...config(fakeFetch(200, valid())), limits: createLimits() },
  )
  assert.equal(res.status, 400)
})
