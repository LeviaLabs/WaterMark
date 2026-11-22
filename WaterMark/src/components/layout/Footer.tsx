import { useRef, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { useInView } from '../../hooks/useInView'
import { EVENT, REPOSITORY_URL, SPONSORS, TEAM } from '../../scripting/content/team'
import { STATUS_LABELS } from '../../scripting/content/featureStory'
import { Icon } from '../common/Icon'
import { Logo } from '../common/Logo'
import { RollText } from '../common/RollText'

const at = (i: number) => ({ '--i': i }) as CSSProperties

/**
 * Footer. The first time it scrolls into view its parts arrive in turn: the
 * brand and thanks rise, the sponsor chips pop, the "Built by" rule draws
 * across, then each teammate and their work slide in one after another.
 */
export function Footer() {
  const ref = useRef<HTMLElement>(null)
  const visible = useInView(ref, { once: true, rootMargin: '0px 0px -12% 0px' })
  const { canSignIn } = useAuth()

  return (
    <footer ref={ref} className={`footer ${visible ? 'is-visible' : ''}`}>
      <span className="footer-wave" aria-hidden="true" />
      <div className="footer-inner">
        <section className="footer-brand stagger-item" style={at(0)} aria-label="About WaterMark">
          <Logo />
          <p className="footer-tagline">Flood and extreme-rainfall evidence for the communities that live with the water.</p>
          <p className="footer-disclaimer">
            WaterMark is a hackathon prototype, not an official warning service or a guarantee of safety. Always follow
            the National Weather Service and your local emergency managers. A lack of data is not a lack of risk.
          </p>
          <a className="footer-github" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            <Icon name="github" size={18} /> <RollText text="LeviaLabs/WaterMark" />
          </a>
        </section>

        <section className="footer-thanks stagger-item" style={at(1)} aria-labelledby="footer-thanks-title">
          <h2 id="footer-thanks-title" className="footer-heading">
            <span className="footer-heart">
              <Icon name="heart" size={16} />
            </span>{' '}
            Thank you
          </h2>
          <p>
            To the {EVENT.name} organizers, administrators, mentors and judges for running a hackathon about{' '}
            {EVENT.theme.toLowerCase()}, and for the feedback that shaped WaterMark: keep it 2D, drop the mandatory
            login, and show every timestamp.
          </p>
          <p className="footer-sponsor-intro">And to the sponsors who made the event possible:</p>
          <ul className="footer-sponsors">
            {SPONSORS.map((sponsor, index) => (
              <li key={sponsor} style={at(index)}>
                {sponsor}
              </li>
            ))}
          </ul>
          <p className="footer-data-credit">
            Data credit: NWS, NOAA, FEMA, USGS, NYC Open Data, FloodNet NYC, Open-Meteo and Copernicus GloFAS. AI coding assistants (Claude, Cursor, Codex and Grok) helped write parts of this project.
          </p>
        </section>
        <section className="footer-team" aria-labelledby="footer-team-title">
          <h2 id="footer-team-title" className="footer-heading footer-heading--rule">
            Built by
          </h2>
          <ul className="footer-members">
            {TEAM.map((member, memberIndex) => (
              <li key={member.name} style={at(memberIndex)}>
                <span className="footer-member">{member.name}</span>
                <span className="footer-role">{member.role}</span>
                <ul className="footer-work">
                  {member.work.map((item, itemIndex) => (
                    <li key={item.text} style={{ '--i': memberIndex, '--k': itemIndex } as CSSProperties}>
                      {item.text}
                      {item.status !== 'built' && (
                        <span className={`footer-status footer-status--${item.status}`}>{STATUS_LABELS[item.status]}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

      </div>
      <div className="footer-bottom stagger-item" style={at(4)}>
        <span>
          © 2026 LeviaLabs · Made for {EVENT.name}
        </span>
        <nav className="footer-bottom-links" aria-label="Footer">
          <Link to="/map">
            <RollText text="Map" />
          </Link>
          {canSignIn && (
            <Link to="/login">
              <RollText text="Log in" />
            </Link>
          )}
          <a href="#top" className="footer-top">
            <RollText text="Back to top" /> <Icon name="arrowDown" size={14} />
          </a>
        </nav>
      </div>
    </footer>
  )
}
