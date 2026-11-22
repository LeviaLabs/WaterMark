// The flood squares card, bottom left: the time slider and the legend for the squares on show (the
// US grid inside the US, the world grid elsewhere).
//
// The slider runs through every year of the grid and ends on "All years". Play steps through the
// years from the first (or from the year on show) about once a second and stops on "All years".
// One year uses one color scale for every year, so years compare fairly; all years use their own.
// The legend folds to a single ramp to keep the map clear; open, every color class has its own row.
// Swatch colors are the --flood-1..6 tokens, which mirror the map palette in scripting/mapTheme.ts.
import { useEffect, useId, useState, type CSSProperties } from 'react'
import { Icon } from '../common/Icon'
import { cellLegend } from '../../scripting/choropleth'
import type { GridKind } from '../../scripting/cells'
import type { FloodHistoryIndex } from '../../services/floodHistory'

interface Props {
  grid: GridKind
  index: FloodHistoryIndex | null
  /** The year on show, or null for all years. */
  year: number | null
  onYearChange: (year: number | null) => void
}

const STEP_MS = 1100

export function MapLegend({ grid, index, year, onYearChange }: Props) {
  const id = useId()
  const [isOpen, setIsOpen] = useState(() => !matchMedia('(max-width: 700px)').matches)
  const [isPlaying, setIsPlaying] = useState(false)
  const range = index?.cells[grid].years ?? null

  // Playing: the next year after a pause, then "All years" after the last, where it stops.
  useEffect(() => {
    if (!isPlaying || !range) return
    const t = setTimeout(() => {
      if (year == null) return setIsPlaying(false)
      if (year >= range[1]) {
        onYearChange(null)
        setIsPlaying(false)
      } else onYearChange(year + 1)
    }, STEP_MS)
    return () => clearTimeout(t)
  }, [isPlaying, year, range, onYearChange])

  if (!index || !range) return null
  const meta = index.cells[grid]
  const isAll = year == null
  const rows = cellLegend(isAll ? meta.breaks : meta.yearBreaks)
  const what = 'Floods per square'
  const km = Math.round(meta.size * 111)
  const source = grid === 'us' ? 'NOAA flood episodes' : 'GDACS flood events'
  const sub = isAll
    ? `${meta.size}° squares, about ${km} km north to south · native size of this count · ${source}, ${range[0]}–${range[1]}`
    : `${meta.size}° squares, about ${km} km north to south · native size of this count · ${source}, in ${year} · same scale every year`
  const usStart = index.cells.us.years[0]
  const usNote = grid === 'world' && year != null && year < usStart
    ? `US squares (NOAA flood episodes) start in ${usStart}.`
    : null

  const togglePlay = () => {
    if (isPlaying) return setIsPlaying(false)
    if (year == null || year >= range[1]) onYearChange(range[0])
    setIsPlaying(true)
  }
  const slide = (v: number) => {
    setIsPlaying(false)
    onYearChange(v > range[1] ? null : v)
  }

  return (
    <section className={isOpen ? 'map-card map-legend is-open' : 'map-card map-legend'} aria-label={`${what}, ${sub}`}>
      <div className="time-head">
        <button type="button" className={isPlaying ? 'time-play is-playing' : 'time-play'} onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : `Play the years from ${year != null && year < range[1] ? year : range[0]}`}>
          <Icon name={isPlaying ? 'pause' : 'play'} size={16} />
        </button>
        <p className="time-year" aria-live="polite">{isAll ? 'All years' : year}</p>
        {isAll ? null : (
          <button type="button" className="time-all" onClick={() => { setIsPlaying(false); onYearChange(null) }}>All years</button>
        )}
      </div>
      <input type="range" className="time-slider" min={range[0]} max={range[1] + 1} step={1}
        value={year ?? range[1] + 1} onChange={(e) => slide(Number(e.target.value))}
        aria-label="Year" aria-valuetext={isAll ? `All years, ${range[0]} to ${range[1]}` : String(year)}
        style={{ '--fill': `${(((year ?? range[1] + 1) - range[0]) / (range[1] + 1 - range[0])) * 100}%` } as CSSProperties} />
      <p className="time-ends" aria-hidden="true"><span>{range[0]}</span><span className="time-ends-last">{range[1]}</span><span>All</span></p>
      <button type="button" className="map-legend-toggle" aria-expanded={isOpen} aria-controls={id} onClick={() => setIsOpen(!isOpen)}>
        <span className="map-legend-title">{what}</span>
        <svg className="map-legend-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 10 4-4 4 4" /></svg>
      </button>
      <p className="map-legend-sub">{sub}</p>
      {usNote ? <p className="map-legend-sub time-note">{usNote}</p> : null}
      {isOpen ? (
        <ul id={id} className="map-legend-list">
          {rows.map((r) => (
            <li key={r.cls}><span className={`region-swatch region-swatch--${r.cls}`} aria-hidden="true" />{r.label}</li>
          ))}
          <li className="map-legend-empty"><span className="region-swatch region-swatch--none" aria-hidden="true" />None recorded</li>
        </ul>
      ) : (
        <p id={id} className="map-legend-ramp">
          <span className="map-legend-ramp-bar" aria-hidden="true">
            {rows.map((r) => <span key={r.cls} className={`region-swatch region-swatch--${r.cls}`} />)}
          </span>
          <span className="map-legend-ramp-ends"><span>{rows[0]?.label}</span><span>{rows.at(-1)?.label}</span></span>
        </p>
      )}
    </section>
  )
}
