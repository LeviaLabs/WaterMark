import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { Bibliography } from './Bibliography.tsx'
import { EvidenceKinds } from './EvidenceKinds.tsx'
import { FeatureSection } from './FeatureSection.tsx'
import { ParallaxCoast } from './ParallaxCoast.tsx'
import { WaveRule } from './WaveRule.tsx'

export function BelowFold() {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])

  return (
    <>
      <WaveRule />
      <ParallaxCoast />
      <WaveRule />
      <EvidenceKinds />
      <WaveRule />
      <FeatureSection />
      <WaveRule />
      <Bibliography />
    </>
  )
}
