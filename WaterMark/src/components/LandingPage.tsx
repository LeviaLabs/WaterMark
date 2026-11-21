import { lazy, Suspense } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Text } from '@astryxdesign/core/Text'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { Hero } from './Hero.tsx'
import { SiteFrame } from './SiteFrame.tsx'

const BelowFold = lazy(() => import('./BelowFold.tsx').then((module) => ({ default: module.BelowFold })))

export function LandingPage() {
  usePageTitle('WaterMark — Flood and extreme-rainfall awareness')

  return (
    <SiteFrame>
      <Hero />
      <div className="band band--tight">
        <Banner
          status="warning"
          container="section"
          collapsible={false}
          title="Prototype, not an official warning"
          description="WaterMark does not issue alerts, evacuation orders, or a flood probability. If a source is missing, that is unknown, not a green light. Follow the National Weather Service and local emergency managers."
        />
      </div>
      <Suspense
        fallback={
          <section className="band" aria-busy="true">
            <Text as="p">Loading the rest of the page.</Text>
          </section>
        }
      >
        <BelowFold />
      </Suspense>
    </SiteFrame>
  )
}
