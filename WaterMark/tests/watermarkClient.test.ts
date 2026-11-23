import { afterEach, describe, expect, it, vi } from 'vitest'
import { floodEventCount } from '../src/services/floodnet'
import { watermarkApiUrlFromEnv } from '../src/services/watermark/config'
import { createWatermarkClient } from '../src/services/watermark/client'
import { loadWatermarkArea } from '../src/services/watermark/loadArea'
import { encodeAreaBody, guardJsonBody, watermarkUrl } from '../src/scripting/watermark/parse'
import { WATERMARK_PATHS, WatermarkApiError } from '../src/scripting/watermark/types'

const BASE = 'https://example.test/functions/v1/watermark-v1'
const GENERATED = '2026-11-23T12:00:00Z'

function envelope(data: unknown, status = 200) {
  return new Response(JSON.stringify({ apiVersion: '1.0', generatedAt: GENERATED, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorEnvelope(status: number, code: string, message: string) {
  return new Response(JSON.stringify({
    apiVersion: '1.0',
    generatedAt: GENERATED,
    error: { code, message },
  }), { status, headers: { 'Content-Type': 'application/json' } })
}

function result(status: string, data: unknown, units = 'mm') {
  return {
    status,
    kind: 'test',
    source: { id: 'src', name: 'Test source', url: 'https://example.test/source', geographicCoverage: 'fixture' },
    location: { lat: 40.67, lon: -73.98 },
    coverage: { method: 'point query' },
    observedAt: null,
    forecastIssuedAt: null,
    validFrom: '2026-11-23T00:00:00Z',
    validTo: '2026-11-24T00:00:00Z',
    fetchedAt: GENERATED,
    sourceUpdatedAt: null,
    sourceLanguage: null,
    units,
    data,
    qualityFlags: [],
    limitations: ['Fixture, not a live reading.'],
  }
}

function locationBody(status: string) {
  const rain = result(status, {
    samples: [
      { validFrom: '2026-11-23T15:00:00Z', validTo: '2026-11-23T16:00:00Z', value: status === 'available' ? 1.25 : null },
      { validFrom: '2026-11-23T16:00:00Z', validTo: '2026-11-23T17:00:00Z', value: null },
    ],
    model: 'Open-Meteo best match',
  })
  return {
    location: { lat: 40.67, lon: -73.98 },
    rainfall: rain,
    riverDischarge: result(status, {
      samples: [{ validFrom: '2026-11-23T00:00:00Z', validTo: '2026-11-24T00:00:00Z', value: status === 'available' ? 12 : null }],
      model: 'GloFAS',
    }, 'm3/s'),
    officialAlerts: result(status, status === 'available' ? [{
      event: 'Flood Warning',
      severity: 'Severe',
      urgency: 'Immediate',
      certainty: 'Observed',
      headline: 'Flood warning',
      instruction: 'Move to higher ground',
      onset: '2026-11-23T12:00:00Z',
      effective: '2026-11-23T12:00:00Z',
      ends: '2026-11-24T06:00:00Z',
      expires: '2026-11-24T06:00:00Z',
      messageType: 'Alert',
      hazardTiming: 'active',
      messageValidity: 'in_force',
      floodRelevance: 'flood_hazard_notice',
    }] : []),
    historicalFloods: result('insufficient_data', {
      stations: [],
      events: [],
      queryEvidence: { eventSearchCompleted: true, zeroEventMatchesVerified: false, windowStart: null, windowEnd: GENERATED },
    }),
    modeledExposure: result(status === 'unsupported' ? 'unsupported' : 'insufficient_data', null),
  }
}

describe('watermark API url', () => {
  it('uses a configured https base and ignores an empty or unsafe value', () => {
    expect(watermarkApiUrlFromEnv({})).toBeNull()
    expect(watermarkApiUrlFromEnv({ VITE_WATERMARK_API_URL: '  ' })).toBeNull()
    expect(watermarkApiUrlFromEnv({ VITE_WATERMARK_API_URL: 'javascript:alert(1)' })).toBeNull()
    expect(watermarkApiUrlFromEnv({ VITE_WATERMARK_API_URL: `${BASE}/` })).toBe(BASE)
    expect(watermarkApiUrlFromEnv({ VITE_WATERMARK_API_URL: 'http://127.0.0.1:54321/functions/v1/watermark-v1' })).toBe('http://127.0.0.1:54321/functions/v1/watermark-v1')
    expect(watermarkApiUrlFromEnv({ PROD: true, VITE_WATERMARK_API_URL: 'http://127.0.0.1:54321/functions/v1/watermark-v1' })).toBeNull()
    expect(watermarkApiUrlFromEnv({ PROD: true, VITE_WATERMARK_API_URL: BASE })).toBe(BASE)
  })
})

describe('watermark client', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('does not call undocumented routes', () => {
    expect(WATERMARK_PATHS).not.toContain('/flood-zones')
    expect(() => watermarkUrl(BASE, '/flood-zones')).toThrow(WatermarkApiError)
    expect(() => watermarkUrl(BASE, '/flood-zones')).toThrow(/Unknown API route/)
  })

  it('rejects an out-of-range radius and an oversized body before fetch', () => {
    const fetchImpl = vi.fn()
    const client = createWatermarkClient(BASE, fetchImpl as unknown as typeof fetch)
    expect(() => encodeAreaBody({ lat: 40.67, lon: -73.98 }, 50)).toThrow(/INVALID_RADIUS|100 and 10000/)
    return expect(client.areaSummary({ lat: 40.67, lon: -73.98 }, 50)).rejects.toMatchObject({ code: 'INVALID_RADIUS' }).finally(() => {
      expect(fetchImpl).not.toHaveBeenCalled()
    }).then(() => {
      expect(() => guardJsonBody('x'.repeat(4097))).toThrow(WatermarkApiError)
    })
  })

  it('posts the center and radius with no key and keeps a null rain sample', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const path = new URL(url).pathname
      if (path.endsWith('/health')) return envelope({ status: 'ready', providers: [] })
      if (path.endsWith('/location-summary')) return envelope(locationBody('available'))
      if (path.endsWith('/area-summary')) return envelope({
        ...result('available', {
          stationCount: null,
          cachedEventCount: 4,
          sampledHistoricalMaxDepthMm: null,
          coverageStatus: 'incomplete',
          zeroMatchesVerified: false,
          windowStart: '2026-08-25T00:00:00Z',
          windowEnd: GENERATED,
          cacheOldestFetchedAt: GENERATED,
          cacheNewestFetchedAt: GENERATED,
        }),
        center: { lat: 40.67, lon: -73.98 },
        radiusMeters: 1200,
      })
      if (path.endsWith('/series')) return envelope(result('insufficient_data', { events: [] }))
      if (path.endsWith('/rainfall')) return envelope(result('stale', { samples: [{ validFrom: '2026-11-23T15:00:00Z', validTo: '2026-11-23T16:00:00Z', value: null }], model: 'x' }))
      if (path.endsWith('/alerts')) return envelope(result('unsupported', []))
      if (path.endsWith('/flood-exposure')) return envelope(result('insufficient_data', null))
      return errorEnvelope(404, 'NOT_FOUND', 'Unknown API route.')
    })
    const client = createWatermarkClient(BASE, fetchImpl as unknown as typeof fetch)
    const loaded = await loadWatermarkArea(client, 40.67, -73.98, 1.2)
    const urls = fetchImpl.mock.calls.map((call) => String(call[0]))
    expect(urls.some((url) => url.includes('/location-summary?'))).toBe(true)
    expect(urls.some((url) => url.includes('/area-summary'))).toBe(true)
    expect(urls.some((url) => url.includes('/health'))).toBe(true)
    expect(urls.some((url) => url.includes('/series') && url.includes('kind=historical_flood_events'))).toBe(true)
    expect(urls.some((url) => url.includes('/flood-zones') || url.includes('open-meteo'))).toBe(false)
    const areaCall = fetchImpl.mock.calls.find((call) => String(call[0]).includes('/area-summary'))
    const init = areaCall?.[1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('omit')
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(JSON.stringify(init.headers)).not.toMatch(/authorization|apikey/i)
    expect(JSON.parse(String(init.body))).toEqual({ center: { lat: 40.67, lon: -73.98 }, radiusMeters: 1200 })
    expect(loaded.rainfall.data?.[1].value).toBeNull()
    expect(loaded.area.data?.stationCount).toBeNull()
    expect(loaded.area.data?.cachedEventCount).toBe(4)
    expect(loaded.floods.data?.eventCount).toBeNull()
    expect(loaded.series.data?.count).toBeNull()
    expect(loaded.alerts.data?.[0].hazardTiming).toBe('active')

    const rain = await client.rainfall(40.67, -73.98)
    expect(rain.status).toBe('stale')
    expect(rain.data?.[0].value).toBeNull()
    const alerts = await client.alerts(40.67, -73.98)
    expect(alerts.status).toBe('unsupported')
    const exposure = await client.floodExposure(40.67, -73.98)
    expect(exposure.status).toBe('insufficient_data')
  })

  it('surfaces INVALID_RADIUS and a 413 body from the API', async () => {
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls += 1
      return calls === 1
        ? errorEnvelope(400, 'INVALID_RADIUS', 'Radius must be between 100 and 10000 meters.')
        : errorEnvelope(413, 'PAYLOAD_TOO_LARGE', 'Payload exceeds size limit.')
    })
    const client = createWatermarkClient(BASE, fetchImpl as unknown as typeof fetch)
    await expect(client.areaSummary({ lat: 40.67, lon: -73.98 }, 1000)).rejects.toMatchObject({
      code: 'INVALID_RADIUS',
      status: 400,
    })
    await expect(client.areaSummary({ lat: 40.67, lon: -73.98 }, 1000)).rejects.toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
      status: 413,
    })
  })

  it('keeps each contract status on the location summary', async () => {
    for (const status of ['available', 'stale', 'insufficient_data', 'unsupported', 'error'] as const) {
      const fetchImpl = vi.fn(async () => envelope(locationBody(status)))
      const client = createWatermarkClient(BASE, fetchImpl as unknown as typeof fetch)
      const summary = await client.locationSummary(40.67, -73.98)
      expect(summary.rainfall.status).toBe(status)
      expect(summary.river.status).toBe(status)
      expect(summary.alerts.status).toBe(status)
    }
  })
})

describe('flood event counts', () => {
  it('does not turn a missing count into zero', () => {
    expect(floodEventCount(undefined)).toBeNull()
    expect(floodEventCount('')).toBeNull()
    expect(floodEventCount('nope')).toBeNull()
    expect(floodEventCount('0')).toBe(0)
    expect(floodEventCount('3')).toBe(3)
  })
})
