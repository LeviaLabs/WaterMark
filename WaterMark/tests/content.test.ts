import { describe, expect, it } from 'vitest'
import { DATA_SOURCES, EVIDENCE_LABELS, EVIDENCE_RULES } from '../src/scripting/content/dataSources'
import { EVIDENCE_LAYERS, activeLayerIndex } from '../src/scripting/content/evidenceLayers'
import { FEATURES } from '../src/scripting/content/features'
import { TEAM } from '../src/scripting/content/team'

describe('landing content', () => {
  it('links every data source over https, without duplicates', () => {
    const urls = DATA_SOURCES.map((source) => source.url)
    expect(new Set(urls).size).toBe(urls.length)
    for (const url of urls) expect(url.startsWith('https://')).toBe(true)
  })

  it('explains every kind of evidence exactly once', () => {
    const kinds = EVIDENCE_RULES.map((rule) => rule.kind).sort()
    expect(kinds).toEqual(Object.keys(EVIDENCE_LABELS).sort())
  })

  it('credits all three team members with their work', () => {
    expect(TEAM.map((member) => member.name)).toEqual(['Ryan Bergman', 'Ryan Lin', 'Decong Huang'])
    for (const member of TEAM) expect(member.work.length).toBeGreaterThan(0)
  })

  it('gives every feature a priority from the README', () => {
    for (const feature of FEATURES) expect(['P0', 'P1', 'P2']).toContain(feature.priority)
  })
})

describe('activeLayerIndex', () => {
  it('walks through every layer and clamps at the ends', () => {
    const count = EVIDENCE_LAYERS.length
    expect(activeLayerIndex(-0.5)).toBe(0)
    expect(activeLayerIndex(0)).toBe(0)
    expect(activeLayerIndex(1)).toBe(count - 1)
    expect(activeLayerIndex(2)).toBe(count - 1)
    const seen = new Set(Array.from({ length: 101 }, (_, i) => activeLayerIndex(i / 100)))
    expect(seen.size).toBe(count)
  })
})
