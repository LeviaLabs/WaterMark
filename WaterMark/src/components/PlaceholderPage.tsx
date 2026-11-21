import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { SiteFrame } from './SiteFrame.tsx'
import '../styling/placeholder.css'

type PlaceholderPageProps = {
  title: string
  owner: string
  body: string
  showMapFrame?: boolean
}

export function PlaceholderPage({ title, owner, body, showMapFrame = false }: PlaceholderPageProps) {
  usePageTitle(`${title} — WaterMark`)

  return (
    <SiteFrame>
      <article className="placeholder">
        <p className="eyebrow">Placeholder</p>
        <Heading level={1} textWrap="balance">
          {title}
        </Heading>
        <Text as="p" color="secondary">
          {body}
        </Text>
        <Text as="p" type="supporting" color="secondary">
          Owned by {owner}. Exploring flood information stays available without an account.
        </Text>
        {showMapFrame ? (
          <div className="map-frame" role="img" aria-label="Empty map frame. No live flood layers are loaded on this placeholder.">
            No live layers loaded
          </div>
        ) : null}
        <div className="placeholder__actions">
          <Button label="Back to the landing page" href="/" variant="secondary" />
          <Button label="Open the map placeholder" href="/app" variant="primary" />
        </div>
      </article>
    </SiteFrame>
  )
}
