import { Button } from '@astryxdesign/core/Button'
import { RouterLink } from '../common/RouterLink'

export function NotFoundPage() {
  return (
    <section className="placeholder-page" aria-labelledby="not-found-title">
      <div className="placeholder-card glass-panel">
        <p className="placeholder-code">404</p>
        <h1 id="not-found-title">This page washed away</h1>
        <p>The address you followed does not exist.</p>
        <Button label="Go home" variant="primary" href="/" as={RouterLink} />
      </div>
    </section>
  )
}
