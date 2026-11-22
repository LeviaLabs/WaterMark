// The flood outlook (worked out in code) and the open-weight summary proxy (with a fake fetch,
// never the real model).
import { describe, expect, it } from 'vitest'
import { buildOutlook, floodSeason, isCautious, isGrounded, rateText, recurrenceOf, summaryFacts, type PlaceHistory } from '../src/scripting/outlook'
import { cleanText, DEFAULT_MODELS, modelsFrom, parseSummaryRequest, runSummary } from '../../supabase/functions/outlook-summary/core.mts'
import type { DailySeries } from '../src/scripting/climate'
import type { RainOutlook, RiverOutlook } from '../src/scripting/types'

const NOW = new Date(2026, 10, 22, 12) // Nov 22, 2026, local time
const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => {
  const d = new Date(Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)) + i))
  return d.toISOString().slice(0, 10)
})
/** 20 years of daily history, each year's maximum `peak` on Jun 1, everything else `base`. */
function history(peak: number, base = 1): DailySeries {
  const time = days('2005-01-01', 365 * 20)
  return { time, values: time.map((d) => (d.endsWith('-06-01') ? peak : base)) }
}
const rainFor = (mm: number[]): RainOutlook => {
  const time = days('2026-11-22', mm.length)
  return { time, mm, probability: mm.map(() => null), timezone: 'UTC' }
}
const riverFor = (flow: number[]): RiverOutlook => {
  const time = days('2026-11-22', flow.length)
  return { time, flow, median: flow, p25: flow, p75: flow, min: flow, max: flow }
}
const harris: PlaceHistory = {
  level: 'county', name: 'Harris County, Texas', firstYear: 2016, perYear: [7, 10, 3, 5, 3, 6, 1, 7, 3, 3],
  months: [4, 1, 2, 2, 13, 11, 4, 4, 5, 1, 0, 1], last: '2025-08-31', unit: 'NOAA flood episodes', source: 'NOAA', url: 'https://www.ncdc.noaa.gov/stormevents/',
}
const quiet = {
  rain: rainFor(Array(16).fill(2)), rainHistory: history(60), river: riverFor(Array(30).fill(50)), riverHistory: history(400, 40),
  alerts: [], history: [harris], now: NOW,
}

describe('flood outlook', () => {
  it('says nothing points to flooding when forecasts stay low, never that it is safe', () => {
    const o = buildOutlook(quiet)
    expect(o.level).toBe('quiet')
    expect(o.isPending).toBe(false)
    expect(o.headline).toMatch(/not a guarantee/)
    expect(o.headline).not.toMatch(/safe/i)
    expect(o.signals.map((s) => s.kind)).toEqual(['alert', 'rain', 'river'])
  })
  it("raises the outlook for rain as heavy as a typical year's wettest day, or a river at a typical year's high", () => {
    const rain = buildOutlook({ ...quiet, rain: rainFor([0, 0, 70, ...Array(13).fill(0)]) })
    expect(rain.level).toBe('elevated')
    expect(rain.signals.find((s) => s.kind === 'rain')?.text).toMatch(/70 mm \(2\.8 in\) on Tue, Nov 24.*60 mm/)
    const river = buildOutlook({ ...quiet, river: riverFor([...Array(10).fill(50), 450, ...Array(19).fill(50)]) })
    expect(river.level).toBe('elevated')
    expect(river.headline).toMatch(/a high river/)
  })
  it('leads with official flood warnings and watches, and ignores other weather alerts', () => {
    const warn = buildOutlook({ ...quiet, alerts: [{ event: 'Flash Flood Warning' }, { event: 'Wind Advisory' }] })
    expect(warn.level).toBe('warning')
    expect(warn.signals.filter((s) => s.kind === 'alert')).toHaveLength(1)
    expect(buildOutlook({ ...quiet, alerts: [{ event: 'Flood Watch' }] }).level).toBe('watch')
    expect(buildOutlook({ ...quiet, alerts: [{ event: 'Wind Advisory' }] }).signals[0].text).toMatch(/No NWS flood alerts.*1 other/)
  })
  it('waits for lookups, and never shows a failed one as low risk', () => {
    expect(buildOutlook({ ...quiet, rain: null }).isPending).toBe(true)
    const failed = buildOutlook({ ...quiet, rain: 'error', river: 'error', alerts: 'error' })
    expect(failed.level).toBe('unknown')
    expect(failed.isComplete).toBe(false)
    const outside = buildOutlook({ ...quiet, alerts: 'unsupported' })
    expect(outside.notes[0]).toMatch(/national weather service/)
  })
  it('works out how often floods came, the busy season and when it next comes round', () => {
    const r = recurrenceOf([harris], NOW)!
    expect(r.rate).toBe('about one every 3 months') // 48 in 10 years
    expect(r.season).toEqual({ months: 'May–Jul', sharePercent: 58, from: 'Harris County, Texas' })
    expect(r.nextWindow).toBe('May–Jul 2027')
    expect(r.isInSeason).toBe(false)
    expect(r.last).toBe('Aug 31, 2025')
    expect(r.sinceLast).toBe('15 months ago')
    // In season: the current run, across the new year.
    const winter = recurrenceOf([{ ...harris, months: [10, 2, 0, 0, 0, 0, 0, 0, 0, 0, 3, 9] }], NOW)!
    expect(winter.nextWindow).toBe('Nov 2026–Jan 2027')
    expect(winter.isInSeason).toBe(true)
  })
  it('never gives a county with no floods its state rate', () => {
    const none: PlaceHistory = { ...harris, name: 'Loving County, Texas', perYear: Array(10).fill(0), months: Array(12).fill(0), last: undefined }
    const state: PlaceHistory = { ...harris, level: 'state', name: 'Texas', months: [10, 10, 20, 40, 90, 80, 40, 40, 60, 30, 10, 10] }
    const r = recurrenceOf([none, state], NOW)!
    expect(r.place).toBe('Loving County, Texas')
    expect(r.total).toBe(0)
    expect(r.rate).toBe('none recorded')
    expect(r.season?.from).toBe('Texas')
  })
  it('takes the season from a wider area when the local record is too small', () => {
    const small: PlaceHistory = { ...harris, name: 'Loving County, Texas', perYear: [0, 1, 0, 0, 0, 1, 0, 0, 0, 0], months: [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0] }
    const state: PlaceHistory = { ...harris, level: 'state', name: 'Texas', months: [10, 10, 20, 40, 90, 80, 40, 40, 60, 30, 10, 10] }
    const r = recurrenceOf([small, state], NOW)!
    expect(r.place).toBe('Loving County, Texas')
    expect(r.rate).toBe('about one every 5 years')
    expect(r.season?.from).toBe('Texas')
  })
  it('finds no season when floods are spread over the year', () => {
    expect(floodSeason(Array(12).fill(3))).toBeNull()
    expect(rateText(0, 10)).toBe('none recorded')
    expect(rateText(300, 10)).toBe('about 3 a month')
    expect(rateText(9, 10)).toBe('about one a year')
  })
})

