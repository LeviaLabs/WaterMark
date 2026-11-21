import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import '../styling/cta.css'

export function ClosingCta() {
  return (
    <section className="cta" aria-labelledby="cta-title">
      <div className="cta__inner">
        <p className="eyebrow">Open the map</p>
        <Heading id="cta-title" level={2} color="inherit" textWrap="balance">
          See the evidence for one place, with the limits still attached.
        </Heading>
        <Text as="p" color="inherit">
          The map page is where rainfall, alerts, and flood context will show up, each labeled. This landing page does not fetch them.
        </Text>
        <div className="lift cta__actions">
          <Button label="Open the map" variant="primary" size="lg" href="/app" />
          <Button label="Read the sources" variant="secondary" size="lg" href="/#sources" />
        </div>
      </div>
    </section>
  )
}
