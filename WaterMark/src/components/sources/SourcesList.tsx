// Data sources and citations. A self-contained, toggleable section: the map's Sources tab shows it
// open, and the landing page can mount it collapsed with <SourcesList />.
import { useId, useState } from 'react'
import { SOURCES } from '../../scripting/sources'
import { fmtTime } from '../../scripting/format'
import { useFreshness } from '../../hooks/useFreshness'
import '../../styling/sources.css'

export function SourcesList({ defaultOpen = false, isToggleable = true }: { defaultOpen?: boolean; isToggleable?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen || !isToggleable)
  const fetched = useFreshness()
  const listId = useId()

  return (
    <section className="sources" aria-label="Data sources and citations">
      {isToggleable ? (
        <button type="button" className="sources-toggle" aria-expanded={isOpen} aria-controls={listId}
          onClick={() => setIsOpen((o) => !o)}>
          <svg className="sources-chev" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M5 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Data sources and citations ({SOURCES.length})
        </button>
      ) : null}
      <ol className="sources-list" id={listId} hidden={!isOpen}>
        {SOURCES.map((s) => {
          const at = fetched[s.id]
          return (
            <li key={s.id}>
              <p className="sources-name">{s.name}</p>
              <p className="sources-use">{s.use}</p>
              <p className="sources-meta">
                {s.publisher}.{' '}
                <a href={s.url} target="_blank" rel="noopener">{s.url.replace(/^https?:\/\//, '')}</a>.{' '}
                {at ? <span className="sources-live">Fetched {fmtTime(at)}</span>
                  : s.live ? 'Live source, not loaded yet' : 'Static or pre-downloaded'}
              </p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
