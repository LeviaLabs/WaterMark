// MojoAuth email-code client and adapter (WM-CLAUDE-002). Fake fetch only: no network.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  createMojoAuthAdapter,
  isEmail,
  isOtp,
  MojoAuthError,
  mojoAuthConfigFromEnv,
  resendEmailCode,
  sendEmailCode,
  SESSION_STORAGE_KEY,
  verifyEmailCode,
  verifyWithBackend,
  type MojoAuthConfig,
} from '../src/services/auth/mojoAuth.ts'

type Call = { url: string; init: RequestInit }
function fake(responses: Array<[number, unknown]>, calls: Call[] = []): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    const [status, body] = responses.shift() ?? [500, {}]
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
}
function memoryStorage() {
  const map = new Map<string, string>()
  return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) }
}
const base = { apiKey: 'public-key-not-real', verifyUrl: 'https://backend.test/functions/v1/auth-verify' }
const cfg = (responses: Array<[number, unknown]>, calls: Call[] = [], storage: MojoAuthConfig['storage'] = null): MojoAuthConfig =>
  ({ ...base, fetcher: fake(responses, calls), storage })
const ACCOUNT = { id: 'user-123', displayName: 'river@example.test', expiresAt: Date.now() + 3_600_000 }
const rejectsWith = async (p: Promise<unknown>, code: string) =>
  assert.rejects(p, (e: unknown) => e instanceof MojoAuthError && e.code === code)

test('input checks', () => {
  assert.ok(isEmail('a@b.co'))
  for (const bad of ['', 'a@b', 'a b@c.d', '@b.co', 'a@b.c'.padStart(260, 'x')]) assert.ok(!isEmail(bad), bad.slice(0, 20))
  assert.ok(isOtp('123456'))
  for (const bad of ['', '123', '12a456', '12345678901']) assert.ok(!isOtp(bad), bad)
})

test('sendEmailCode posts the email with the public key and the user language', async () => {
  const calls: Call[] = []
  const id = await sendEmailCode(cfg([[200, { state_id: 'state-1' }]], calls), '  river@example.test ', 'zh-Hans')
  assert.equal(id, 'state-1')
  assert.equal(calls[0].url, 'https://api.mojoauth.com/users/emailotp?language=zh')
  assert.equal((calls[0].init.headers as Record<string, string>)['x-api-key'], base.apiKey)
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { email: 'river@example.test' })
  assert.equal(calls[0].init.redirect, 'error')
})

test('sendEmailCode: invalid email never reaches the network; 429 and 5xx map to codes', async () => {
  const calls: Call[] = []
  await rejectsWith(sendEmailCode(cfg([], calls), 'nope', 'en'), 'invalid-email')
  assert.equal(calls.length, 0)
  await rejectsWith(sendEmailCode(cfg([[429, {}]]), 'a@b.co', 'en'), 'rate-limited')
  await rejectsWith(sendEmailCode(cfg([[503, {}]]), 'a@b.co', 'en'), 'network')
  await rejectsWith(sendEmailCode(cfg([[200, {}]]), 'a@b.co', 'en'), 'network')
  await rejectsWith(sendEmailCode(cfg([[400, { code: 905, message: 'Invalid API Key' }]]), 'a@b.co', 'en'), 'misconfigured')
  await rejectsWith(sendEmailCode(cfg([[400, { code: 1 }]]), 'a@b.co', 'en'), 'invalid-email')
  const offline = { ...base, fetcher: (async () => { throw new TypeError('offline') }) as typeof fetch }
  await rejectsWith(sendEmailCode(offline, 'a@b.co', 'en'), 'network')
})

test('verifyEmailCode sends a form body and returns the access token', async () => {
  const calls: Call[] = []
  const token = await verifyEmailCode(
    cfg([[200, { authenticated: true, oauth: { access_token: 'a.b.c', refresh_token: 'r' } }]], calls),
    'state-1', ' 123456 ')
  assert.equal(token, 'a.b.c')
  assert.equal(calls[0].url, 'https://api.mojoauth.com/users/emailotp/verify')
  assert.equal(String(calls[0].init.body), 'OTP=123456&state_id=state-1')
  await rejectsWith(verifyEmailCode(cfg([[400, {}]]), 's', '123456'), 'invalid-code')
  await rejectsWith(verifyEmailCode(cfg([[200, { authenticated: false }]]), 's', '123456'), 'invalid-code')
  await rejectsWith(verifyEmailCode(cfg([]), 's', '12'), 'invalid-code')
})

