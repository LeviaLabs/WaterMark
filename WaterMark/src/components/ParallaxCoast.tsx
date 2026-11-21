import { useEffect, useRef } from 'react'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.ts'
import '../styling/story.css'

const READOUT = [
  { label: 'Official alerts', value: 'Not loaded' },
  { label: 'Rainfall forecast', value: 'Not loaded' },
  { label: 'Mapped exposure', value: 'Not loaded' },
  { label: 'Historical records', value: 'Not loaded' },
]

export function ParallaxCoast() {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const farRef = useRef<SVGGElement>(null)
  const midRef = useRef<SVGGElement>(null)
  const waterRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const section = sectionRef.current
    const stage = stageRef.current
    if (!section || !stage) return

    let frame = 0
    let visible = true
    const pointer = { x: 0.68, y: 0.46 }
    const current = { x: 0.68, y: 0.46 }
    let scrollP = 0.35

    const measureScroll = () => {
      const rect = section.getBoundingClientRect()
      const total = rect.height + window.innerHeight
      const passed = window.innerHeight - rect.top
      scrollP = Math.min(1, Math.max(0, passed / total))
    }

    const paint = () => {
      if (reduced) {
        current.x = 0.62
        current.y = 0.48
      } else {
        current.x += (pointer.x - current.x) * 0.18
        current.y += (pointer.y - current.y) * 0.18
      }
      const drift = reduced ? 0 : (current.x - 0.5) * 6
      const rise = reduced ? 36 : 18 + scrollP * 26
      farRef.current?.style.setProperty('transform', `translate3d(${(drift * 0.4).toFixed(2)}%, 0, 0)`)
      midRef.current?.style.setProperty('transform', `translate3d(${(drift * 0.9).toFixed(2)}%, 0, 0)`)
      if (waterRef.current) waterRef.current.style.transform = `translate3d(0, ${(42 - rise).toFixed(2)}%, 0)`
      if (ringRef.current) {
        ringRef.current.style.left = `${(current.x * 100).toFixed(2)}%`
        ringRef.current.style.top = `${(current.y * 100).toFixed(2)}%`
        ringRef.current.style.transform = 'translate(-50%, -50%)'
      }
      const settled = Math.abs(pointer.x - current.x) + Math.abs(pointer.y - current.y) < 0.004
      if (!reduced && visible && !document.hidden && !settled) {
        frame = requestAnimationFrame(paint)
      } else {
        frame = 0
      }
    }

    const requestPaint = () => {
      if (!visible || document.hidden) return
      if (frame !== 0) return
      frame = requestAnimationFrame(() => {
        frame = 0
        paint()
      })
    }

    const onPointer = (event: PointerEvent) => {
      if (reduced) return
      const rect = stage.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      pointer.x = Math.min(0.84, Math.max(0.16, (event.clientX - rect.left) / rect.width))
      pointer.y = Math.min(0.72, Math.max(0.18, (event.clientY - rect.top) / rect.height))
      requestPaint()
    }

    const onScroll = () => {
      measureScroll()
      requestPaint()
    }

    const onVisibility = () => {
      if (!document.hidden) requestPaint()
    }

    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting)
      if (visible) requestPaint()
    })

    measureScroll()
    requestPaint()
    observer.observe(section)
    stage.addEventListener('pointermove', onPointer, { passive: true })
    stage.addEventListener('pointerdown', onPointer, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      observer.disconnect()
      stage.removeEventListener('pointermove', onPointer)
      stage.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reduced])

  return (
    <section id="idea" aria-labelledby="idea-title" ref={sectionRef} className="band">
      <div className="idea">
        <div className="idea__copy">
          <p className="eyebrow">How a place gets read</p>
          <Heading id="idea-title" level={2} textWrap="balance">
            Pick an area. Keep every source in its own column.
          </Heading>
          <Text as="p" color="secondary">
            The map is two-dimensional on purpose. You choose a circle, and WaterMark is being built to
            return the evidence that circle can actually support: alerts, a forecast with a valid time,
            mapped exposure, and history. Each one stays labeled. A missing value stays unknown.
          </Text>
          <dl className="readout">
            {READOUT.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          <Text as="p" type="supporting" color="secondary">
            Those four lines are empty on purpose. This picture does not query a provider.
          </Text>
        </div>
        <div className="idea__stage" ref={stageRef}>
          <div className="coast__sky" aria-hidden="true" />
          <svg className="coast__layer coast__far" viewBox="0 0 800 520" aria-hidden="true">
            <g ref={farRef}>
              <path d="M0 340 H70 V300 H120 V250 H150 V210 H190 V250 H230 V310 H300 V230 H340 V170 H370 V130 H400 V170 H430 V240 H500 V200 H540 V260 H600 V220 H650 V290 H720 V250 H770 V320 H800 V520 H0 Z" />
            </g>
          </svg>
          <svg className="coast__layer coast__mid" viewBox="0 0 800 520" aria-hidden="true">
            <g ref={midRef}>
              <path d="M0 390 H40 V330 H90 V360 H140 V300 H180 V250 H210 V300 H250 V345 H310 V280 H350 V230 H390 V280 H430 V350 H520 V300 H560 V250 H590 V220 H620 V250 H660 V330 H730 V290 H800 V520 H0 Z" />
              <path d="M470 360 H800 V390 H620 V410 H470 Z" />
              <path d="M500 390 V470 H530 V390 Z" />
            </g>
          </svg>
          <div className="coast__water" ref={waterRef} aria-hidden="true">
            <svg className="coast__wave" viewBox="0 0 800 40" preserveAspectRatio="none">
              <path d="M0 22 Q 50 4 100 22 T 200 22 T 300 22 T 400 22 T 500 22 T 600 22 T 700 22 T 800 22 V40 H0 Z" fill="currentColor" />
            </svg>
          </div>
          <div className="coast__ring" ref={ringRef} aria-hidden="true">
            Area
          </div>
          <p className="coast__caption">Illustration, not a live map</p>
        </div>
      </div>
    </section>
  )
}
