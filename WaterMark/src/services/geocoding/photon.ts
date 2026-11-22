/**
 * Place search through Photon (https://photon.komoot.io), a free, keyless
 * geocoder built on OpenStreetMap data that is made for search-as-you-type.
 * The browser calls it directly: there is no key to hide. Every response is
 * validated before use, malformed results are dropped, and results are
 * cached per query so retyping a query does not ask again.
 *
 * Attribution: results must credit "OpenStreetMap contributors" (ODbL), and
 * the public server is shared fair-use infrastructure with no uptime promise.
 */

export const PHOTON_URL = 'https://photon.komoot.io/api/'

export const PHOTON_ATTRIBUTION = {
  service: { name: 'Photon', url: 'https://photon.komoot.io' },
  data: { name: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' },
} as const

/** Queries shorter than this are not sent; they match too much to be useful. */
export const MIN_QUERY_LENGTH = 3

export type GeocodedPlace = {
  /** Stable OpenStreetMap id, e.g. "osm-N-158823151". */
  id: string
  label: string
  /** Where it is: district, city, state, country (whatever the record has). */
  detail: string
  /** What it is, in plain words: "Neighborhood", "Address", "Park". */
  kind: string
  /** WGS 84 decimal degrees. */
  lat: number
  lon: number
  countryCode?: string
}

export type GeocodeErrorCode = 'rate-limited' | 'unavailable' | 'malformed'

export class GeocodeError extends Error {
  readonly code: GeocodeErrorCode

  constructor(code: GeocodeErrorCode, message: string) {
    super(message)
    this.name = 'GeocodeError'
    this.code = code
  }
}

type Bias = { lat: number; lon: number }

type Options = {
  limit?: number
  /** Ranks places near here higher; it never hides places elsewhere. */
  near?: Bias
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined)

const KIND_WORDS: Record<string, string> = {
  neighbourhood: 'Neighborhood',
  suburb: 'Neighborhood',
  quarter: 'Neighborhood',
  house: 'Address',
  postcode: 'ZIP or postal code',
  city: 'City',
  town: 'Town',
  village: 'Village',
  hamlet: 'Village',
  county: 'County',
  state: 'State or region',
  country: 'Country',
  district: 'District',
  locality: 'Place',
  street: 'Street',
}

function kindOf(properties: Record<string, unknown>): string {
  const value = text(properties.osm_value)
  const type = text(properties.type)
  const word = (value && KIND_WORDS[value]) ?? (type && KIND_WORDS[type])
  if (word) return word
  const raw = value ?? type ?? 'place'
  return (raw.charAt(0).toUpperCase() + raw.slice(1)).replace(/_/g, ' ')
}

/** One Photon feature as a place, or null when it lacks a usable name or valid coordinates. */
function toPlace(feature: unknown): GeocodedPlace | null {
  if (!isRecord(feature) || !isRecord(feature.properties) || !isRecord(feature.geometry)) return null
  const { properties, geometry } = feature
  const coordinates = geometry.coordinates
  if (geometry.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length < 2) return null
  const [lon, lat] = coordinates
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null

  const street = [text(properties.housenumber), text(properties.street)].filter(Boolean).join(' ') || undefined
  const label = text(properties.name) ?? street ?? text(properties.postcode) ?? text(properties.city)
  if (!label) return null

  const parts = [
    text(properties.name) && street,
    text(properties.district),
    text(properties.city),
    text(properties.state),
    text(properties.country),
  ].filter((part): part is string => Boolean(part) && part !== label)
  const detail = [...new Set(parts)].join(', ')

  const osmType = text(properties.osm_type) ?? 'X'
  const osmId = typeof properties.osm_id === 'number' ? properties.osm_id : `${lat.toFixed(5)},${lon.toFixed(5)}`
  return {
    id: `osm-${osmType}-${osmId}`,
    label,
    detail,
    kind: kindOf(properties),
    lat,
    lon,
    countryCode: text(properties.countrycode),
  }
}

/**
 * Validates a Photon response and turns it into places. Throws `malformed`
 * when the response is not a FeatureCollection; skips individual features
 * that are unusable, and repeats of the same place.
 */
export function parsePhotonResponse(payload: unknown): GeocodedPlace[] {
  if (!isRecord(payload) || payload.type !== 'FeatureCollection' || !Array.isArray(payload.features)) {
    throw new GeocodeError('malformed', 'Place search returned an unexpected response.')
  }
  const seen = new Set<string>()
  const places: GeocodedPlace[] = []
  for (const feature of payload.features) {
    const place = toPlace(feature)
    if (!place) continue
    const key = `${place.label}|${place.detail}|${place.lat.toFixed(3)}|${place.lon.toFixed(3)}`
    if (seen.has(key) || seen.has(place.id)) continue
    seen.add(key)
    seen.add(place.id)
    places.push(place)
  }
  return places
}

/** The request URL for a query (exported for tests). */
export function photonUrl(query: string, { limit = 6, near }: Options = {}): string {
  const params = new URLSearchParams({ q: query.trim(), limit: String(limit), lang: 'en' })
  if (near) {
    params.set('lat', near.lat.toFixed(4))
    params.set('lon', near.lon.toFixed(4))
  }
  return `${PHOTON_URL}?${params}`
}

const CACHE_LIMIT = 60
const cache = new Map<string, GeocodedPlace[]>()

/**
 * Places matching what the user typed, best match first. Resolves to an empty
 * list for queries under MIN_QUERY_LENGTH. Pass the AbortSignal of the
 * keystroke that started it so older searches are cancelled as the user types;
 * an aborted search rejects with the AbortError, which callers should ignore.
 */
export async function searchPlaces(query: string, signal?: AbortSignal, options: Options = {}): Promise<GeocodedPlace[]> {
  const trimmed = query.trim()
  if (trimmed.length < MIN_QUERY_LENGTH) return []
  const url = photonUrl(trimmed, options)
  const hit = cache.get(url)
  if (hit) return hit

  let response: Response
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new GeocodeError('unavailable', 'Place search could not be reached.')
  }
  if (response.status === 429) throw new GeocodeError('rate-limited', 'Too many searches in a short time.')
  if (!response.ok) throw new GeocodeError('unavailable', `Place search answered ${response.status}.`)

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new GeocodeError('malformed', 'Place search returned something that is not JSON.')
  }
  const places = parsePhotonResponse(payload)
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
  cache.set(url, places)
  return places
}
