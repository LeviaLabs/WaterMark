import { useId, useState, type CSSProperties } from 'react'
import type { EvidenceKind } from '../../scripting/content/dataSources'
import { buildAreaRequest, type AreaSummaryData, type EnvironmentalResult } from '../../scripting/evidence/contract'
import { radiusToSlider, sliderToRadius } from '../../scripting/evidence/area'
import { formatDistance } from '../../scripting/evidence/format'
import { EvidenceTag } from '../common/EvidenceTag'
import { EvidencePanel } from './EvidencePanel'

type Props = {
  result: EnvironmentalResult<AreaSummaryData>
  isExample?: boolean
  timeZone?: string
  /** Called with the validated POST /area-summary body whenever the radius changes. */
  onRequest?: (body: ReturnType<typeof buildAreaRequest>) => void
}

/**
 * Circle-area summary: a radius control that builds the exact request body
 * the data API accepts (100 m to 10 km), and the metrics that come back.
 * Unknown counts read "Unknown"; cached counts are marked as lower bounds.
 */
export function AreaSummary({ result, isExample, timeZone, onRequest }: Props) {
  const id = useId()
  const [radius, setRadius] = useState(result.data?.radiusMeters ?? 800)
  const request = buildAreaRequest(result.data?.center ?? result.location, radius)
  const resultRadius = result.data?.radiusMeters ?? null
  const showingOtherRadius = resultRadius !== null && resultRadius !== request.radiusMeters
  const circleScale = 0.25 + (radiusToSlider(radius) / 1000) * 0.75

  return (
    <EvidencePanel
      title="Circle an area"
      kind="observed"
      result={result}
      times={['fetchedAt']}
      isExample={isExample}
      timeZone={timeZone}
      className="area"
    >
      {(area) => (
        <>
          <div className="area-map" aria-hidden="true">
            <svg viewBox="0 0 300 160" focusable="false">
              <g className="area-streets">
                {[30, 80, 130, 180, 230, 280].map((x) => (
                  <path key={`v${x}`} d={`M${x} 0V160`} />
                ))}
                {[25, 65, 105, 145].map((y) => (
                  <path key={`h${y}`} d={`M0 ${y}H300`} />
                ))}
              </g>
              <g className="area-circle" style={{ '--r': circleScale.toFixed(3) } as CSSProperties}>
                <circle cx="150" cy="80" r="70" pathLength={1} />
              </g>
              <circle className="area-center" cx="150" cy="80" r="4" />
              {[
                [118, 62],
                [176, 94],
                [140, 112],
                [196, 58],
              ].map(([cx, cy], index) => (
                <circle
                  key={index}
                  className="area-sensor"
                  cx={cx}
                  cy={cy}
                  r="4"
                  style={{ '--i': index } as CSSProperties}
                />
              ))}
            </svg>
          </div>

          <label className="area-radius" htmlFor={`${id}-radius`}>
            <span>Radius</span>
            <strong>{formatDistance(request.radiusMeters)}</strong>
          </label>
          <input
            id={`${id}-radius`}
            className="range"
            type="range"
            min={0}
            max={1000}
            value={radiusToSlider(radius)}
            aria-valuetext={formatDistance(request.radiusMeters)}
            onChange={(event) => {
              const next = sliderToRadius(Number(event.target.value))
              setRadius(next)
              onRequest?.(buildAreaRequest(area.center, next))
            }}
          />

          <table className="area-metrics">
            <caption className="area-caption">
              {showingOtherRadius
                ? `Results below are for ${formatDistance(resultRadius)}. Run the new circle on the map.`
                : `Inside ${formatDistance(request.radiusMeters)}`}
            </caption>
            <tbody>
              {area.metrics.map((metric, index) => (
                <tr key={metric.id} style={{ '--i': index } as CSSProperties}>
                  <th scope="row">
                    {metric.label}
                    <small>{metric.note}</small>
                  </th>
                  <td>
                    <strong className={metric.value === null ? 'is-unknown' : ''}>
                      {metric.value === null ? 'Unknown' : `${metric.isLowerBound ? '≥ ' : ''}${metric.value}`}
                    </strong>
                    <EvidenceTag kind={metric.kind as EvidenceKind} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <details className="area-request">
            <summary>Request sent to the data API</summary>
            <pre>
              <code>{`POST /area-summary\n${JSON.stringify(request, null, 2)}`}</code>
            </pre>
          </details>
        </>
      )}
    </EvidencePanel>
  )
}
