import { Heading } from '@astryxdesign/core/Heading'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Text } from '@astryxdesign/core/Text'
import { AUDIENCES, FEATURES, type FeatureStatus } from '../scripting/features.ts'
import { GlassCard } from './GlassCard.tsx'
import '../styling/features.css'

function statusVariant(status: FeatureStatus): 'accent' | 'warning' | 'neutral' {
  if (status === 'in-progress') return 'accent'
  if (status === 'research') return 'warning'
  return 'neutral'
}

export function FeatureSection() {
  return (
    <section id="features" className="band" aria-labelledby="features-title">
      <div className="feature-head">
        <p className="eyebrow">What the team is building</p>
        <Heading id="features-title" level={2} textWrap="balance">
          The map comes first. Everything else is labeled with how far it has gotten.
        </Heading>
        <Text as="p" color="secondary">
          Nothing in these cards is a live reading. Planned work stays planned until a provider response is on the screen with its timestamp.
        </Text>
      </div>
      <div className="feature-grid">
        {FEATURES.map((feature) => (
          <GlassCard key={feature.id} marked={feature.id === 'move-your-car'}>
            <div className="feature-status">
              <StatusDot variant={statusVariant(feature.status)} label={feature.statusLabel} />
              <Text type="label" weight="bold">
                {feature.statusLabel}
              </Text>
            </div>
            <Heading className="feature-title" level={3}>
              {feature.title}
            </Heading>
            <Text className="feature-copy" as="p">
              {feature.summary}
            </Text>
            <Text className="feature-limit" as="p" type="supporting" color="secondary">
              {feature.limit}
            </Text>
            <Text className="feature-owner" as="p" type="supporting">
              {feature.owner}
            </Text>
          </GlassCard>
        ))}
      </div>
      <div className="feature-head" style={{ marginTop: 'var(--spacing-10)' }}>
        <p className="eyebrow">If there is time</p>
        <Heading level={2}>Same evidence, different emphasis</Heading>
        <Text as="p" color="secondary">
          Tailored views for homeowners, schools, CERT teams, and volunteer fire departments are joint work, and only after the public map is reliable.
        </Text>
      </div>
      <div className="audience-grid">
        {AUDIENCES.map((audience) => (
          <article key={audience.id} className="audience">
            <Heading level={3}>{audience.title}</Heading>
            <Text as="p" color="secondary">
              {audience.text}
            </Text>
          </article>
        ))}
      </div>
    </section>
  )
}
