import type { CSSProperties } from 'react'
import { Avatar } from '@astryxdesign/core/Avatar'
import { STATUS_LABELS } from '../../scripting/content/featureStory'
import { TEAM } from '../../scripting/content/team'
import { Reveal } from '../common/Reveal'
import { SplitText } from '../common/SplitText'
import { TiltCard } from '../common/TiltCard'

const TITLE = ['Four builders,', '\n', { text: 'one coastline.', accent: true }] as const

export function TeamSection() {
  return (
    <section className="team section" aria-labelledby="team-title">
      <Reveal className="section-head">
        <p className="section-eyebrow">The crew</p>
        <h2 id="team-title" className="section-title">
          <SplitText parts={TITLE} />
        </h2>
        <p className="section-lede">
          Built during EvoHacks II. Roles follow the color-coded assignments in our planning doc, and everything
          below shipped and is live on watermark.works.
        </p>
      </Reveal>
      <ul className="team-grid">
        {TEAM.map((member, index) => (
          <li key={member.name}>
            <Reveal delay={index * 100}>
              <TiltCard className="member" maxDegrees={9}>
                <span className="member-avatar">
                  <Avatar name={member.name} size="lg" tooltip={false} />
                </span>
                <h3>{member.name}</h3>
                <p className="member-role">{member.role}</p>
                <ul className="member-work">
                  {member.work.map((item, itemIndex) => (
                    <li key={item.text} className="stagger-item" style={{ '--i': itemIndex } as CSSProperties}>
                      <span>{item.text}</span>
                      <span className={`build-status build-status--${item.status}`}>{STATUS_LABELS[item.status]}</span>
                    </li>
                  ))}
                </ul>
              </TiltCard>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  )
}
