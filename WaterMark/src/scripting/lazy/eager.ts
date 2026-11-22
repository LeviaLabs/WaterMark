/**
 * One switch that tells every lazy landing section to mount now, used when
 * the visitor jumps to an anchor (so the sections above the target exist and
 * the jump lands in the right place). Plain subscribe/get for
 * useSyncExternalStore; no React here.
 */

let eager = false
const listeners = new Set<() => void>()

export function isEager(): boolean {
  return eager
}

export function makeEager(): void {
  if (eager) return
  eager = true
  for (const listener of listeners) listener()
}

export function subscribeEager(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
