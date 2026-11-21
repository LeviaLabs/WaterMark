import { Avatar } from '@astryxdesign/core/Avatar'
import { TEAM } from '../../scripting/content/team'
import { Reveal } from '../common/Reveal'
import { TiltCard } from '../common/TiltCard'

export function TeamSection() {
  return (
    <section id="team" className="team section" aria-labelledby="team-title">
      <Reveal className="section-head">
        <p className="section-eyebrow">The crew</p>
        <h2 id="team-title" className="section-title">Three builders, one coastline</h2>
        <p className="section-lede">Designed and built during EvoHacks II. Here is who did what.</p>
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
                  {member.work.map((item) => (
                    <li key={item}>{item}</li>
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
