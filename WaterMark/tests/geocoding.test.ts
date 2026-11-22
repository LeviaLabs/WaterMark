import { afterEach, describe, expect, it, vi } from 'vitest'
import { GeocodeError, parsePhotonResponse, photonUrl, searchPlaces } from '../src/services/geocoding/photon'

/** Trimmed from a real Photon answer for "red hook brooklyn" (example fixture). */
const RED_HOOK = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        osm_type: 'N',
        osm_id: 158823151,
        osm_value: 'neighbourhood',
        type: 'locality',
        name: 'Red Hook',
        district: 'Brooklyn',
        city: 'New York',
        state: 'New York',
        country: 'United States',
        countrycode: 'US',
      },
      geometry: { type: 'Point', coordinates: [-74.0095841, 40.6751032] },
    },
    {
      type: 'Feature',
      properties: { osm_type: 'W', osm_id: 1, osm_value: 'house', housenumber: '160', street: 'Van Brunt Street', city: 'New York', country: 'United States' },
      geometry: { type: 'Point', coordinates: [-74.0122, 40.6812] },
    },
  ],
}

const response = (status: number, body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.restoreAllMocks())

describe('photon geocoding', () => {
  it('turns features into places with latitude and longitude in the right order', () => {
    const [hood, address] = parsePhotonResponse(RED_HOOK)
    expect(hood).toMatchObject({ id: 'osm-N-158823151', label: 'Red Hook', kind: 'Neighborhood', lat: 40.6751032, lon: -74.0095841 })
    expect(hood.detail).toBe('Brooklyn, New York, United States')
    expect(address).toMatchObject({ label: '160 Van Brunt Street', kind: 'Address', detail: 'New York, United States' })
  })

  it('drops unusable features and repeats, and rejects responses of the wrong shape', () => {
    const places = parsePhotonResponse({
      type: 'FeatureCollection',
      features: [
        RED_HOOK.features[0],
        RED_HOOK.features[0],
        { type: 'Feature', properties: { name: 'Nowhere' }, geometry: { type: 'Point', coordinates: [200, 95] } },
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [1, 1] } },
        { type: 'Feature', properties: { name: 'Line' }, geometry: { type: 'LineString', coordinates: [[1, 1], [2, 2]] } },
        null,
      ],
    })
    expect(places.map((place) => place.label)).toEqual(['Red Hook'])
    expect(() => parsePhotonResponse({ message: 'q parameter is required' })).toThrow(GeocodeError)
  })

  it('builds the request with the query, a limit and an optional location bias', () => {
    const url = new URL(photonUrl('  11231 ', { limit: 4, near: { lat: 40.7128, lon: -74.006 } }))
    expect(url.origin + url.pathname).toBe('https://photon.komoot.io/api/')
    expect(url.searchParams.get('q')).toBe('11231')
    expect(url.searchParams.get('limit')).toBe('4')
    expect(url.searchParams.get('lat')).toBe('40.7128')
  })

  it('skips short queries, caches answers and reports rate limits and outages', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    await expect(searchPlaces('ny')).resolves.toEqual([])
    expect(fetch).not.toHaveBeenCalled()

    fetch.mockResolvedValueOnce(response(200, RED_HOOK))
    const first = await searchPlaces('Red Hook test')
    const again = await searchPlaces('Red Hook test')
    expect(again).toBe(first)
    expect(fetch).toHaveBeenCalledTimes(1)

    fetch.mockResolvedValueOnce(response(429, {}))
    await expect(searchPlaces('rate limited')).rejects.toMatchObject({ code: 'rate-limited' })
    fetch.mockResolvedValueOnce(response(503, {}))
    await expect(searchPlaces('server down')).rejects.toMatchObject({ code: 'unavailable' })
    fetch.mockResolvedValueOnce(response(200, 'not json'))
    await expect(searchPlaces('bad body')).rejects.toMatchObject({ code: 'malformed' })
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(searchPlaces('offline')).rejects.toMatchObject({ code: 'unavailable' })
  })

  it('lets an aborted search reject with the abort, not as an outage', async () => {
    const controller = new AbortController()
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => {
      controller.abort()
      return Promise.reject(new DOMException('Aborted', 'AbortError'))
    })
    await expect(searchPlaces('aborted query', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
