import { useEffect, useRef } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { useTheme } from '../hooks/useTheme.ts'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.ts'
import { mountWaterScene } from '../scripting/waterScene.ts'
import '../styling/hero.css'

const PLACES = ['Coney Island', 'The Rockaways', 'Red Hook']

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { mode } = useTheme()
  const reduced = usePrefersReducedMotion()
  const modeRef = useRef(mode)
  const reducedRef = useRef(reduced)

  useEffect(() => {
    modeRef.current = mode
    reducedRef.current = reduced
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const section = sectionRef.current
    if (!canvas || !section) return
    const scene = mountWaterScene(canvas, {
      getLight: () => (modeRef.current === 'light' ? 1 : 0),
      getReducedMotion: () => reducedRef.current,
      eventTarget: section,
    })
    if (!scene) {
      section.classList.add('is-fallback')
      return () => section.classList.remove('is-fallback')
    }
    const onLost = () => section.classList.add('is-fallback')
    canvas.addEventListener('watermark-water-lost', onLost)
    return () => {
      canvas.removeEventListener('watermark-water-lost', onLost)
      scene.destroy()
      section.classList.remove('is-fallback')
    }
  }, [])

  return (
    <section className="hero" aria-labelledby="hero-title" ref={sectionRef}>
      <div className="hero__wash" aria-hidden="true" />
      <canvas ref={canvasRef} className="hero__canvas" aria-hidden="true" />
      <div className="hero__scrim" aria-hidden="true" />
      <div className="hero__copy">
        <p className="eyebrow">EvoHacks II · Projects for Social Good</p>
        <Heading
          id="hero-title"
          level={1}
          className="hero__title"
          style={{ fontSize: 'clamp(2.6rem, 6.2vw, 5.1rem)', lineHeight: 0.96, letterSpacing: '-0.03em', color: '#f7fffc', fontWeight: 500 }}
        >
          <span className="hero__line"><span>Read the flood</span></span>
          <span className="hero__line"><span>evidence for</span></span>
          <span className="hero__line"><span>the block you</span></span>
          <span className="hero__line"><span>care about.</span></span>
        </Heading>
        <div className="hero__rest">
        <p className="hero__sub">
          WaterMark is a 2D map for official warnings, rainfall forecasts, mapped exposure, and historical
          records. It is being built for residents, schools, CERT volunteers, and community responders, with
          coastal neighborhoods such as Coney Island, the Rockaways, and Red Hook in mind, where many people
          do not carry flood insurance and the useful data is scattered.
        </p>
        <ul className="hero__places" aria-label="Neighborhoods that shaped the project">
          {PLACES.map((place) => (
            <li key={place}>{place}</li>
          ))}
        </ul>
        <Text className="hero__note" as="p" type="supporting" color="secondary">
          Motivation for the project, not a live statistic. Unknown is never shown as low risk.
        </Text>
        <HStack gap={2} wrap="wrap" className="hero__actions lift">
          <Button label="Open the map" variant="primary" size="lg" href="/app" />
          <Button label="See what it shows" variant="secondary" size="lg" href="#features" />
        </HStack>
        </div>
      </div>
    </section>
  )
}
