import { AUDIENCES, FEATURES, PRIORITY_LABELS } from '../../scripting/content/features'
import { Reveal } from '../common/Reveal'
import { TiltCard } from '../common/TiltCard'

export function FeaturesSection() {
  return (
    <section id="features" className="features section" aria-labelledby="features-title">
      <Reveal className="section-head">
        <p className="section-eyebrow">The app</p>
        <h2 id="features-title" className="section-title">What we're building</h2>
        <p className="section-lede">
          Core features come first; everything else waits until the core is reliable. Labels show where each piece sits
          in our plan.
        </p>
      </Reveal>

      <ul className="feature-grid">
        {FEATURES.map((feature, index) => (
          <li key={feature.title}>
            <Reveal delay={(index % 3) * 80}>
              <TiltCard className="feature">
                <span className={`priority priority--${feature.priority.toLowerCase()}`}>
                  {PRIORITY_LABELS[feature.priority]}
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
                <p className="feature-owner">{feature.owner}</p>
              </TiltCard>
            </Reveal>
          </li>
        ))}
      </ul>

      <Reveal className="audiences">
        <h3 className="audiences-title">Made for the people who respond first</h3>
        <ul className="audience-list">
          {AUDIENCES.map((audience) => (
            <li key={audience.title} className="audience glass-card">
              <strong>{audience.title}</strong>
              <span>{audience.body}</span>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  )
}
