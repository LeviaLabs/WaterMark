import {
  useEffect,
  useId,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { DATA_SOURCES, EVIDENCE_LABELS, EVIDENCE_RULES, type EvidenceKind } from '../../scripting/content/dataSources'
import { makeBubbles, makeSchool, newDepth, type FishShape } from '../../scripting/sea/school'
import { EvidenceTag } from '../common/EvidenceTag'
import { Icon, type IconName } from '../common/Icon'
import { RollText } from '../common/RollText'

const KIND_ICONS: Record<EvidenceKind, IconName> = {
  official: 'bell',
  forecast: 'drop',
  modeled: 'ripple',
  scenario: 'layers',
  observed: 'pin',
  historical: 'clock',
  reference: 'map',
}

const KINDS = EVIDENCE_RULES.map((rule) => rule.kind)

/** Fish drawn facing right in a -16 -24 140 118 box; the tail hinges at (TAIL_X, 35). */
const FISH: Record<FishShape, { body: string; tail: string; fins: string; stripes: string }> = {
  sleek: {
    body: 'M10 35C30 13 78 11 106 31C111 34 111 37 106 40C78 59 30 57 10 35Z',
    tail: 'M14 35L-12 15Q-4 35-12 55Z',
    fins: 'M50 16L64 4L70 18Z',
    stripes: 'M44 18Q38 35 44 53M60 15Q53 35 60 56',
  },
  round: {
    body: 'M14 35C14 6 96 2 106 35C96 68 14 64 14 35Z',
    tail: 'M18 35L-8 12Q0 35-8 58Z',
    fins: 'M46 9L60-6L72 8Z',
    stripes: 'M50 8Q42 35 50 62M68 6Q60 35 68 64',
  },
  tall: {
    body: 'M16 35C30 0 72-6 104 35C72 76 30 70 16 35Z',
    tail: 'M20 35L-6 16Q0 35-6 54Z',
    fins: 'M42 12L56-20L72 10ZM42 58L56 90L72 60Z',
    stripes: 'M46 10Q38 35 46 60M64 4Q56 35 64 66',
  },
}

const SEAWEED = [
  { x: 4, h: 1.1, delay: 0 },
  { x: 9, h: 0.75, delay: 1.2 },
  { x: 22, h: 0.9, delay: 0.5 },
  { x: 41, h: 0.6, delay: 1.8 },
  { x: 58, h: 1, delay: 0.9 },
  { x: 63, h: 0.7, delay: 2.2 },
  { x: 81, h: 1.15, delay: 0.3 },
  { x: 92, h: 0.8, delay: 1.5 },
]

type OpenCard = {
  kind: EvidenceKind
  /** Offset of the fish that opened the card from the section's center, in px. */
  from: { x: number; y: number }
  /** 1 after "next", -1 after "previous": which way the content slides. */
  dir: 1 | -1
}

/**
 * "Evidence, labeled" under the sea: right after the flooded city of "How it
 * works", the page sinks below the surface. Each kind of evidence WaterMark
 * uses is a fish of its own color, swimming across left to right or right to
 * left at its own depth and speed; a fish that leaves the screen comes back
 * at a new depth. Bubbles rise, light rays sway, seaweed waves.
 *
 * Hover a fish and it stops; click it (or focus it and press Enter) to open a
 * glass card that grows out of the fish: what that evidence is, what it is
 * not, how WaterMark labels it and its sources. The sea blurs and stops;
 * arrows step through the kinds; closing shrinks the card back into its fish.
 */
export function EvidenceSea({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const seaRef = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [school, setSchool] = useState(() => makeSchool(KINDS, Math.random))
  const [bubbles] = useState(() => makeBubbles(20, Math.random))
  const [open, setOpen] = useState<OpenCard | null>(null)
  const [closing, setClosing] = useState(false)
  const titleId = useId()

  useEffect(() => {
    if (open && !closing) closeRef.current?.focus({ preventScroll: true })
  }, [open, closing])

  const show = (kind: EvidenceKind, origin: HTMLElement) => {
    const sea = seaRef.current
    if (!sea) return
    const seaBox = sea.getBoundingClientRect()
    const box = origin.getBoundingClientRect()
    trigger.current = origin
    setClosing(false)
    setOpen({
      kind,
      dir: 1,
      from: {
        x: box.left + box.width / 2 - (seaBox.left + seaBox.width / 2),
        y: box.top + box.height / 2 - (seaBox.top + seaBox.height / 2),
      },
    })
  }

  const step = (by: 1 | -1) => {
    setOpen((current) => {
      if (!current) return current
      const index = (KINDS.indexOf(current.kind) + by + KINDS.length) % KINDS.length
      return { ...current, kind: KINDS[index], dir: by }
    })
  }

  const close = () => {
    if (open) setClosing(true)
  }

  const onCardAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !closing) return
    setOpen(null)
    setClosing(false)
    trigger.current?.focus({ preventScroll: true })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return
    if (event.key === 'Escape') {
      event.stopPropagation()
      close()
    } else if (event.key === 'ArrowRight') {
      step(1)
    } else if (event.key === 'ArrowLeft') {
      step(-1)
    }
  }

  // A fish that swam off screen comes back at a new depth.
  const resurface = (kind: EvidenceKind) => {
    setSchool((current) =>
      current.map((fish) => (fish.kind === kind ? { ...fish, y: newDepth(fish.y, current.length, Math.random) } : fish)),
    )
  }

  const rule = open ? EVIDENCE_RULES.find((item) => item.kind === open.kind) : undefined
  const sources = open ? DATA_SOURCES.filter((source) => source.kind === open.kind) : []
  const seaClass = ['sea', open ? 'is-open' : '', closing ? 'is-closing' : ''].join(' ')

  return (
    <div ref={seaRef} className={seaClass} onKeyDown={onKeyDown}>
      <span className="sea-surface" aria-hidden="true" />
      <span className="sea-rays" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>

      <span className="sea-schools" aria-hidden="true">
        {[0, 1].map((school) => (
          <span key={school} className={`sea-school sea-school--${school}`}>
            {Array.from({ length: 7 }, (_, i) => (
              <svg key={i} viewBox="0 0 24 12" style={{ '--n': i } as CSSProperties}>
                <path d="M4 6C8 1 17 1 21 6C17 11 8 11 4 6ZM4 6L0 2V10Z" />
              </svg>
            ))}
          </span>
        ))}
      </span>

      <ul className="sea-bubbles" aria-hidden="true">
        {bubbles.map((bubble, index) => (
          <li
            key={index}
            style={
              {
                '--x': bubble.x,
                '--rise': `${bubble.rise.toFixed(2)}s`,
                '--start': `${(-bubble.phase * bubble.rise).toFixed(2)}s`,
                '--bubble': `${bubble.size.toFixed(1)}px`,
                '--drift': `${bubble.drift.toFixed(0)}px`,
              } as CSSProperties
            }
          >
            <span />
          </li>
        ))}
      </ul>

      <ul className="sea-fish-lanes" aria-label="Kinds of evidence. Choose a fish to learn about it.">
        {school.map((fish) => {
          const shape = FISH[fish.shape]
          const selected = open?.kind === fish.kind
          return (
            <li
              key={fish.kind}
              className={`sea-lane ${fish.dir === 1 ? 'sea-lane--ltr' : 'sea-lane--rtl'} ${selected ? 'is-selected' : ''}`}
              style={
                {
                  '--y': fish.y.toFixed(3),
                  '--swim': `${fish.swim.toFixed(2)}s`,
                  '--start': `${(-fish.phase * fish.swim).toFixed(2)}s`,
                  '--size': fish.size.toFixed(3),
                  '--bob': `${fish.bob.toFixed(2)}s`,
                  '--fish': `var(--kind-${fish.kind})`,
                } as CSSProperties
              }
            >
              <button
                type="button"
                className="sea-fish"
                aria-haspopup="dialog"
                aria-label={`${EVIDENCE_LABELS[fish.kind]}: what this kind of evidence means`}
                onClick={(event) => show(fish.kind, event.currentTarget)}
                onAnimationIteration={(event) => {
                  if (event.animationName === 'fish-swim') resurface(fish.kind)
                }}
              >
                <span className="sea-fish-body">
                  <svg viewBox="-16 -24 140 118" aria-hidden="true">
                    <path className="sea-fish-tail" d={shape.tail} />
                    <path className="sea-fish-fin" d={shape.fins} />
                    <path className="sea-fish-shape" d={shape.body} />
                    <path className="sea-fish-stripes" d={shape.stripes} />
                    <path className="sea-fish-pectoral" d="M58 40Q66 52 54 54Z" />
                    <circle className="sea-fish-eye" cx="88" cy="30" r="6" />
                    <circle className="sea-fish-pupil" cx="90" cy="30" r="3" />
                  </svg>
                </span>
                <span className="sea-fish-tag" aria-hidden="true">
                  <Icon name={KIND_ICONS[fish.kind]} size={12} />
                  {EVIDENCE_LABELS[fish.kind]}
                  <span className="sea-fish-open">Open</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <span className="sea-bed" aria-hidden="true">
        {SEAWEED.map((weed) => (
          <svg
            key={weed.x}
            className="sea-weed"
            viewBox="0 0 40 200"
            preserveAspectRatio="xMidYMax meet"
            style={{ '--x': `${weed.x}%`, '--h': weed.h, '--delay': `${weed.delay}s` } as CSSProperties}
          >
            <path d="M20 200C8 160 32 130 18 96C6 64 30 40 20 4C26 40 40 66 26 98C14 130 34 162 24 200Z" />
          </svg>
        ))}
        <svg className="sea-sand" viewBox="0 0 1600 120" preserveAspectRatio="none">
          <path d="M0 60C160 30 300 76 470 52S760 24 930 50 1260 78 1420 46 1560 40 1600 48V120H0Z" />
        </svg>
      </span>

      <div className="sea-content">{children}</div>

      <div className="sea-footer">{footer}</div>

      <span className="sea-veil" aria-hidden="true" onClick={close} />

      {open && rule && (
        <div
          className={`sea-card glass-panel ${closing ? 'is-closing' : ''}`}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          data-lenis-prevent
          onAnimationEnd={onCardAnimationEnd}
          style={
            {
              '--fish': `var(--kind-${rule.kind})`,
              '--from-x': `${open.from.x.toFixed(0)}px`,
              '--from-y': `${open.from.y.toFixed(0)}px`,
              '--dir': open.dir,
            } as CSSProperties
          }
        >
          <span className="sea-card-wash" aria-hidden="true" />
          <div className="sea-card-bar">
            <span className="sea-card-count">
              {KINDS.indexOf(rule.kind) + 1} / {KINDS.length}
            </span>
            <button type="button" className="sea-card-nav" onClick={() => step(-1)} aria-label="Previous kind of evidence">
              <Icon name="arrowRight" size={16} className="sea-card-prev" />
            </button>
            <button type="button" className="sea-card-nav" onClick={() => step(1)} aria-label="Next kind of evidence">
              <Icon name="arrowRight" size={16} />
            </button>
            <button ref={closeRef} type="button" className="sea-card-close" onClick={close} aria-label="Close">
              <Icon name="close" size={18} />
            </button>
          </div>

          <div className="sea-card-body" key={rule.kind}>
            <header className="sea-card-head">
              <span className="sea-card-badge" aria-hidden="true">
                <svg viewBox="-16 -24 140 118">
                  <path d={FISH.round.tail} />
                  <path d={FISH.round.body} />
                  <circle cx="88" cy="30" r="6" className="sea-card-badge-eye" />
                </svg>
              </span>
              <span>
                <p className="sea-card-eyebrow">
                  <Icon name={KIND_ICONS[rule.kind]} size={13} /> Kind of evidence
                </p>
                <h3 id={titleId} className="sea-card-title">
                  {EVIDENCE_LABELS[rule.kind]}
                </h3>
              </span>
            </header>

            <dl className="sea-card-facts">
              <div className="sea-fact" style={{ '--n': 0 } as CSSProperties}>
                <dt>What it is</dt>
                <dd>{rule.is}</dd>
              </div>
              <div className="sea-fact sea-fact--not" style={{ '--n': 1 } as CSSProperties}>
                <dt>What it is not</dt>
                <dd>{rule.isNot}</dd>
              </div>
              <div className="sea-fact" style={{ '--n': 2 } as CSSProperties}>
                <dt>How WaterMark shows it</dt>
                <dd>
                  <EvidenceTag kind={rule.kind} /> {rule.shownAs}
                </dd>
              </div>
            </dl>

            <p className="sea-card-sources-title">Where it comes from</p>
            <ul className="sea-card-sources">
              {sources.map((source, index) => (
                <li key={source.url} style={{ '--n': index } as CSSProperties}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    <RollText text={source.name} />
                    <span className="sea-card-provider">{source.provider}</span>
                    <Icon name="external" size={13} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
