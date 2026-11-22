import type { CSSProperties } from 'react'
import { DATA_SOURCES, EVIDENCE_RULES } from '../../scripting/content/dataSources'
import { Reveal } from '../common/Reveal'
import { SplitText } from '../common/SplitText'

const TITLE = ['Flood information is scattered.', '\n', { text: 'Your street isn’t.', accent: true }] as const

const STATS = [
  { value: String(DATA_SOURCES.length), label: 'public datasets evaluated', note: 'NWS, NOAA, FEMA, USGS, NYC and more' },
  { value: String(EVIDENCE_RULES.length), label: 'kinds of evidence', note: 'kept apart, never blended into one score' },
  { value: '0', label: 'invented readings', note: 'no data means "unknown", never "low risk"' },
]

export function MissionSection() {
  return (
    <section className="mission section" aria-labelledby="mission-title">
      <Reveal className="mission-copy">
        <p className="section-eyebrow">Why WaterMark</p>
        <h2 id="mission-title" className="section-title">
          <SplitText parts={TITLE} />
        </h2>
        <p className="section-lede">
          The facts about a place that floods are spread across weather forecasts, government flood maps, tide gauges,
          street sensors and decades of incident reports. We started with Coney Island, the Rockaways and Red Hook, where
          many families live close to the water and many go without flood insurance, and asked: what if one map put all
          of it in front of them, honestly labeled?
        </p>
      </Reveal>

      <ul className="mission-stats">
        {STATS.map((stat, index) => (
          <li key={stat.label}>
            <Reveal delay={index * 90} className="stat glass-card">
              <span className="stat-value" style={{ '--i': index } as CSSProperties}>{stat.value}</span>
              <span className="stat-label">{stat.label}</span>
              <span className="stat-note">{stat.note}</span>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  )
}
