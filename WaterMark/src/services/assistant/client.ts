// The one request to the flood assistant function: the conversation so far in, the model's next
// turn out. Where it lives (environment variable name only, no secret):
//   VITE_WATERMARK_ASSISTANT_URL   e.g. https://<project>.supabase.co/functions/v1/assistant
// In `npm run dev` it defaults to /api/assistant, which the Vite dev server serves (vite.config.ts).
import { parseModelTurn, resolveAssistantUrl, type Content } from '../../scripting/assistant'

const configured = import.meta.env.VITE_WATERMARK_ASSISTANT_URL as string | undefined
export const ASSISTANT_URL: string | null = resolveAssistantUrl(configured, import.meta.env.DEV)

export class AssistantError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const MESSAGES: Record<string, string> = {
  NOT_CONFIGURED: "The assistant isn't set up on this server yet.",
  DISABLED: 'The assistant is turned off right now.',
  RATE_LIMITED: 'The assistant has reached its question limit. Try again later.',
  MODEL_UNAVAILABLE: "The AI model didn't answer. Try again in a moment.",
  BLOCKED: "The AI model wouldn't answer that. Try asking another way.",
  INVALID_REQUEST: 'That conversation got too long. Start a new conversation.',
}

export async function askAssistant(contents: readonly Content[], context: string, signal: AbortSignal): Promise<Content> {
  if (!ASSISTANT_URL) throw new AssistantError('NOT_CONFIGURED', MESSAGES.NOT_CONFIGURED)
  let res: Response
  try {
    res = await fetch(ASSISTANT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents, context }),
      signal,
    })
  } catch (e) {
    if (signal.aborted) throw e
    throw new AssistantError('NETWORK', "Couldn't reach the assistant. Check your connection and try again.")
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const code = body && typeof body === 'object' && 'code' in body ? String((body as { code: unknown }).code) : 'MODEL_ERROR'
    throw new AssistantError(code, MESSAGES[code] ?? 'Something went wrong with the assistant. Try again.')
  }
  return parseModelTurn(body)
}
