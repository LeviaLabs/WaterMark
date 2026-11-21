import { chooseGridSize, chooseWaterQuality } from './waterQuality.ts'

const RIPPLES = 6

const SKY = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 uResolution;
uniform float uLight;
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec3 zenith = mix(vec3(0.015, 0.03, 0.07), vec3(0.36, 0.68, 0.86), uLight);
  vec3 horizon = mix(vec3(0.07, 0.14, 0.26), vec3(0.73, 0.9, 0.93), uLight);
  float h = smoothstep(0.0, 1.0, uv.y);
  vec3 col = mix(horizon, zenith, pow(h, 0.85));
  vec2 orb = vec2(0.74, mix(0.58, 0.74, uLight));
  float d = length((uv - orb) * vec2(uResolution.x / uResolution.y, 1.0));
  vec3 glow = mix(vec3(0.72, 0.84, 1.0), vec3(1.0, 0.93, 0.62), uLight);
  col += glow * exp(-d * 22.0);
  col += glow * exp(-d * 5.5) * 0.55;
  fragColor = vec4(col, 1.0);
}`

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aUV;
uniform mat4 uVP;
uniform float uTime;
uniform float uTide;
uniform vec4 uRipple[6];
out vec3 vWorld;
out vec3 vNormal;

const float PI = 3.14159265;

void wave(inout vec3 p, inout vec3 n, vec2 dir, float amp, float len, float speed, float steep) {
  float k = 2.0 * PI / len;
  float phase = k * dot(dir, p.xz) + uTime * speed;
  float s = sin(phase);
  float c = cos(phase);
  p.x += steep * amp * dir.x * c;
  p.z += steep * amp * dir.y * c;
  p.y += amp * s;
  n.x -= dir.x * k * amp * c;
  n.z -= dir.y * k * amp * c;
  n.y -= steep * k * amp * s;
}

void main() {
  vec2 xz = vec2((aUV.x - 0.5) * 78.0, mix(16.0, -86.0, aUV.y));
  vec3 p = vec3(xz.x, 0.0, xz.y);
  vec3 n = vec3(0.0, 1.0, 0.0);
  wave(p, n, normalize(vec2(1.0, 0.18)), 0.78, 26.0, 1.15, 0.48);
  wave(p, n, normalize(vec2(0.25, 1.0)), 0.46, 14.0, 1.55, 0.42);
  wave(p, n, normalize(vec2(-0.72, 0.55)), 0.28, 8.0, 1.9, 0.36);
  wave(p, n, normalize(vec2(0.85, -0.35)), 0.12, 4.2, 2.4, 0.3);
  for (int i = 0; i < 6; i++) {
    float amp = uRipple[i].w;
    if (amp < 0.001) continue;
    vec2 center = uRipple[i].xy;
    float age = uRipple[i].z;
    vec2 delta = p.xz - center;
    float dist = length(delta);
    vec2 rd = dist > 0.0001 ? delta / dist : vec2(0.0);
    float atten = exp(-dist * 0.07) * exp(-age * 0.4);
    float phase = dist * 2.4 - age * 7.5;
    float h = sin(phase) * amp * atten;
    float slope = cos(phase) * 2.4 * amp * atten;
    p.y += h;
    n.x -= rd.x * slope;
    n.z -= rd.y * slope;
  }
  p.y += uTide;
  vWorld = p;
  vNormal = n;
  gl_Position = uVP * vec4(p, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
out vec4 fragColor;
uniform vec3 uEye;
uniform float uLight;
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uEye - vWorld);
  vec3 L = normalize(mix(vec3(-0.55, 0.62, 0.28), vec3(0.62, 0.78, 0.22), uLight));
  float ndotl = max(dot(N, L), 0.0);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.4);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), mix(36.0, 90.0, uLight));
  vec3 deep = mix(vec3(0.01, 0.045, 0.1), vec3(0.015, 0.18, 0.36), uLight);
  vec3 shallow = mix(vec3(0.04, 0.22, 0.34), vec3(0.05, 0.62, 0.7), uLight);
  float facing = clamp(vWorld.y * 0.55 + 0.35, 0.0, 1.0);
  vec3 water = mix(deep, shallow, facing);
  vec3 sky = mix(vec3(0.12, 0.22, 0.38), vec3(0.62, 0.84, 0.92), uLight);
  vec3 col = mix(water, sky, fres * 0.72);
  col += ndotl * mix(vec3(0.03, 0.08, 0.12), vec3(0.12, 0.18, 0.1), uLight);
  vec3 glint = mix(vec3(0.78, 0.88, 1.0), vec3(1.0, 0.95, 0.72), uLight);
  col += spec * glint * (1.15 + fres);
  float crest = smoothstep(0.28, 0.95, vWorld.y);
  float sharp = smoothstep(0.18, 0.72, 1.0 - N.y);
  vec3 foam = mix(vec3(0.68, 0.84, 0.9), vec3(0.96, 0.99, 0.98), uLight);
  col = mix(col, foam, clamp(crest * 0.55 + sharp * 0.85, 0.0, 1.0) * 0.8);
  float dist = distance(vWorld.xz, uEye.xz);
  float fog = smoothstep(22.0, 78.0, dist);
  vec3 horizon = mix(vec3(0.06, 0.13, 0.24), vec3(0.7, 0.88, 0.92), uLight);
  col = mix(col, horizon, fog);
  fragColor = vec4(col, 1.0);
}`

