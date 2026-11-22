// HTTP guard for the flood assistant. No Deno globals: the Edge Function (index.ts), the Vite dev
// server, and the unit tests all call `handleAssistant`.
//
// CORS does not stop a script or a direct request. Every POST that would call Gemini first takes a
// request budget. Production uses Postgres (`watermark_take_assistant_budget`), the same atomic
// bucket table as watermark-v1. The dev server uses an in-memory budget for that one process.
// A missing or failed budget check does not call Gemini.
//
// `WATERMARK_ASSISTANT_DISABLED` (1, true, yes, or on) and a database row with bucket
// `assistant:disabled` both return 503 before the model is called.

import { parseRequest, runAssistant, type AssistantResult } from "./core.mts";

/** Must match watermark_take_assistant_budget in the assistant budget migration. */
export const ASSISTANT_LIMITS = {
  perClientPerMinute: 12,
  perClientPerDay: 80,
  globalPerDay: 400,
} as const

/** Raw body cap. Above the 120k character conversation cap, below an unbounded upload. */
export const MAX_BODY_BYTES = 160_000
export const BODY_TIMEOUT_MS = 5_000

export type BudgetCode = "ok" | "client_limited" | "daily_limited" | "disabled" | "unavailable"

export interface AssistantBudget {
  take(clientHash: string): Promise<BudgetCode>
}

export interface AssistantDeps {
  apiKey: string | undefined
  allowedOrigins: readonly string[]
  /** Dev server only. The public function checks `allowedOrigins`. */
  allowAnyOrigin?: boolean
  /** Value of WATERMARK_ASSISTANT_DISABLED. */
  disabled?: string | undefined
  takeBudget: (clientHash: string) => Promise<BudgetCode>
  fetcher?: typeof fetch
  log?: (msg: string) => void
  now?: () => number
  bodyTimeoutMs?: number
  maxBodyBytes?: number
  /** Passed through to the Gemini call. Tests use a short deadline. */
  upstreamTimeoutMs?: number
}

export function isAssistantDisabled(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? "").trim())
}

/** Client address as the platform reports it. Hashed before it is stored. Not a proof of identity. */
export function clientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return (forwarded || headers.get("cf-connecting-ip") || headers.get("x-real-ip") || "unknown").slice(0, 64)
}

/** 32 hex chars. Changes each UTC day so the budget table does not keep a long-term address index. */
export async function dailyClientHash(address: string, now = Date.now()): Promise<string> {
  const day = new Date(now).toISOString().slice(0, 10)
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`watermark-assistant|${day}|${address}`),
  )
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32)
}

export function retryAfterFor(code: "client_limited" | "daily_limited", now = Date.now()): number {
  if (code === "client_limited") return 60
  const next = Date.UTC(
    new Date(now).getUTCFullYear(),
    new Date(now).getUTCMonth(),
    new Date(now).getUTCDate() + 1,
  )
  return Math.max(60, Math.min(86_400, Math.ceil((next - now) / 1000)))
}

/**
 * Fixed-window counters for one process. The public function does not use this: a per-instance
 * counter would not survive a second Edge isolate. `npm run dev` uses it so a local key is bounded.
 */
export function createMemoryBudget(
  clock: () => number = Date.now,
  limits: { perClientPerMinute: number; perClientPerDay: number; globalPerDay: number } = ASSISTANT_LIMITS,
): AssistantBudget {
  const buckets = new Map<string, { count: number; expires: number }>()
  const hit = (key: string, limit: number, expires: number, now: number): boolean => {
    const row = buckets.get(key)
    if (!row || row.expires <= now) {
      buckets.set(key, { count: 1, expires })
      return true
    }
    if (row.count >= limit) return false
    row.count += 1
    return true
  }
  return {
    take(clientHash: string): Promise<BudgetCode> {
      const now = clock()
      for (const [key, row] of buckets) if (row.expires <= now) buckets.delete(key)
      const minute = Math.floor(now / 60_000)
      const day = new Date(now).toISOString().slice(0, 10)
      if (!hit(`c:${clientHash}:m:${minute}`, limits.perClientPerMinute, (minute + 2) * 60_000, now)) {
        return Promise.resolve("client_limited")
      }
      if (!hit(`c:${clientHash}:d:${day}`, limits.perClientPerDay, now + 2 * 86_400_000, now)) {
        return Promise.resolve("client_limited")
      }
      if (!hit(`g:${day}`, limits.globalPerDay, now + 2 * 86_400_000, now)) {
        return Promise.resolve("daily_limited")
      }
      return Promise.resolve("ok")
    },
  }
}

/**
 * Reads at most `maxBytes`, and gives up after `timeoutMs`. Returns null when the body is larger,
 * the declared Content-Length is larger, the sender stalls, or the bytes are not JSON.
 */
export async function readJsonBody(
  source: { body: ReadableStream<Uint8Array> | null; headers: Headers },
  maxBytes = MAX_BODY_BYTES,
  timeoutMs = BODY_TIMEOUT_MS,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const text = await readBoundedText(source, maxBytes, timeoutMs)
  if (text === null) return { ok: false }
  try {
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    return { ok: false }
  }
}

