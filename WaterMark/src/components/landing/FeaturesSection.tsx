import type { CSSProperties } from 'react'
import { AUDIENCES } from '../../scripting/content/features'
import { Icon } from '../common/Icon'
import { Reveal } from '../common/Reveal'
import { SplitText } from '../common/SplitText'
import { TiltCard } from '../common/TiltCard'

const TITLE = ['Made for the people', '\n', { text: 'who respond first.', accent: true }] as const

/** Who WaterMark is for. The features themselves are shown in the flood story above. */
export function FeaturesSection() {
  return (
    <section id="audiences" className="features section" aria-labelledby="audiences-title">
      <Reveal className="section-head">
        <p className="section-eyebrow">Who it’s for</p>
        <h2 id="audiences-title" className="section-title">
          <SplitText parts={TITLE} />
        </h2>
        <p className="section-lede">
          The same evidence, read by four kinds of neighbors. Tailored views for each come after the core map is
          reliable.
        </p>
      </Reveal>

      <ul className="audience-list">
        {AUDIENCES.map((audience, index) => (
          <li key={audience.title}>
            <Reveal delay={index * 90}>
              <TiltCard className="audience" maxDegrees={8}>
                <span className="audience-icon" style={{ '--i': index } as CSSProperties} aria-hidden="true">
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