type NetworkInformation = { saveData?: boolean }
type Ripple = { x: number; z: number; born: number; amp: number }

export type WaterScene = { destroy: () => void }

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

function link(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram | null {
  const vert = compile(gl, gl.VERTEX_SHADER, vertSrc)
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragSrc)
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
  return program
}

function perspective(fovY: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovY / 2)
  const nf = 1 / (near - far)
  const out = new Float32Array(16)
  out[0] = f / aspect
  out[5] = f
  out[10] = (far + near) * nf
  out[11] = -1
  out[14] = 2 * far * near * nf
  return out
}

function lookAt(eye: number[], target: number[], up: number[]): Float32Array {
  const zx = eye[0] - target[0]
  const zy = eye[1] - target[1]
  const zz = eye[2] - target[2]
  const zl = Math.hypot(zx, zy, zz) || 1
  const z0 = zx / zl
  const z1 = zy / zl
  const z2 = zz / zl
  const cx = up[1] * z2 - up[2] * z1
  const cy = up[2] * z0 - up[0] * z2
  const cz = up[0] * z1 - up[1] * z0
  const cl = Math.hypot(cx, cy, cz) || 1
  const x0 = cx / cl
  const x1 = cy / cl
  const x2 = cz / cl
  const y0 = z1 * x2 - z2 * x1
  const y1 = z2 * x0 - z0 * x2
  const y2 = z0 * x1 - z1 * x0
  const out = new Float32Array(16)
  out[0] = x0
  out[1] = y0
  out[2] = z0
  out[4] = x1
  out[5] = y1
  out[6] = z1
  out[8] = x2
  out[9] = y2
  out[10] = z2
  out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2])
  out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2])
  out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2])
  out[15] = 1
  return out
}

function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16)
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k]
      out[col * 4 + row] = sum
    }
  }
  return out
}

function buildGrid(cols: number, rows: number) {
  const positions = new Float32Array(cols * rows * 2)
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const i = (z * cols + x) * 2
      positions[i] = x / (cols - 1)
      positions[i + 1] = z / (rows - 1)
    }
  }
  const indices = new Uint32Array((cols - 1) * (rows - 1) * 6)
  let k = 0
  for (let z = 0; z < rows - 1; z++) {
    for (let x = 0; x < cols - 1; x++) {
      const a = z * cols + x
      indices[k++] = a
      indices[k++] = a + cols
      indices[k++] = a + 1
      indices[k++] = a + 1
      indices[k++] = a + cols
      indices[k++] = a + cols + 1
    }
  }
  return { positions, indices }
}

/**
 * Perspective ocean: a vertex grid displaced by Gerstner waves, with a sky
 * pass behind it. The loop stops when the canvas is offscreen or the tab is
 * hidden. Reduced motion draws the displaced surface once and holds it.
 */
