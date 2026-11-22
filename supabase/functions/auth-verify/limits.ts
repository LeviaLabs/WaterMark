// Abuse limits for auth-verify: bounded body reads and a fixed-window rate limiter.
// No Deno globals here, so the same file runs in the Supabase Edge Runtime and in Node tests.

/**
 * Reads at most `maxBytes` of a body, then stops. Returns null if the body is larger, the
 * declared Content-Length is larger, the read takes longer than `timeoutMs`, or reading fails.
 * Unlike `Response.text()`, memory never grows past `maxBytes` and a slow sender cannot hold
 * the function open.
 */
export async function readBounded(
  source: { body: ReadableStream<Uint8Array> | null; headers: Headers },
  maxBytes: number,
  timeoutMs = 5000,
): Promise<string | null> {
  const declared = Number(source.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    await source.body?.cancel().catch(() => {})
    return null
  }
  if (!source.body) return ''
  const reader = source.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs)
  })
  try {
    for (;;) {
      const step = await Promise.race([reader.read(), deadline])
      if (step === 'timeout') {
        await reader.cancel().catch(() => {})
        return null
      }
      if (step.done) break
      total += step.value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => {})
        return null
      }
      chunks.push(step.value)
    }
  } catch {
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
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

/**
 * Fixed-window counter per key. In-memory, so it is per Edge Runtime instance: it slows one
 * client hammering one instance and caps how fast any instance spends the MojoAuth quota.
 * It is not a global limit across instances.
 */
export class RateLimiter {
  readonly limit: number
  readonly windowMs: number
  readonly maxKeys: number
  private readonly windows = new Map<string, { start: number; count: number }>()

  constructor(limit: number, windowMs: number, maxKeys = 10_000) {
    this.limit = limit
    this.windowMs = windowMs
    this.maxKeys = maxKeys
  }

  /** Counts one request. Returns 0 if allowed, otherwise the seconds until the window resets. */
  hit(key: string, now: number): number {
    let w = this.windows.get(key)
    if (!w || now - w.start >= this.windowMs) {
      if (!w && this.windows.size >= this.maxKeys) this.prune(now)
      w = { start: now, count: 0 }
      this.windows.set(key, w)
    }
    w.count += 1
    return w.count > this.limit ? Math.max(1, Math.ceil((w.start + this.windowMs - now) / 1000)) : 0
  }

  private prune(now: number): void {
    for (const [key, w] of this.windows) if (now - w.start >= this.windowMs) this.windows.delete(key)
    // Still full: every key is active. Drop the oldest so memory stays bounded.
    while (this.windows.size >= this.maxKeys) {
      const oldest = this.windows.keys().next().value
      if (oldest === undefined) break
      this.windows.delete(oldest)
    }
  }
}

/** Client address as Supabase's gateway reports it. Used only as a rate-limit key. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return (forwarded || request.headers.get('cf-connecting-ip') || 'unknown').slice(0, 64)
}
