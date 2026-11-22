// Legend for the flood squares on show (the US grid inside the US, the world grid elsewhere).
// Folds to a single ramp to keep the map clear; open, every color class has its own row.
// Swatch colors are the --flood-1..6 tokens, which mirror the map palette in scripting/mapTheme.ts.
import { useId, useState } from 'react'
import { cellLegend } from '../../scripting/choropleth'
import type { GridKind } from '../../scripting/cells'
import type { FloodHistoryIndex } from '../../services/floodHistory'

interface Props {
  grid: GridKind
  index: FloodHistoryIndex | null
}

export function MapLegend({ grid, index }: Props) {
  const id = useId()
  const [isOpen, setIsOpen] = useState(() => !matchMedia('(max-width: 700px)').matches)
  if (!index) return null
  const meta = index.cells[grid]
  const rows = cellLegend(meta.breaks)
  const what = grid === 'us' ? 'Flood reports per square' : 'Floods per square'
  const km = Math.round(meta.size * 111)
  const sub = `${meta.size}° squares, about ${km} km north to south · native size of this count · ${grid === 'us' ? 'NOAA' : 'GDACS'}, ${meta.years[0]}–${meta.years[1]}`
  return (
    <section className={isOpen ? 'map-card map-legend is-open' : 'map-card map-legend'} aria-label={`${what}, ${sub}`}>
      <button type="button" className="map-legend-toggle" aria-expanded={isOpen} aria-controls={id} onClick={() => setIsOpen(!isOpen)}>
        <span className="map-legend-title">{what}</span>
        <svg className="map-legend-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 10 4-4 4 4" /></svg>
      </button>
      <p className="map-legend-sub">{sub}</p>
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
