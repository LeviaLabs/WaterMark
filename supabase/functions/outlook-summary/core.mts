// WaterMark flood-outlook summaries, server side: a fixed, narrow proxy to a cheap open-weight model.
//
// The browser works out the outlook itself (WaterMark/src/scripting/outlook.ts: alerts, forecast
// rain and river against this place's history, and how often floods came here) and sends those
// figures. This adds the instructions, owned here so a client cannot change them, asks the model for
// two or three plain sentences, and returns them. The model predicts nothing and adds no figures:
// the browser drops any summary that quotes a number not in the figures it sent.
//
// Any OpenAI-compatible chat-completions API works. The default is OpenRouter, which serves the
// open-weight models below from several providers. Configuration (names only, no secrets):
//   WATERMARK_SUMMARY_API_KEY    the provider key (required)
//   WATERMARK_SUMMARY_BASE_URL   default https://openrouter.ai/api/v1 (e.g. https://api.groq.com/openai/v1)
//   WATERMARK_SUMMARY_MODELS     comma-separated model ids, tried in order (default DEFAULT_MODELS)
//
// Pure: plain `fetch`, no Deno or Node APIs, so the Supabase Edge Function (index.ts) and the Vite
// dev server (WaterMark/vite.config.ts) both run this same code. Tested in WaterMark/tests/outlookSummary.test.ts.

// Open-weight and cheap: chosen on OpenRouter (Nov 2026) by summarizing real outlooks (Houston, Mumbai,
// a county with no floods, a flash-flood warning) and checking each summary as the browser does.
// Gemma 3 12B ($0.05 in / $0.15 out per million tokens, about $0.05 per 1,000 summaries) kept every
// figure and caveat; Llama 3.1 8B is the fastest; Mistral Small 3.2 is the slow, careful fallback.
// Llama 3.3 70B did as well at about nine times the price. A busy (429/503), retired (404) or failing
// (5xx) model hands the request to the next.
export const DEFAULT_MODELS = ['google/gemma-3-12b-it', 'meta-llama/llama-3.1-8b-instruct', 'mistralai/mistral-small-3.2-24b-instruct'] as const
export const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'

const MAX_FACTS_CHARS = 8_000
const MAX_SUMMARY_CHARS = 900
const TIMEOUT_MS = 30_000

export const SUMMARY_PROMPT = `You write the short summary at the top of a flood outlook on WaterMark, a public flood map.
You are given FACTS as JSON: what the next days' official alerts and forecasts show for a place, and its past flood record.

Write two or three plain sentences (at most 70 words) for a resident:
1. First what the next days look like, from next_days. If there is an official warning or watch, lead with it and say to follow local officials.
2. Then when a flood is most likely here, from flood_record: how often floods came, the busy season and when it next comes round, and when the last flood began. Say this is the pattern of past floods, not a forecast.

Rules:
- Use only the facts given. Every number and date you write must appear in FACTS exactly as written there. Do not add, round, convert or combine figures, and do not give percentages or chances other than those in FACTS.
- Never say a place is safe, will not flood, or that no flooding is expected. When next_days.overall is "quiet", say the forecasts show no sign of flooding and that this is not a guarantee.
- If the notes say official alerts here come from the national weather service, say to check it; never claim there are no official warnings there.
- If flood_record shows no floods recorded, say that is not the same as no risk.
- Do not mention rivers, rain or alerts that FACTS do not mention. If something is missing or could not be loaded, you may say so briefly.
- Plain text only: no lists, headings, markdown or emoji.`

export interface SummaryConfig {
  apiKey?: string
  baseUrl?: string
  /** Comma-separated model ids. */
  models?: string
}

export type SummaryResult =
  | { ok: true; text: string; model: string }
  | { ok: false; status: number; code: string; retryAfterSeconds?: number }

type Fetcher = (input: string, init: RequestInit) => Promise<Response>

/** The facts object, if the body is { facts: {...} } of a sane size; else null. */
export function parseSummaryRequest(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null
  const facts = (body as { facts?: unknown }).facts
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) return null
  const size = JSON.stringify(facts).length
  return size > 2 && size <= MAX_FACTS_CHARS ? (facts as Record<string, unknown>) : null
}

/** The reply's text: reasoning blocks some open models emit are dropped, whitespace tidied. */
export function cleanText(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/[*_#`]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY_CHARS)
}

export function modelsFrom(config: SummaryConfig): string[] {
  const list = (config.models ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return list.length ? list : [...DEFAULT_MODELS]
}

export async function runSummary(body: unknown, config: SummaryConfig, fetcher: Fetcher, log: (msg: string) => void = () => {}): Promise<SummaryResult> {
  if (!config.apiKey) return { ok: false, status: 503, code: 'NOT_CONFIGURED' }
  const facts = parseSummaryRequest(body)
  if (!facts) return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  const url = `${(config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')}/chat/completions`
  let lastStatus = 502
  let retryAfter: number | undefined
  for (const model of modelsFrom(config)) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
    let res: Response
    try {
      res = await fetcher(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}`, 'x-title': 'WaterMark' },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          // Room for reasoning models (gpt-oss) to think before the short answer.
          max_tokens: 1200,
          messages: [
            { role: 'system', content: SUMMARY_PROMPT },
            { role: 'user', content: `FACTS:\n${JSON.stringify(facts)}` },
          ],
        }),
        signal: ctl.signal,
      })
    } catch {
      clearTimeout(timer)
      log(`outlook-summary: ${model} did not answer (network or timeout)`)
      lastStatus = 504
      continue
    }
    clearTimeout(timer)
    if (!res.ok) {
      lastStatus = res.status
      if (res.status === 429) retryAfter = Number(res.headers.get('retry-after')) || retryAfter
      log(`outlook-summary: ${model} answered ${res.status}`)
      if (res.status === 401 || res.status === 403) return { ok: false, status: 503, code: 'NOT_CONFIGURED' }
      if (res.status === 400) continue // e.g. a model that refuses a parameter; try the next
      if (res.status === 404 || res.status === 429 || res.status >= 500) continue
      return { ok: false, status: 502, code: 'MODEL_ERROR' }
    }
    const json = (await res.json().catch(() => null)) as { choices?: { message?: { content?: unknown } }[]; model?: unknown } | null
    const text = cleanText(json?.choices?.[0]?.message?.content)
    if (!text) {
      log(`outlook-summary: ${model} returned no text`)
      continue
    }
    return { ok: true, text, model: typeof json?.model === 'string' ? json.model : model }
  }
  return lastStatus === 429
    ? { ok: false, status: 429, code: 'RATE_LIMITED', retryAfterSeconds: retryAfter }
    : { ok: false, status: 502, code: 'MODEL_UNAVAILABLE' }
}
