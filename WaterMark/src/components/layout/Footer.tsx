import { Link } from 'react-router'
import { EVENT, REPOSITORY_URL, SPONSORS, TEAM } from '../../scripting/content/team'
import { Icon } from '../common/Icon'
import { Logo } from '../common/Logo'

export function Footer() {
  return (
    <footer className="footer">
      <span className="footer-wave" aria-hidden="true" />
      <div className="footer-inner">
        <section className="footer-brand" aria-label="About WaterMark">
          <Logo />
          <p className="footer-tagline">Flood and extreme-rainfall evidence for the communities that live with the water.</p>
          <p className="footer-disclaimer">
            WaterMark is a hackathon prototype, not an official warning service or a guarantee of safety. Always follow
            the National Weather Service and your local emergency managers. A lack of data is not a lack of risk.
          </p>
          <a className="footer-github" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            <Icon name="github" size={18} /> LeviaLabs/WaterMark
          </a>
        </section>

        <section className="footer-team" aria-labelledby="footer-team-title">
          <h2 id="footer-team-title" className="footer-heading">Built by</h2>
          <ul>
            {TEAM.map((member) => (
              <li key={member.name}>
                <span className="footer-member">{member.name}</span>
                <span className="footer-role">{member.work.join(' · ')}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="footer-thanks" aria-labelledby="footer-thanks-title">
          <h2 id="footer-thanks-title" className="footer-heading">
            <Icon name="heart" size={16} /> Thank you
          </h2>
          <p>
            To the {EVENT.name} organizers, administrators, mentors and judges for running a hackathon about{' '}
            {EVENT.theme.toLowerCase()}, and for the feedback that shaped WaterMark: keep it 2D, drop the mandatory
            login, and show every timestamp.
          </p>
          <p className="footer-sponsor-intro">And to the sponsors who made the event possible:</p>
          <ul className="footer-sponsors">
            {SPONSORS.map((sponsor) => (
              <li key={sponsor}>{sponsor}</li>
            ))}
          </ul>
          <p className="footer-data-credit">
            Data credit: NWS, NOAA, FEMA, USGS, NYC Open Data, FloodNet NYC, Open-Meteo and Copernicus GloFAS. AI coding assistants helped write parts of this project.
          </p>
        </section>
      </div>
      <div className="footer-bottom">
        <span>
          © 2026 LeviaLabs · Made for {EVENT.name}
        </span>
        <nav className="footer-bottom-links" aria-label="Footer">
          <Link to="/map">Map</Link>
          <Link to="/login">Log in</Link>
          <a href="#top">Back to top</a>
        </nav>
      </div>
    </footer>
  )
}
