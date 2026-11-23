import { describe, expect, it } from 'vitest'
import { DATA_SOURCES, EVIDENCE_LABELS, EVIDENCE_RULES } from '../src/scripting/content/dataSources'
import { DIGEST_LANGUAGES, EXAMPLE_RAINFALL, EXAMPLE_THREAD, PILOT_PLACES } from '../src/scripting/content/featureExamples'
import { STORY_STEPS, activeStepIndex } from '../src/scripting/content/featureStory'
import { TEAM } from '../src/scripting/content/team'
import { totalOf, peakOf, formatHour } from '../src/scripting/evidence/format'

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

  it('credits all four team members, each item with a build status', () => {
    expect(TEAM.map((member) => member.name)).toEqual(['Ryan Bergman', 'Daniel Manita', 'Ryan Lin', 'Decong Huang'])
    for (const member of TEAM) {
      expect(member.work.length).toBeGreaterThan(0)
      for (const item of member.work) expect(['built', 'review', 'planned']).toContain(item.status)
    }
  })

  it('gives every story step a unique id, a README priority and an owner', () => {
    expect(new Set(STORY_STEPS.map((step) => step.id)).size).toBe(STORY_STEPS.length)
    for (const step of STORY_STEPS) {
      expect(['P0', 'P1', 'P2']).toContain(step.priority)
      expect(step.owners.length).toBeGreaterThan(0)
    }
  })

  it('marks all shipped story features including zoom/timeline, assistant, and audiences as built', () => {
    for (const id of ['zoom', 'area', 'assistant', 'audiences', 'digest'] as const) {
      expect(STORY_STEPS.find((step) => step.id === id)?.status).toBe('built')
    }
  })
})

describe('example data', () => {
  it('keeps pilot places inside New York Harbor and its coast', () => {
    for (const place of PILOT_PLACES) {
      expect(place.lat).toBeGreaterThan(40.4)
      expect(place.lat).toBeLessThan(40.8)
      expect(place.lon).toBeGreaterThan(-74.1)
      expect(place.lon).toBeLessThan(-73.7)
    }
  })

  it('matches what the example assistant answer says about the rain', () => {
    const samples = EXAMPLE_RAINFALL.data!.samples
    expect(Math.round(totalOf(samples)!)).toBe(30)
    expect(formatHour(peakOf(samples)!.validFrom, 'America/New_York')).toBe('9 PM')
    expect(EXAMPLE_THREAD.some((message) => message.text.includes('about 30 mm') && message.text.includes('9 PM'))).toBe(true)
  })

  it('offers the five languages from the localization work', () => {
    expect(DIGEST_LANGUAGES.map((language) => language.code)).toEqual(['en', 'es', 'zh-Hans', 'ru', 'hi'])
  })
})

describe('activeStepIndex', () => {
  it('walks through every step and clamps at the ends', () => {
    const count = STORY_STEPS.length
    expect(activeStepIndex(-0.5)).toBe(0)
    expect(activeStepIndex(0)).toBe(0)
    expect(activeStepIndex(1)).toBe(count - 1)
    expect(activeStepIndex(2)).toBe(count - 1)
    expect(activeStepIndex(Number.NaN)).toBe(0)
    const seen = new Set(Array.from({ length: 101 }, (_, i) => activeStepIndex(i / 100)))
    expect(seen.size).toBe(count)
  })
})
