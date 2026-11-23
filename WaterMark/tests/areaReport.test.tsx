// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AreaReport } from '../src/components/map/AreaReport'
import { AlertsList } from '../src/components/map/AlertsList'
import { makeCircle } from '../src/scripting/geo'
import type { AreaReport as Report, Selection, WeatherAlert } from '../src/scripting/types'

const NOW = new Date('2026-11-23T15:00:00Z')
const CENTER: [number, number] = [-98.5, 39.8]
const selection: Selection = {
  center: CENTER,
  radiusKm: 2,
  label: 'Test area',
  circle: makeCircle(CENTER, 2),
}
const zone = { center: null, inArea: [] as string[] }
const storm = { nuisance: 0, deep: 0, partial: false, none: true }
const ALL_CLEAR = 'No active alerts or high-risk zone found here'
const GUARANTEE = 'not a safety guarantee'

function report(over: Partial<Report> = {}): Report {
  return {
    rain: 'error',
    river: 'error',
    rainHistory: 'error',
    riverHistory: 'error',
    elevation: 12,
    country: 'US',
    zone,
    storm,
    zip: 'none',
    alerts: [],
    claims: 'none',
    ...over,
  }
}

const activeFlood = (over: Partial<WeatherAlert> = {}): WeatherAlert => ({
  event: 'Flood Warning',
  status: 'Actual',
  messageType: 'Alert',
  headline: 'Flood warning for the test area',
  onset: '2026-11-23T12:00:00Z',
  effective: '2026-11-23T12:00:00Z',
  ends: '2026-11-24T06:00:00Z',
  expires: '2026-11-24T06:00:00Z',
  ...over,
})

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

function renderReport(value: Report) {
  return mount(
    <AreaReport selection={selection} report={value} onRetry={() => {}} sensors="unsupported" floods="unsupported" />,
  )
}

describe('area report availability', () => {
  const views: { unmount: () => void }[] = []
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    views.splice(0).forEach((view) => view.unmount())
    vi.useRealTimers()
  })

  const cases: { name: string; report: Report; unavailable: string | null; allClear: boolean; extra?: string }[] = [
    { name: 'every source loaded with nothing found', report: report(), unavailable: null, allClear: true },
    { name: 'F1c alerts empty while zone and storm failed', report: report({ zone: 'error', storm: 'error' }), unavailable: 'FEMA flood zones, the heavy-rain flood model', allClear: false },
    { name: 'zone failed and storm loaded', report: report({ zone: 'error' }), unavailable: 'FEMA flood zones', allClear: false },
    { name: 'storm failed and zone loaded', report: report({ storm: 'error' }), unavailable: 'the heavy-rain flood model', allClear: false },
    { name: 'alerts failed and the maps loaded', report: report({ alerts: 'error' }), unavailable: 'weather alerts', allClear: false },
    { name: 'F1a alerts, zone and storm all failed', report: report({ alerts: 'error', zone: 'error', storm: 'error' }), unavailable: 'weather alerts, FEMA flood zones, the heavy-rain flood model', allClear: false },
    { name: 'F1b alerts, zone and storm still loading', report: report({ alerts: null, zone: null, storm: null }), unavailable: null, allClear: false, extra: 'Loading weather alerts, FEMA flood zones, the heavy-rain flood model' },
    { name: 'an active flood alert beside a failed zone', report: report({ alerts: [activeFlood()], zone: 'error' }), unavailable: 'FEMA flood zones', allClear: false, extra: '1 active flood alert' },
  ]

  it.each(cases)('$name', ({ report: value, unavailable, allClear, extra }) => {
    const view = renderReport(value)
    views.push(view)
    const text = view.text()
    if (unavailable) expect(text).toContain(`Some data unavailable: ${unavailable}.`)
    else expect(text).not.toContain('Some data unavailable:')
    if (allClear) {
      expect(text).toContain(ALL_CLEAR)
      expect(text).toContain(GUARANTEE)
    } else {
      expect(text).not.toContain(ALL_CLEAR)
      expect(text).not.toContain('No active alerts here')
    }
    if (extra) expect(text).toContain(extra)
    expect(text).not.toMatch(/\bsafe\b/i)
  })

  it('counts a future flood watch as upcoming and a wind advisory as other, not as two active alerts', () => {
    const view = renderReport(report({
      alerts: [
        activeFlood({ event: 'Flood Watch', onset: '2026-11-25T15:00:00Z' }),
        activeFlood({ event: 'Wind Advisory' }),
        activeFlood({ status: 'Test', event: 'Flash Flood Warning' }),
      ],
    }))
    views.push(view)
    const text = view.text()
    expect(text).toContain('1 other alert · 1 upcoming flood alert')
    expect(text).not.toContain('There is an active alert')
    expect(text).not.toContain('2 active')
    expect(text).not.toContain(ALL_CLEAR)
  })
})

describe('null rainfall and river today', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
  afterEach(() => { vi.useRealTimers() })

  it('renders null precipitation as no data and does not label another river day as today', () => {
    const days = ['2026-11-23', '2026-11-24', '2026-11-25']
    const view = renderReport(report({
      zone: { center: { FLD_ZONE: 'X' }, inArea: ['X'] },
      rain: { time: days, mm: [null, 1.2, null], probability: [null, null, null], timezone: 'UTC' },
      river: {
        time: days,
        flow: [null, 250, 10],
        median: [null, 250, 10],
        p25: [null, 250, 10],
        p75: [null, 250, 10],
        min: [null, 250, 10],
        max: [null, 250, 10],
      },
    }))
    const text = view.text()
    expect(text).toContain('—')
    expect(text).toContain('2 days in this forecast have no data')
    const today = [...view.host.querySelectorAll('.stat-row')].find((row) => row.querySelector('span')?.textContent === 'Today')
    expect(today?.textContent).toContain('No data')
    expect(today?.textContent).not.toContain('250')
    const riverTile = [...view.host.querySelectorAll('.report-tile')].find((tile) => tile.textContent?.includes('River now'))
    expect(riverTile?.textContent).toContain('No data')
    expect(riverTile?.textContent).not.toContain('250')
    const zoneButton = [...view.host.querySelectorAll('button')].find((button) => button.textContent?.includes('FEMA flood zones'))
    expect(zoneButton).toBeTruthy()
    act(() => { zoneButton?.click() })
    expect(zoneButton?.getAttribute('aria-expanded')).toBe('true')
    expect(view.text()).toContain('Zones in this area')
    expect(view.text()).toContain('X')
    view.unmount()
  })
})

describe('alerts list times', () => {
  it('shows the start and the end, and omits a test message', () => {
    const view = mount(
      <AlertsList alerts={[
        activeFlood({ status: 'Test' }),
        activeFlood({ event: 'Flood Watch', onset: '2026-11-25T15:00:00Z', headline: 'Watch headline' }),
      ]} />,
    )
    const text = view.text()
    expect(text).toContain('Upcoming')
    expect(text).toContain('Starts ')
    expect(text).toContain('Until ')
    expect(text).not.toContain('Test')
    expect(text).toContain('Watch headline')
    view.unmount()
  })
})
