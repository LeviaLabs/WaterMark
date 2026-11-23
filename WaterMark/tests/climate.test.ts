import { describe, expect, it } from 'vitest'
import { busiestMonths, peaksByYear, percentileOf, rainByYear, seasonalMedian, sumKnown, todayIndex } from '../src/scripting/climate'

const series = {
  time: ['2020-01-01', '2020-06-01', '2021-03-01', '2021-03-02', '2021-03-03'],
  values: [10, 60, null, 55, 70],
}

describe('climate summaries', () => {
  it('finds the heaviest day and heavy-rain days of each year, skipping gaps', () => {
    const r = rainByYear(series, 50)
    expect(r.maxDay).toEqual([{ year: 2020, value: 60 }, { year: 2021, value: 70 }])
    expect(r.heavyDays).toEqual([{ year: 2020, value: 1 }, { year: 2021, value: 2 }])
    expect(r.wettest).toEqual({ day: '2021-03-03', mm: 70 })
  })
  it('finds yearly peak flows', () => {
    expect(peaksByYear(series)).toEqual([{ year: 2020, value: 60 }, { year: 2021, value: 70 }])
  })
  it('ranks a value against the history and returns null with no history', () => {
    expect(percentileOf(60, series.values)).toBe(50)
    expect(percentileOf(5, [null])).toBeNull()
  })
  it('takes the median around the same calendar day, across years', () => {
    expect(seasonalMedian('2024-03-02', series, 3)).toBe(62.5)
    expect(seasonalMedian('2024-09-01', series, 3)).toBeNull()
  })
  it('finds today in a daily series', () => {
    expect(todayIndex(['2026-11-21', '2026-11-22'], new Date(2026, 10, 22, 9))).toBe(1)
  })
  it('sums known days and counts nulls instead of treating them as zero', () => {
    expect(sumKnown([null, 1.2, null])).toEqual({ total: 1.2, missing: 2 })
    expect(sumKnown([null, null])).toEqual({ total: 0, missing: 2 })
  })
  it('names the busiest months', () => {
    expect(busiestMonths([0, 0, 0, 0, 0, 3, 9, 9, 1, 0, 0, 0])).toBe('Jul, Aug and Jun')
    expect(busiestMonths(Array(12).fill(0))).toBeNull()
    expect(busiestMonths(undefined)).toBeNull()
  })
})
