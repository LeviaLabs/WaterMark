// A small shared, size-limited request cache. Selecting the same place again (or a circle around
// the same center) reuses the answer instead of asking the provider again, and two callers that
// ask at once share one download. A download keeps going if one caller aborts, so a quick reselect
// is instant; each caller still stops waiting as soon as its own signal aborts.

const LIMIT = 80

interface Entry { job: Promise<unknown>; until: number }
const entries = new Map<string, Entry>()

/** Rejects with an AbortError as soon as `signal` aborts, even if the shared download continues. */
export function withSignal<T>(job: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return job
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
    job.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

/**
 * The cached answer for `key` if it is younger than `ttlMs`, otherwise a fresh `run()`.
 * Failures are never cached. `run` gets no caller signal on purpose: the download is shared.
 */
export function shared<T>(key: string, ttlMs: number, run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const now = Date.now()
  let hit = entries.get(key)
  if (hit && hit.until > now) {
    entries.delete(key)
    entries.set(key, hit) // most recently used goes last
  } else {
    const job = run()
    hit = { job, until: now + ttlMs }
    entries.set(key, hit)
    job.catch(() => { if (entries.get(key)?.job === job) entries.delete(key) })
    while (entries.size > LIMIT) entries.delete(entries.keys().next().value as string)
  }
  return withSignal(hit.job as Promise<T>, signal)
}

/** A cache key for a point, rounded to about 100 m so nearby clicks share answers. */
export const pointKey = ([lon, lat]: readonly [number, number]) => `${lon.toFixed(3)},${lat.toFixed(3)}`

export const MINUTE = 60_000
