import { useEffect, useId, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { mapLink } from '../../scripting/evidence/format'
import { Icon } from '../common/Icon'

export type Place = { id: string; label: string; detail: string; lat: number; lon: number; kind?: string }

/** Looks places up by name; must reject with the AbortError when `signal` aborts. */
export type PlaceLookup = (query: string, signal: AbortSignal) => Promise<readonly Place[]>

/** Credit shown under looked-up results (the provider's attribution terms). */
export type LookupCredit = { service: { name: string; url: string }; data: { name: string; url: string } }

type Props = {
  /** Places offered before anything is typed (and matched locally while the query is short). */
  places: readonly Place[]
  /** When given, queries of `minLength` or more characters search anywhere through it. */
  lookup?: PlaceLookup
  credit?: LookupCredit
  minLength?: number
  /** Text the empty box "types" as a hint. */
  hint?: string
  onSelect?: (place: Place) => void
}

type Lookup = { query: string; places: readonly Place[]; error: string | null }

/** What WaterMark can show at each level of coverage (README Section 5). */
const COVERAGE = [
  { scope: 'Everywhere', layers: 'Rainfall forecast · river flow' },
  { scope: 'United States', layers: '+ NWS alerts · USGS gauges · FEMA zones' },
  { scope: 'New York City', layers: '+ stormwater scenarios · FloodNet · 311' },
]

const errorMessage = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'rate-limited'
    ? 'Too many searches at once. Wait a moment, then keep typing.'
    : 'Place search is unavailable right now. Try one of the pilot neighborhoods.'

const coords = (place: Place) => `${place.lat.toFixed(4)}°, ${place.lon.toFixed(4)}°`

/**
 * Place search as an accessible combobox (arrow keys, Enter, Escape). Short
 * queries filter the given places; with a `lookup`, longer ones search
 * anywhere as you type (each keystroke cancels the previous request). The
 * chosen place shows its coordinates, which can be copied, and links to the
 * map page through /map?lat=&lon=.
 */
export function PlaceSearch({ places, lookup, credit, minLength = 3, hint = 'Red Hook, Brooklyn', onSelect }: Props) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [selected, setSelected] = useState<Place | null>(null)
  const [found, setFound] = useState<Lookup>({ query: '', places: [], error: null })
  const [copied, setCopied] = useState<string | null>(null)

  const q = query.trim()
  const searching = Boolean(lookup) && q.length >= minLength && q !== selected?.label
  const loading = searching && found.query !== q

  useEffect(() => {
    if (!lookup || !searching) return
    const controller = new AbortController()
    lookup(q, controller.signal).then(
      (results) => setFound({ query: q, places: results, error: null }),
      (error: unknown) => {
        if (!controller.signal.aborted) setFound({ query: q, places: [], error: errorMessage(error) })
      },
    )
    return () => controller.abort()
  }, [lookup, searching, q])

  const matches = useMemo(() => {
    // While a new search is on its way, keep the last results on screen instead of flashing empty.
    if (searching) return found.places
    if (selected && q === selected.label) return [selected]
    const lower = q.toLowerCase()
    if (!lower) return places
    return places.filter((place) => `${place.label} ${place.detail}`.toLowerCase().includes(lower))
  }, [searching, found.places, places, q, selected])

  const choose = (place: Place) => {
    setSelected(place)
    setQuery(place.label)
    setOpen(false)
    setCopied(null)
    onSelect?.(place)
  }

  const copy = (place: Place) => {
    const value = `${place.lat.toFixed(6)}, ${place.lon.toFixed(6)}`
    navigator.clipboard?.writeText(value).then(
      () => setCopied(place.id),
      () => setCopied(null),
    )
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
  const error = searching && !loading ? found.error : null
  const empty = open && !loading && !error && matches.length === 0 && q.length > 0

  return (
    <div className="place-search">
      <label className="place-search-label" htmlFor={`${id}-input`}>
        Search a place
      </label>
      <div className={`place-search-box ${query ? 'has-value' : ''} ${loading ? 'is-loading' : ''}`}>
        <Icon name="search" size={18} />
        <input
          id={`${id}-input`}
          className="place-search-input"
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-busy={loading}
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
        <span className="place-search-spinner" aria-hidden="true" />
      </div>

      {showList && (
        <ul id={listId} className={`place-search-list ${loading ? 'is-stale' : ''}`} role="listbox" aria-label="Places">
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
                <small>{[place.kind, place.detail].filter(Boolean).join(' · ')}</small>
              </span>
              <code className="place-search-coords">{coords(place)}</code>
            </li>
          ))}
        </ul>
      )}

      <p className="place-search-status" role="status">
        {loading && open ? 'Searching…' : null}
        {error && open ? error : null}
        {empty && searching ? `No place found for “${q}”. Try a city, neighborhood, address or ZIP code.` : null}
        {empty && !searching
          ? lookup
            ? `Type ${minLength} or more letters to search anywhere.`
            : `No pilot place matches “${q}”. The full map searches anywhere.`
          : null}
      </p>

      {credit && searching && open && (
        <p className="place-search-credit">
          Search by{' '}
          <a href={credit.service.url} target="_blank" rel="noreferrer">
            {credit.service.name}
          </a>{' '}
          · Data ©{' '}
          <a href={credit.data.url} target="_blank" rel="noreferrer">
            {credit.data.name}
          </a>
        </p>
      )}

      {showList ? null : selected ? (
        <div className="place-result" key={selected.id}>
          <p className="place-result-coords">
            <Icon name="pin" size={16} />
            <span>{coords(selected)}</span>
            <button type="button" className="place-result-copy" onClick={() => copy(selected)}>
              {copied === selected.id ? 'Copied' : 'Copy'}
            </button>
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
