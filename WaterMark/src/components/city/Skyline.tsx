import { memo, useId, type CSSProperties } from 'react'
import { beaconPoint, buildingPath } from '../../scripting/city/buildingPath'
import type { SkylineLayer } from '../../scripting/city/skyline'

type Props = {
  layer: SkylineLayer
  viewBox: string
  className?: string
  /** Show blinking aviation lights on antennas (night only, via CSS). */
  beacons?: boolean
}

/**
 * One depth layer of the city as a static SVG. Every window of the layer is
 * drawn by one <pattern>; only lit windows (visible at night) are separate
 * rectangles. Colors come from CSS so day and night restyle the same nodes.
 */
export const Skyline = memo(function Skyline({ layer, viewBox, className = '', beacons = false }: Props) {
  const id = useId()
  const patternId = `${id}-windows`
  const { cell, windowWidth, windowHeight } = layer
  const offset = (cell - windowWidth) / 2
  const offsetY = (cell - windowHeight) / 2

  return (
    <svg
      className={`city-skyline city-skyline--${layer.id} ${className}`}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id={patternId} width={cell} height={cell} patternUnits="userSpaceOnUse">
          <rect className="city-window" x={offset} y={offsetY} width={windowWidth} height={windowHeight} rx={1} />
        </pattern>
      </defs>

      <g className="city-buildings">
        {layer.buildings.map((building) => (
          <path key={building.x} d={buildingPath(building, cell)} />
        ))}
      </g>

      <g className="city-windows" fill={`url(#${patternId})`}>
        {layer.buildings.map((building) =>
          building.windows ? (
            <rect
              key={building.x}
              x={building.windows.x}
              y={building.windows.y}
              width={building.windows.width}
              height={building.windows.height}
            />
          ) : null,
        )}
      </g>

      <g className="city-lit">
        {layer.buildings.flatMap((building, b) =>
          building.lit.map((window, w) => (
            <rect
              key={`${building.x}-${window.x}-${window.y}`}
              className={`${(b + w) % 6 === 0 ? 'city-lit--cool' : ''} ${window.flicker ? 'city-lit--flicker' : ''}`}
              x={window.x}
              y={window.y}
              width={windowWidth}
              height={windowHeight}
              rx={1}
              style={window.flicker ? ({ '--delay': `${-((b * 7 + w * 3) % 23)}s` } as CSSProperties) : undefined}
            />
          )),
        )}
      </g>

      {beacons && (
        <g className="city-beacons">
          {layer.buildings.map((building, index) => {
            const point = beaconPoint(building, cell)
            return point ? (
              <circle
                key={building.x}
                cx={point.x}
                cy={point.y}
                r={Math.max(2, cell * 0.28)}
                style={{ '--delay': `${-(index % 5) * 0.7}s` } as CSSProperties}
              />
            ) : null
          })}
        </g>
      )}
    </svg>
  )
})
