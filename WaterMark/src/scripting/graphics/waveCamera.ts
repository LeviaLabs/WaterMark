/**
 * Camera math shared by the hero shader and the pointer code.
 * The GLSL in waveShaders.ts uses the same constants, so a tap on the canvas
 * lands on the same spot of water the shader draws under the finger.
 */

/** Screen height (in uv units, 0 = middle) where the sea meets the sky. */
export const HORIZON = 0.06
/** Camera height above the water plane. */
export const CAMERA_HEIGHT = 1
/** Farther than this the water is fog, so ripples there are not worth it. */
export const MAX_DISTANCE = 60

export type PlanePoint = { x: number; z: number }

/** Pixel position inside the canvas to centered uv (y up, units of height). */
export function pixelToUv(px: number, py: number, width: number, height: number) {
  return {
    u: (px - width / 2) / height,
    v: (height / 2 - py) / height,
  }
}

/**
 * Intersects the camera ray through (u, v) with the water plane.
 * Returns null when the ray looks at the sky or past the fog line.
 */
export function uvToPlane(u: number, v: number, sway = 0): PlanePoint | null {
  const below = HORIZON - v
  if (below <= 0) return null
  const z = CAMERA_HEIGHT / below
  if (z > MAX_DISTANCE) return null
  return { x: (u + sway) * z, z }
}

export const RIPPLE_SLOTS = 4

/**
 * Fixed-size ring of ripples packed as [x, z, startTime] triples, ready to
 * upload with gl.uniform3fv. Old ripples are overwritten, never reallocated.
 */
export class RippleRing {
  readonly data = new Float32Array(RIPPLE_SLOTS * 3).fill(-1000)
  #next = 0

  add(point: PlanePoint, time: number): void {
    const i = this.#next * 3
    this.data[i] = point.x
    this.data[i + 1] = point.z
    this.data[i + 2] = time
    this.#next = (this.#next + 1) % RIPPLE_SLOTS
  }
}
