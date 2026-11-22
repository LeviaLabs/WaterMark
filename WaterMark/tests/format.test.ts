import { describe, expect, it } from 'vitest'
import { fmtDate, fmtMiles, fmtRadius, pct, weekday } from '../src/scripting/format'

describe('format', () => {
  it('shows tiny non-zero shares as "under 0.1%" instead of 0.0%', () => {
    expect(pct(0.04)).toBe('under 0.1%')
    expect(pct(0)).toBe('0.0%')
    expect(pct(2.66)).toBe('2.7%')
  })
  it('uses feet below half a mile, miles above', () => {
    expect(fmtRadius(0.3)).toBe('984 ft')
    expect(fmtRadius(1)).toBe('0.62 mi')
    expect(fmtMiles(100)).toBe('62 mi')
  })
  it('handles missing and invalid dates', () => {
    expect(fmtDate(null)).toBe('none')
    expect(fmtDate('not a date')).toBe('none')
    expect(fmtDate('2026-09-27T10:00:00')).toBe('Sep 27, 2026')
  })
  it('reads a calendar day without time-zone drift', () => {
    expect(weekday('2026-11-22')).toBe('Sun')
    expect(weekday('2026-11-22', 'long')).toBe('Sunday')
  })
})
