// Step 2 of 2 for the stormwater map tiles (step 1 is convert.py).
// Cuts .cache/stormwater.geojson into Mapbox Vector Tiles, zooms 10 to 14, under
// public/data/stormwater/{z}/{x}/{y}.pbf, plus index.json listing every tile that
// has data (the app never requests tiles that are not listed).
//
// geojson-vt is the same tiler MapLibre uses for GeoJSON sources: each zoom level
// is simplified to its own pixel grid, so zoomed-out tiles are coarser and small.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import geojsonvt from 'geojson-vt'
import vtpbf from 'vt-pbf'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CACHE = path.join(ROOT, '.cache')
const OUT = path.join(ROOT, 'public', 'data', 'stormwater')
const MIN_ZOOM = 10
const MAX_ZOOM = 14
const LAYER = 'stormwater'

const fc = JSON.parse(fs.readFileSync(path.join(CACHE, 'stormwater.geojson'), 'utf8'))
const meta = JSON.parse(fs.readFileSync(path.join(CACHE, 'stormwater.meta.json'), 'utf8'))

const tiler = geojsonvt(fc, { maxZoom: MAX_ZOOM, indexMaxZoom: MAX_ZOOM, indexMaxPoints: 0, tolerance: 3, extent: 4096, buffer: 64 })

// Bounds of the data, to limit the tile loops.
let [west, south, east, north] = [180, 90, -180, -90]
const visit = (c) => {
  if (typeof c[0] === 'number') {
    west = Math.min(west, c[0]); east = Math.max(east, c[0]); south = Math.min(south, c[1]); north = Math.max(north, c[1])
  } else c.forEach(visit)
}
fc.features.forEach((f) => visit(f.geometry.coordinates))

const lonToX = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z)
const latToY = (lat, z) => {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

fs.rmSync(OUT, { recursive: true, force: true })
const tiles = []
let bytes = 0
for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
  for (let x = lonToX(west, z); x <= lonToX(east, z); x++) {
    for (let y = latToY(north, z); y <= latToY(south, z); y++) {
      const tile = tiler.getTile(z, x, y)
      if (!tile || !tile.features.length) continue
      const buf = vtpbf.fromGeojsonVt({ [LAYER]: tile }, { version: 2 })
      fs.mkdirSync(path.join(OUT, String(z), String(x)), { recursive: true })
      fs.writeFileSync(path.join(OUT, String(z), String(x), `${y}.pbf`), buf)
      tiles.push(`${z}/${x}/${y}`)
      bytes += buf.length
    }
  }
}

fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({
  ...meta,
  sourceLayer: LAYER,
  minzoom: MIN_ZOOM,
  maxzoom: MAX_ZOOM,
  bounds: [west, south, east, north].map((v) => Number(v.toFixed(5))),
  builtAt: new Date().toISOString().slice(0, 10),
  tiles,
}))
console.log(`Wrote ${tiles.length} tiles (${(bytes / 1e6).toFixed(2)} MB) to public/data/stormwater`)
