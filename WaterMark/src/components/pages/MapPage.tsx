import { Button } from '@astryxdesign/core/Button'
import { Icon } from '../common/Icon'
import { RouterLink } from '../common/RouterLink'

/**
 * Route reserved for the interactive map. Ryan Lin owns the map page
 * (README Section 10); replace this component with his when it merges.
 */
export function MapPage() {
  return (
    <section className="placeholder-page" aria-labelledby="map-title">
      <div className="placeholder-card glass-panel">
        <span className="placeholder-icon">
          <Icon name="map" size={28} />
        </span>
        <h1 id="map-title">The map is on its way</h1>
        <p>
          The interactive 2D flood map is being built on its own branch and will live at this address. Until it merges,
          the landing page shows what it will do and which data it uses.
        </p>
        <Button label="Back to the overview" variant="secondary" href="/" as={RouterLink} />
      </div>
    </section>
  )
}
