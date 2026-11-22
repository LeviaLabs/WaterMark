// Web Mercator ("slippy map") tile math, the same z/x/y grid MapLibre uses. Pure; tested in tests/tiles.test.ts.
import type { Feature, Polygon } from 'geojson'

export type TileKey = [z: number, x: number, y: number]

export const lonToTileX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z)

export function latToTileY(lat: number, z: number) {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

const tileXToLon = (x: number, z: number) => (x / 2 ** z) * 360 - 180
const tileYToLat = (y: number, z: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI

/** [west, south, east, north] of a tile in degrees. */
export function tileBounds(z: number, x: number, y: number): [number, number, number, number] {
  return [tileXToLon(x, z), tileYToLat(y + 1, z), tileXToLon(x + 1, z), tileYToLat(y, z)]
}

/** Every tile at zoom `z` that the polygon's bounding box touches. */
export function tilesCovering(area: Feature<Polygon>, z: number): TileKey[] {
  let [w, s, e, n] = [180, 90, -180, -90]
  for (const [lon, lat] of area.geometry.coordinates[0]) {
    w = Math.min(w, lon); e = Math.max(e, lon); s = Math.min(s, lat); n = Math.max(n, lat)
  }
  const keys: TileKey[] = []
  for (let x = lonToTileX(w, z); x <= lonToTileX(e, z); x++) {
    for (let y = latToTileY(n, z); y <= latToTileY(s, z); y++) keys.push([z, x, y])
  }
  return keys
}
