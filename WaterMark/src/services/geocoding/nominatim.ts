// Fallback place search through OpenStreetMap's Nominatim, used only when Photon fails (its public
// server rate-limits busy clients, which the browser reports as a CORS error). Nominatim's usage
// policy forbids search-as-you-type, so this runs once per settled query, never per keystroke.
// https://operations.osmfoundation.org/policies/nominatim/
import { getJSON } from '../http'
import type { GeocodedPlace } from './photon'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')

/** Validates one Nominatim result as a place; null when it lacks a name or valid coordinates. */
function toPlace(r: unknown): GeocodedPlace | null {
  if (typeof r !== 'object' || r === null) return null
  const o = r as Record<string, unknown>
  const lat = Number(o.lat)
  const lon = Number(o.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  const full = text(o.display_name)
  const label = text(o.name) ?? full?.split(',')[0]
  if (!label) return null
  const detail = (full ?? '').split(',').map((s) => s.trim()).filter((s) => s && s !== label).slice(0, 4).join(', ')
  const address = typeof o.address === 'object' && o.address ? (o.address as Record<string, unknown>) : {}
  return {
    id: `osm-${text(o.osm_type)?.charAt(0).toUpperCase() ?? 'X'}-${String(o.osm_id ?? `${lat},${lon}`)}`,
    label,
    detail,
    kind: capitalize(text(o.addresstype) ?? text(o.type) ?? 'Place'),
    lat,
    lon,
    countryCode: text(address.country_code)?.toUpperCase(),
  }
}

export async function searchNominatim(query: string, signal: AbortSignal): Promise<GeocodedPlace[]> {
  const q = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', limit: '6' })
  const rows = await getJSON<unknown>(`${NOMINATIM_URL}?${q}`, { signal })
  if (!Array.isArray(rows)) throw new Error('Nominatim returned an unexpected response.')
  return rows.map(toPlace).filter((p): p is GeocodedPlace => p !== null)
}