export async function readBoundedText(
  source: { body: ReadableStream<Uint8Array> | null; headers: Headers },
  maxBytes: number,
  timeoutMs: number,
): Promise<string | null> {
  const declared = Number(source.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > maxBytes) {
    await source.body?.cancel().catch(() => {})
    return null
  }
  if (!source.body) return ""
  const reader = source.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs)
  })
  try {
    for (;;) {
      const step = await Promise.race([reader.read(), deadline])
      if (step === "timeout") {
        void reader.cancel().catch(() => {})
        return null
      }
      if (step.done) break
      total += step.value.byteLength
      if (total > maxBytes) {
        void reader.cancel().catch(() => {})
        return null
      }
      chunks.push(step.value)
    }
  } catch {
    void reader.cancel().catch(() => {})
    return null
  } finally {
    clearTimeout(timer)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

/** Postgres budget via PostgREST. The argument is the daily hash, never the raw address. */
export function createAssistantBudgetClient(
  baseUrl: string,
  key: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 4_000,
): AssistantBudget {
  const headers: Record<string, string> = {
    apikey: key,
    accept: "application/json",
    "content-type": "application/json",
  }
  if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`
  const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/rpc/watermark_take_assistant_budget`
  return {
    async take(clientHash: string): Promise<BudgetCode> {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetcher(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ p_client: clientHash }),
          signal: controller.signal,
        })
        const raw = await readBoundedText(res, 256, timeoutMs)
        if (!res.ok || raw === null) return "unavailable"
        const value: unknown = JSON.parse(raw)
        if (
          value === "ok" || value === "client_limited" || value === "daily_limited" ||
          value === "disabled"
        ) return value
        return "unavailable"
      } catch {
        return "unavailable"
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

function corsHeaders(
  origin: string | null,
  allowed: readonly string[],
  allowAnyOrigin: boolean,
): Record<string, string> {
  const headers: Record<string, string> = { vary: "Origin" }
  if (origin && (allowAnyOrigin || allowed.includes(origin))) {
    headers["access-control-allow-origin"] = origin
    headers["access-control-allow-methods"] = "POST, OPTIONS"
    headers["access-control-allow-headers"] = "content-type, authorization, apikey, x-client-info"
    headers["access-control-max-age"] = "600"
  }
  return headers
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "content-type": "application/json", "cache-control": "no-store" },
  })
}

function isJsonContent(headers: Headers): boolean {
  return /^application\/json\b/i.test(headers.get("content-type") ?? "")
}

/**
 * One assistant HTTP call. Returns 503 when the kill switch is on or the budget cannot be taken,
 * 429 when the client or the global day cap is spent, and 400 for an oversized or slow body.
 * Gemini is called only after a budget of `ok`.
 */
export async function handleAssistant(req: Request, deps: AssistantDeps): Promise<Response> {
  const origin = req.headers.get("origin")
  const cors = corsHeaders(origin, deps.allowedOrigins, deps.allowAnyOrigin === true)
  if (origin && deps.allowAnyOrigin !== true && !deps.allowedOrigins.includes(origin)) {
    return json({ code: "ORIGIN_NOT_ALLOWED" }, 403, cors)
  }
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors })
  if (req.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405, cors)
  if (isAssistantDisabled(deps.disabled)) {
    await req.body?.cancel().catch(() => {})
    return json({ code: "DISABLED" }, 503, cors)
  }
  if (!isJsonContent(req.headers)) {
    await req.body?.cancel().catch(() => {})
    return json({ code: "INVALID_REQUEST" }, 400, cors)
  }
  const parsed = await readJsonBody(req, deps.maxBodyBytes ?? MAX_BODY_BYTES, deps.bodyTimeoutMs ?? BODY_TIMEOUT_MS)
  if (!parsed.ok) return json({ code: "INVALID_REQUEST" }, 400, cors)
  if (!parseRequest(parsed.value)) return json({ code: "INVALID_REQUEST" }, 400, cors)
  if (!deps.apiKey) return json({ code: "NOT_CONFIGURED" }, 503, cors)

  const now = deps.now ?? Date.now
  let budget: BudgetCode
  try {
    budget = await deps.takeBudget(await dailyClientHash(clientAddress(req.headers), now()))
  } catch {
    ;(deps.log ?? (() => {}))("assistant: budget check failed")
    return json({ code: "NOT_CONFIGURED" }, 503, cors)
  }
  if (budget === "disabled") return json({ code: "DISABLED" }, 503, cors)
  if (budget === "client_limited" || budget === "daily_limited") {
    return json({ code: "RATE_LIMITED" }, 429, {
      ...cors,
      "retry-after": String(retryAfterFor(budget, now())),
    })
  }
  if (budget !== "ok") return json({ code: "NOT_CONFIGURED" }, 503, cors)

  const log = deps.log ?? (() => {})
  let result: AssistantResult
  try {
    result = await runAssistant(parsed.value, deps.apiKey, deps.fetcher ?? fetch, log, {
      timeoutMs: deps.upstreamTimeoutMs,
    })
  } catch {
    log("assistant: model call failed")
    return json({ code: "MODEL_UNAVAILABLE" }, 504, cors)
  }
  if (!result.ok) {
    const headers = result.retryAfterSeconds
      ? { ...cors, "retry-after": String(result.retryAfterSeconds) }
      : cors
    return json({ code: result.code }, result.status, headers)
  }
  return json(
    { content: result.content, model: result.model, finishReason: result.finishReason },
    200,
    cors,
  )
}
