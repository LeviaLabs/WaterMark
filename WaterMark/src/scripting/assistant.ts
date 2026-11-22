// The flood assistant's conversation, without React or network: the message shapes exchanged with
// the assistant function (supabase/functions/assistant/core.mts), checks on what comes back, what
// the chat shows while a tool runs, the suggested questions, and the reply text split into
// paragraphs and bullet points for display (never rendered as HTML). Tested in tests/assistant.test.ts.

export interface FunctionCall { name: string; args?: Record<string, unknown>; id?: string }
export interface Part {
  text?: string
  functionCall?: FunctionCall
  functionResponse?: { name: string; response: Record<string, unknown>; id?: string }
  /** Opaque: must go back to the model unchanged with the call it came with. */
  thoughtSignature?: string
}
export interface Content { role: 'user' | 'model'; parts: Part[] }

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

/** The model's next turn from an assistant response; throws on anything else. */
export function parseModelTurn(raw: unknown): Content {
  const c = isObj(raw) ? raw.content : null
  if (!isObj(c) || c.role !== 'model' || !Array.isArray(c.parts)) throw new Error('The assistant sent an unexpected answer.')
  const parts: Part[] = []
  for (const p of c.parts) {
    if (!isObj(p)) continue
    const part: Part = {}
    if (typeof p.text === 'string') part.text = p.text
    const fc = p.functionCall
    if (isObj(fc) && typeof fc.name === 'string') {
      part.functionCall = { name: fc.name, args: isObj(fc.args) ? fc.args : {} }
      if (typeof fc.id === 'string') part.functionCall.id = fc.id
    }
    if (typeof p.thoughtSignature === 'string') part.thoughtSignature = p.thoughtSignature
    if (part.text !== undefined || part.functionCall) parts.push(part)
  }
  if (!parts.length) throw new Error('The assistant sent an empty answer.')
  return { role: 'model', parts }
}

export const callsIn = (c: Content): FunctionCall[] => c.parts.flatMap((p) => (p.functionCall ? [p.functionCall] : []))
export const textOf = (c: Content): string => c.parts.map((p) => p.text ?? '').join('').trim()

/** The user turn that answers a model turn's tool calls, in the same order. */
export function toolResultsTurn(calls: readonly FunctionCall[], results: readonly Record<string, unknown>[]): Content {
  return {
    role: 'user',
    parts: calls.map((call, i) => ({
      functionResponse: { name: call.name, response: results[i] ?? { ok: false, error: 'No result.' }, ...(call.id ? { id: call.id } : {}) },
    })),
  }
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const place = (args: Record<string, unknown> | undefined) => {
  const lat = num(args?.lat), lon = num(args?.lon)
  return lat != null && lon != null ? `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}` : 'there'
}

/** What the chat says while a tool runs, and lists under the answer as the data it used. */
export function toolLabel(call: FunctionCall): string {
  const a = call.args
  switch (call.name) {
    case 'find_place': return `Looking up “${String(a?.query ?? '').slice(0, 60)}”`
    case 'flood_record': return `Flood records near ${place(a)} (GDACS, NOAA)`
    case 'rain_forecast': return `Rain forecast at ${place(a)} (Open-Meteo)`
    case 'rain_history': return `Rain since 1991 at ${place(a)} (ERA5)`
    case 'river_forecast': return `River flow at ${place(a)} (GloFAS)`
    case 'weather_alerts': return `Official alerts at ${place(a)} (NWS)`
    case 'current_floods': return 'Floods listed worldwide, past 30 days (GDACS)'
    case 'top_regions': return a?.level === 'us_state' ? 'US states ranked by flood record (NOAA)' : 'Countries ranked by flood record (GDACS)'
    case 'show_on_map': return `Opened ${String(a?.label ?? 'the place').slice(0, 60)} on the map`
    default: return call.name
  }
}

/** Questions to try, for the place on the map (or the world). */
export function suggestionsFor(placeName: string | null, isUS: boolean): string[] {
  if (!placeName) {
    return [
      'Where in the world is flooding right now?',
      'Which countries have had the most serious floods?',
      'How do I stay safe if a flash flood warning is issued?',
    ]
  }
  return [
    `How often does ${placeName} flood?`,
    isUS ? `Are there any flood warnings in ${placeName} right now?` : `Is heavy rain forecast in ${placeName} this week?`,
    isUS ? `What were the worst flood years in ${placeName}, and what damage did they do?` : `What were the worst flood years in ${placeName}?`,
  ]
}

export interface PageContext {
  /** The focus trail, e.g. ["United States", "Pennsylvania"]. */
  focus: string[]
  /** The picked spot or square, if any. */
  selection: { label: string; lat: number; lon: number } | null
  units: 'imperial' | 'metric'
  today: string
}

/**
 * Where the chat sends questions. A production build with no URL calls nothing and the panel says
 * the assistant is not set up. Dev falls back to the Vite route.
 */
export function resolveAssistantUrl(configured: string | undefined, isDev: boolean): string | null {
  const value = configured?.trim() ?? ''
  if (value) return value
  return isDev ? '/api/assistant' : null
}

/** The page context as plain text. The server treats it as untrusted user-supplied data. */
export function contextText(c: PageContext): string {
  const lines = [
    `Today: ${c.today}`,
    `Units the user reads: ${c.units === 'imperial' ? 'US (inches, miles, °F)' : 'metric (mm, km, °C)'}`,
    `Map focus: ${c.focus.length ? c.focus.join(' > ') : 'the whole world'}`,
  ]
  if (c.selection) lines.push(`Selected on the map: ${c.selection.label} at lat ${c.selection.lat.toFixed(4)}, lon ${c.selection.lon.toFixed(4)}`)
  return lines.join('\n')
}

export type Inline = { text: string; bold: boolean }
export type Block = { kind: 'p'; parts: Inline[] } | { kind: 'ul'; items: Inline[][] }

/** **bold** spans in a line; everything else is plain text (no HTML, links shown as written). */
export function inlineOf(line: string): Inline[] {
  const out: Inline[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), bold: false })
    out.push({ text: m[1], bold: true })
    last = m.index + m[0].length
  }
  if (last < line.length) out.push({ text: line.slice(last), bold: false })
  return out.map((p) => ({ ...p, text: p.text.replace(/(^|\s)[*_](\S[^*_]*?)[*_](?=\s|[.,;:!?]|$)/g, '$1$2') }))
}

/** A reply split into paragraphs (one per line) and bullet lists; markdown headings become bold paragraphs. */
export function blocksOf(text: string): Block[] {
  const blocks: Block[] = []
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    if (!line) { blocks.push({ kind: 'p', parts: [] }); continue }
    const bullet = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line)
    if (bullet) {
      const prev = blocks.at(-1)
      if (prev?.kind === 'ul') prev.items.push(inlineOf(bullet[1]))
      else blocks.push({ kind: 'ul', items: [inlineOf(bullet[1])] })
      continue
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    blocks.push({ kind: 'p', parts: heading ? [{ text: heading[1].replace(/\*\*/g, ''), bold: true }] : inlineOf(line) })
  }
  return blocks.filter((b) => (b.kind === 'p' ? b.parts.length > 0 : b.items.length > 0))
}

/** Plain text for reading aloud: no markdown marks, bullets as sentences. */
export function speakableText(text: string): string {
  return blocksOf(text)
    .map((b) => (b.kind === 'p' ? b.parts.map((p) => p.text).join('') : b.items.map((i) => i.map((p) => p.text).join('')).join('. ')))
    .join('. ')
    .replace(/\.\s*\./g, '.')
    .replace(/m³\/s/g, 'cubic meters per second')
}
