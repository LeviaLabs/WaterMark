// Screened gauge alerts client (Agentboxd alert inbox). Fake fetch only: no network.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { alertsUrlFromEnv, loadEmailAlerts, OBSERVATION_NOTICE, parseEmailAlerts, REASON_TEXT } from '../src/services/emailAlerts.ts'

const accepted = {
  id: 'm1',
  receivedAt: '2026-11-22T15:58:00.000Z',
  status: 'accepted',
  reason: 'screened-usgs-alert',
  screening: { injection: 0.01, phishing: 0.02, state: 'screened' },
  site: { id: '01646500', name: 'POTOMAC RIVER', latitude: 38.95, longitude: -77.13 },
  readings: [{ parameter: '00065', label: 'Gage height', unit: 'ft', value: 2.71, time: '2026-11-22T15:50:00.000Z', provisional: true }],
}
const held = { id: 'm2', receivedAt: '2026-11-22T15:59:00.000Z', status: 'quarantined', reason: 'injection-risk', screening: { injection: 0.97, phishing: 0.1, state: 'screened' }, site: null, readings: [] }

test('parses accepted and quarantined alerts', () => {
  const out = parseEmailAlerts({ alerts: [accepted, held] })
  assert.equal(out.length, 2)
  assert.deepEqual(out[0].site, accepted.site)
  assert.equal(out[0].readings[0].value, 2.71)
  assert.equal(out[1].status, 'quarantined')
  assert.equal(out[1].site, null)
})

test('a quarantined alert never carries a site or readings, even if the server sent them', () => {
  const out = parseEmailAlerts({ alerts: [{ ...held, site: accepted.site, readings: accepted.readings }] })
  assert.equal(out[0].site, null)
  assert.deepEqual(out[0].readings, [])
})

test('malformed entries and fields are dropped, not guessed', () => {
  const out = parseEmailAlerts({
    alerts: [
      { ...accepted, status: 'admin' },
      { ...accepted, receivedAt: 'soon' },
      { ...accepted, id: 'm3', site: { ...accepted.site, id: '<script>' } },
      { ...accepted, id: 'm4', site: { ...accepted.site, latitude: 200 }, readings: [{ value: 'NaN' }], screening: { injection: 7 } },
    ],
  })
  assert.deepEqual(out.map((a) => a.id), ['m3', 'm4'])
  assert.equal(out[0].site, null)
  assert.equal(out[1].site?.latitude, null)
  assert.deepEqual(out[1].readings, [])
  assert.equal(out[1].screening.injection, null)
  assert.deepEqual(parseEmailAlerts(null), [])
  assert.deepEqual(parseEmailAlerts({ alerts: 'x' }), [])
})

test('loads from the feed URL without credentials; errors throw', async () => {
  let init: RequestInit | undefined
  const out = await loadEmailAlerts('https://ref.supabase.co/functions/v1/alert-inbox/alerts', async (_u, i) => {
    init = i
    return new Response(JSON.stringify({ alerts: [accepted] }))
  })
  assert.equal(out.length, 1)
  assert.equal(init?.credentials, 'omit')
  await assert.rejects(loadEmailAlerts('https://x', async () => new Response('', { status: 503 })))
})

test('env: URL required; production needs HTTPS and not localhost', () => {
  assert.equal(alertsUrlFromEnv({}), null)
  assert.equal(alertsUrlFromEnv({ VITE_WATERMARK_ALERTS_URL: 'ftp://x' }), null)
  assert.ok(alertsUrlFromEnv({ VITE_WATERMARK_ALERTS_URL: 'http://localhost:8788/alert-inbox/alerts' }))
  assert.equal(alertsUrlFromEnv({ PROD: true, VITE_WATERMARK_ALERTS_URL: 'http://localhost:8788/alert-inbox/alerts' }), null)
  assert.ok(alertsUrlFromEnv({ PROD: true, VITE_WATERMARK_ALERTS_URL: 'https://ref.supabase.co/functions/v1/alert-inbox/alerts' }))
})

test('every server reason has plain-language text', () => {
  for (const r of ['screened-usgs-alert', 'injection-risk', 'phishing-risk', 'check-failed', 'not-checked', 'blocked', 'sender-auth-failed', 'sender-not-allowed', 'no-usgs-site']) {
    assert.ok(REASON_TEXT[r], r)
  }
})

test('readings are labelled as USGS observations, never as warnings or confirmed alerts', () => {
  assert.match(OBSERVATION_NOTICE, /Observed USGS gauge readings/)
  assert.match(OBSERVATION_NOTICE, /Not official National Weather Service/)
  assert.doesNotMatch(REASON_TEXT['screened-usgs-alert'], /confirm|warning/i)
})

