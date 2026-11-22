import { Suspense, use, useEffect, useRef, useState, useSyncExternalStore, type ReactElement } from 'react'
import type { Chunk } from '../../scripting/lazy/chunk'
import { useInView } from '../../hooks/useInView'
import { isEager, subscribeEager } from '../../scripting/lazy/eager'

type Props = {
  /** Anchor id (#how, #data…), kept on the slot so links work before the section loads. */
  id?: string
  /** Rough height of the section while it loads, so the page does not jump. */
  minHeight: string
  /** Skeleton shape: a heading with rows, or a heading with cards. */
  shape?: 'rows' | 'cards' | 'stage'
  /** The section's code (scripting/lazy/chunk), loaded on approach or earlier. */
  load: Chunk<ReactElement>
}

/**
 * Loads and mounts a landing section only as it scrolls into view: a
 * shimmering skeleton holds its place while its code arrives, then the real
 * section fades up over it. A section whose code is already loaded (after an
 * anchor jump) renders at once.
 */
export function LazySection({ id, minHeight, shape = 'rows', load }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const near = useInView(ref, { once: true, rootMargin: '0px 0px 160px 0px' })
  const eager = useSyncExternalStore(subscribeEager, isEager, () => false)
  const [ready, setReady] = useState(false)
  const mounted = near || eager

  return (
    <div
      ref={ref}
      id={id}
      className={`lazy-slot ${ready ? 'is-ready' : ''}`}
      style={ready ? undefined : { minHeight }}
    >
      {mounted ? (
        <Suspense fallback={<Skeleton shape={shape} />}>
          <Arrived load={load} onArrive={() => setReady(true)} />
        </Suspense>
      ) : (
        <Skeleton shape={shape} />
      )}
    </div>
  )
}

/** Renders once the code has loaded; tells the slot so it can drop its placeholder height. */
function Arrived({ load, onArrive }: { load: Chunk<ReactElement>; onArrive: () => void }) {
  const section = use(load())
  useEffect(onArrive, [onArrive])
  return (
    <div className="lazy-content">
      {section}
    </div>
  )
}

function Skeleton({ shape }: { shape: 'rows' | 'cards' | 'stage' }) {
  return (
    <div className={`skeleton skeleton--${shape}`} aria-hidden="true">
      <span className="skeleton-line skeleton-line--eyebrow" />
      <span className="skeleton-line skeleton-line--title" />
      <span className="skeleton-line skeleton-line--title skeleton-line--short" />
      <span className="skeleton-body">
        {Array.from({ length: shape === 'cards' ? 3 : 4 }, (_, index) => (
          <span key={index} className="skeleton-block" style={{ animationDelay: `${index * 120}ms` }} />
        ))}
      </span>
    </div>
  )
}
