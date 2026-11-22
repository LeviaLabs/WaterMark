// The Overlay button and the list it opens: one optional layer drawn on top of the flood squares.
// Only one overlay shows at a time (choosing another switches, choosing the same one turns it off),
// so the map never stacks colors. The list floats beside the button (above it on desktop, below it
// on phones) and scales in and out from the button's corner.
import { useId, type ReactNode } from 'react'
import { Icon } from '../common/Icon'
import { LayerSwitch } from './LayerSwitch'
import { usePresence } from '../../hooks/usePresence'
import type { GlobalFloodCollection, LayerId, LayerVisibility, Loadable } from '../../scripting/types'

// Swatch colors live in map-page.css (.layer-swatch--<id>) so they follow the theme tokens.
const LAYERS: { id: LayerId; label: string; where: string }[] = [
  { id: 'rain', label: 'Rain falling now', where: 'Worldwide · NASA satellite, a few hours old' },
  { id: 'floods', label: 'Floods happening now', where: 'Worldwide · GDACS, past 30 days' },
  { id: 'fema', label: 'Flood zones (insurance maps)', where: 'US · FEMA, zoom in to a town' },
  { id: 'storm', label: 'Heavy-rain flooding model', where: 'New York City · scenario, not today' },
  { id: 'sensors', label: 'Street flood sensors', where: 'New York City · FloodNet, zoom in' },
]

interface Props {
  layers: LayerVisibility
  onToggle: (id: LayerId, on: boolean) => void
  floods: Loadable<GlobalFloodCollection>
  stormNote: string | null
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  /** The flood-history legend, shown beside the button while the list is closed. */
  legend?: ReactNode
}

export function LayersCard({ layers, onToggle, floods, stormNote, isOpen, onOpenChange, legend }: Props) {
  const id = useId()
  const presence = usePresence(isOpen)
  const active = LAYERS.find((l) => layers[l.id]) ?? null

  let globalNote = 'Loading worldwide flood reports…'
  if (floods === 'error') globalNote = "Worldwide flood reports didn't load. GDACS may be busy; reload to try again."
  else if (floods) {
    const live = floods.features.filter((f) => f.properties.active).length
    globalNote = `GDACS lists ${live} active floods worldwide, ${floods.features.length} in the past 30 days.`
  }

  return (
    <div className="layers">
      {legend}
      <button type="button" className={isOpen ? 'map-card layers-toggle is-open' : 'map-card layers-toggle'}
        aria-expanded={isOpen} aria-controls={id} onClick={() => onOpenChange(!isOpen)}>
        <Icon name="layers" size={18} />
        <span className="layers-toggle-label">Overlay</span>
        <span className="layers-count">{active ? active.label : 'Off'}</span>
        <span className="layers-chev" aria-hidden="true" />
      </button>
      {presence.isMounted ? (
        <section id={id} aria-label="Map overlay" {...presence.bind}
          className={presence.isClosing ? 'map-card layers-panel is-closing' : 'map-card layers-panel'}>
          <p className="layers-intro">Add one layer on top of the flood squares. Pick another to switch, or the same one to turn it off.</p>
          <ul className="layers-list" role="radiogroup" aria-label="Overlay">
            {LAYERS.map((l) => (
              <li key={l.id}>
                <LayerSwitch label={l.label} detail={l.where} swatch={l.id} isOn={layers[l.id]} onChange={(on) => onToggle(l.id, on)} />
              </li>
            ))}
          </ul>
          {layers.rain ? (
            <div className="rain-scale" aria-hidden="true">
              <span className="rain-scale-bar" />
              <span className="rain-scale-ends"><span>Light rain</span><span>Heavy</span></span>
            </div>
          ) : null}
          {stormNote ? <p className="map-meta">{stormNote}</p> : null}
          <p className="map-meta">{globalNote}</p>
        </section>
      ) : null}
    </div>
  )
}
