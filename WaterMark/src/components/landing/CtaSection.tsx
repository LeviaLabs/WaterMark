import { Button } from '@astryxdesign/core/Button'
import { Icon } from '../common/Icon'
import { Reveal } from '../common/Reveal'
import { RouterLink } from '../common/RouterLink'

export function CtaSection() {
  return (
    <section className="cta section" aria-labelledby="cta-title">
      <Reveal className="cta-panel glass-panel">
        <span className="cta-rings" aria-hidden="true" />
        <h2 id="cta-title" className="section-title">Start with your own block.</h2>
        <p className="section-lede">Search a city, ZIP code or coordinates. No account needed to explore.</p>
        <div className="cta-actions">
          <Button
            label="Open the map"
            variant="primary"
            size="lg"
            href="/map"
            as={RouterLink}
            endContent={<Icon name="map" size={18} />}
          />
          <Button label="Create a free account" variant="secondary" size="lg" href="/signup" as={RouterLink} />
        </div>
      </Reveal>
    </section>
  )
}
