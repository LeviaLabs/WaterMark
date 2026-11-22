/// <reference types="node" />
import assert from 'node:assert/strict'
import { afterEach, describe, it, vi } from 'vitest'
import {
  ACCOUNT_FEATURES,
  canUse,
  evaluateSession,
  GUEST,
  guestAdapter,
  PUBLIC_FEATURES,
  sanitizeState,
  watchExpiry,
  type AuthState,
} from '../src/services/auth/session.ts'

const NOW = 1_800_000_000_000
const signedIn = (expiresAt: number | null): AuthState => ({
  status: 'signed-in',
  account: { id: 'user-1', displayName: 'Ana', provider: 'mojoauth' },
  expiresAt,
  error: null,
})

const ALL_STATES: AuthState[] = [
  GUEST,
  { ...GUEST, status: 'loading' },
  { ...GUEST, status: 'error', error: 'x' },
  { ...GUEST, status: 'expired' },
  signedIn(NOW + 60_000),
  signedIn(NOW - 1),
]

describe('access control', () => {
  it('public features work in every auth state, including errors', () => {
    for (const s of ALL_STATES) for (const f of PUBLIC_FEATURES) assert.equal(canUse(s, f, NOW), true, `${s.status} ${f}`)
  })
  it('account features need a live signed-in session', () => {
    for (const f of ACCOUNT_FEATURES) {
      assert.equal(canUse(GUEST, f, NOW), false)
      assert.equal(canUse({ ...GUEST, status: 'loading' }, f, NOW), false)
      assert.equal(canUse({ ...GUEST, status: 'error' }, f, NOW), false)
      assert.equal(canUse(signedIn(NOW - 1), f, NOW), false, 'expired session must not unlock')
      assert.equal(canUse(signedIn(NOW + 60_000), f, NOW), true)
      assert.equal(canUse(signedIn(null), f, NOW), true)
    }
  })
})

describe('session lifecycle', () => {
  it('marks a passed expiry as expired and drops the account', () => {
    const s = evaluateSession(signedIn(NOW), NOW)
    assert.equal(s.status, 'expired')
    assert.equal(s.account, null)
  })
  it('leaves a live session alone', () => {
    const live = signedIn(NOW + 1)
    assert.equal(evaluateSession(live, NOW), live)
  })
})

describe('watchExpiry (AuthProvider uses it to end a session on time)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires once at the expiry time, not before', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    let fired = 0
    watchExpiry(NOW + 60_000, () => fired++)
    vi.advanceTimersByTime(59_999)
    assert.equal(fired, 0)
    vi.advanceTimersByTime(1)
    assert.equal(fired, 1)
    vi.advanceTimersByTime(600_000)
    assert.equal(fired, 1, 'only once')
  })

  it('fires immediately for a session that is already over', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    let fired = 0
    watchExpiry(NOW, () => fired++)
    assert.equal(fired, 1)
  })

  it('catches a missed timer when the tab wakes up (sleep or hidden tab)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const page = new EventTarget()
    let fired = 0
    watchExpiry(NOW + 60_000, () => fired++, [page])
    // The clock jumps past expiry while timers are frozen, as in a laptop waking from sleep.
    vi.setSystemTime(NOW + 120_000)
    assert.equal(fired, 0)
    page.dispatchEvent(new Event('visibilitychange'))
    assert.equal(fired, 1)
    page.dispatchEvent(new Event('focus'))
    assert.equal(fired, 1, 'only once')
  })

  it('a wake-up before expiry changes nothing', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const page = new EventTarget()
    let fired = 0
    watchExpiry(NOW + 60_000, () => fired++, [page])
    vi.setSystemTime(NOW + 30_000)
    page.dispatchEvent(new Event('pageshow'))
    assert.equal(fired, 0)
    vi.advanceTimersByTime(30_000)
    assert.equal(fired, 1)
  })

  it('stop() cancels the timer and the listeners', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const page = new EventTarget()
    let fired = 0
    const stop = watchExpiry(NOW + 1_000, () => fired++, [page])
    stop()
    vi.advanceTimersByTime(5_000)
    page.dispatchEvent(new Event('focus'))
    assert.equal(fired, 0)
  })

  it('protected features close at the expiry instant even before any timer runs', () => {
    const s = signedIn(NOW + 1_000)
    assert.equal(canUse(s, 'savedPlaces', NOW + 999), true)
    assert.equal(canUse(s, 'savedPlaces', NOW + 1_000), false)
    assert.equal(canUse(s, 'map', NOW + 1_000), true, 'public features stay open')
  })
})

describe('sanitizeState', () => {
  it('rejects malformed adapter output', () => {
    for (const bad of [null, 'signed-in', 42, {}, { status: 'admin' }]) {
      assert.deepEqual(sanitizeState(bad), { ...GUEST, error: 'invalid-state' })
    }
  })
  it('rejects signed-in without a valid account or provider', () => {
    assert.equal(sanitizeState({ status: 'signed-in', account: null, expiresAt: null }).status, 'guest')
    assert.equal(sanitizeState({ status: 'signed-in', account: { id: '', provider: 'mojoauth' }, expiresAt: null }).status, 'guest')
    assert.equal(sanitizeState({ status: 'signed-in', account: { id: 'u', provider: 'other' }, expiresAt: null }).status, 'guest')
    assert.equal(sanitizeState({ status: 'signed-in', account: { id: 'u', provider: 'mojoauth' }, expiresAt: 'soon' }).status, 'guest')
  })
  it('strips unknown fields such as tokens', () => {
    const s = sanitizeState({
      status: 'signed-in',
      account: { id: 'u', displayName: '  Ana  ', provider: 'mojoauth', accessToken: 'should-not-survive' },
      expiresAt: NOW,
      token: 'should-not-survive',
    })
    assert.deepEqual(s, { status: 'signed-in', account: { id: 'u', displayName: 'Ana', provider: 'mojoauth' }, expiresAt: NOW, error: null })
    assert.ok(!JSON.stringify(s).includes('should-not-survive'))
  })
  it('clips long error strings', () => {
    assert.equal(sanitizeState({ status: 'error', error: 'x'.repeat(500) }).error?.length, 40)
  })
})

describe('guest adapter', () => {
  it('restores as guest and cannot sign in', async () => {
    assert.equal(guestAdapter.canSignIn, false)
    assert.deepEqual(await guestAdapter.restore(), GUEST)
    assert.equal((await guestAdapter.signIn('a.b.c')).error, 'sign-in-disabled')
  })
})
