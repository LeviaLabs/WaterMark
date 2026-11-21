import { chooseWaterQuality, type WaterQuality } from './waterQuality.ts'

const VERT = `#version 300 es
void main() {
  vec2 pos = vec2(-1.0, -1.0);
  if (gl_VertexID == 1) pos = vec2(3.0, -1.0);
  if (gl_VertexID == 2) pos = vec2(-1.0, 3.0);
  gl_Position = vec4(pos, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision mediump float;
out vec4 fragColor;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform float uActive;
uniform float uScroll;
uniform float uLight;
uniform float uDetail;

float heightAt(vec2 p, vec2 pointer) {
  float t = uTime;
  float h = sin(p.x * 1.7 + t * 0.55) * 0.55;
  h += sin(p.y * 1.35 - t * 0.42 + p.x * 0.4) * 0.38;
  h += sin(dot(p, vec2(1.1, 0.7)) * 2.4 + t * 0.7) * 0.18;
  if (uDetail > 0.55) {
    h += sin(p.x * 4.2 - p.y * 3.1 + t) * 0.06;
  }
  float dist = length(p - pointer);
  h += sin(dist * 11.0 - t * 2.4) * exp(-dist * 3.6) * 0.26 * uActive;
  h += uScroll * sin(p.x * 1.6 + t * 0.3) * 0.1;
  return h;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float scale = min(uResolution.y, 900.0);
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / scale;
  vec2 pointer = (uPointer * uResolution - 0.5 * uResolution) / scale;
  p.x += uScroll * 0.08;

  float h = heightAt(p, pointer);
  float e = 0.012;
  float hx = heightAt(p + vec2(e, 0.0), pointer) - h;
  float hy = heightAt(p + vec2(0.0, e), pointer) - h;
  vec3 normal = normalize(vec3(-hx, -hy, 0.085));

  vec3 lightDir = normalize(vec3(-0.35, 0.55, 0.78));
  float diff = clamp(dot(normal, lightDir), 0.0, 1.0);
  float spec = pow(clamp(dot(reflect(-lightDir, normal), vec3(0.0, 0.15, 1.0)), 0.0, 1.0), 36.0);
  float fres = pow(1.0 - clamp(normal.z, 0.0, 1.0), 2.4);
  float crest = smoothstep(0.18, 0.72, h);

  vec3 deep = mix(vec3(0.015, 0.07, 0.11), vec3(0.04, 0.32, 0.40), uLight);
  vec3 mid = mix(vec3(0.04, 0.20, 0.28), vec3(0.12, 0.55, 0.56), uLight);
  vec3 foam = mix(vec3(0.45, 0.78, 0.76), vec3(0.90, 0.97, 0.95), uLight);
  vec3 glint = mix(vec3(0.55, 0.86, 0.84), vec3(1.0, 1.0, 0.98), uLight);

  vec3 col = mix(deep, mid, smoothstep(-0.35, 0.65, h));
  col += diff * mix(vec3(0.02, 0.08, 0.09), vec3(0.1, 0.16, 0.12), uLight);
  float waveLine = smoothstep(0.55, 1.0, sin(p.x * 2.2 + h * 2.4 + uTime * 0.5));
  col = mix(col, foam, crest * 0.34 + fres * 0.2 + waveLine * 0.22);
  col += spec * glint * (0.4 + 0.35 * uLight);

  float vignette = smoothstep(1.2, 0.2, length(uv - vec2(0.62, 0.48)));
  col *= mix(0.82, 1.0, vignette);

  float skyMix = smoothstep(0.62, 1.0, uv.y);
  vec3 sky = mix(vec3(0.02, 0.07, 0.1), vec3(0.78, 0.9, 0.88), uLight);
  col = mix(col, sky, skyMix * 0.72);

  fragColor = vec4(col, 1.0);
}`

type NetworkInformation = { saveData?: boolean }

export type WaterScene = {
  destroy: () => void
  setVisible: (visible: boolean) => void
}

