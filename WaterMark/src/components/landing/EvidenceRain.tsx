import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import { DATA_SOURCES, EVIDENCE_LABELS, EVIDENCE_RULES, type EvidenceKind } from '../../scripting/content/dataSources'
import { EvidenceTag } from '../common/EvidenceTag'
import { Icon, type IconName } from '../common/Icon'
import { RollText } from '../common/RollText'

const DROP_ICONS: Record<EvidenceKind, IconName> = {
  official: 'bell',
  forecast: 'drop',
  modeled: 'ripple',
  scenario: 'layers',
  observed: 'pin',
  historical: 'clock',
  reference: 'map',
}

/**
 * Where each drop falls. `x` is the share of the sky's width, `fall` the
 * seconds one pass takes, `phase` how far through its fall it starts (so the
 * drops are spread out from the first frame), and `rest` where it hangs when
 * motion is reduced.
 */
const LANES = [
  { x: 0.04, fall: 17, phase: 0.12, rest: 0.22 },
  { x: 0.62, fall: 21, phase: 0.58, rest: 0.6 },
  { x: 0.3, fall: 15, phase: 0.86, rest: 0.36 },
  { x: 0.92, fall: 19, phase: 0.32, rest: 0.72 },
  { x: 0.16, fall: 23, phase: 0.7, rest: 0.66 },
  { x: 0.78, fall: 16, phase: 0.04, rest: 0.3 },
  { x: 0.46, fall: 20, phase: 0.44, rest: 0.5 },
]

const DROP_PATH = 'M50 4C50 4 92 56 92 84a42 42 0 0 1-84 0C8 56 50 4 50 4Z'

/**
 * "Evidence, labeled": every kind of evidence WaterMark uses falls through the
 * section as a big colored raindrop. Hovering a drop holds it still. Pressing
 * one stops the rain, blurs the other drops and opens a glass card on what
 * that evidence is, what it is not, how WaterMark labels it and where it
 * comes from. Closing the card lets the rain fall again; drops that leave the
 * bottom come back in from the top.
 */
export function EvidenceRain() {
  const [open, setOpen] = useState<EvidenceKind | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (open) closeRef.current?.focus({ preventScroll: true })
  }, [open])

  const show = (kind: EvidenceKind, event: MouseEvent<HTMLButtonElement>) => {
    trigger.current = event.currentTarget
    setOpen(kind)
  }

  const close = () => {
    setOpen(null)
    trigger.current?.focus({ preventScroll: true })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      close()
    }
  }

  const rule = EVIDENCE_RULES.find((item) => item.kind === open)
  const sources = open ? DATA_SOURCES.filter((source) => source.kind === open) : []

  return (
    <div className={`rain-sky ${open ? 'is-open' : ''}`} onKeyDown={onKeyDown}>
      <span className="rain-streaks" aria-hidden="true" />
      <p className="rain-hint" aria-hidden={open !== null}>
        <Icon name="drop" size={14} /> Tap a drop to see what that evidence means
      </p>

      <ul className="rain-lanes" aria-label="Kinds of evidence">
        {EVIDENCE_RULES.map((item, index) => {
          const lane = LANES[index % LANES.length]
          const style = {
            '--x': lane.x,
            '--fall': `${lane.fall}s`,
            '--start': `${(-lane.phase * lane.fall).toFixed(2)}s`,
            '--rest': lane.rest,
            '--drop': `var(--kind-${item.kind})`,
          } as CSSProperties
          return (
            <li key={item.kind} className="rain-lane" style={style}>
              <button
                type="button"
                className={`rain-drop ${open === item.kind ? 'is-selected' : ''}`}
                aria-haspopup="dialog"
                aria-expanded={open === item.kind}
                onClick={(event) => show(item.kind, event)}
                tabIndex={open && open !== item.kind ? -1 : 0}
              >
                <span className="rain-drop-body">
                  <svg viewBox="0 0 100 130" aria-hidden="true">
                    <path className="rain-drop-shape" d={DROP_PATH} />
                    <ellipse className="rain-drop-shine" cx="30" cy="62" rx="6" ry="11" transform="rotate(22 30 62)" />
                  </svg>
                  <span className="rain-drop-icon">
                    <Icon name={DROP_ICONS[item.kind]} size={20} />
                  </span>
                  <span className="rain-drop-label">{EVIDENCE_LABELS[item.kind]}</span>
                </span>
              </button>
              <span className="rain-splash" aria-hidden="true" />
            </li>
          )
        })}
      </ul>

      <span className="rain-veil" aria-hidden="true" onClick={close} />

      {rule && (
        <div
          key={rule.kind}
          className="rain-card glass-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          style={{ '--drop': `var(--kind-${rule.kind})` } as CSSProperties}
        >
          <button ref={closeRef} type="button" className="rain-card-close" onClick={close} aria-label="Close">
            <Icon name="close" size={18} />
          </button>

          <header className="rain-card-head">
            <span className="rain-card-badge" aria-hidden="true">
              <svg viewBox="0 0 100 130">
                <path d={DROP_PATH} />
              </svg>
              <Icon name={DROP_ICONS[rule.kind]} size={22} />
            </span>
            <span>
              <p className="rain-card-eyebrow">Kind of evidence</p>
              <h3 id={titleId} className="rain-card-title">
                {EVIDENCE_LABELS[rule.kind]}
              </h3>
            </span>
          </header>

          <dl className="rain-card-facts">
            <div className="rain-fact" style={{ '--n': 0 } as CSSProperties}>
              <dt>What it is</dt>
              <dd>{rule.is}</dd>
            </div>
            <div className="rain-fact rain-fact--not" style={{ '--n': 1 } as CSSProperties}>
              <dt>What it is not</dt>
              <dd>{rule.isNot}</dd>
            </div>
            <div className="rain-fact" style={{ '--n': 2 } as CSSProperties}>
              <dt>How WaterMark shows it</dt>
              <dd>
                <EvidenceTag kind={rule.kind} /> {rule.shownAs}
              </dd>
            </div>
          </dl>

          <p className="rain-card-sources-title">Where it comes from</p>
          <ul className="rain-card-sources">
            {sources.map((source, index) => (
              <li key={source.url} style={{ '--n': index } as CSSProperties}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  <RollText text={source.name} />
                  <span className="rain-card-provider">{source.provider}</span>
                  <Icon name="external" size={13} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
