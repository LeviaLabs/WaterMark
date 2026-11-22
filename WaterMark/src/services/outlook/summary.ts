// The one request for an AI summary of a place's flood outlook: the figures in, two or three
// sentences out, written by an open-weight model behind a server function. Where it lives
// (environment variable name only, no secret):
//   VITE_WATERMARK_SUMMARY_URL   e.g. https://<project>.supabase.co/functions/v1/outlook-summary
// In `npm run dev` it defaults to /api/outlook-summary, which the Vite dev server serves (vite.config.ts).
import { isCautious, isGrounded } from '../../scripting/outlook'

const configured = import.meta.env.VITE_WATERMARK_SUMMARY_URL as string | undefined
export const SUMMARY_URL: string | null = configured || (import.meta.env.DEV ? '/api/outlook-summary' : null)

export interface Summary { text: string; model: string }

export class SummaryError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const MESSAGES: Record<string, string> = {
  NOT_CONFIGURED: "AI summaries aren't set up on this server yet.",
  RATE_LIMITED: 'The AI summary is busy. Try again in a minute.',
  MODEL_UNAVAILABLE: "The AI model didn't answer. Try again in a moment.",
  UNGROUNDED: 'The AI summary quoted a figure that is not in the data, so it is not shown.',
  NOT_CAUTIOUS: 'The AI summary gave an all-clear the data cannot support, so it is not shown.',
}

export async function fetchSummary(facts: unknown, signal: AbortSignal): Promise<Summary> {
  if (!SUMMARY_URL) throw new SummaryError('NOT_CONFIGURED', MESSAGES.NOT_CONFIGURED)
  let res: Response
  try {
    res = await fetch(SUMMARY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ facts }),
      signal,
    })
  } catch (e) {
    if (signal.aborted) throw e
    throw new SummaryError('NETWORK', "Couldn't reach the AI summary. Check your connection.")
  }
  const body: unknown = await res.json().catch(() => null)
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  if (!res.ok) {
    const code = typeof b.code === 'string' ? b.code : 'MODEL_ERROR'
    throw new SummaryError(code, MESSAGES[code] ?? 'The AI summary failed. Try again.')
  }
  if (typeof b.text !== 'string' || !b.text.trim() || typeof b.model !== 'string') {
    throw new SummaryError('MODEL_ERROR', 'The AI summary came back empty.')
  }
  // The model may only restate the figures it was given.
  if (!isGrounded(b.text, facts)) throw new SummaryError('UNGROUNDED', MESSAGES.UNGROUNDED)
  if (!isCautious(b.text)) throw new SummaryError('NOT_CAUTIOUS', MESSAGES.NOT_CAUTIOUS)
  return { text: b.text.trim(), model: b.model }
}
