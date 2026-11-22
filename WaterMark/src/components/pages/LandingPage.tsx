import { useEffect } from 'react'
import { flushSync } from 'react-dom'
import { useLocation } from 'react-router'
import { chunk } from '../../scripting/lazy/chunk'
import { makeEager } from '../../scripting/lazy/eager'
import { LazySection } from '../common/LazySection'
import { Hero } from '../hero/Hero'
import { MissionSection } from '../landing/MissionSection'

// Everything below the first screen loads as the visitor scrolls to it.
const SECTIONS = {
  story: chunk(() => import('../landing/FloodStory').then((m) => <m.FloodStory />)),
  data: chunk(() => import('../landing/DataSection').then((m) => <m.DataSection />)),
  features: chunk(() => import('../landing/FeaturesSection').then((m) => <m.FeaturesSection />)),
  team: chunk(() => import('../landing/TeamSection').then((m) => <m.TeamSection />)),
  cta: chunk(() => import('../landing/CtaSection').then((m) => <m.CtaSection />)),
}

let sectionsLoaded = false
const loadAllSections = () =>
  Promise.all(Object.values(SECTIONS).map((load) => load())).then(() => {
    sectionsLoaded = true
  })

export function LandingPage() {
  const { hash } = useLocation()

  // Jumping to an anchor: mount every section first, so the ones above the
  // target have their real height and the jump lands where it should.
  // If some sections have not loaded yet, hold the click, load them, mount
  // everything, then replay the click so the smooth scroll lands exactly.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href*="#"]') : null
      if (!link) return
      if (sectionsLoaded) {
        flushSync(makeEager)
        return
      }
      event.preventDefault()
      event.stopImmediatePropagation()
      void loadAllSections().then(() => link.click())
    }
    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])

  // Arriving from another page with /#data etc.: React Router does not scroll
  // to hashes by itself, so mount everything and scroll once it exists.
  useEffect(() => {
    if (!hash) return
    let cancelled = false
    void loadAllSections().then(() => {
      if (cancelled) return
      flushSync(makeEager)
      document.getElementById(hash.slice(1))?.scrollIntoView()
    })
    return () => {
      cancelled = true
    }
  }, [hash])

  return (
    <>
      <Hero />
      <MissionSection />
      <LazySection id="how" minHeight="300svh" shape="stage" load={SECTIONS.story} />
      <LazySection id="data" minHeight="max(100svh, 46rem)" load={SECTIONS.data} />
      <LazySection id="audiences" minHeight="60rem" shape="cards" load={SECTIONS.features} />
      <LazySection id="team" minHeight="50rem" shape="cards" load={SECTIONS.team} />
      <LazySection minHeight="30rem" load={SECTIONS.cta} />
    </>
  )
}
