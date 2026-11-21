import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useScrollProgress } from '../../hooks/useScrollProgress'
import { usePointerTilt } from '../../hooks/usePointerTilt'
import { usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import { EVIDENCE_LAYERS, activeLayerIndex } from '../../scripting/content/evidenceLayers'
import { EvidenceTag } from '../common/EvidenceTag'
import { LayerArt } from './LayerArt'

/**
 * "How it works": a sticky 3D stack of map plates. Scrolling through the
 * section pulls the plates apart (parallax driven by the --progress CSS
 * variable) and walks through each layer; the mouse tilts the stack; choosing
 * a layer scrolls to it, so scroll position stays the single source of truth.
 */
export function EvidenceStack() {
  const sectionRef = useRef<HTMLElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const [active, setActive] = useState(0)
  const reducedMotion = usePrefersReducedMotion()

  useScrollProgress(sectionRef, (progress) => setActive(activeLayerIndex(progress)))
  usePointerTilt(sceneRef, 6)

  // On phones the layer chips scroll sideways; keep the active one in view.
  useEffect(() => {
    const list = listRef.current
    const item = list?.children[active] as HTMLElement | undefined
    if (!list || !item || list.scrollWidth <= list.clientWidth) return
    list.scrollTo({
      left: item.offsetLeft - (list.clientWidth - item.offsetWidth) / 2,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }, [active, reducedMotion])

  const focusLayer = (index: number) => {
    const section = sectionRef.current
    if (!section) return
    const travel = section.offsetHeight - window.innerHeight
    const sectionTop = section.getBoundingClientRect().top + window.scrollY
    const top = sectionTop + (travel * (index + 0.5)) / EVIDENCE_LAYERS.length
    window.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  const current = EVIDENCE_LAYERS[active]

  return (
    <section id="how" ref={sectionRef} className="stack" aria-labelledby="stack-title">
      <div className="stack-sticky">
        <span className="stack-orb stack-orb--one" aria-hidden="true" />
        <span className="stack-orb stack-orb--two" aria-hidden="true" />
        <span className="stack-orb stack-orb--three" aria-hidden="true" />

        <div className="stack-copy">
          <p className="section-eyebrow">How it works</p>
          <h2 id="stack-title" className="section-title">
            One place.
            <br />
            Six layers of evidence.
          </h2>
          <p className="section-lede">
            Pick a spot on the map and WaterMark stacks everything known about it, from today's warnings down to decades
            of history. Each layer keeps its own label, so a scenario never passes for a measurement.
          </p>

          <ol className="stack-list" ref={listRef}>
            {EVIDENCE_LAYERS.map((layer, index) => (
              <li key={layer.id}>
                <button
                  type="button"
                  className={`stack-list-item ${index === active ? 'is-active' : ''}`}
                  aria-current={index === active ? 'step' : undefined}
                  onClick={() => focusLayer(index)}
                >
                  <span className="stack-list-number">{String(index + 1).padStart(2, '0')}</span>
                  {layer.title}
                </button>
              </li>
            ))}
          </ol>

          <article className="stack-detail glass-panel" aria-live="polite">
            <header className="stack-detail-header">
              <h3>{current.title}</h3>
              <EvidenceTag kind={current.kind} />
            </header>
            <p>{current.summary}</p>
            <p className="stack-detail-source">Source: {current.sources}</p>
          </article>
        </div>

        <div className="stack-scene" ref={sceneRef}>
          <div className="stack-plates">
            {EVIDENCE_LAYERS.map((layer, index) => (
              <button
                type="button"
                key={layer.id}
                className={`stack-plate stack-plate--${layer.kind} ${index === active ? 'is-active' : ''}`}
                style={{ '--i': index } as CSSProperties}
                onClick={() => focusLayer(index)}
                tabIndex={-1}
                aria-hidden="true"
              >
                <LayerArt pattern={layer.pattern} />
                <span className="stack-plate-label">{layer.title}</span>
              </button>
            ))}
            <span className="stack-pin" aria-hidden="true">
              <span className="stack-pin-head" />
              <span className="stack-pin-line" />
            </span>
          </div>
        </div>

        <span className="stack-progress" aria-hidden="true">
          <span className="stack-progress-fill" />
        </span>
      </div>
    </section>
  )
}
