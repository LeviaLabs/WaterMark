import { between, createRandom } from './random'

/**
 * The 2D city behind the hero and the flood story. Pure geometry, no DOM:
 * components/city/Skyline.tsx turns a layer into SVG.
 *
 * Every layer lives in the same coordinate space: WORLD_WIDTH wide and
 * LAYER_HEIGHT tall, ground at the bottom. Buildings and windows snap to a
 * grid of `cell` units so a single SVG <pattern> can draw every window of a
 * layer (one element per building instead of one per window); only the
 * windows lit at night become separate rectangles.
 */

export const WORLD_WIDTH = 2400
export const LAYER_HEIGHT = 600

export type Roof = 'flat' | 'antenna' | 'spire' | 'stepped' | 'tank' | 'dome'

export type LitWindow = {
  x: number
  y: number
  /** A few windows flicker on and off at night. */
  flicker: boolean
}

export type Building = {
  x: number
  /** Top edge of the building body (roof details sit above it). */
  y: number
  width: number
  height: number
  roof: Roof
  /** Window grid inside the building, or null for silhouettes and narrow towers. */
  windows: { x: number; y: number; width: number; height: number } | null
  lit: readonly LitWindow[]
}

export type SkylineLayer = {
  id: string
  cell: number
  windowWidth: number
  windowHeight: number
  buildings: readonly Building[]
}

export type LayerOptions = {
  id: string
  seed: number
  /** Window grid size in world units. Building edges snap to it. */
  cell: number
  windowWidth: number
  windowHeight: number
  /** Building width range, in cells. */
  widthCells: readonly [number, number]
  /** Building height range, as a share of LAYER_HEIGHT. */
  heightShare: readonly [number, number]
  /** Gap between buildings, in cells. */
  gapCells: readonly [number, number]
  /** Draw windows at all (the far layer is a silhouette). */
  windows: boolean
  /** Share of windows lit at night. */
  litShare: number
  /** Share of lit windows that flicker. */
  flickerShare: number
  roofs: readonly Roof[]
}

const snap = (value: number, cell: number) => Math.round(value / cell) * cell

export function generateLayer(options: LayerOptions): SkylineLayer {
  const random = createRandom(options.seed)
  const { cell } = options
  const buildings: Building[] = []
  let x = -snap(between(random, 0, 2) * cell, cell)

  while (x < WORLD_WIDTH) {
    const width = Math.round(between(random, options.widthCells[0], options.widthCells[1] + 1)) * cell
    const height = Math.max(cell * 3, snap(between(random, options.heightShare[0], options.heightShare[1]) * LAYER_HEIGHT, cell))
    const y = LAYER_HEIGHT - height
    const roof = options.roofs[Math.floor(random() * options.roofs.length)]

    // Windows keep one cell of wall on each side and two at the top; the
    // bottom row stays blank as a lobby.
    const hasWindows = options.windows && width >= cell * 3 && height >= cell * 4
    const windows = hasWindows ? { x: x + cell, y: y + cell * 2, width: width - cell * 2, height: height - cell * 3 } : null

    const lit: LitWindow[] = []
    if (windows) {
      const cols = windows.width / cell
      const rows = windows.height / cell
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (random() < options.litShare) {
            lit.push({
              x: windows.x + col * cell + (cell - options.windowWidth) / 2,
              y: windows.y + row * cell + (cell - options.windowHeight) / 2,
              flicker: random() < options.flickerShare,
            })
          }
        }
      }
    }

    buildings.push({ x, y, width, height, roof, windows, lit })
    x += width + Math.round(between(random, options.gapCells[0], options.gapCells[1] + 1)) * cell
  }

  return {
    id: options.id,
    cell,
    windowWidth: options.windowWidth,
    windowHeight: options.windowHeight,
    buildings,
  }
}

/** The three depth layers, far to near. */
export const SKYLINE_LAYERS: readonly SkylineLayer[] = [
  generateLayer({
    id: 'far',
    seed: 7,
    cell: 10,
    windowWidth: 4,
    windowHeight: 5,
    widthCells: [6, 14],
    heightShare: [0.42, 0.86],
    gapCells: [0, 1],
    windows: false,
    litShare: 0,
    flickerShare: 0,
    roofs: ['flat', 'spire', 'antenna', 'stepped', 'flat'],
  }),
  generateLayer({
    id: 'mid',
    seed: 21,
    cell: 12,
    windowWidth: 5,
    windowHeight: 7,
    widthCells: [5, 10],
    heightShare: [0.3, 0.68],
    gapCells: [0, 2],
    windows: true,
    litShare: 0.26,
    flickerShare: 0.04,
    roofs: ['flat', 'tank', 'antenna', 'stepped', 'dome', 'flat'],
  }),
  generateLayer({
    id: 'near',
    seed: 58,
    cell: 18,
    windowWidth: 9,
    windowHeight: 11,
    widthCells: [4, 8],
    heightShare: [0.16, 0.46],
    gapCells: [1, 3],
    windows: true,
    litShare: 0.32,
    flickerShare: 0.05,
    roofs: ['flat', 'tank', 'tank', 'stepped', 'flat'],
  }),
]

/**
 * Horizontal slice of the world to show for a box of the given aspect ratio
 * (width / height), centered. Narrow (phone) boxes still show at least
 * `minWidth` units of city, so it reads as a skyline, not three giant towers.
 */
export function viewBoxFor(aspect: number, minWidth = 680): string {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9
  const width = Math.min(WORLD_WIDTH, Math.max(minWidth, safeAspect * LAYER_HEIGHT))
  const x = (WORLD_WIDTH - width) / 2
  return `${x.toFixed(1)} 0 ${width.toFixed(1)} ${LAYER_HEIGHT}`
}
