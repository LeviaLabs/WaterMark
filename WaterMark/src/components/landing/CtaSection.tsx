import { Button } from '@astryxdesign/core/Button'
import { Icon } from '../common/Icon'
import { Reveal } from '../common/Reveal'
import { RollText } from '../common/RollText'
import { RouterLink } from '../common/RouterLink'
import { SplitText } from '../common/SplitText'

const TITLE = ['Start with your own block.'] as const

export function CtaSection() {
  return (
    <section className="cta section" aria-labelledby="cta-title">
      <Reveal className="cta-panel glass-panel">
        <span className="cta-rings" aria-hidden="true" />
        <h2 id="cta-title" className="section-title">
          <SplitText parts={TITLE} />
        </h2>
        <p className="section-lede">Search a city, ZIP code or coordinates. No account needed to explore.</p>
        <div className="cta-actions">
          <Button
            label="Open the map"
            variant="primary"
            size="lg"
            href="/map"
            as={RouterLink}
            endContent={<Icon name="map" size={18} />}
          >
            <RollText text="Open the map" />
          </Button>
          <Button label="Create a free account" variant="secondary" size="lg" href="/signup" as={RouterLink}>
            <RollText text="Create a free account" />
          </Button>
        </div>
      </Reveal>
    </section>
  )
}