test('resendEmailCode returns the new state id', async () => {
  const calls: Call[] = []
  assert.equal(await resendEmailCode(cfg([[200, { state_id: 'state-2' }]], calls), 'state-1', 'es'), 'state-2')
  assert.equal(calls[0].url, 'https://api.mojoauth.com/users/emailotp/resend?language=es')
})

test('verifyWithBackend keeps only account fields; 401 means expired', async () => {
  const calls: Call[] = []
  const state = await verifyWithBackend(cfg([[200, { account: { ...ACCOUNT, token: 'leak', extra: 1 } }]], calls), 'a.b.c')
  assert.deepEqual(state, { status: 'signed-in', account: { id: 'user-123', displayName: 'river@example.test', provider: 'mojoauth' }, expiresAt: ACCOUNT.expiresAt, error: null })
  assert.equal(calls[0].url, base.verifyUrl)
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { token: 'a.b.c' })
  assert.equal((await verifyWithBackend(cfg([[401, { error: 'invalid-token' }]]), 'a.b.c')).status, 'expired')
  await rejectsWith(verifyWithBackend(cfg([[502, {}]]), 'a.b.c'), 'verify-failed')
  assert.equal((await verifyWithBackend(cfg([[200, { account: { id: '' } }]]), 'a.b.c')).error, 'invalid-state')
})

test('adapter: stores the token in sessionStorage only after the backend verifies it', async () => {
  const storage = memoryStorage()
  const bad = createMojoAuthAdapter(cfg([[401, {}]], [], storage))
  assert.equal((await bad.signIn('a.b.c')).status, 'expired')
  assert.equal(storage.map.size, 0)

  const good = createMojoAuthAdapter(cfg([[200, { account: ACCOUNT }]], [], storage))
  assert.equal((await good.signIn('a.b.c')).status, 'signed-in')
  assert.equal(storage.map.get(SESSION_STORAGE_KEY), 'a.b.c')
  await good.signOut()
  assert.equal(storage.map.size, 0)
})

test('adapter.restore: re-verifies a stored token; clears it when rejected; keeps it when offline', async () => {
  const storage = memoryStorage()
  assert.equal((await createMojoAuthAdapter(cfg([], [], storage)).restore()).status, 'guest')

  storage.setItem(SESSION_STORAGE_KEY, 'a.b.c')
  assert.equal((await createMojoAuthAdapter(cfg([[200, { account: ACCOUNT }]], [], storage)).restore()).status, 'signed-in')

  assert.equal((await createMojoAuthAdapter(cfg([[503, {}]], [], storage)).restore()).status, 'guest')
  assert.equal(storage.map.get(SESSION_STORAGE_KEY), 'a.b.c')

  assert.equal((await createMojoAuthAdapter(cfg([[401, {}]], [], storage)).restore()).status, 'guest')
  assert.equal(storage.map.size, 0)
})

test('config from env: both values required, verify URL must be http(s)', () => {
  assert.equal(mojoAuthConfigFromEnv({}), null)
  assert.equal(mojoAuthConfigFromEnv({ VITE_MOJOAUTH_API_KEY: 'k' }), null)
  assert.equal(mojoAuthConfigFromEnv({ VITE_MOJOAUTH_API_KEY: 'k', VITE_WATERMARK_AUTH_VERIFY_URL: 'javascript:x' }), null)
  assert.deepEqual(
    mojoAuthConfigFromEnv({ VITE_MOJOAUTH_API_KEY: ' k ', VITE_WATERMARK_AUTH_VERIFY_URL: 'http://127.0.0.1:8000/auth-verify' }),
    { apiKey: 'k', verifyUrl: 'http://127.0.0.1:8000/auth-verify' })
})
