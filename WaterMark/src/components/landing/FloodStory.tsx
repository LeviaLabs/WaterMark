import { useEffect, useLayoutEffect, useRef, useState, type AnimationEvent, type CSSProperties } from 'react'
import { useInView } from '../../hooks/useInView'
import { useScrollProgress } from '../../hooks/useScrollProgress'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { STATUS_LABELS, STORY_STEPS, activeStepIndex, type StoryStep } from '../../scripting/content/featureStory'
import { PRIORITY_LABELS } from '../../scripting/content/features'
import { CityScene } from '../city/CityScene'
import { EvidenceTag } from '../common/EvidenceTag'
import { Reveal } from '../common/Reveal'
import { ScrollArea } from '../common/ScrollArea'
import { SplitText } from '../common/SplitText'
import { FeaturePreview } from './FeaturePreview'

/** Rain over the city at each step: the storm builds, peaks, then eases. */
const STEP_RAIN = [0.15, 0.35, 0.9, 0.7, 0.45, 0.25, 0.1, 0]

const INTRO_TITLE = ['Watch the water rise.', '\n', { text: 'See what we know.', accent: true }] as const

function StepCopy({ step, index }: { step: StoryStep; index: number }) {
  return (
    <>
      <p className="story-count">
        <span>{String(index + 1).padStart(2, '0')}</span> / {String(STORY_STEPS.length).padStart(2, '0')} · {step.eyebrow}
      </p>
      <h3 className="story-title">
        <SplitText parts={[step.title]} play />
      </h3>
      <p className="story-body">{step.body}</p>
      <p className="story-meta">
        <span className={`priority priority--${step.priority.toLowerCase()}`}>{PRIORITY_LABELS[step.priority]}</span>
        <span className={`build-status build-status--${step.status}`} title={step.statusNote}>
          {STATUS_LABELS[step.status]}
        </span>
        {step.kinds.map((kind) => (
          <EvidenceTag key={kind} kind={kind} />
        ))}
      </p>
      <p className="story-owner">
        {step.owners} · <span>{step.statusNote}</span>
      </p>
    </>
  )
}

/** One step in the phone / short-screen layout; raises the water when it reaches mid-screen. */
function CompactStep({ step, index, onActive }: { step: StoryStep; index: number; onActive: (index: number) => void }) {
  const ref = useRef<HTMLLIElement>(null)
  const centered = useInView(ref, { rootMargin: '-45% 0px -45% 0px' })
  useEffect(() => {
    if (centered) onActive(index)
  }, [centered, index, onActive])

  return (
    <li ref={ref} className={`story-item ${centered ? 'is-current' : ''}`}>
      <Reveal className="story-copy story-copy--card">
        <StepCopy step={step} index={index} />
      </Reveal>
      <Reveal className="story-panel" delay={120}>
        <FeaturePreview id={step.id} />
      </Reveal>
    </li>
  )
}

/**
 * "How it works": the water climbs with the scroll, continuously, and each
 * step brings up one feature of the app as a working panel. Scroll position is
 * the single source of truth: useScrollProgress writes --progress on the
 * section and story.css maps it to the water level, so the city floods
 * smoothly between steps instead of jumping. The step buttons scroll to their
 * step.
 *
 * On phones and short windows (a desktop zoomed far in) one sticky screen
 * cannot hold a step and its panel, so the city becomes a sticky backdrop and
 * the steps scroll over it; the water still follows the scroll.
 */
export function FloodStory() {
  const compact = useMediaQuery('(max-width: 860px), (max-height: 600px)')
  return compact ? <CompactStory /> : <StickyStory />
}

function CompactStory() {
  const sectionRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  // Writes --progress on the section; story.css turns it into the water level.
  useScrollProgress(sectionRef)
  return (
    <section ref={sectionRef} className="story story--compact" aria-labelledby="story-title">
      <div className="story-backdrop" aria-hidden="true">
        <CityScene rain={STEP_RAIN[active] ?? 0} boat className="story-city" />
        <span className="story-scrim" />
      </div>
      <Reveal className="story-intro story-intro--compact">
        <p className="section-eyebrow">How it works</p>
        <h2 id="story-title" className="story-heading">
          <SplitText parts={INTRO_TITLE} />
        </h2>
      </Reveal>
      <ol className="story-list">
        {STORY_STEPS.map((item, index) => (
          <CompactStep key={item.id} step={item} index={index} onActive={setActive} />
        ))}
      </ol>
    </section>
  )
}

type StepView = {
  /** The step on screen. */
  active: number
  /** The step animating away, until its exit animation ends. */
  leaving: number | null
  /** 1 when scrolling down (new step rises from below), -1 when scrolling up. */
  dir: 1 | -1
}

