import { useRef } from 'react'
import { useInView } from '../../hooks/useInView'
import { Button } from '@astryxdesign/core/Button'
import { usePointerParallax } from '../../hooks/usePointerParallax'
import { useScrollProgress } from '../../hooks/useScrollProgress'
import { Icon } from '../common/Icon'
import { RollText } from '../common/RollText'
import { RouterLink } from '../common/RouterLink'
import { SplitText } from '../common/SplitText'
import { Droplet } from './Droplet'

const PROVIDERS = ['National Weather Service', 'NOAA Tides & Currents', 'FEMA', 'USGS', 'NYC Open Data', 'FloodNet NYC', 'Open-Meteo', 'Copernicus GloFAS']

const TITLE = ['Know the water', '\n', { text: 'around you.', accent: true }] as const

/**
 * Hero: the headline on the left (it rises in and its second line decrypts;
 * hover a word to decrypt it again) and, on the right, the WaterMark droplet
 * as a glass drop of water over a slow aurora (Droplet.tsx). The water
 * sloshes as the pointer moves and fills as you scroll on, into "Watch the
 * water rise".
 */
export function Hero() {
  const heroRef = useRef<HTMLElement>(null)
  usePointerParallax(heroRef)
  useScrollProgress(heroRef, undefined, { exit: true })
  const visible = useInView(heroRef)

  return (
    <section ref={heroRef} className={`hero ${visible ? '' : 'hero--still'}`} aria-labelledby="hero-title">
      <span className="hero-aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <Droplet />
      <span className="hero-grain" aria-hidden="true" />
      <span className="hero-shade" aria-hidden="true" />

      <div className="hero-content">
        <p className="hero-eyebrow">
          <span className="hero-eyebrow-dot" aria-hidden="true" />
          EvoHacks II · Projects for Social Good
        </p>
        <h1 id="hero-title" className="hero-title">
          <SplitText parts={TITLE} play delay={250} scramble="accent" hoverScramble />
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
