import { useRef, type MouseEvent, type PointerEvent } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { usePointerParallax } from '../../hooks/usePointerParallax'
import { useRainFlood } from '../../hooks/useRainFlood'
import { CityScene } from '../city/CityScene'
import { Icon } from '../common/Icon'
import { RollText } from '../common/RollText'
import { RouterLink } from '../common/RouterLink'
import { SplitText } from '../common/SplitText'

const PROVIDERS = ['National Weather Service', 'NOAA Tides & Currents', 'FEMA', 'USGS', 'NYC Open Data', 'FloodNet NYC', 'Open-Meteo', 'Copernicus GloFAS']

const TITLE = ['Know the water', '\n', { text: 'around you.', accent: true }] as const

const isControl = (target: EventTarget) => target instanceof Element && target.closest('a, button, input, label') !== null

/**
 * Hero: a 2D city by the water. Night lights the windows; day turns them to
 * glass. Press and hold anywhere on the city (or the rain button) and a storm
 * rolls in: the water swells up through the streets in a curved, moving
 * surface, then drains away when you let go.
 */
export function Hero() {
  const heroRef = useRef<HTMLElement>(null)
  const { raining, startRain, stopRain } = useRainFlood(heroRef)
  usePointerParallax(heroRef)

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || isControl(event.target)) return
    event.currentTarget.setPointerCapture(event.pointerId)
    startRain()
  }

  // Keyboard and assistive tech "click" without a pointer (detail 0): toggle
  // the rain instead, since they cannot press and hold.
  const onToggle = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) return
    if (raining) stopRain()
    else startRain()
  }

  return (
    <section
      ref={heroRef}
      className={`hero ${raining ? 'is-raining' : ''}`}
      aria-labelledby="hero-title"
      onPointerDown={onPointerDown}
      onPointerUp={stopRain}
      onPointerCancel={stopRain}
      onLostPointerCapture={stopRain}
    >
      <CityScene live boat rain={raining ? 1 : 0} className="hero-city" />
      <span className="hero-shade" aria-hidden="true" />

      <div className="hero-content">
        <p className="hero-eyebrow">
          <span className="hero-eyebrow-dot" aria-hidden="true" />
          EvoHacks II · Projects for Social Good
        </p>
        <h1 id="hero-title" className="hero-title">
          <SplitText parts={TITLE} play delay={250} />
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

      <button
        type="button"
        className="rain-button"
        aria-pressed={raining}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          startRain()
        }}
        onPointerUp={stopRain}
        onPointerCancel={stopRain}
        onClick={onToggle}
        onBlur={stopRain}
        aria-label="Make it rain"
      >
        <span className="rain-meter" aria-hidden="true">
          <span className="rain-meter-fill" />
        </span>
        <Icon name="drop" size={18} />
        <span className="rain-button-text">
          {raining ? 'Raining…' : 'Hold to make it rain'}
        </span>
      </button>

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
