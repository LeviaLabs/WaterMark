import { Heading } from '@astryxdesign/core/Heading'
import { Link } from '@astryxdesign/core/Link'
import { DEVPOST_URL, GITHUB_URL, SPONSORS, TEAM } from '../scripting/team.ts'
import '../styling/footer.css'

export function SiteFooter() {
  return (
    <footer id="team" className="footer">
      <div className="footer__inner">
        <div>
          <p className="footer__mark">WaterMark</p>
          <p className="footer__lead">
            A flood and extreme-rainfall map for coastal communities. Roles below are ownership, not a claim that every piece is finished.
          </p>
        </div>
        <div className="footer__team">
          {TEAM.map((person) => (
            <article key={person.id} className="footer__person">
              <Heading level={3} color="inherit">
                {person.name}
              </Heading>
              <p className="footer__role">{person.role}</p>
              <p className="footer__lead">{person.work}</p>
            </article>
          ))}
        </div>
        <div>
          <p className="footer__role">With thanks</p>
          <ul className="footer__sponsors">
            {SPONSORS.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <p className="footer__thanks">EvoHacks II organizers and administrators.</p>
        </div>
        <div className="footer__end">
          <p className="footer__note">
            Follow the National Weather Service and local emergency managers. WaterMark is not an official warning.
          </p>
          <p className="footer__note">
            <Link href={GITHUB_URL} isExternalLink color="inherit">
              GitHub
            </Link>
            {'  ·  '}
            <Link href={DEVPOST_URL} isExternalLink color="inherit">
              Devpost
            </Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
