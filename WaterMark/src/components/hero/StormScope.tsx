import { useEffect, useMemo, useRef, useState, type AnimationEvent, type CSSProperties, type PointerEvent } from 'react'
import { useInView } from '../../hooks/useInView'
import { EVIDENCE_LABELS, EVIDENCE_RULES, type EvidenceKind } from '../../scripting/content/dataSources'
import {
  BLIPS,
  ECHO_BANDS,
  SWEEP_SECONDS,
  TAP_INTENSITY,
  bearingOf,
  echoShape,
  heldIntensity,
  polar,
  scopeFor,
  sweepDelay,
} from '../../scripting/radar/scope'

type Cell = { id: number; x: number; y: number; seed: number; intensity: number; growing: boolean }

/** At most this many of your cells on screen; the oldest gives way. */
const MAX_CELLS = 14

/** A storm line that drifts across the scope on its own, so it is alive before anyone touches it. */
const STORM_LINE = [
  { seed: 11, intensity: 0.55, top: 0.26, duration: 64, delay: -6 },
  { seed: 23, intensity: 0.92, top: 0.42, duration: 58, delay: -20 },
  { seed: 37, intensity: 0.4, top: 0.6, duration: 72, delay: -40 },
  { seed: 51, intensity: 0.72, top: 0.34, duration: 66, delay: -48 },
]

const TICKS = Array.from({ length: 36 }, (_, index) => index * 10)
const COMPASS = [
  { label: 'N', bearing: 0 },
  { label: 'E', bearing: 90 },
  { label: 'S', bearing: 180 },
  { label: 'W', bearing: 270 },
]

const IS = Object.fromEntries(EVIDENCE_RULES.map((rule) => [rule.kind, rule.is])) as Record<EvidenceKind, string>

function Echo({ seed, intensity, growing, className = '', style, onAnimationEnd }: {
  seed: number
  intensity: number
  growing?: boolean
  className?: string
  style?: CSSProperties
  onAnimationEnd?: (event: AnimationEvent<HTMLSpanElement>) => void
}) {
  const shape = useMemo(() => echoShape(seed), [seed])
  return (
    <span
      className={`storm-echo ${growing ? 'is-growing' : ''} ${className}`}
      style={{ ...style, '--i': growing ? 'var(--hold)' : intensity } as CSSProperties}
      onAnimationEnd={onAnimationEnd}
    >
      <span className="storm-echo-bloom">
        <svg viewBox="-100 -100 200 200">
          {ECHO_BANDS.map((band) => (
            <path key={band.id} className={`storm-echo-${band.id}`} d={shape[band.id]} />
          ))}
        </svg>
      </span>
    </span>
  )
}

/**
 * Hero background: a storm scope over a field of dots. The sweep turns once
 * every few seconds and each kind of evidence blips as it passes (hover or
 * tap a blip to read what it is). The pointer lights the dots under it and
 * reads out its bearing and range. A tap drops a light rain cell; holding
 * builds it from light rain to extreme, and on release it drifts off with the
 * wind like a real echo. A storm line drifts through on its own. All of it is
 * an illustration, not live radar.
 */
