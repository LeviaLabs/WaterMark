/// <reference types="node" />
import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  ACCOUNT_FEATURES,
  canUse,
  evaluateSession,
  GUEST,
  guestAdapter,
  PUBLIC_FEATURES,
  sanitizeState,
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
