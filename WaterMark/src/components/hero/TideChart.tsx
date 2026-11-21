import { useId, useRef, type CSSProperties } from 'react'
import { useInView } from '../../hooks/useInView'
import { CHART, ISLANDS, LAND_LEVELS, islandContours, pointOn } from '../../scripting/tide/contours'

/** Geometry is fixed, so it is built once when the module loads. */
const ISLAND_CONTOURS = ISLANDS.map((island) => ({ island, contours: islandContours(island) }))

/** Rain rings on open water: position and start offset in seconds. */
const RIPPLES = [
  { x: 230, y: 310, delay: 0 },
  { x: 440, y: 610, delay: 1.7 },
  { x: 770, y: 160, delay: 3.2 },
  { x: 290, y: 900, delay: 0.9 },
  { x: 1540, y: 900, delay: 2.5 },
  { x: 900, y: 960, delay: 4.1 },
  { x: 640, y: 380, delay: 5.3 },
]

const [MAIN] = ISLANDS

/** Survey pins: the kinds of instruments WaterMark reads, placed on the island. No values, just names. */
const PINS = [
  { label: 'Tide gauge', ...pointOn(MAIN, 0, Math.PI * 0.72), delay: 0 },
  { label: 'Street sensor', ...pointOn(MAIN, 2, Math.PI * 0.32), delay: 0.8 },
  { label: 'Rain gauge', ...pointOn(MAIN, 5, -Math.PI * 0.4), delay: 1.6 },
]

const levelStyle = (level: number) =>
  ({ '--k': level, '--mix': `${Math.round((Math.max(level, 0) / (LAND_LEVELS - 1)) * 100)}%` }) as CSSProperties

/**
 * The hero's living tide chart: a made-up island drawn like a nautical
 * topographic map. On its own, the tide slowly rises and falls, drowning the
 * low contour bands one by one; the shoreline glows where the water meets
 * the land, rain rings spread on open water and survey pins pulse.
 *
 * The tide is one registered CSS number (--tide) animated in CSS; each band
 * reads it to set its own opacity. No script runs per frame, nothing needs a
 * click, and everything pauses off screen or holds still under reduced motion.
 */
export function TideChart() {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInView(ref, { rootMargin: '80px' })
  const gridId = `${useId()}-grid`

  return (
    <div ref={ref} className={`tide-chart ${visible ? '' : 'tide-chart--paused'}`} aria-hidden="true">
      <svg className="tide-map" viewBox={`0 0 ${CHART.width} ${CHART.height}`} preserveAspectRatio="xMaxYMid slice">
        <defs>
          <pattern id={gridId} width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M80 0H0V80" className="tide-grid-line" />
          </pattern>
        </defs>

        <rect className="tide-sea" width={CHART.width} height={CHART.height} />
        <rect className="tide-grid" width={CHART.width} height={CHART.height} fill={`url(#${gridId})`} />

        <g className="tide-ripples">
          {RIPPLES.map((ripple) => (
            <circle
              key={`${ripple.x}-${ripple.y}`}
              className="tide-ripple"
              cx={ripple.x}
              cy={ripple.y}
              r="34"
              style={{ '--delay': `${ripple.delay}s` } as CSSProperties}
            />
          ))}
        </g>

        {ISLAND_CONTOURS.map(({ island, contours }) => (
          <g key={island.id} className="tide-island">
            {contours.map((contour) =>
              contour.level < 0 ? (
                <path key={contour.level} className="tide-depth" d={contour.d} style={levelStyle(contour.level)} />
              ) : (
                <g key={contour.level} style={levelStyle(contour.level)}>
                  <path className="tide-land" d={contour.d} />
                  <path className="tide-flood" d={contour.d} />
                </g>
              ),
            )}
          </g>
        ))}

        <g className="tide-lines">
          {ISLAND_CONTOURS.flatMap(({ island, contours }) =>
            contours
              .filter((contour) => contour.level >= 0)
              .map((contour) => (
                <path key={`${island.id}-${contour.level}`} className="tide-line" d={contour.d} style={levelStyle(contour.level)} />
              )),
          )}
        </g>

        {PINS.map((pin) => {
          const width = pin.label.length * 11 + 34
          return (
            <g
              key={pin.label}
              className="tide-pin"
              transform={`translate(${pin.x.toFixed(1)} ${pin.y.toFixed(1)})`}
              style={{ '--delay': `${pin.delay}s` } as CSSProperties}
            >
              <circle className="tide-pin-pulse" r="16" />
              <circle className="tide-pin-dot" r="7" />
              <path className="tide-pin-stem" d="M0 -9V-46" />
              <g className="tide-pin-label">
                <rect x={-width / 2} y="-82" width={width} height="36" rx="18" />
                <text y="-58" textAnchor="middle">
                  {pin.label}
                </text>
              </g>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
