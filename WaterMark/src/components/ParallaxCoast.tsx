import { useEffect, useRef } from 'react'
import { Heading } from '@astryxdesign/core/Heading'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.ts'
import '../styling/story.css'

const STEPS = [
  {
    kicker: '01 · Select',
    title: 'Pick a circle on the map.',
    body: 'The drawing shows a neighborhood, not a measurement. On the real map, a circle is just the area you asked about.',
  },
  {
    kicker: '02 · Moderate rain, illustrated',
    title: 'The tide in this picture climbs the boardwalk.',
    body: 'A moderate-rain scenario would name its source, its inches, and the hours it covers. This rise is only the illustration moving.',
  },
  {
    kicker: '03 · Extreme rain, illustrated',
    title: 'The street goes under in the drawing.',
    body: 'An extreme scenario is still a model of exposure, not a statement that this block is flooding now.',
  },
  {
    kicker: '04 · Act on evidence',
    title: 'Then read what is actually known.',
    body: 'Warnings, forecasts, maps, and history stay separate. WaterMark does not issue an order. Follow official guidance.',
  },
]

export function ParallaxCoast() {
  const sectionRef = useRef<HTMLElement>(null)
  const skyRef = useRef<HTMLDivElement>(null)
  const cloudRef = useRef<HTMLDivElement>(null)
  const farRef = useRef<HTMLDivElement>(null)
  const midRef = useRef<HTMLDivElement>(null)
  const nearRef = useRef<HTMLDivElement>(null)
  const waterRef = useRef<HTMLDivElement>(null)
  const kickerRef = useRef<HTMLParagraphElement>(null)
  const titleRef = useRef<HTMLParagraphElement>(null)
  const bodyRef = useRef<HTMLParagraphElement>(null)
  const meterRef = useRef<HTMLSpanElement>(null)
  const dotsRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    let frame = 0
    let visible = false
    const pointer = { x: 0.5, y: 0.5 }
    let step = -1

    const paint = () => {
      const rect = section.getBoundingClientRect()
      const span = Math.max(1, rect.height - window.innerHeight)
      const progress = reduced ? 0.42 : Math.min(1, Math.max(0, -rect.top / span))
      const px = reduced ? 0 : (pointer.x - 0.5) * 70
      const py = reduced ? 0 : (pointer.y - 0.5) * 24
      if (skyRef.current) skyRef.current.style.transform = `translate3d(${(px * 0.08).toFixed(1)}px, ${(progress * -30 + py * 0.1).toFixed(1)}px, 0)`
      if (cloudRef.current) cloudRef.current.style.transform = `translate3d(${(px * 0.22).toFixed(1)}px, ${(progress * -70).toFixed(1)}px, 0)`
      if (farRef.current) farRef.current.style.transform = `translate3d(${(px * 0.45).toFixed(1)}px, ${(40 + progress * -220).toFixed(1)}px, 0)`
      if (midRef.current) midRef.current.style.transform = `translate3d(${(px * 0.9).toFixed(1)}px, ${(90 + progress * -420).toFixed(1)}px, 0)`
      if (nearRef.current) nearRef.current.style.transform = `translate3d(${(px * 1.45).toFixed(1)}px, ${(150 + progress * -640).toFixed(1)}px, 0)`
      if (waterRef.current) waterRef.current.style.height = `${(16 + progress * 62).toFixed(1)}%`
      if (meterRef.current) meterRef.current.style.transform = `scaleX(${progress.toFixed(3)})`
      const next = progress < 0.25 ? 0 : progress < 0.5 ? 1 : progress < 0.75 ? 2 : 3
      if (next !== step) {
        step = next
        const item = STEPS[next]
        if (kickerRef.current) kickerRef.current.textContent = item.kicker
        if (titleRef.current) titleRef.current.textContent = item.title
        if (bodyRef.current) bodyRef.current.textContent = item.body
        dotsRef.current?.querySelectorAll('span').forEach((dot, index) => {
          dot.classList.toggle('is-on', index <= next)
        })
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

    const onScroll = () => requestPaint()
    const onPointer = (event: PointerEvent) => {
      pointer.x = event.clientX / Math.max(window.innerWidth, 1)
      pointer.y = event.clientY / Math.max(window.innerHeight, 1)
      requestPaint()
    }
    const onVisibility = () => {
      if (!document.hidden) requestPaint()
    }

    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting)
      section.classList.toggle('is-paused', !visible || document.hidden)
      if (visible) requestPaint()
    })

    observer.observe(section)
    paint()
    window.addEventListener('scroll', onScroll, { passive: true })
    section.addEventListener('pointermove', onPointer, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
      section.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reduced])

  return (
    <section id="idea" className="pin" ref={sectionRef} aria-labelledby="idea-title">
      <div className="pin__sticky">
        <div className="pin__sky" ref={skyRef} aria-hidden="true" />
        <div className="pin__clouds" ref={cloudRef} aria-hidden="true" />
        <div className="pin__layer pin__far" ref={farRef} aria-hidden="true">
          <svg viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax meet">
            <path d="M0 250 H80 V190 H130 V150 H170 V190 H230 V120 H270 V80 H310 V120 H360 V200 H440 V140 H500 V90 H540 V40 H590 V90 H640 V170 H740 V110 H800 V70 H850 V130 H930 V180 H1020 V100 H1080 V60 H1140 V140 H1240 V190 H1320 V150 H1440 V420 H0 Z" />
          </svg>
        </div>
        <div className="pin__layer pin__mid" ref={midRef} aria-hidden="true">
          <svg viewBox="0 0 1440 520" preserveAspectRatio="xMidYMax meet">
            <path className="pin__boardwalk" d="M0 300 H1440 V340 H0 Z" />
            <path d="M40 300 V210 H110 V250 H170 V180 H230 V300 H300 V150 H360 V110 H410 V150 H470 V230 H540 V170 H620 V90 H680 V170 H760 V300 H840 V200 H920 V140 H980 V200 H1060 V250 H1140 V180 H1220 V240 H1300 V160 H1380 V300 Z" />
            <path d="M860 300 V360 H1120 V300 Z" />
            <path d="M930 360 V470 H980 V360 Z" />
            <circle cx="210" cy="168" r="28" />
          </svg>
        </div>
        <div className="pin__layer pin__near" ref={nearRef} aria-hidden="true">
          <svg viewBox="0 0 1440 360" preserveAspectRatio="xMidYMax meet">
            <path d="M0 150 H1440 V190 H0 Z" />
            <path d="M80 150 V40 H96 V150 Z M200 150 V20 H216 V150 Z M340 150 V55 H356 V150 Z M500 150 V10 H516 V150 Z M680 150 V48 H696 V150 Z M860 150 V25 H876 V150 Z M1040 150 V60 H1056 V150 Z M1220 150 V15 H1236 V150 Z M1360 150 V70 H1376 V150 Z" />
            <path d="M1180 190 V300 H1280 V190 Z" />
            <path d="M1220 190 V120 H1240 V190 Z" />
          </svg>
        </div>
        <div className="pin__water" ref={waterRef} aria-hidden="true">
          <svg className="pin__wave" viewBox="0 0 1440 80" preserveAspectRatio="none">
            <path d="M0 40 Q 90 8 180 40 T 360 40 T 540 40 T 720 40 T 900 40 T 1080 40 T 1260 40 T 1440 40 V80 H0 Z" />
          </svg>
        </div>
        <div className="pin__copy">
          <p className="eyebrow">Scroll the tide</p>
          <Heading id="idea-title" level={2} textWrap="balance">
            Five layers. One rising shoreline.
          </Heading>
          <p className="pin__kicker" ref={kickerRef}>
            {STEPS[0].kicker}
          </p>
          <p className="pin__step-title" ref={titleRef}>
            {STEPS[0].title}
          </p>
          <p className="pin__step-body" ref={bodyRef}>
            {STEPS[0].body}
          </p>
          <div className="pin__meter" aria-hidden="true">
            <span ref={meterRef} />
          </div>
          <div className="pin__dots" ref={dotsRef} aria-hidden="true">
            <span className="is-on" />
            <span />
            <span />
            <span />
          </div>
          <p className="pin__fine">Illustration of the idea. Not a rainfall total, not a warning, and not a depth.</p>
        </div>
      </div>
    </section>
  )
}
