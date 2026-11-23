import type { CSSProperties } from 'react'
import { AUDIENCES } from '../../scripting/content/features'
import { Icon } from '../common/Icon'
import { Reveal } from '../common/Reveal'
import { SplitText } from '../common/SplitText'
import { TiltCard } from '../common/TiltCard'

const TITLE = ['Made for the people', '\n', { text: 'who respond first.', accent: true }] as const

/** Who WaterMark is for. Mirrors the role views shipped on /map. */
export function FeaturesSection() {
  return (
    <section className="features section" aria-labelledby="audiences-title">
      <Reveal className="section-head">
        <p className="section-eyebrow">Who it’s for</p>
        <h2 id="audiences-title" className="section-title">
          <SplitText parts={TITLE} />
        </h2>
        <p className="section-lede">
          The same verified evidence, arranged into tailored role views on the flood map for the decisions each group
          actually has to make.
        </p>
      </Reveal>

      <ul className="audience-grid">
        {AUDIENCES.map((audience, index) => (
          <li key={audience.title}>
            <Reveal delay={index * 80}>
              <TiltCard className="audience">
                <span className="audience-icon" style={{ '--i': index } as CSSProperties}>
                  <Icon name={audience.icon} size={22} />
                </span>
                <h3>{audience.title}</h3>
                <p>{audience.body}</p>
              </TiltCard>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  )
}
