import { describe, expect, it } from 'vitest'
import { alertHeadline, classifyAlert, readWeatherAlert, shownAlerts } from '../src/scripting/alerts'
import type { WeatherAlert } from '../src/scripting/types'

const NOW = new Date('2026-11-23T15:00:00Z')

const activeFlood = (over: Partial<WeatherAlert> = {}): WeatherAlert => ({
  event: 'Flood Warning',
  status: 'Actual',
  messageType: 'Alert',
  onset: '2026-11-23T12:00:00Z',
  effective: '2026-11-23T12:00:00Z',
  ends: '2026-11-24T00:00:00Z',
  expires: '2026-11-24T00:00:00Z',
  ...over,
})

describe('alert classification', () => {
  it('drops Test, Cancel and expired messages from the list and the active count', () => {
    const rows = shownAlerts([
      activeFlood({ status: 'Test' }),
      activeFlood({ messageType: 'Cancel' }),
      activeFlood({ expires: '2026-11-20T00:00:00Z', ends: '2026-11-20T00:00:00Z' }),
      activeFlood(),
    ], NOW)
    expect(rows).toHaveLength(1)
    expect(rows[0].active).toBe(true)
    expect(rows[0].floodRelevance).toBe('flood_hazard_notice')
  })

  it('shows a future onset or effective time as upcoming, not active', () => {
    const byOnset = classifyAlert(activeFlood({ onset: '2026-11-25T15:00:00Z', event: 'Flood Watch' }), NOW)
    expect(byOnset.hazardTiming).toBe('upcoming')
    expect(byOnset.active).toBe(false)
    expect(byOnset.shown).toBe(true)
    const byEffective = classifyAlert(activeFlood({ onset: null, effective: '2026-11-25T15:00:00Z' }), NOW)
    expect(byEffective.hazardTiming).toBe('upcoming')
    expect(byEffective.active).toBe(false)
  })

  it('does not show an alert past its end as active', () => {
    const ended = classifyAlert(activeFlood({ ends: '2026-11-23T14:00:00Z' }), NOW)
    expect(ended.hazardTiming).toBe('ended')
    expect(ended.active).toBe(false)
    expect(ended.shown).toBe(false)
  })

  it('separates flood alerts from other alerts in the headline', () => {
    const headline = alertHeadline([
      activeFlood(),
      activeFlood({ event: 'Wind Advisory' }),
      activeFlood({ event: 'Flood Watch', onset: '2026-11-25T15:00:00Z' }),
    ], NOW)
    expect(headline.text).toBe('1 active flood alert · 1 other alert · 1 upcoming flood alert')
    expect(headline.hasActiveFlood).toBe(true)
    expect(headline.activeFlood).toBe(1)
    expect(headline.activeOther).toBe(1)
  })

  it('treats hydrologic products as flood alerts and hurricanes as other context', () => {
    expect(classifyAlert(activeFlood({ event: 'Hydrologic Outlook' }), NOW).floodRelevance).toBe('flood_hazard_notice')
    expect(classifyAlert(activeFlood({ event: 'Hurricane Warning' }), NOW).floodRelevance).toBe('multi_hazard_context')
    const headline = alertHeadline([
      activeFlood({ status: 'Test' }),
      activeFlood({ event: 'Wind Advisory' }),
    ], NOW)
    expect(headline.text).toBe('1 other alert')
    expect(headline.hasActiveFlood).toBe(false)
  })

  it('uses watermark-v1 timing fields instead of re-deriving them', () => {
    const fromApi = classifyAlert(activeFlood({
      onset: '2026-11-25T15:00:00Z',
      hazardTiming: 'active',
      messageValidity: 'in_force',
      floodRelevance: 'flood_hazard_notice',
    }), NOW)
    expect(fromApi.active).toBe(true)
    expect(fromApi.hazardTiming).toBe('active')
    const upcoming = classifyAlert(activeFlood({
      hazardTiming: 'upcoming',
      messageValidity: 'upcoming',
      floodRelevance: 'multi_hazard_context',
    }), NOW)
    expect(upcoming.active).toBe(false)
    expect(upcoming.floodRelevance).toBe('multi_hazard_context')
    const parsed = readWeatherAlert({
      event: 'Coastal Flood Advisory',
      status: 'Actual',
      hazardTiming: 'upcoming',
      messageValidity: 'upcoming',
      floodRelevance: 'flood_hazard_notice',
      onset: '2026-11-23T12:00:00Z',
    })
    expect(parsed?.hazardTiming).toBe('upcoming')
    expect(classifyAlert(parsed!, NOW).active).toBe(false)
  })
})
