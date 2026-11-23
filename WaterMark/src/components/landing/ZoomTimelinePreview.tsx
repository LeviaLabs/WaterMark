import { useEffect, useId, useState } from 'react'
import { Icon } from '../common/Icon'

const ZOOM_LEVELS = [
  { id: 'world', label: 'World', scope: 'Global archive (GDACS)', episodes: '4,800+', note: 'Countries shaded by annual international flood events.' },
  { id: 'country', label: 'United States', scope: 'NOAA Storm Events', episodes: '52,140', note: 'Episodes deduplicated per state, county & grid square.' },
  { id: 'state', label: 'New York', scope: 'State breakdown', episodes: '2,410', note: 'Top causes: heavy rain, flash floods & coastal surge.' },
  { id: 'county', label: 'Kings County', scope: 'County focus', episodes: '84', note: 'Zooming past the threshold locks the county automatically.' },
  { id: 'block', label: 'Red Hook block', scope: 'Grid square (0.1°)', episodes: '19', note: 'Selects the block under your cursor without a click.' },
] as const

const TIMELINE_YEARS = [
  { year: '2021', episodes: 6420, topCause: 'Tropical & heavy rain', share: 88 },
  { year: '2022', episodes: 4890, topCause: 'Flash flooding', share: 67 },
  { year: '2023', episodes: 5340, topCause: 'Heavy rain', share: 73 },
  { year: '2024', episodes: 5910, topCause: 'Coastal & storm surge', share: 81 },
  { year: '2025', episodes: 4680, topCause: 'Heavy rain', share: 64 },
  { year: 'All years', episodes: 52140, topCause: 'Heavy rain (54%) · Flash flood (28%)', share: 100 },
] as const

export function ZoomTimelinePreview() {
  const sliderId = useId()
  const [depth, setDepth] = useState(4)
  const [yearIndex, setYearIndex] = useState(TIMELINE_YEARS.length - 1)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setYearIndex((current) => (current + 1) % TIMELINE_YEARS.length)
    }, 1100)
    return () => window.clearInterval(timer)
  }, [playing])

  const level = ZOOM_LEVELS[depth]
  const entry = TIMELINE_YEARS[yearIndex]

  return (
    <article className="evidence-panel zoom-timeline-preview" aria-label="Zoom-to-focus and flood timeline preview">
      <header className="evidence-panel-head">
        <h3>Zoom focus &amp; timeline</h3>
        <span className="evidence-panel-tags">
          <span className="example-badge">Example · NOAA &amp; GDACS</span>
        </span>
      </header>

      <div className="zoom-trail" role="group" aria-label="Automatic zoom depth">
        {ZOOM_LEVELS.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            className={`zoom-chip ${idx === depth ? 'is-active' : idx < depth ? 'is-path' : ''}`}
            aria-pressed={idx === depth}
            onClick={() => setDepth(idx)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="zoom-readout">
        <div>
          <span className="zoom-scope">{level.scope}</span>
          <strong className="zoom-count">{level.episodes}</strong>
          <span className="zoom-unit">flood episodes</span>
        </div>
        <p className="zoom-note">{level.note}</p>
      </div>

      <div className="timeline-box">
        <div className="timeline-head">
          <button
            type="button"
            className="timeline-play"
            aria-label={playing ? 'Pause timeline' : 'Play timeline'}
            onClick={() => setPlaying((on) => !on)}
          >
            <Icon name={playing ? 'pause' : 'play'} size={14} />
            <span>{playing ? 'Pause' : 'Play'}</span>
          </button>
          <label className="timeline-year" htmlFor={sliderId}>
            {entry.year} · <strong>{entry.episodes.toLocaleString('en-US')}</strong> US episodes
          </label>
        </div>

        <input
          id={sliderId}
          className="range"
          type="range"
          min={0}
          max={TIMELINE_YEARS.length - 1}
          value={yearIndex}
          aria-valuetext={`${entry.year}: ${entry.episodes} episodes`}
          onChange={(event) => {
            setPlaying(false)
            setYearIndex(Number(event.target.value))
          }}
        />

        <div className="timeline-cause">
          <span>Primary causes: {entry.topCause}</span>
          <span className="timeline-bar" aria-hidden="true">
            <span style={{ width: `${entry.share}%` }} />
          </span>
        </div>
      </div>

      <p className="evidence-limit">
        On /map, wheel and pinch zoom automatically select regions and scrub NOAA flood episodes from 2016–2025.
      </p>
    </article>
  )
}
