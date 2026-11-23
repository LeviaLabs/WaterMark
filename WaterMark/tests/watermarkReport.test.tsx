// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { AreaReport } from '../src/components/map/AreaReport'
import { makeCircle } from '../src/scripting/geo'
import type { AreaReport as Report, GlobalFloodCollection, Selection } from '../src/scripting/types'
import type { ApiResult, WatermarkReport } from '../src/scripting/watermark/types'

const CENTER: [number, number] = [-98.5, 39.8]
const selection: Selection = { center: CENTER, radiusKm: 2, label: 'Test area', circle: makeCircle(CENTER, 2) }

function mount(node: ReactNode) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root: Root = createRoot(host)
  act(() => { root.render(node) })
  return {
    host,
    text: () => host.textContent ?? '',
    unmount() {
      act(() => { root.unmount() })
      host.remove()
    },
  }
}

function part<T>(status: ApiResult<T>['status'], data: T | null, error?: { code: string; message: string }): ApiResult<T> {
  return {
    status,
    sourceName: status === 'error' ? 'watermark-v1' : 'Test source',
    sourceUrl: status === 'error' ? null : 'https://example.test/source',
    fetchedAt: '2026-11-23T12:00:00Z',
    units: null,
    limitations: ['Fixture, not a live reading.'],
    qualityFlags: [],
    error: error ?? null,
    data,
  }
}

function view(status: ApiResult<unknown>['status']): WatermarkReport {
  const samples = [
    { validFrom: '2026-11-23T15:00:00Z', validTo: '2026-11-23T16:00:00Z', value: status === 'available' ? 2 : null },
    { validFrom: '2026-11-23T16:00:00Z', validTo: '2026-11-23T17:00:00Z', value: null },
  ]
  return {
    generatedAt: '2026-11-23T12:00:00Z',
    health: 'ready',
    healthDetail: null,
    rainfall: part(status, status === 'error' ? null : samples),
    river: part(status, status === 'error' ? null : [{ validFrom: '2026-11-23T00:00:00Z', validTo: '2026-11-24T00:00:00Z', value: null }]),
    alerts: part(status, status === 'available' || status === 'stale' ? [] : null),
    exposure: part(status === 'available' ? 'insufficient_data' : status, null),
    floods: part(status === 'available' ? 'insufficient_data' : status, { stationCount: null, eventCount: null, zeroEventMatchesVerified: false }),
    area: part(status, status === 'error' ? null : {
      stationCount: null,
      cachedEventCount: status === 'available' ? 2 : null,
      sampledHistoricalMaxDepthMm: null,
      coverageStatus: 'incomplete',
      zeroMatchesVerified: false,
      windowStart: null,
      windowEnd: null,
      cacheOldestFetchedAt: null,
      cacheNewestFetchedAt: null,
      radiusMeters: 2000,
      center: { lat: 39.8, lon: -98.5 },
    }, status === 'error' ? { code: 'INVALID_RADIUS', message: 'Radius must be between 100 and 10000 meters.' } : undefined),
    series: part('insufficient_data', { count: null }),
    request: { center: { lat: 39.8, lon: -98.5 }, radiusMeters: 2000 },
    radiusClamped: false,
  }
}

function baseReport(watermark: WatermarkReport): Report {
  return {
    rain: 'error',
    river: 'error',
    rainHistory: 'error',
    riverHistory: 'error',
    elevation: null,
    country: 'US',
    zone: { center: null, inArea: [] },
    storm: { nuisance: 0, deep: 0, partial: false, none: true },
    zip: 'none',
    alerts: [],
    claims: 'none',
    watermark,
  }
}

describe('watermark area report statuses', () => {
  const views: { unmount: () => void }[] = []
  afterEach(() => { views.splice(0).forEach((item) => item.unmount()) })

  it.each([
    ['available', 'Available'],
    ['stale', 'Stale'],
    ['insufficient_data', 'Not enough data'],
    ['unsupported', 'Not covered'],
    ['error', 'data unavailable'],
  ] as const)('renders %s without calling it safe', (status, label) => {
    const shown = mount(
      <AreaReport selection={selection} report={baseReport(view(status))} onRetry={() => {}} sensors="unsupported" floods="unsupported" />,
    )
    views.push(shown)
    const text = shown.text()
    expect(shown.host.querySelector(`[data-status="${status}"]`)).toBeTruthy()
    expect(text).toContain(label)
    expect(text).not.toMatch(/\bsafe\b/i)
    if (status !== 'available' && status !== 'stale') {
      expect(text).not.toContain('No active alerts or high-risk zone found here')
      expect(text).toMatch(/not the same as low risk|says nothing about the risk|data unavailable/i)
    }
  })

  it('shows missing counts and null rain as no data, and names INVALID_RADIUS', () => {
    const shown = mount(
      <AreaReport selection={selection} report={baseReport(view('available'))} onRetry={() => {}} sensors="unsupported" floods="unsupported" />,
    )
    views.push(shown)
    const counts = [...shown.host.querySelectorAll('.wm-count')].map((node) => node.textContent)
    expect(counts).toContain('No data')
    expect(counts).toContain('≥ 2')
    expect(counts).not.toContain('0')
    expect(shown.text()).toContain('No data')
    expect(shown.text()).not.toMatch(/0\.0 mm/)
    const denied = mount(
      <AreaReport selection={selection} report={baseReport(view('error'))} onRetry={() => {}} sensors="unsupported" floods="unsupported" />,
    )
    views.push(denied)
    expect(denied.text()).toContain('INVALID_RADIUS')
    expect(denied.text()).toContain('data unavailable')
  })

  it('renders an https source and omits a non-https GDACS link', () => {
    const shown = mount(
      <AreaReport selection={selection} report={baseReport(view('stale'))} onRetry={() => {}} sensors="unsupported" floods="unsupported" />,
    )
    views.push(shown)
    const source = [...shown.host.querySelectorAll('a')].find((anchor) => anchor.textContent?.includes('Test source'))
    expect(source?.getAttribute('href')).toBe('https://example.test/source')
    const insecure: GlobalFloodCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: CENTER },
        properties: {
          name: 'River flood', alertlevel: 'Orange', color: '#f80', active: true,
          fromdate: '2026-11-01', todate: '2026-11-20', report: 'http://gdacs.example/report',
        },
      }],
    }
    const flood = mount(
      <AreaReport selection={selection} report={baseReport(view('insufficient_data'))} onRetry={() => {}} sensors="unsupported" floods={insecure} />,
    )
    views.push(flood)
    const floodButton = [...flood.host.querySelectorAll('button')].find((button) => button.textContent?.includes('Nearest reported flood'))
    expect(floodButton).toBeTruthy()
    act(() => { floodButton?.click() })
    expect(flood.text()).toContain('not an https address')
    expect([...flood.host.querySelectorAll('a')].some((anchor) => anchor.getAttribute('href')?.startsWith('http:'))).toBe(false)
  })
})
