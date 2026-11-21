import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { Hero } from '../hero/Hero'
import { CtaSection } from '../landing/CtaSection'
import { DataSection } from '../landing/DataSection'
import { EvidenceStack } from '../landing/EvidenceStack'
import { FeaturesSection } from '../landing/FeaturesSection'
import { MissionSection } from '../landing/MissionSection'
import { TeamSection } from '../landing/TeamSection'

export function LandingPage() {
  const { hash } = useLocation()

  // Arriving from another page with /#data etc.: React Router does not scroll
  // to hashes by itself, so do it once after the sections exist.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])

  return (
    <>
      <Hero />
      <MissionSection />
      <EvidenceStack />
      <DataSection />
      <FeaturesSection />
      <TeamSection />
      <CtaSection />
    </>
  )
}
