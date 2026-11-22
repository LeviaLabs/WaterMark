// Records when each live source was last fetched, so the Sources list can show how fresh it is.
// A tiny external store read with useSyncExternalStore (see hooks/useFreshness.ts): no global events.
import type { SourceId } from './sources'

type Snapshot = Readonly<Partial<Record<SourceId, Date>>>

let snapshot: Snapshot = {}
const subscribers = new Set<() => void>()

export function markFetched(id: SourceId): void {
  snapshot = { ...snapshot, [id]: new Date() }
  for (const notify of subscribers) notify()
}

export function subscribe(notify: () => void): () => void {
  subscribers.add(notify)
  return () => subscribers.delete(notify)
}

export const getSnapshot = (): Snapshot => snapshot
