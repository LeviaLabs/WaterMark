import { Button } from '@astryxdesign/core/Button'
import { Icon } from '../common/Icon'
import { RouterLink } from '../common/RouterLink'
import { WaveCanvas } from './WaveCanvas'

const PROVIDERS = ['NWS', 'NOAA', 'FEMA', 'USGS', 'NYC Open Data', 'FloodNet', 'Open-Meteo']

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <WaveCanvas className="hero-canvas" />
      <span className="hero-shade" aria-hidden="true" />

      <div className="hero-content">
        <p className="hero-eyebrow">
          <span className="hero-eyebrow-dot" aria-hidden="true" />
          EvoHacks II · Projects for Social Good
        </p>
        <h1 id="hero-title" className="hero-title">
          Know the water
          <br />
          <em>around you.</em>
        </h1>
        <p className="hero-lede">
          Official flood warnings, rainfall forecasts, stormwater scenarios, sensor readings and flood history on one
          honest 2D map. Every number says where it came from and when.
        </p>
        <div className="hero-actions">
          <Button
            label="Explore the map"
            variant="primary"
            size="lg"
            href="/map"
            as={RouterLink}
            endContent={<Icon name="arrowRight" size={18} />}
          />
          <a className="hero-secondary" href="#how">
            See how it works <Icon name="arrowDown" size={16} />
          </a>
        </div>
      </div>

      <p className="hero-hint" aria-hidden="true">
        <Icon name="ripple" size={16} /> Move across the water, or tap it
      </p>

      <div className="hero-providers glass-panel">
        <span className="hero-providers-label">Built on public data from</span>
        <ul>
          {PROVIDERS.map((provider) => (
            <li key={provider}>{provider}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
