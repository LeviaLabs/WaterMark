import { useRef } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { usePointerParallax } from '../../hooks/usePointerParallax'
import { Icon } from '../common/Icon'
import { RollText } from '../common/RollText'
import { RouterLink } from '../common/RouterLink'
import { SplitText } from '../common/SplitText'
import { TideChart } from './TideChart'

const PROVIDERS = ['National Weather Service', 'NOAA Tides & Currents', 'FEMA', 'USGS', 'NYC Open Data', 'FloodNet NYC', 'Open-Meteo', 'Copernicus GloFAS']

const TITLE = ['Know the water', '\n', { text: 'around you.', accent: true }] as const

/**
 * Hero: a living tide chart. The headline rises in and its last letters
 * decrypt, while behind it the tide rolls in and out over a topographic
 * island on its own. Nothing to press; the chart drifts a little with the
 * mouse on desktop.
 */
export function Hero() {
  const heroRef = useRef<HTMLElement>(null)
  usePointerParallax(heroRef)

  return (
    <section ref={heroRef} className="hero" aria-labelledby="hero-title">
      <TideChart />
      <span className="hero-shade" aria-hidden="true" />

      <div className="hero-content">
        <p className="hero-eyebrow">
          <span className="hero-eyebrow-dot" aria-hidden="true" />
          EvoHacks II · Projects for Social Good
        </p>
        <h1 id="hero-title" className="hero-title">
          <SplitText parts={TITLE} play delay={250} scramble={6} />
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
          >
            <RollText text="Explore the map" />
          </Button>
          <a className="hero-secondary" href="#how">
            <RollText text="See how it works" /> <Icon name="arrowDown" size={16} />
          </a>
        </div>
      </div>

      <div className="hero-providers glass-panel">
        <span className="hero-providers-label">Built on public data from</span>
        <span className="marquee">
          <ul className="marquee-track">
            {PROVIDERS.map((provider) => (
              <li key={provider}>{provider}</li>
            ))}
          </ul>
          <ul className="marquee-track" aria-hidden="true">
            {PROVIDERS.map((provider) => (
              <li key={provider}>{provider}</li>
            ))}
          </ul>
        </span>
      </div>
    </section>
  )
}
