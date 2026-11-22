/**
 * A lazily imported chunk that remembers its promise and marks it settled
 * (status/value), the shape React's `use()` reads synchronously. Once a chunk
 * has loaded, a section renders in the same frame instead of suspending,
 * which keeps anchor jumps exact.
 */

type Tracked<T> = Promise<T> & { status?: 'pending' | 'fulfilled' | 'rejected'; value?: T; reason?: unknown }

export type Chunk<T> = () => Promise<T>

export function chunk<T>(importer: () => Promise<T>): Chunk<T> {
  let promise: Tracked<T> | null = null
  return (): Promise<T> => {
    if (!promise) {
      const tracked: Tracked<T> = importer()
      tracked.status = 'pending'
      tracked.then(
        (value) => {
          tracked.status = 'fulfilled'
          tracked.value = value
        },
        (reason: unknown) => {
          tracked.status = 'rejected'
          tracked.reason = reason
        },
      )
      promise = tracked
    }
    return promise
  }
}
