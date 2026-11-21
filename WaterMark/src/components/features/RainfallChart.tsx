import type { CSSProperties } from 'react'
import type { EnvironmentalResult, ForecastData } from '../../scripting/evidence/contract'
import { formatHour, formatNumber, peakOf, totalOf } from '../../scripting/evidence/format'
import { niceMax } from '../../scripting/evidence/scale'
import { EvidencePanel } from './EvidencePanel'

type Props = {
  result: EnvironmentalResult<ForecastData>
  isExample?: boolean
  timeZone?: string
}

/**
 * Hourly forecast precipitation as a bar chart. One series, so no legend: the
 * title names it. Each bar shows its value on hover or keyboard focus; a
 * hidden table carries the same numbers for screen readers. Missing hours are
 * drawn as a dashed gap and labeled "No value", never as zero.
 */
export function RainfallChart({ result, isExample, timeZone }: Props) {
  const units = result.units ?? 'mm'
  return (
    <EvidencePanel
      title="Rainfall forecast"
      kind="forecast"
      result={result}
      times={['forecastIssuedAt', 'fetchedAt']}
      isExample={isExample}
      timeZone={timeZone}
    >
      {(forecast) => {
        const total = totalOf(forecast.samples)
        const peak = peakOf(forecast.samples)
        const top = niceMax(Math.max(0, ...forecast.samples.map((s) => s.value ?? 0)))
        return (
          <>
            <p className="rain-stats">
              <span className="rain-total">
                <strong>{formatNumber(total, units)}</strong>
                <small>over the next {forecast.samples.length} hours</small>
              </span>
              {peak && (
                <span className="rain-peak">
                  Heaviest at <strong>{formatHour(peak.validFrom, timeZone)}</strong> · {formatNumber(peak.value, units)}
                </span>
              )}
            </p>

            <div className="bar-chart" role="img" aria-label={`Hourly rainfall in ${units}. Values are in the table below.`}>
              <span className="bar-chart-grid" aria-hidden="true">
                <span data-label={`${top} ${units}`} />
                <span data-label={`${top / 2}`} />
                <span data-label="0" />
              </span>
              <ol className="bar-chart-bars" aria-hidden="true">
                {forecast.samples.map((sample, index) => {
                  const missing = sample.value === null
                  const share = missing ? 1 : (sample.value ?? 0) / top
                  return (
                    <li
                      key={sample.validFrom}
                      className={`bar ${missing ? 'bar--missing' : ''}`}
                      style={{ '--h': share.toFixed(3), '--i': index } as CSSProperties}
                      tabIndex={-1}
                    >
                      <span className="bar-fill" />
                      <span className="bar-tip">
                        {formatHour(sample.validFrom, timeZone)} · {missing ? 'No value' : formatNumber(sample.value, units)}
                      </span>
                      {index % 3 === 0 && <span className="bar-label">{formatHour(sample.validFrom, timeZone)}</span>}
                    </li>
                  )
                })}
              </ol>
            </div>

            <table className="visually-hidden">
              <caption>Hourly forecast rainfall ({units})</caption>
              <thead>
                <tr>
                  <th scope="col">Hour starting</th>
                  <th scope="col">Rainfall</th>
                </tr>
              </thead>
              <tbody>
                {forecast.samples.map((sample) => (
                  <tr key={sample.validFrom}>
                    <td>{formatHour(sample.validFrom, timeZone)}</td>
                    <td>{formatNumber(sample.value, units)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="chart-note">Model: {forecast.model}. Precipitation in the hour before each time, rain and snow combined.</p>
          </>
        )
      }}
    </EvidencePanel>
  )
}