function readQuality(): WaterQuality {
  const nav = navigator as Navigator & { connection?: NetworkInformation }
  return chooseWaterQuality({
    devicePixelRatio: window.devicePixelRatio || 1,
    viewportWidth: window.innerWidth,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    saveData: nav.connection?.saveData === true,
  })
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
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
 * Full-screen WebGL2 water. The loop pauses when the canvas is offscreen
 * or the tab is hidden, and it draws a single frame when motion is reduced.
 * Returns null when WebGL2 or the shaders are unavailable.
 */
export function mountWaterScene(
  canvas: HTMLCanvasElement,
  options: { light: number; reducedMotion: boolean; eventTarget?: HTMLElement },
): WaterScene | null {
  const quality = readQuality()
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: quality.detail < 0.7 ? 'low-power' : 'default',
  })
  if (!gl) return null

  const vert = compile(gl, gl.VERTEX_SHADER, VERT)
  const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG)
  if (!vert || !frag) return null

  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vert)
  gl.attachShader(program, frag)
  gl.linkProgram(program)
  gl.deleteShader(vert)
  gl.deleteShader(frag)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    return null
  }

  const uResolution = gl.getUniformLocation(program, 'uResolution')
  const uTime = gl.getUniformLocation(program, 'uTime')
  const uPointer = gl.getUniformLocation(program, 'uPointer')
  const uActive = gl.getUniformLocation(program, 'uActive')
  const uScroll = gl.getUniformLocation(program, 'uScroll')
  const uLight = gl.getUniformLocation(program, 'uLight')
  const uDetail = gl.getUniformLocation(program, 'uDetail')

  const pointer = { x: 0, y: 0.2, active: 0 }
  const scroll = { value: 0 }
  let visible = true
  let frame = 0
  let running = false
  let staticDrawn = false
  const started = performance.now()

  const resize = () => {
    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    if (cssW < 2 || cssH < 2) return
    let width = Math.round(cssW * quality.pixelRatio)
    let height = Math.round(cssH * quality.pixelRatio)
    const longest = Math.max(width, height)
    if (longest > 1920) {
      const scale = 1920 / longest
      width = Math.max(1, Math.round(width * scale))
      height = Math.max(1, Math.round(height * scale))
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
  }

  const draw = (timeSeconds: number) => {
    resize()
    if (canvas.width < 2 || canvas.height < 2) return
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.useProgram(program)
    gl.uniform2f(uResolution, canvas.width, canvas.height)
    gl.uniform1f(uTime, timeSeconds)
    gl.uniform2f(uPointer, pointer.x, pointer.y)
    gl.uniform1f(uActive, options.reducedMotion ? 0 : pointer.active)
    gl.uniform1f(uScroll, options.reducedMotion ? 0 : scroll.value)
    gl.uniform1f(uLight, options.light)
    gl.uniform1f(uDetail, quality.detail)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  const stop = () => {
    running = false
    if (frame !== 0) cancelAnimationFrame(frame)
    frame = 0
  }

  const tick = (now: number) => {
    frame = 0
    if (!running) return
    if (document.hidden || !visible) {
      running = false
      return
    }
    if (options.reducedMotion) {
      if (!staticDrawn) {
        draw(0)
        staticDrawn = canvas.width >= 2
      }
      running = false
      return
    }
    draw((now - started) / 1000)
    frame = requestAnimationFrame(tick)
  }

  const start = () => {
    if (running || document.hidden || !visible) return
    running = true
    frame = requestAnimationFrame(tick)
  }

  const onPointer = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    pointer.x = (event.clientX - rect.left) / rect.width
    pointer.y = (rect.bottom - event.clientY) / rect.height
    pointer.active = 1
  }

  const onScroll = () => {
    const rect = canvas.getBoundingClientRect()
    const height = rect.height || 1
    scroll.value = Math.max(0, Math.min(1, -rect.top / height))
  }

  const onVisibility = () => {
    if (document.hidden) stop()
    else start()
  }

  const onLost = (event: Event) => {
    event.preventDefault()
    stop()
    canvas.dispatchEvent(new Event('watermark-water-lost'))
  }

  const eventTarget = options.eventTarget ?? canvas
  eventTarget.addEventListener('pointermove', onPointer, { passive: true })
  eventTarget.addEventListener('pointerdown', onPointer, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  canvas.addEventListener('webglcontextlost', onLost)

  const resizeObserver = new ResizeObserver(() => {
    if (!options.reducedMotion) return
    draw(0)
  })
  resizeObserver.observe(canvas)

  const observer = new IntersectionObserver(
    (entries) => {
      visible = entries.some((entry) => entry.isIntersecting)
      if (visible) start()
      else stop()
    },
    { threshold: 0.01 },
  )
  observer.observe(canvas)
  onScroll()
  start()

  return {
    setVisible: (next) => {
      visible = next
      if (next) start()
      else stop()
    },
    destroy: () => {
      stop()
      observer.disconnect()
      resizeObserver.disconnect()
      eventTarget.removeEventListener('pointermove', onPointer)
      eventTarget.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('webglcontextlost', onLost)
      gl.deleteProgram(program)
    },
  }
}
