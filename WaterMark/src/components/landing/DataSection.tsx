import { DATA_SOURCES } from '../../scripting/content/dataSources'
import { EvidenceTag } from '../common/EvidenceTag'
import { Icon, type IconName } from '../common/Icon'
import { Reveal } from '../common/Reveal'
import { RollText } from '../common/RollText'
import { SplitText } from '../common/SplitText'
import { EvidenceRain } from './EvidenceRain'

const TITLE = ['Evidence, labeled.', '\n', { text: 'Never guessed.', accent: true }] as const

const PRINCIPLES: readonly { icon: IconName; text: string }[] = [
  { icon: 'shield', text: 'Official warnings always win' },
  { icon: 'clock', text: 'A timestamp on everything' },
  { icon: 'layers', text: 'Unknown is never shown as low risk' },
  { icon: 'ripple', text: 'No fabricated forecasts or probabilities' },
]

export function DataSection() {
  return (
    <section id="data" className="data section" aria-labelledby="data-title">
      <Reveal className="section-head">
        <p className="section-eyebrow">Accurate data</p>
        <h2 id="data-title" className="section-title">
          <SplitText parts={TITLE} />
        </h2>
        <p className="section-lede">
          Most flood tools blend everything into one colorful score. WaterMark keeps seven kinds of evidence separate,
          each with its own color. Catch a drop to see what it is, what it is not, and how we label it.
        </p>
      </Reveal>

      <ul className="principles" aria-label="Data principles">
        {PRINCIPLES.map((principle) => (
          <li key={principle.text} className="principle">
            <Icon name={principle.icon} size={16} />
            {principle.text}
          </li>
        ))}
      </ul>

      <Reveal className="data-rain">
        <EvidenceRain />
      </Reveal>

      {/* Ryan Lin's resources / bibliography component mounts below this list (README Section 10). */}
      <Reveal className="sources">
        <h3 className="sources-title">Where the data comes from</h3>
        <ul className="sources-list">
          {DATA_SOURCES.map((source) => (
            <li key={source.url}>
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
    </section>
  )
}