export function StormScope() {
  const rootRef = useRef<HTMLDivElement>(null)
  const readoutRef = useRef<HTMLSpanElement>(null)
  const press = useRef<{ id: number; start: number; frame: number } | null>(null)
  const nextId = useRef(1)
  const visible = useInView(rootRef, { rootMargin: '80px' })
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [cells, setCells] = useState<Cell[]>([])
  const [openBlip, setOpenBlip] = useState<EvidenceKind | null>(null)

  const scope = scopeFor(size.width, size.height)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width: Math.round(width), height: Math.round(height) })
    })
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  // The pointer lights the dots and reads out bearing and range, even over the headline.
  useEffect(() => {
    const root = rootRef.current
    const hero = root?.parentElement
    if (!root || !hero || !visible) return
    let frame = 0
    let x = 0
    let y = 0
    const draw = () => {
      frame = 0
      root.style.setProperty('--mx', `${x.toFixed(0)}px`)
      root.style.setProperty('--my', `${y.toFixed(0)}px`)
      const { cx, cy, radius } = scopeFor(root.clientWidth, root.clientHeight)
      const range = Math.hypot(x - cx, y - cy) / radius
      const readout = readoutRef.current
      if (readout) {
        readout.textContent =
          range <= 1
            ? `BRG ${String(Math.round(bearingOf(x - cx, y - cy)) % 360).padStart(3, '0')}° · RNG ${Math.round(range * 100)}%`
            : 'Outside range'
      }
    }
    const onMove = (event: globalThis.PointerEvent) => {
      const rect = root.getBoundingClientRect()
      x = event.clientX - rect.left
      y = event.clientY - rect.top
      root.dataset.pointer = 'on'
      if (!frame) frame = requestAnimationFrame(draw)
    }
    const onLeave = () => {
      delete root.dataset.pointer
    }
    hero.addEventListener('pointermove', onMove, { passive: true })
    hero.addEventListener('pointerleave', onLeave)
    return () => {
      hero.removeEventListener('pointermove', onMove)
      hero.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(frame)
    }
  }, [visible])

  useEffect(
    () => () => {
      if (press.current) cancelAnimationFrame(press.current.frame)
    },
    [],
  )

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current
    if (!root || event.button !== 0 || press.current) return
    if (event.target instanceof Element && event.target.closest('.storm-blip')) return
    setOpenBlip(null)
    const rect = root.getBoundingClientRect()
    const id = nextId.current++
    const cell: Cell = {
      id,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      seed: id * 97 + 13,
      intensity: TAP_INTENSITY,
      growing: true,
    }
    setCells((current) => [...current.slice(-(MAX_CELLS - 1)), cell])
    root.style.setProperty('--hold', String(TAP_INTENSITY))
    const start = performance.now()
    const grow = (now: number) => {
      root.style.setProperty('--hold', heldIntensity((now - start) / 1000).toFixed(3))
      if (press.current) press.current.frame = requestAnimationFrame(grow)
    }
    press.current = { id, start, frame: requestAnimationFrame(grow) }
    try {
      root.setPointerCapture(event.pointerId)
    } catch {
      // Capture is a nicety; the release still arrives without it.
    }
  }

  const release = () => {
    const held = press.current
    if (!held) return
    cancelAnimationFrame(held.frame)
    press.current = null
    const intensity = heldIntensity((performance.now() - held.start) / 1000)
    setCells((current) => current.map((cell) => (cell.id === held.id ? { ...cell, intensity, growing: false } : cell)))
  }

  const onDrifted = (id: number) => (event: AnimationEvent<HTMLSpanElement>) => {
    if (event.animationName === 'echo-drift') setCells((current) => current.filter((cell) => cell.id !== id))
  }

  // The storm line only shows inside the scope's range, like a real radar picture.
  const stormLine = (layer: 'glow' | 'dots') => (
    <div className={`storm-echoes storm-echoes--range storm-echoes--${layer}`} aria-hidden="true">
      {STORM_LINE.map((echo) => (
        <Echo
          key={echo.seed}
          seed={echo.seed}
          intensity={echo.intensity}
          className="storm-echo--line"
          style={{ '--top': `${echo.top * 100}%`, '--pass': `${echo.duration}s`, '--start': `${echo.delay}s` } as CSSProperties}
        />
      ))}
    </div>
  )

  const echoes = (layer: 'glow' | 'dots') => (
    <div className={`storm-echoes storm-echoes--${layer}`} aria-hidden="true">
      {cells.map((cell) => (
        <Echo
          key={cell.id}
          seed={cell.seed}
          intensity={cell.intensity}
          growing={cell.growing}
          style={{ left: cell.x, top: cell.y }}
          onAnimationEnd={layer === 'dots' ? onDrifted(cell.id) : undefined}
        />
      ))}
    </div>
  )

  return (
    <div
      ref={rootRef}
      className={`storm ${visible ? '' : 'storm--paused'}`}
      onPointerDown={onPointerDown}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      style={{ '--sweep': `${SWEEP_SECONDS}s` } as CSSProperties}
    >
      <span className="storm-field" aria-hidden="true" />
      <span className="storm-field storm-field--lit" aria-hidden="true" />

      {echoes('glow')}
      {echoes('dots')}

      {size.width > 0 && (
        <div
          className="storm-scope"
          style={{ left: scope.cx - scope.radius, top: scope.cy - scope.radius, width: scope.radius * 2, height: scope.radius * 2 }}
        >
          {stormLine('glow')}
          {stormLine('dots')}
          <svg className="storm-dial" viewBox="-100 -100 200 200" aria-hidden="true">
            {[33, 66, 99].map((r) => (
              <circle key={r} className="storm-ring" r={r} pathLength={1} />
            ))}
            <path className="storm-cross" d="M-99 0H99M0 -99V99" />
            {TICKS.map((bearing) => {
              const major = bearing % 30 === 0
              const inner = polar(bearing, major ? 91 : 95)
              const outer = polar(bearing, 99)
              return (
                <line
                  key={bearing}
                  className={major ? 'storm-tick storm-tick--major' : 'storm-tick'}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                />
              )
            })}
            {COMPASS.map(({ label, bearing }) => {
              const at = polar(bearing, 108)
              return (
                <text key={label} className="storm-compass" x={at.x} y={at.y}>
                  {label}
                </text>
              )
            })}
          </svg>
          <span className="storm-sweep" aria-hidden="true" />

          <ul className="storm-blips" aria-label="Kinds of evidence WaterMark keeps apart">
            {BLIPS.map((blip, index) => {
              const at = polar(blip.bearing, blip.range)
              const open = openBlip === blip.kind
              return (
                <li
                  key={blip.kind}
                  className={`storm-blip-slot ${at.x > 0.2 ? 'storm-blip-slot--east' : ''}`}
                  style={
                    {
                      left: `${50 + at.x * 50}%`,
                      top: `${50 + at.y * 50}%`,
                      '--kind': `var(--kind-${blip.kind})`,
                      '--blip': `${sweepDelay(blip.bearing).toFixed(2)}s`,
                      '--n': index,
                    } as CSSProperties
                  }
                >
                  <button
                    type="button"
                    className={`storm-blip ${open ? 'is-open' : ''}`}
                    aria-expanded={open}
                    onClick={() => setOpenBlip(open ? null : blip.kind)}
                  >
                    <span className="storm-blip-dot" aria-hidden="true" />
                    <span className="storm-blip-tip">
                      <strong>{EVIDENCE_LABELS[blip.kind]}</strong>
                      <span>{IS[blip.kind]}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <aside className="storm-hud glass-panel" aria-label="Storm scope">
        <p className="storm-hud-title">
          <span className="storm-hud-live" aria-hidden="true" />
          Storm scope <span className="storm-hud-note">illustration, not live radar</span>
        </p>
        <span ref={readoutRef} className="storm-readout">
          BRG ---° · RNG --%
        </span>
        <span className="storm-legend" aria-label="Rain intensity, light to extreme">
          {ECHO_BANDS.map((band) => (
            <span key={band.id} className={`storm-legend-band storm-legend-band--${band.id}`}>
              {band.label}
            </span>
          ))}
        </span>
        <span className="storm-hint">
          <span className="storm-hint-fine">Click to drop rain · hold to build a storm</span>
          <span className="storm-hint-coarse">Tap for rain · hold for a storm</span>
        </span>
      </aside>
    </div>
  )
}
