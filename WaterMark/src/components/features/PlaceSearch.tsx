import { useId, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { mapLink } from '../../scripting/evidence/format'
import { Icon } from '../common/Icon'

export type Place = { id: string; label: string; detail: string; lat: number; lon: number }

type Props = {
  places: readonly Place[]
  /** Text the empty box "types" as a hint. */
  hint?: string
  onSelect?: (place: Place) => void
}

/** What WaterMark can show at each level of coverage (README Section 5). */
const COVERAGE = [
  { scope: 'Everywhere', layers: 'Rainfall forecast · river flow' },
  { scope: 'United States', layers: '+ NWS alerts · USGS gauges · FEMA zones' },
  { scope: 'New York City', layers: '+ stormwater scenarios · FloodNet · 311' },
]

/**
 * Place search as an accessible combobox (arrow keys, Enter, Escape). It
 * filters a list of known places and hands the chosen one to the map page
 * through a /map?lat=&lon= link. On the map page, `places` can come from a
 * geocoder instead of the fixed pilot list.
 */
export function PlaceSearch({ places, hint = 'Red Hook, Brooklyn', onSelect }: Props) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [selected, setSelected] = useState<Place | null>(null)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return places
    return places.filter((place) => `${place.label} ${place.detail}`.toLowerCase().includes(q))
  }, [places, query])

  const choose = (place: Place) => {
    setSelected(place)
    setQuery(place.label)
    setOpen(false)
    onSelect?.(place)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (matches.length ? (current + delta + matches.length) % matches.length : 0))
    } else if (event.key === 'Enter' && open && matches[active]) {
      event.preventDefault()
      choose(matches[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const listId = `${id}-list`
  const showList = open && matches.length > 0

  return (
    <div className="place-search">
      <label className="place-search-label" htmlFor={`${id}-input`}>
        Search a place
      </label>
      <div className={`place-search-box ${query ? 'has-value' : ''}`}>
        <Icon name="search" size={18} />
        <input
          id={`${id}-input`}
          className="place-search-input"
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${id}-option-${active}` : undefined}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        <span className="place-search-ghost" aria-hidden="true" style={{ '--chars': hint.length } as CSSProperties}>
          {hint}
        </span>
      </div>

      {showList && (
        <ul id={listId} className="place-search-list" role="listbox" aria-label="Places">
          {matches.map((place, index) => (
            <li
              key={place.id}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === active}
              className={`place-search-option ${index === active ? 'is-active' : ''}`}
              style={{ '--i': index } as CSSProperties}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(place)}
              onMouseEnter={() => setActive(index)}
            >
              <Icon name="pin" size={16} />
              <span>
                <strong>{place.label}</strong>
                <small>{place.detail}</small>
              </span>
            </li>
          ))}
        </ul>
      )}

      {open && matches.length === 0 && (
        <p className="place-search-none" role="status">
          No pilot place matches “{query}”. The full map searches anywhere.
        </p>
      )}

      {selected ? (
        <div className="place-result" key={selected.id}>
          <p className="place-result-coords">
            <Icon name="pin" size={16} />
            {selected.lat.toFixed(4)}°, {selected.lon.toFixed(4)}°
          </p>
          <Link className="place-result-link" to={mapLink(selected)}>
            Open {selected.label} on the map <Icon name="arrowRight" size={16} />
          </Link>
        </div>
      ) : (
        <ul className="place-coverage" aria-label="Coverage levels">
          {COVERAGE.map((row, index) => (
            <li key={row.scope} style={{ '--i': index } as CSSProperties}>
              <strong>{row.scope}</strong>
              <span>{row.layers}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
