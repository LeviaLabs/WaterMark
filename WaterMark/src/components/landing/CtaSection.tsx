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
        <p className="section-lede">
          Zoom into any block, scrub the flood timeline, ask the voice assistant, or review screened alerts. No account needed.
        </p>
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
          <Button
            label="Alert inbox"
            variant="secondary"
            size="lg"
            href="/alerts"
            as={RouterLink}
            endContent={<Icon name="mail" size={18} />}
          >
            <RollText text="Alert inbox" />
          </Button>
        </div>
      </Reveal>
    </section>
  )
}
