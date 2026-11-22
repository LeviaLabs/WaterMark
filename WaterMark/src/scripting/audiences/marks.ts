// GeoJSON for the audience overlays: approach arrow, car suggestions, ranked squares, sensor ranks.
import type { Feature, FeatureCollection, MultiLineString } from 'geojson'
import type { Compass } from './compass'
import { bearingOf, offsetPoint } from './compass'
import type { LngLat } from '../types'

function arrow(origin: LngLat, bearing: number, lengthKm: number): Feature<MultiLineString> {
  const tip = offsetPoint(origin, bearing, lengthKm)
  const left = offsetPoint(tip, bearing + 150, lengthKm * 0.22)
  const right = offsetPoint(tip, bearing - 150, lengthKm * 0.22)
  return {
    type: 'Feature',
    properties: { kind: 'approach' },
    geometry: { type: 'MultiLineString', coordinates: [[origin, tip], [left, tip, right]] },
  }
}

export function audienceMarks(input: {
  approach: { origin: LngLat; compass: Compass } | null
  parking: { origin: LngLat; points: LngLat[] } | null
  areas: { bounds: [number, number, number, number]; role: 'response' | 'staging' }[]
  sensors: { point: LngLat; role: 'recorded' | 'quiet' }[]
}): FeatureCollection {
  const features: Feature[] = []
  if (input.approach) features.push(arrow(input.approach.origin, bearingOf(input.approach.compass), 0.7))
  if (input.parking) {
    input.parking.points.forEach((point, index) => {
      features.push({ type: 'Feature', properties: { kind: 'suggestion' }, geometry: { type: 'Point', coordinates: point } })
      if (index === 0) {
        features.push({
          type: 'Feature', properties: { kind: 'suggestion' },
          geometry: { type: 'LineString', coordinates: [input.parking!.origin, point] },
        })
      }
    })
    features.push({ type: 'Feature', properties: { kind: 'car' }, geometry: { type: 'Point', coordinates: input.parking.origin } })
  }
  for (const area of input.areas) {
    const [w, s, e, n] = area.bounds
    features.push({
      type: 'Feature',
      properties: { kind: area.role },
      geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
    })
  }
  for (const sensor of input.sensors) {
    features.push({ type: 'Feature', properties: { kind: sensor.role === 'recorded' ? 'sensor' : 'quiet' }, geometry: { type: 'Point', coordinates: sensor.point } })
  }
  return { type: 'FeatureCollection', features }
}
