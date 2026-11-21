import { Heading } from '@astryxdesign/core/Heading'
import { Link } from '@astryxdesign/core/Link'
import { Text } from '@astryxdesign/core/Text'
import { DEVPOST_URL, GITHUB_URL, SPONSORS, TEAM } from '../scripting/team.ts'
import '../styling/footer.css'

export function SiteFooter() {
  return (
    <footer id="team" className="footer">
      <div className="footer__inner">
        <div>
          <p className="eyebrow" style={{ color: 'var(--wm-sand)' }}>
            EvoHacks II
          </p>
          <Heading level={2} color="inherit">
            Built by three people, for communities that meet the water first.
          </Heading>
          <Text as="p" color="inherit">
            Roles are who owns the work. A role is not a claim that every piece is finished. WaterMark is a hackathon prototype, not an official warning service.
          </Text>
        </div>
        <div className="footer__team">
          {TEAM.map((person) => (
            <article key={person.id} className="footer__person">
              <Heading level={3} color="inherit">
                {person.name}
              </Heading>
              <p className="footer__role">{person.role}</p>
              <Text as="p" color="inherit">
                {person.work}
              </Text>
            </article>
          ))}
        </div>
        <div>
          <Heading level={3} color="inherit">
            Sponsors
          </Heading>
          <ul className="footer__sponsors">
            {SPONSORS.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <p className="footer__meta">Thank you to the EvoHacks II organizers and administrators.</p>
        </div>
        <div className="footer__end">
          <Text as="p" color="inherit" type="supporting">
            Follow official guidance from the National Weather Service and local emergency managers.
          </Text>
          <p className="footer__meta">
            <Link href={GITHUB_URL} isExternalLink color="inherit">
              GitHub
            </Link>
            {' · '}
            <Link href={DEVPOST_URL} isExternalLink color="inherit">
              EvoHacks II on Devpost
            </Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
