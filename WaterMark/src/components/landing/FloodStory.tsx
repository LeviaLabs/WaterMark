import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useInView } from '../../hooks/useInView'
import { useScrollProgress } from '../../hooks/useScrollProgress'
import { useMediaQuery, usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import { storyLevel } from '../../scripting/city/floodLevel'
import { STATUS_LABELS, STORY_STEPS, activeStepIndex, type StoryStep } from '../../scripting/content/featureStory'
import { PRIORITY_LABELS } from '../../scripting/content/features'
import { CityScene } from '../city/CityScene'
import { EvidenceTag } from '../common/EvidenceTag'
import { Reveal } from '../common/Reveal'
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
 * "How it works": the city floods one step at a time as you scroll, and each
 * step brings up one feature of the app as a working panel. Scroll position is
 * the single source of truth; the step buttons scroll to their step.
 *
 * On phones and short windows (a desktop zoomed far in) one sticky screen
 * cannot hold a step and its panel, so the city becomes a sticky backdrop and
 * the steps scroll over it; each step that reaches mid-screen raises the water.
 */
export function FloodStory() {
  const compact = useMediaQuery('(max-width: 860px), (max-height: 600px)')
  return compact ? <CompactStory /> : <StickyStory />
}

function CompactStory() {
  const [active, setActive] = useState(0)
  const level = storyLevel(active, STORY_STEPS.length, 0.08, 0.42)
  return (
    <section id="how" className="story story--compact" aria-labelledby="story-title">
      <div className="story-backdrop" aria-hidden="true">
        <CityScene level={level} rain={STEP_RAIN[active] ?? 0} boat className="story-city" />
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

function StickyStory() {
  const sectionRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const reducedMotion = usePrefersReducedMotion()

  useScrollProgress(sectionRef, (progress) => setActive(activeStepIndex(progress)))

  const focusStep = (index: number) => {
    const section = sectionRef.current
    if (!section) return
    const travel = section.offsetHeight - window.innerHeight
    const top = section.getBoundingClientRect().top + window.scrollY + (travel * (index + 0.5)) / STORY_STEPS.length
    window.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  const step = STORY_STEPS[active]
  const level = storyLevel(active, STORY_STEPS.length, 0.1, 0.46)

  return (
    <section
      id="how"
      ref={sectionRef}
      className="story"
      aria-labelledby="story-title"
      style={{ '--steps': STORY_STEPS.length } as CSSProperties}
    >
      <div className="story-sticky">
        <CityScene level={level} rain={STEP_RAIN[active] ?? 0} boat className="story-city" />
        <span className="story-scrim" aria-hidden="true" />

        <div className="story-inner">
          <Reveal className="story-intro">
            <p className="section-eyebrow">How it works</p>
            <h2 id="story-title" className="story-heading">
              <SplitText parts={INTRO_TITLE} />
            </h2>
          </Reveal>

          <div className="story-copy" key={step.id} aria-live="polite">
            <StepCopy step={step} index={active} />
          </div>

          <div className="story-panel" key={`panel-${step.id}`}>
            <FeaturePreview id={step.id} />
          </div>

          <nav className="story-steps" aria-label="Features">
            <ol>
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

        <span className="story-gauge" aria-hidden="true" style={{ '--gauge': level.toFixed(3) } as CSSProperties}>
          <span className="story-gauge-fill" />
          {[0, 1, 2, 3, 4].map((tick) => (
            <span key={tick} className="story-gauge-tick" style={{ '--t': tick } as CSSProperties} />
          ))}
        </span>
      </div>
    </section>
  )
}
