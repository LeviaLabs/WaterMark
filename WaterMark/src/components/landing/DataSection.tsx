import { DATA_SOURCES, EVIDENCE_RULES } from '../../scripting/content/dataSources'
import { EvidenceTag } from '../common/EvidenceTag'
import { Icon, type IconName } from '../common/Icon'
import { Reveal } from '../common/Reveal'
import { TiltCard } from '../common/TiltCard'
import { ProvenanceCard } from './ProvenanceCard'

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
          Evidence, labeled.
          <br />
          <span className="text-gradient">Never guessed.</span>
        </h2>
        <p className="section-lede">
          Most flood tools blend everything into one colorful score. WaterMark keeps each kind of evidence separate and
          tells you what it is, and what it is not.
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

      <div className="data-grid">
        <ul className="rules" aria-label="Kinds of evidence">
          {EVIDENCE_RULES.map((rule, index) => (
            <li key={rule.kind}>
              <Reveal delay={(index % 2) * 80}>
                <TiltCard className="rule">
                  <EvidenceTag kind={rule.kind} />
                  <p className="rule-is">{rule.is}</p>
                  <p className="rule-not">
                    <span>Not:</span> {rule.isNot}
                  </p>
                </TiltCard>
              </Reveal>
            </li>
          ))}
        </ul>
        <Reveal className="data-provenance">
          <ProvenanceCard />
        </Reveal>
      </div>

      {/* Ryan Lin's resources / bibliography component mounts below this list (README Section 10). */}
      <Reveal className="sources">
        <h3 className="sources-title">Where the data comes from</h3>
        <ul className="sources-list">
          {DATA_SOURCES.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer" className="source-row">
                <span className="source-name">
                  {source.name}
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
