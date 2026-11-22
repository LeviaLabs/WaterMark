// Zoom-to-focus: which level a zoom shows (scripting/zoomFocus.ts).
import { describe, expect, it } from 'vitest'
import { blockZoomFor, zoomDepth } from '../src/scripting/zoomFocus'

// Houston: the US (lower 48) fits at about 3.3, Texas at 5.6, Harris County at 9.
const fits = [3.3, 5.6, 9]
const at = (zoom: number, prevZoom: number, current: number) =>
  zoomDepth({ zoom, prevZoom, fits, blockZoom: blockZoomFor(9), worldZoom: 1.7, current })

describe('zoom to focus', () => {
  it('steps down a level as you zoom in past each one', () => {
    expect(at(2.2, 1.7, 0)).toBe(0) // still the world
    expect(at(2.9, 1.7, 0)).toBe(1) // the country
    expect(at(5.2, 2.9, 1)).toBe(2) // the state
    expect(at(8.5, 5.2, 2)).toBe(3) // the county
    expect(at(10.2, 8.5, 3)).toBe(4) // the block
  })
  it('jumps several levels in one long zoom', () => {
    expect(at(10.5, 1.7, 0)).toBe(4)
    expect(at(6, 1.7, 0)).toBe(2)
  })
  it('steps back up as you zoom out, to the world', () => {
    expect(at(9.2, 10.2, 4)).toBe(3) // below the block: back to the county
    expect(at(7.5, 9.2, 3)).toBe(2) // well below the county: the state
    expect(at(4.2, 7.5, 2)).toBe(1)
    expect(at(1.8, 4.2, 1)).toBe(0)
  })
  it('does not flip at a boundary: leaving needs a bigger zoom-out than entering needed', () => {
    // The county is entered at 8.4 (its fit 9 less 0.6)…
    expect(at(8.5, 8, 2)).toBe(3)
    // …and a small zoom-out back to 8.1 keeps it; it is left only below 7.8.
    expect(at(8.1, 8.5, 3)).toBe(3)
    expect(at(7.7, 8.1, 3)).toBe(2)
  })
  it('never moves up while zooming in, nor down while zooming out', () => {
    expect(at(8.2, 8.0, 4)).toBeNull()
    expect(at(10.2, 10.6, 2)).toBeNull()
    expect(at(5, 5, 1)).toBeNull() // a pan, not a zoom
  })
  it('never focuses a huge country at the world view', () => {
    const russia = (zoom: number) => zoomDepth({ zoom, prevZoom: 1.2, fits: [1.9], blockZoom: 8.5, worldZoom: 1.7, current: 0 })
    expect(russia(1.8)).toBe(0)
    expect(russia(2.4)).toBe(1)
  })
  it('selects the block close up even where the deepest region is small or missing', () => {
    expect(blockZoomFor(9.5)).toBe(10.5)
    expect(blockZoomFor(5)).toBe(8.5)
    expect(blockZoomFor(undefined)).toBe(8.5)
  })
})
