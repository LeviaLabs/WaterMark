// Bounded body reads for alert-inbox (same helper as auth-verify/limits.ts, copied so the
// functions deploy independently).
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
  // Cancelling an incoming server Request can abort its HTTP connection before the 413 is sent.
  // Stop reading and let the server own its lifetime; outbound provider responses can be cancelled.
  const cancelRejectedBody = !(source instanceof Request)
  const declared = Number(source.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    // Cancellation may wait on the remote transport indefinitely. Request it without delaying rejection.
    if (cancelRejectedBody) void source.body?.cancel().catch(() => {})
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
        if (cancelRejectedBody) void reader.cancel().catch(() => {})
        return null
      }
      if (step.done) break
      total += step.value.byteLength
      if (total > maxBytes) {
        if (cancelRejectedBody) void reader.cancel().catch(() => {})
        return null
      }
      chunks.push(step.value)
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    reader.releaseLock()
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
