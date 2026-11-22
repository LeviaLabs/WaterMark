import type { CSSProperties } from 'react'
import { DATA_SOURCES } from '../../scripting/content/dataSources'
import { EvidenceTag } from '../common/EvidenceTag'
import { Icon, type IconName } from '../common/Icon'
import { Reveal } from '../common/Reveal'
import { RollText } from '../common/RollText'
import { SplitText } from '../common/SplitText'
import { EvidenceSea } from './EvidenceSea'

const TITLE = ['Evidence, labeled.', '\n', { text: 'Never guessed.', accent: true }] as const

const PRINCIPLES: readonly { icon: IconName; text: string }[] = [
  { icon: 'shield', text: 'Official warnings always win' },
  { icon: 'clock', text: 'A timestamp on everything' },
  { icon: 'layers', text: 'Unknown is never shown as low risk' },
  { icon: 'ripple', text: 'No fabricated forecasts or probabilities' },
]

export function DataSection() {
  return (
    <section className="data" aria-labelledby="data-title">
      <Reveal className="data-sea">
        <EvidenceSea
          footer={
            <ul className="principles" aria-label="Data principles">
              {PRINCIPLES.map((principle, index) => (
                <li key={principle.text} className="principle" style={{ '--i': index } as CSSProperties}>
                  <Icon name={principle.icon} size={16} />
                  {principle.text}
                </li>
              ))}
            </ul>
          }
        >
          <p className="section-eyebrow">Accurate data</p>
          <h2 id="data-title" className="section-title">
            <SplitText parts={TITLE} />
          </h2>
          <p className="section-lede">
            Most flood tools blend everything into one colorful score. WaterMark keeps seven kinds of evidence separate,
            each with its own color.
          </p>
          <p className="sea-hint">
            <span className="sea-hint-fish" aria-hidden="true">
              <svg viewBox="0 0 24 12">
                <path d="M4 6C8 1 17 1 21 6C17 11 8 11 4 6ZM4 6L0 2V10Z" />
              </svg>
            </span>
            Click a fish to see what that kind of evidence is, and what it is not.
          </p>
        </EvidenceSea>
      </Reveal>

      <div className="section data-sources">
      {/* Ryan Lin's resources / bibliography component mounts below this list (README Section 10). */}
      <Reveal className="sources">
        <h3 className="sources-title">Where the data comes from</h3>
        <ul className="sources-list">
          {DATA_SOURCES.map((source, index) => (
            <li key={source.url} style={{ '--i': index } as CSSProperties}>
              <a href={source.url} target="_blank" rel="noreferrer" className="source-row">
                <span className="source-name">
                  <RollText text={source.name} />
                  <Icon name="external" size={14} />
                </span>
                <span className="source-provider">{source.provider}</span>
                <span className="source-coverage">{source.coverage}</span>
                <EvidenceTag kind={source.kind} />
              </a>
            </li>
          ))}
        </ul>
      </Reveal>
      </div>
    </section>
  )
}
