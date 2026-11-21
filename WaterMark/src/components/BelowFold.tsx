import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { Bibliography } from './Bibliography.tsx'
import { ClosingCta } from './ClosingCta.tsx'
import { EvidenceKinds } from './EvidenceKinds.tsx'
import { FeatureSection } from './FeatureSection.tsx'
import { HowItWorks } from './HowItWorks.tsx'
import { ParallaxCoast } from './ParallaxCoast.tsx'

export function BelowFold() {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])

  return (
    <>
      <ParallaxCoast />
      <HowItWorks />
      <EvidenceKinds />
      <FeatureSection />
      <Bibliography />
      <ClosingCta />
    </>
  )
}
