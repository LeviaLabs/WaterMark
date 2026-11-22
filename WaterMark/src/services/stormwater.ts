// NYC Stormwater Flood Map (Moderate Flood, 2.13 in/hr, current sea levels), served as our own
// static vector tiles built from the official NYC Open Data layer (scripts/stormwater).
// Flooding_Category 1 = nuisance flooding (4 in to 1 ft), 2 = deep flooding (1 ft or more).
//
// The ArcGIS service this replaced stored the whole city as two features, so every map move
// downloaded about 4 MB. Tiles are small blocks: the map asks only for the blocks in view,
// zoomed-out blocks are simplified, and both the map and the area statistics share one
// size-limited cache, so a block is downloaded once and dropped once it is far out of use.
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import type { Feature, MultiPolygon, Polygon } from 'geojson'
import { ENDPOINTS } from './endpoints'
import { getJSON } from './http'
import { withSignal } from './shared'
import { markFetched } from '../scripting/freshness'
import { stormShareFromTiles, type StormTile } from '../scripting/geo'
import { tileBounds, tilesCovering } from '../scripting/tiles'
import type { StormShare } from '../scripting/types'

export const STORM_PROTOCOL = 'wmstorm'

export interface StormIndex {
  dataset: string
  layer: string
  datasetUpdated: string
  sourceLayer: string
  minzoom: number
  maxzoom: number
  bounds: [number, number, number, number]
  tiles: Set<string>
}

let indexPromise: Promise<StormIndex> | null = null

/** The tile list and dataset facts, loaded once per visit. */
export function loadStormIndex(): Promise<StormIndex> {
  indexPromise ??= getJSON<unknown>(ENDPOINTS.stormIndex).then((raw) => {
    const r = raw as Partial<Omit<StormIndex, 'tiles'>> & { tiles?: unknown }
    if (!Array.isArray(r.tiles) || typeof r.maxzoom !== 'number' || typeof r.minzoom !== 'number' || !Array.isArray(r.bounds)) {
      throw new Error('Stormwater tile index is malformed.')
    }
    return { ...(r as Omit<StormIndex, 'tiles'>), tiles: new Set(r.tiles.filter((t): t is string => typeof t === 'string')) }
  })
  indexPromise.catch(() => { indexPromise = null })
  return indexPromise
}

// Least-recently-used cache of tile downloads, shared by the map and the area statistics.
// 160 blocks is a few city views; the biggest block is about 35 kB.
const CACHE_LIMIT = 160
const tileCache = new Map<string, Promise<ArrayBuffer>>()

async function tileBuffer(key: string): Promise<ArrayBuffer> {
  const index = await loadStormIndex()
  if (!index.tiles.has(key)) return new ArrayBuffer(0) // no modeled flooding in this block: nothing to download
  const hit = tileCache.get(key)
  if (hit) {
    tileCache.delete(key)
    tileCache.set(key, hit) // most recently used goes last
    return hit
  }
  const job = fetch(`${ENDPOINTS.stormTiles}/${key}.pbf`).then((res) => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.arrayBuffer()
  })
  tileCache.set(key, job)
  job.catch(() => tileCache.delete(key))
  while (tileCache.size > CACHE_LIMIT) tileCache.delete(tileCache.keys().next().value as string)
  return job
}


/** MapLibre protocol handler for `wmstorm://{z}/{x}/{y}`. Register once with maplibregl.addProtocol. */
export async function loadStormTile(params: { url: string }, abort: AbortController): Promise<{ data: ArrayBuffer }> {
  const key = params.url.slice(`${STORM_PROTOCOL}://`.length)
  const cached = await withSignal(tileBuffer(key), abort.signal)
  markFetched('stormwater')
  // MapLibre transfers the buffer to its worker, which detaches it; hand over a copy so the
  // cached original stays usable for the next view and for the area statistics.
  return { data: cached.slice(0) }
}

function decode(buffer: ArrayBuffer, z: number, x: number, y: number, layer: string): StormTile['features'] {
  if (!buffer.byteLength) return []
  const vtLayer = new VectorTile(new Pbf(buffer)).layers[layer]
  if (!vtLayer) return []
  const out: StormTile['features'] = []
  for (let i = 0; i < vtLayer.length; i++) {
    const f = vtLayer.feature(i).toGeoJSON(x, y, z) as Feature<Polygon | MultiPolygon, { Flooding_Category: number }>
    if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') out.push(f)
  }
  return out
}

/** Most blocks read for one circle; a bigger circle reads coarser (lower-zoom) blocks instead. */
const MAX_TILES = 48

/** Share of a drawn circle covered by modeled flooding, from the same tiles the map draws. */
export async function fetchStormInArea(area: Feature<Polygon>, signal: AbortSignal): Promise<StormShare> {
  const index = await withSignal(loadStormIndex(), signal)
  let z = index.maxzoom
  while (z > index.minzoom && tilesCovering(area, z).length > MAX_TILES) z--
  const keys = tilesCovering(area, z)
  const tiles = await withSignal(Promise.all(keys.map(async ([tz, tx, ty]) => ({
    bounds: tileBounds(tz, tx, ty),
    features: decode(await tileBuffer(`${tz}/${tx}/${ty}`), tz, tx, ty, index.sourceLayer),
  }))), signal)
  markFetched('stormwater')
  return { ...stormShareFromTiles(area, tiles), partial: z < index.maxzoom }
}
