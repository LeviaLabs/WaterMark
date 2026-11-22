import type { ColorScheme } from '../theme/themeStorage'
import { RippleRing, pixelToUv, uvToPlane } from './waveCamera'
import { WAVE_PALETTES, easeInOut, mixPalettes, type WavePalette } from './wavePalettes'
import { FRAGMENT_SHADER, VERTEX_SHADER } from './waveShaders'

const UNIFORMS = [
  'uResolution', 'uTime', 'uSway', 'uHover', 'uHoverStrength', 'uRipples',
  'uSkyTop', 'uSkyHorizon', 'uWaterDeep', 'uWaterShallow', 'uLightColor', 'uLightDir', 'uLightDisc',
] as const
type UniformName = (typeof UNIFORMS)[number]

/** Skip frames that arrive sooner than this, so 120 Hz screens draw at ~60 fps. */
const MIN_FRAME_MS = 1000 / 62
const THEME_FADE_MS = 700
const MAX_SWAY = 0.1

export type WaveQuality = {
  /** Fraction of CSS pixels to render; the canvas is stretched back up by CSS. */
  renderScale: number
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

/**
 * Owns the WebGL context of the hero canvas. React only creates it, forwards
 * pointer/theme/visibility changes and disposes it; all per-frame work stays
 * here, outside React state, so the page never re-renders while the sea moves.
 */
export class WaveRenderer {
  #gl: WebGLRenderingContext
  #program: WebGLProgram
  #buffer: WebGLBuffer
  #uniforms: Record<UniformName, WebGLUniformLocation | null>
  #canvas: HTMLCanvasElement
  #quality: WaveQuality

  #ripples = new RippleRing()
  #frame = 0
  #running = false
  #lastFrame = 0
  #clock = 0 // seconds of animation actually shown; does not advance while stopped
  #cssWidth = 1
  #cssHeight = 1

  #hover = { x: 0, z: 6 }
  #hoverStrength = 0
  #hoverTarget = 0
  #sway = 0
  #swayTarget = 0

  #palette: WavePalette
  #fadeFrom: WavePalette
  #fadeTo: WavePalette
  #fadeStart = -1

  static create(canvas: HTMLCanvasElement, scheme: ColorScheme, quality: WaveQuality): WaveRenderer | null {
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    })
    if (!gl) return null
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    const program = gl.createProgram()
    const buffer = gl.createBuffer()
    if (!vertex || !fragment || !program || !buffer) return null
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
    return new WaveRenderer(canvas, gl, program, buffer, scheme, quality)
  }

  private constructor(
    canvas: HTMLCanvasElement,
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    buffer: WebGLBuffer,
    scheme: ColorScheme,
    quality: WaveQuality,
  ) {
    this.#canvas = canvas
    this.#gl = gl
    this.#program = program
    this.#buffer = buffer
    this.#quality = quality
    this.#palette = WAVE_PALETTES[scheme]
    this.#fadeFrom = this.#palette
    this.#fadeTo = this.#palette

    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    this.#uniforms = Object.fromEntries(
      UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)]),
    ) as Record<UniformName, WebGLUniformLocation | null>
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.#cssWidth = Math.max(cssWidth, 1)
    this.#cssHeight = Math.max(cssHeight, 1)
    const scale = this.#quality.renderScale
    const width = Math.max(Math.round(this.#cssWidth * scale), 1)
    const height = Math.max(Math.round(this.#cssHeight * scale), 1)
    if (this.#canvas.width !== width || this.#canvas.height !== height) {
      this.#canvas.width = width
      this.#canvas.height = height
      this.#gl.viewport(0, 0, width, height)
    }
    if (!this.#running) this.#draw()
  }

  setScheme(scheme: ColorScheme, animate: boolean): void {
    const target = WAVE_PALETTES[scheme]
    if (target === this.#fadeTo) return
    this.#fadeFrom = this.#palette
    this.#fadeTo = target
    if (animate && this.#running) {
      this.#fadeStart = performance.now()
    } else {
      this.#palette = target
      this.#fadeStart = -1
      if (!this.#running) this.#draw()
    }
  }

  /** Coordinates are CSS pixels relative to the canvas. */
  pointerMove(px: number, py: number): void {
    const { u, v } = pixelToUv(px, py, this.#cssWidth, this.#cssHeight)
    this.#swayTarget = Math.max(-1, Math.min(1, u)) * MAX_SWAY
    const point = uvToPlane(u, v, this.#sway)
    if (point) {
      this.#hover = point
      this.#hoverTarget = 1
    } else {
      this.#hoverTarget = 0
    }
  }

  pointerLeave(): void {
    this.#hoverTarget = 0
    this.#swayTarget = 0
  }

  pointerDown(px: number, py: number): void {
    const { u, v } = pixelToUv(px, py, this.#cssWidth, this.#cssHeight)
    const point = uvToPlane(u, v, this.#sway)
    if (point) this.#ripples.add(point, this.#clock)
    if (!this.#running) this.#draw()
  }

  start(): void {
    if (this.#running) return
    this.#running = true
    this.#lastFrame = performance.now()
    this.#frame = requestAnimationFrame(this.#tick)
  }

  stop(): void {
    this.#running = false
    cancelAnimationFrame(this.#frame)
  }

  /** Draws a single still frame (used for reduced motion and while paused). */
  renderStill(): void {
    this.#draw()
  }

  dispose(): void {
    this.stop()
    const gl = this.#gl
    gl.deleteBuffer(this.#buffer)
    gl.deleteProgram(this.#program)
    // Do not call WEBGL_lose_context here: a canvas has only one context, and
    // React (StrictMode, or a remount) may hand the same canvas to a new renderer.
  }

  #tick = (now: number): void => {
    if (!this.#running) return
    this.#frame = requestAnimationFrame(this.#tick)
    const elapsed = now - this.#lastFrame
    if (elapsed < MIN_FRAME_MS) return
    this.#lastFrame = now
    // Clamp so a long pause (tab hidden, scrolled away) does not jump the sea.
    const dt = Math.min(elapsed, 100) / 1000
    this.#clock += dt

    const ease = 1 - Math.exp(-dt * 6)
    this.#hoverStrength += (this.#hoverTarget - this.#hoverStrength) * ease
    this.#sway += (this.#swayTarget - this.#sway) * (1 - Math.exp(-dt * 2.5))

    if (this.#fadeStart >= 0) {
      const t = (now - this.#fadeStart) / THEME_FADE_MS
      this.#palette = mixPalettes(this.#fadeFrom, this.#fadeTo, easeInOut(t))
      if (t >= 1) this.#fadeStart = -1
    }
    this.#draw()
  }

  #draw(): void {
    const gl = this.#gl
    const u = this.#uniforms
    const p = this.#palette
    gl.uniform2f(u.uResolution, this.#canvas.width, this.#canvas.height)
    gl.uniform1f(u.uTime, this.#clock)
    gl.uniform1f(u.uSway, this.#sway)
    gl.uniform2f(u.uHover, this.#hover.x, this.#hover.z)
    gl.uniform1f(u.uHoverStrength, this.#hoverStrength)
    gl.uniform3fv(u.uRipples, this.#ripples.data)
    gl.uniform3fv(u.uSkyTop, p.skyTop)
    gl.uniform3fv(u.uSkyHorizon, p.skyHorizon)
    gl.uniform3fv(u.uWaterDeep, p.waterDeep)
    gl.uniform3fv(u.uWaterShallow, p.waterShallow)
    gl.uniform3fv(u.uLightColor, p.lightColor)
    gl.uniform3fv(u.uLightDir, p.lightDir)
    gl.uniform1f(u.uLightDisc, p.lightDisc)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