describe('AI summary grounding', () => {
  const facts = summaryFacts('Harris County', buildOutlook(quiet), NOW)
  it('accepts a summary that quotes only figures it was given', () => {
    expect(isGrounded('Floods here came about one every 3 months; the busy season, May–Jul 2027, is next. The last began Aug 31, 2025.', facts)).toBe(true)
  })
  it('rejects an all-clear the figures cannot support', () => {
    expect(isCautious('No flooding is expected in the next 16 days.')).toBe(false)
    expect(isCautious('Houston will not flood this week.')).toBe(false)
    expect(isCautious('The area is safe.')).toBe(false)
    expect(isCautious('Forecasts show no sign of flooding; that is not a guarantee. Stay alert.')).toBe(true)
    expect(isCautious('No floods recorded here is not the same as no risk.')).toBe(true)
  })
  it('rejects a summary with a number not in the figures', () => {
    expect(isGrounded('There is a 40% chance of a flood by Apr 2027.', facts)).toBe(false)
    expect(isGrounded('Expect about 12 inches of rain.', facts)).toBe(false)
  })
})

describe('outlook summary proxy', () => {
  const body = { facts: { place: 'Harris County', next_days: { headline: 'x' } } }
  const ok = (text: string, model = 'google/gemma-3-12b-it') =>
    new Response(JSON.stringify({ model, choices: [{ message: { content: text } }] }), { status: 200 })

  it('needs a key and a sane request', async () => {
    expect(await runSummary(body, {}, async () => ok('x'))).toMatchObject({ ok: false, code: 'NOT_CONFIGURED' })
    expect(parseSummaryRequest({ facts: 'x' })).toBeNull()
    expect(parseSummaryRequest({ facts: { a: 'x'.repeat(9000) } })).toBeNull()
  })
  it('sends the fixed instructions with the facts to an OpenAI-compatible API', async () => {
    const seen: { url: string; init: RequestInit }[] = []
    const r = await runSummary(body, { apiKey: 'k', baseUrl: 'https://example.test/v1/' }, async (url, init) => { seen.push({ url, init }); return ok('Quiet <think>hmm</think>days **ahead**.') })
    expect(r).toEqual({ ok: true, text: 'Quiet days ahead.', model: 'google/gemma-3-12b-it' })
    expect(seen[0].url).toBe('https://example.test/v1/chat/completions')
    const sent = JSON.parse(String(seen[0].init.body))
    expect(sent.model).toBe('google/gemma-3-12b-it')
    expect(sent.messages[0].role).toBe('system')
    expect(sent.messages[1].content).toContain('Harris County')
    expect((seen[0].init.headers as Record<string, string>).authorization).toBe('Bearer k')
  })
  it('moves on to the next model when one is busy or retired', async () => {
    const statuses = [429, 404]
    const models: string[] = []
    const r = await runSummary(body, { apiKey: 'k', models: 'a, b ,c' }, async (_u, init) => {
      models.push(JSON.parse(String(init.body)).model)
      const s = statuses.shift()
      return s ? new Response('{}', { status: s }) : ok('Fine.', 'c')
    })
    expect(models).toEqual(['a', 'b', 'c'])
    expect(r).toMatchObject({ ok: true, model: 'c' })
    expect(await runSummary(body, { apiKey: 'k', models: 'a' }, async () => new Response('{}', { status: 429 }))).toMatchObject({ ok: false, code: 'RATE_LIMITED' })
    expect(await runSummary(body, { apiKey: 'bad' }, async () => new Response('{}', { status: 401 }))).toMatchObject({ ok: false, code: 'NOT_CONFIGURED' })
  })
  it('reads the model list and cleans replies', () => {
    expect(modelsFrom({ models: '' })).toEqual([...DEFAULT_MODELS])
    expect(cleanText('  ## Hi\n\n there ')).toBe('Hi there')
    expect(cleanText(3)).toBe('')
  })
})
