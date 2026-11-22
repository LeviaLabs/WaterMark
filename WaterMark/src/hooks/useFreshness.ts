import { useSyncExternalStore } from 'react'
import { getSnapshot, subscribe } from '../scripting/freshness'

/** When each live source was last fetched in this session. Re-renders only when that changes. */
export function useFreshness() {
  return useSyncExternalStore(subscribe, getSnapshot)
}
