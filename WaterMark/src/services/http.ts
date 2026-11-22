// One fetch helper for every adapter: rejects on HTTP errors so callers only handle one failure path,
// and gives up after a time limit so a stalled provider shows "couldn't load" instead of loading forever.

const TIMEOUT_MS = 15_000

export async function getJSON<T>(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = TIMEOUT_MS, signal, ...rest } = init ?? {}
  const limit = AbortSignal.timeout(timeoutMs)
  const res = await fetch(url, { ...rest, signal: signal ? AbortSignal.any([signal, limit]) : limit })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

/** True only when the caller cancelled (a newer request replaced this one); a timeout is a failure. */
export const isAbort = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError'
