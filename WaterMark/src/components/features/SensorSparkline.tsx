import { useState, type PointerEvent } from 'react'
import type { EnvironmentalResult, ObservationSeries } from '../../scripting/evidence/contract'
import { formatLocalTime, formatNumber } from '../../scripting/evidence/format'
import { scaleLinear } from '../../scripting/evidence/scale'
import { EvidencePanel } from './EvidencePanel'

const WIDTH = 320
const HEIGHT = 120
const PAD = { top: 12, right: 10, bottom: 14, left: 10 }

type Props = {
  result: EnvironmentalResult<ObservationSeries>
  isExample?: boolean
  timeZone?: string
}

/**
 * Recent readings from one station as a line with a hover crosshair. The
 * headline is the latest reading and its own observation time, which is kept
 * apart from when WaterMark fetched it. Gaps in the record break the line.
 */
export function SensorSparkline({ result, isExample, timeZone }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const units = result.units ?? ''

  return (
    <EvidencePanel
      title="Sensors & tides"
      kind="observed"
      result={result}
      times={['observedAt', 'fetchedAt']}
      isExample={isExample}
      timeZone={timeZone}
    >
      {(series) => {
        const known = series.points.filter((p) => p.value !== null)
        if (known.length === 0) {
          return <p className="evidence-empty">This station has no readings in the window. Unknown, not low.</p>
        }
        const values = known.map((p) => p.value as number)
        const domain = [Math.min(...values), Math.max(...values)] as const
        const x = (i: number) => scaleLinear(i, [0, series.points.length - 1], [PAD.left, WIDTH - PAD.right])
        const y = (v: number) => scaleLinear(v, domain, [HEIGHT - PAD.bottom, PAD.top])

        // Break the line wherever a reading is missing.
        let d = ''
        let pen = false
        series.points.forEach((point, i) => {
          if (point.value === null) {
            pen = false
            return
          }
          d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(point.value).toFixed(1)}`
          pen = true
        })

        const lastIndex = series.points.findLastIndex((p) => p.value !== null)
        const latest = series.points[lastIndex]
        const shown = hover !== null ? series.points[hover] : latest
        const shownIndex = hover ?? lastIndex

        const onMove = (event: PointerEvent<SVGSVGElement>) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const ratio = (event.clientX - rect.left) / rect.width
          const index = Math.round(ratio * (series.points.length - 1))
          setHover(Math.min(Math.max(index, 0), series.points.length - 1))
        }

        return (
          <>
            <p className="sensor-head">
              <span className="sensor-station">
                {series.stationName} · station {series.stationId}
              </span>
              <span className="sensor-value">
                <strong>{formatNumber(shown.value, units)}</strong>
                <small>
                  {series.metric}, {hover === null ? 'latest reading' : 'reading'} at {formatLocalTime(shown.observedAt, { timeZone })}
                </small>
              </span>
            </p>
            <svg
              className="sparkline"
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              role="img"
              aria-label={`${series.metric} at ${series.stationName}, ${known.length} readings. Latest ${formatNumber(latest.value, units)}.`}
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
            >
              <path className="sparkline-base" d={`M${PAD.left} ${HEIGHT - PAD.bottom}H${WIDTH - PAD.right}`} />
              <path className="sparkline-area" d={`${d}V${HEIGHT - PAD.bottom}H${PAD.left}Z`} />
              <path className="sparkline-line" d={d} pathLength={1} />
              {shown.value !== null && (
                <>
                  <path className="sparkline-cross" d={`M${x(shownIndex).toFixed(1)} ${PAD.top}V${HEIGHT - PAD.bottom}`} />
                  <circle className="sparkline-dot" cx={x(shownIndex)} cy={y(shown.value)} r={4.5} />
                </>
              )}
            </svg>
            <table className="visually-hidden">
              <caption>
                {series.metric} at {series.stationName} ({units})
              </caption>
              <tbody>
                {series.points.map((point) => (
                  <tr key={point.observedAt}>
                    <td>{formatLocalTime(point.observedAt, { timeZone })}</td>
                    <td>{formatNumber(point.value, units)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )
      }}
    </EvidencePanel>
  )
}
