// Bounds are enforced while streaming, before JSON parsing or retaining the complete body.
export async function readBounded(
  source: { body: ReadableStream<Uint8Array> | null; headers: Headers },
  maxBytes: number,
  timeoutMs: number,
): Promise<string | null> {
  const cancel = () => { void source.body?.cancel().catch(() => {}) }
  const declared = Number(source.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) { cancel(); return null }
  if (!source.body) return ''
  const reader = source.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs) })
  try {
    for (;;) {
      const step = await Promise.race([reader.read(), deadline])
      if (step === null) return null
      if (step.done) break
      total += step.value.byteLength
      if (total > maxBytes) return null
      chunks.push(step.value)
    }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    // An uncooperative sender's cancel promise must not defeat the read deadline.
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

/** Supplemental per-instance ingress limit; the database separately enforces /start globally. */
export class IngressLimiter {
  private started = 0
  private total = 0
  private clients = new Map<string, number>()

  hit(key: string, now: number): boolean {
    if (now - this.started >= 60_000 || now < this.started) {
      this.started = now
      this.total = 0
      this.clients.clear()
    }
    this.total++
    const count = (this.clients.get(key) ?? 0) + 1
    if (!this.clients.has(key) && this.clients.size >= 1000) return false
    this.clients.set(key, count)
    return this.total <= 600 && count <= 60
  }
}
