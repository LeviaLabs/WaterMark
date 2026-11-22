// Place search on the map, as you type, through Photon (services/geocoding/photon.ts): the same
// keyless OpenStreetMap geocoder the landing page uses. Each keystroke cancels the previous
// request, repeated queries come from Photon's in-memory cache, and places near the current area
// rank higher. An accessible combobox: arrow keys move, Enter picks, Escape closes.
import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { Icon } from '../common/Icon'
import { MIN_QUERY_LENGTH, PHOTON_ATTRIBUTION, searchPlaces, type GeocodedPlace } from '../../services/geocoding/photon'
import { markFetched } from '../../scripting/freshness'
import type { LngLat } from '../../scripting/types'

interface Props {
  /** Biases results toward this point (usually the selected area). */
  near: LngLat
  onPick: (place: GeocodedPlace) => void
}

type Results = { query: string; places: GeocodedPlace[]; error: string | null }

export function MapSearch({ near, onPick }: Props) {
  const id = useId()
  const [text, setText] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [results, setResults] = useState<Results>({ query: '', places: [], error: null })

  const q = text.trim()
  const isSearchable = q.length >= MIN_QUERY_LENGTH
  const isLoading = isSearchable && results.query !== q
  const [nearLon, nearLat] = near

  useEffect(() => {
    if (!isSearchable) return
    const ctl = new AbortController()
    searchPlaces(q, ctl.signal, { near: { lat: nearLat, lon: nearLon } }).then(
      (places) => { markFetched('geocode'); setResults({ query: q, places, error: null }) },
      (e: unknown) => {
        if (ctl.signal.aborted) return
        const limited = e instanceof Error && 'code' in e && e.code === 'rate-limited'
        setResults({ query: q, places: [], error: limited ? 'Too many searches at once. Pause, then keep typing.' : "Place search isn't responding. Try again in a moment." })
      },
    )
    return () => ctl.abort()
  }, [q, isSearchable, nearLat, nearLon])

  const places = isSearchable ? results.places : []
  const showList = isOpen && isSearchable

  const pick = (place: GeocodedPlace) => {
    setText(place.label)
    setIsOpen(false)
    onPick(place)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIsOpen(true); setActive((i) => Math.min(i + 1, places.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (places[active]) pick(places[active]) }
    else if (e.key === 'Escape') setIsOpen(false)
  }

  const status = !isSearchable ? '' : isLoading ? 'Searching…' : results.error ?? (places.length ? `${places.length} places found` : 'No places found. Try a ZIP code or add the city.')

  return (
    <div className="map-card map-search">
      <span className="map-search-field">
        <Icon name="search" size={18} />
        <label htmlFor={`${id}-input`} className="visually-hidden">Search for a place</label>
        <input
          id={`${id}-input`}
          className="map-search-input"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={showList && places[active] ? `${id}-opt-${active}` : undefined}
          value={text}
          onChange={(e) => { setText(e.target.value); setIsOpen(true); setActive(0) }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onKeyDown={onKeyDown}
          placeholder="Search a ZIP code, neighborhood or address"
          autoComplete="off"
          spellCheck={false}
        />
        {isLoading ? <span className="map-search-spinner" aria-hidden="true" /> : null}
      </span>
      <p className="visually-hidden" role="status">{status}</p>
      {showList ? (
        <div className="map-search-popover">
          <ul id={`${id}-list`} role="listbox" className="map-search-list" aria-label="Places">
            {places.map((p, i) => (
              <li
                key={p.id}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'map-search-option is-active' : 'map-search-option'}
                // Pick on mousedown so the input's blur doesn't close the list first.
                onMouseDown={(e) => { e.preventDefault(); pick(p) }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="map-search-label">{p.label}</span>
                <span className="map-search-detail">{[p.kind, p.detail].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
          {!places.length ? <p className="map-search-note">{status}</p> : null}
          <p className="map-search-credit">
            Search by <a href={PHOTON_ATTRIBUTION.service.url} target="_blank" rel="noopener">Photon</a>, data ©{' '}
            <a href={PHOTON_ATTRIBUTION.data.url} target="_blank" rel="noopener">OpenStreetMap contributors</a>
          </p>
        </div>
      ) : null}
    </div>
  )
}