export function mountWaterScene(
  canvas: HTMLCanvasElement,
  options: {
    getLight: () => number
    getReducedMotion: () => boolean
    eventTarget?: HTMLElement
  },
): WaterScene | null {
  const nav = navigator as Navigator & { connection?: NetworkInformation }
  const quality = chooseWaterQuality({
    devicePixelRatio: window.devicePixelRatio || 1,
    viewportWidth: window.innerWidth,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    saveData: nav.connection?.saveData === true,
  })
  const grid = chooseGridSize(quality.detail)
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: quality.detail >= 0.75,
    depth: true,
    stencil: false,
    powerPreference: quality.detail < 0.7 ? 'low-power' : 'high-performance',
  })
  if (!gl) return null

  const sky = link(gl, `#version 300 es
void main() {
  vec2 pos = vec2(-1.0, -1.0);
  if (gl_VertexID == 1) pos = vec2(3.0, -1.0);
  if (gl_VertexID == 2) pos = vec2(-1.0, 3.0);
  gl_Position = vec4(pos, 0.0, 1.0);
}`, SKY)
  const water = link(gl, VERT, FRAG)
  if (!sky || !water) return null

  const mesh = buildGrid(grid.cols, grid.rows)
  const posBuf = gl.createBuffer()
  const indexBuf = gl.createBuffer()
  const vao = gl.createVertexArray()
  if (!posBuf || !indexBuf || !vao) return null
  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
  gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW)
  gl.bindVertexArray(null)

  const skyRes = gl.getUniformLocation(sky, 'uResolution')
  const skyLight = gl.getUniformLocation(sky, 'uLight')
  const uVP = gl.getUniformLocation(water, 'uVP')
  const uTime = gl.getUniformLocation(water, 'uTime')
  const uTide = gl.getUniformLocation(water, 'uTide')
  const uEye = gl.getUniformLocation(water, 'uEye')
  const uLight = gl.getUniformLocation(water, 'uLight')
  const uRipple = gl.getUniformLocation(water, 'uRipple[0]')

  const ripples: Ripple[] = []
  let rippleSlot = 0
  const pointer = { nx: 0.72, ny: 0.42, active: 0 }
  const scroll = { value: 0 }
  let lastSpawnX = 999
  let lastSpawnZ = 999
  let lastSpawnT = 0
  let visible = true
  let frame = 0
  let running = false
  let staticDrawn = false
  const started = performance.now()
  const eventTarget = options.eventTarget ?? canvas

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

  const toWorld = (nx: number, ny: number) => ({
    x: (nx - 0.5) * 42,
    z: 14 - ny * 58,
  })

  const draw = (timeSeconds: number) => {
    resize()
    if (canvas.width < 2 || canvas.height < 2) return
    const light = options.getLight()
    const reduced = options.getReducedMotion()
    const tide = reduced ? 0.15 : scroll.value * 1.7
    const eye: number[] = [
      (pointer.nx - 0.5) * 2.4,
      2.15 - scroll.value * 0.25,
      9.5,
    ]
    const target: number[] = [(pointer.nx - 0.5) * 0.8, 0.15 + tide * 0.35, -24]
    const vp = multiply(perspective(Math.PI / 3.3, canvas.width / canvas.height, 0.15, 220), lookAt(eye, target, [0, 1, 0]))
    const now = timeSeconds
    const rippleData = new Float32Array(RIPPLES * 4)
    for (let i = 0; i < RIPPLES; i++) {
      const ripple = ripples[i]
      if (!ripple) continue
      const age = Math.max(0, now - ripple.born)
      const amp = reduced ? 0 : ripple.amp * Math.exp(-age * 0.85)
      rippleData[i * 4] = ripple.x
      rippleData[i * 4 + 1] = ripple.z
      rippleData[i * 4 + 2] = age
      rippleData[i * 4 + 3] = amp
    }

    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.disable(gl.DEPTH_TEST)
    gl.useProgram(sky)
    gl.uniform2f(skyRes, canvas.width, canvas.height)
    gl.uniform1f(skyLight, light)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    gl.enable(gl.DEPTH_TEST)
    gl.clear(gl.DEPTH_BUFFER_BIT)
    gl.useProgram(water)
    gl.uniformMatrix4fv(uVP, false, vp)
    gl.uniform1f(uTime, reduced ? 0.8 : timeSeconds)
    gl.uniform1f(uTide, tide)
    gl.uniform3f(uEye, eye[0], eye[1], eye[2])
    gl.uniform1f(uLight, light)
    gl.uniform4fv(uRipple, rippleData)
    gl.bindVertexArray(vao)
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_INT, 0)
    gl.bindVertexArray(null)
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
    const seconds = (now - started) / 1000
    if (options.getReducedMotion()) {
      if (!staticDrawn) {
        draw(seconds)
        staticDrawn = canvas.width >= 2
      }
      running = false
      return
    }
    draw(seconds)
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
    const nx = (event.clientX - rect.left) / rect.width
    const ny = (event.clientY - rect.top) / rect.height
    pointer.nx = nx
    pointer.ny = ny
    pointer.active = 1
    if (options.getReducedMotion()) return
    const world = toWorld(nx, ny)
    const now = (performance.now() - started) / 1000
    const moved = Math.hypot(world.x - lastSpawnX, world.z - lastSpawnZ)
    if (moved < 1.15 && now - lastSpawnT < 0.16) return
    const slot = rippleSlot % RIPPLES
    ripples[slot] = { x: world.x, z: world.z, born: now, amp: 1.65 }
    rippleSlot += 1
    lastSpawnX = world.x
    lastSpawnZ = world.z
    lastSpawnT = now
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

  eventTarget.addEventListener('pointermove', onPointer, { passive: true })
  eventTarget.addEventListener('pointerdown', onPointer, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  canvas.addEventListener('webglcontextlost', onLost)

  const resizeObserver = new ResizeObserver(() => {
    if (options.getReducedMotion()) draw(0.8)
  })
  resizeObserver.observe(canvas)

  const observer = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting)
    if (visible) start()
    else stop()
  })
  observer.observe(canvas)
  onScroll()
  start()

  return {
    destroy: () => {
      stop()
      observer.disconnect()
      resizeObserver.disconnect()
      eventTarget.removeEventListener('pointermove', onPointer)
      eventTarget.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('webglcontextlost', onLost)
      gl.deleteProgram(sky)
      gl.deleteProgram(water)
      gl.deleteBuffer(posBuf)
      gl.deleteBuffer(indexBuf)
      gl.deleteVertexArray(vao)
    },
  }
}
