import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { cellAt, cellBounds, cellIndex, howOften, parseGrid } from '../src/scripting/cells'
import { cellLegend } from '../src/scripting/choropleth'

describe('flood grid', () => {
  it('maps points to squares and back', () => {
    expect(cellIndex([-77.86, 40.79], 0.5)).toEqual([204, 261])
    expect(cellBounds(204, 261, 0.5)).toEqual([-78, 40.5, -77.5, 41])
  })
  it('parses rows and returns an empty square where nothing is recorded', () => {
    const g = parseGrid({ size: 0.5, years: [2016, 2025], rows: [[204, 261, 7, 4, 2018, 3, 1, 25000], ['bad']] }, 'us')
    expect(g.cells.features).toHaveLength(1)
    expect(cellAt([-77.86, 40.79], g)).toMatchObject({ e: 7, wy: 2018, a: 1, b: 25000 })
    expect(cellAt([-70.1, 40.79], g)).toMatchObject({ e: 0, n: 0 })
    expect(() => parseGrid({ rows: 3 }, 'us')).toThrow()
  })
  it('says how often in plain words, never as a tiny decimal', () => {
    expect(howOften(0, 10)).toBe('none recorded')
    expect(howOften(1, 25)).toBe('once in 25 years')
    expect(howOften(2, 25)).toBe('about one every 13 years')
    expect(howOften(7, 10)).toBe('nearly one a year')
    expect(howOften(10, 10)).toBe('about one a year')
    expect(howOften(274, 10)).toBe('about 27 a year')
  })
  it('builds legend rows that match the map colors, even with repeated breaks', () => {
    expect(cellLegend([3, 9, 22, 43, 88])).toEqual([
      { cls: 1, label: '1–2' }, { cls: 2, label: '3–8' }, { cls: 3, label: '9–21' },
      { cls: 4, label: '22–42' }, { cls: 5, label: '43–87' }, { cls: 6, label: '88+' },
    ])
    const rows = cellLegend([1, 1, 2, 3, 6])
    expect(rows.map((r) => r.label)).toEqual(['1', '2', '3–5', '6+'])
  })
  it('ships both built grids', () => {
    for (const kind of ['us', 'world'] as const) {
      const g = parseGrid(JSON.parse(readFileSync(`public/data/floods/cells-${kind}.json`, 'utf8')), kind)
      expect(g.cells.features.length).toBeGreaterThan(500)
    }
  })
})