function StickyStory() {
  const sectionRef = useRef<HTMLElement>(null)
  const stepsRef = useRef<HTMLOListElement>(null)
  const pillRef = useRef<HTMLLIElement>(null)
  const enteringRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<StepView>({ active: 0, leaving: null, dir: 1 })
  const [frameHeight, setFrameHeight] = useState(0)

  useScrollProgress(sectionRef, (progress) => {
    const next = activeStepIndex(progress)
    setView((current) =>
      next === current.active
        ? current
        : { active: next, leaving: current.active, dir: next > current.active ? 1 : -1 },
    )
  })

  // Slide the highlight pill under the current step button.
  useLayoutEffect(() => {
    const list = stepsRef.current
    const pill = pillRef.current
    const button = list?.querySelectorAll<HTMLElement>('.story-step')[view.active]
    // Keys keep each step's element alive while it leaves, so nothing replays.
    if (!list || !pill || !button) return
    pill.style.transform = `translateX(${button.offsetLeft}px)`
    pill.style.width = `${button.offsetWidth}px`
  }, [view.active])

  // The frame follows the height of the panel coming in (and of its skeleton while it loads).
  useEffect(() => {
    const panel = enteringRef.current
    if (!panel) return
    const observer = new ResizeObserver(([entry]) => setFrameHeight(Math.ceil(entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height)))
    observer.observe(panel)
    return () => observer.disconnect()
  }, [view.active])

  const focusStep = (index: number) => {
    const section = sectionRef.current
    if (!section) return
    const travel = section.offsetHeight - window.innerHeight
    const top = section.getBoundingClientRect().top + window.scrollY + (travel * (index + 0.5)) / STORY_STEPS.length
    window.scrollTo({ top, behavior: 'smooth' })
  }

  const clearLeaving = (event: AnimationEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) setView((current) => ({ ...current, leaving: null }))
  }

  const { active, leaving, dir } = view
  const step = STORY_STEPS[active]
  const leavingStep = leaving === null ? null : STORY_STEPS[leaving]

  return (
    <section
      ref={sectionRef}
      className="story"
      aria-labelledby="story-title"
      style={{ '--steps': STORY_STEPS.length, '--dir': dir } as CSSProperties}
    >
      <div className="story-sticky">
        <CityScene rain={STEP_RAIN[active] ?? 0} boat className="story-city" />
        <span className="story-scrim" aria-hidden="true" />

        <div className="story-inner">
          <Reveal className="story-intro">
            <p className="section-eyebrow">How it works</p>
            <h2 id="story-title" className="story-heading">
              <SplitText parts={INTRO_TITLE} />
            </h2>
          </Reveal>

          <div className="story-stage story-stage--copy">
            {leavingStep && leaving !== null && (
              <div className="story-copy is-leaving" key={leavingStep.id} aria-hidden="true" inert onAnimationEnd={clearLeaving}>
                <StepCopy step={leavingStep} index={leaving} />
              </div>
            )}
            <div className="story-copy is-entering" key={step.id} aria-live="polite">
              <StepCopy step={step} index={active} />
            </div>
          </div>

          <div className="story-stage--panel">
            {/* One glass frame stays put and resizes to each panel (plus its 1px borders) while the contents cross over inside it. */}
            <div className="story-frame" style={frameHeight ? ({ '--frame-h': `${frameHeight + 2}px` } as CSSProperties) : undefined}>
              <span className="story-frame-sweep" key={`sweep-${step.id}`} aria-hidden="true" />
              <span className="story-frame-progress" aria-hidden="true" style={{ '--step': (active + 1) / STORY_STEPS.length } as CSSProperties} />
              <ScrollArea className="story-frame-scroll">
                <div className="story-stage">
                  {leavingStep && (
                    <div className="story-panel is-leaving" key={leavingStep.id} aria-hidden="true" inert>
                      <FeaturePreview id={leavingStep.id} />
                    </div>
                  )}
                  <div className="story-panel is-entering" key={step.id} ref={enteringRef}>
                    <FeaturePreview id={step.id} />
                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>

          <nav className="story-steps" aria-label="Features">
            <ol ref={stepsRef}>
              <li ref={pillRef} className="story-step-pill" aria-hidden="true" />
              {STORY_STEPS.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`story-step ${index === active ? 'is-active' : ''} ${index < active ? 'is-past' : ''}`}
                    aria-current={index === active ? 'step' : undefined}
                    onClick={() => focusStep(index)}
                  >
                    <span className="story-step-dot" aria-hidden="true" />
                    <span className="story-step-label">{item.eyebrow}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>
    </section>
  )
}
