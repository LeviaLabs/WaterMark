// Place search on the map, as you type, through Photon (services/geocoding/photon.ts): the same
// keyless OpenStreetMap geocoder the landing page uses. Each keystroke cancels the previous
// request, repeated queries come from Photon's in-memory cache, and places near the current area
// rank higher. An accessible combobox: arrow keys move, Enter picks, Escape closes.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from '../common/Icon'
import { MIN_QUERY_LENGTH, PHOTON_ATTRIBUTION, searchPlaces, type GeocodedPlace } from '../../services/geocoding/photon'
import { searchNominatim } from '../../services/geocoding/nominatim'
import { markFetched } from '../../scripting/freshness'
import type { LngLat } from '../../scripting/types'

interface Props {
  /** Biases results toward this point (usually the selected area). */
  near: LngLat
  onPick: (place: GeocodedPlace) => void
}

type Results = { query: string; places: GeocodedPlace[]; error: string | null }

const TYPING_PAUSE_MS = 300

export function MapSearch({ near, onPick }: Props) {
  const id = useId()
  const [text, setText] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [results, setResults] = useState<Results>({ query: '', places: [], error: null })
  // Enter pressed before the results for the current text arrived: pick the best one when they do.
  const pendingPick = useRef<string | null>(null)
  const onPickRef = useRef(onPick)
  useEffect(() => { onPickRef.current = onPick })

  const q = text.trim()
  const isSearchable = q.length >= MIN_QUERY_LENGTH
  // The text a pick put in the box; it is not searched again.
  const [picked, setPicked] = useState<string | null>(null)
  const isLoading = isSearchable && results.query !== q && q !== picked
  const [nearLon, nearLat] = near


  useEffect(() => {
    if (!isSearchable || q === picked) return
    const ctl = new AbortController()
    // Wait for a pause in typing before asking: one request per settled query keeps us under
    // Photon's rate limit (its public server cuts off busy clients, and the browser then reports
    // the refusal as a CORS error). The timer is cleared on the next keystroke.
    const pause = setTimeout(() => {
      searchPlaces(q, ctl.signal, { near: { lat: nearLat, lon: nearLon } })
        // Photon down or rate-limiting: fall back to Nominatim for this one settled query.
        .catch((e: unknown) => (ctl.signal.aborted ? Promise.reject(e) : searchNominatim(q, ctl.signal)))
        .then(
          (places) => {
            markFetched('geocode')
            setResults({ query: q, places, error: null })
            if (pendingPick.current === q && places[0]) {
              pendingPick.current = null
              setPicked(places[0].label)
              setText(places[0].label)
              setIsOpen(false)
              onPickRef.current(places[0])
            }
          },
          () => {
            if (ctl.signal.aborted) return
            pendingPick.current = null
            setResults({ query: q, places: [], error: "Place search isn't responding. Check your connection, or try again in a moment." })
          },
        )
    }, q === results.query ? 0 : TYPING_PAUSE_MS)
    return () => { clearTimeout(pause); ctl.abort() }
    // results.query only picks the delay; it must not restart the search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, isSearchable, nearLat, nearLon, picked])

  const places = isSearchable ? results.places : []
  const showList = isOpen && isSearchable

  const pick = (place: GeocodedPlace) => {
    setPicked(place.label)
    setText(place.label)
    setIsOpen(false)
    pendingPick.current = null
    onPick(place)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIsOpen(true); setActive((i) => Math.min(i + 1, places.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (!isSearchable) return
      // Never pick from the results of an older, shorter query.
      if (isLoading) pendingPick.current = q
      else if (places[active]) pick(places[active])
    }
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
          placeholder="Search a place or ZIP code"
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
