// One fetch helper for every adapter: rejects on HTTP errors so callers only handle one failure path.

export async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export const isAbort = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError'
