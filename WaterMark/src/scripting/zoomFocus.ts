// Zooming picks the level of the map: the world, then the country, its state or province, the US
// county, and at the closest zooms the block (the grid square) at the point zoomed into: under the
// cursor or pinch, or the middle of the screen for the keys and the +/- buttons.
//
// Each level has a "fit" zoom: the zoom the map flies to when that region is clicked. A level is
// entered a little before its fit (ENTER) and left only well below it (LEAVE). The gap is
// hysteresis, so a zoom that stops near a boundary does not flip back and forth. Zooming in never
// moves the focus up a level and zooming out never moves it down, even when that point is now
// over a smaller or larger region.

/** Zoom levels before a region's fit zoom at which it is entered, and below which it is left. */
// A region is entered once it fills roughly half the screen, not only when it almost fills it.
export const ENTER = 1.3
export const LEAVE = 2
/** The block is entered at its zoom and left this far below it. */
export const BLOCK_LEAVE = 0.6

export interface ZoomDepthInput {
  zoom: number
  /** Zoom when the gesture began. */
  prevZoom: number
  /** Fit zoom of each region at the point zoomed into, outermost (the country) first. */
  fits: readonly number[]
  /** Zoom at which the block under the middle is selected. */
  blockZoom: number
  /** The whole-world zoom: nothing is focused until the map is clearly closer than this. */
  worldZoom: number
  /** Levels focused now: the path length, plus one when a spot is selected. */
  current: number
}

/** Depth for this zoom: 0 the world, 1 to fits.length a region, fits.length + 1 the block; null for no change. */
export function zoomDepth({ zoom, prevZoom, fits, blockZoom, worldZoom, current }: ZoomDepthInput): number | null {
  if (Math.abs(zoom - prevZoom) < 0.05) return null
  const thresholds = [...fits.map((f) => [f - ENTER, f - LEAVE] as const), [blockZoom, blockZoom - BLOCK_LEAVE] as const]
  let depth = 0
  for (let i = 0; i < thresholds.length; i++) {
    let [enter, leave] = thresholds[i]
    if (i === 0) {
      // A country is never focused at the world view, however large it is.
      enter = Math.max(enter, worldZoom + 0.6)
      leave = Math.max(leave, worldZoom + 0.3)
    }
    if (zoom >= (i < current ? leave : enter)) depth = i + 1
    else break
  }
  const isZoomingIn = zoom > prevZoom
  if (isZoomingIn && depth < current) return null
  if (!isZoomingIn && depth > current) return null
  return depth
}

/** The zoom at which the block is selected, from the fit zoom of the deepest region there. */
export function blockZoomFor(deepestFit: number | undefined): number {
  return Math.max((deepestFit ?? 6) + 1, 8.5)
}
