// The Layers button and the list it opens. The list floats beside the button (above it on
// desktop, below it on phones) and scales in and out from the button's corner.
import { useId } from 'react'
import { Icon } from '../common/Icon'
import { LayerSwitch } from './LayerSwitch'
import { usePresence } from '../../hooks/usePresence'
import type { GlobalFloodCollection, LayerId, LayerVisibility, Loadable } from '../../scripting/types'

// Swatch colors live in map-page.css (.layer-swatch--<id>) so they follow the theme tokens.
const LAYERS: { id: LayerId; label: string }[] = [
  { id: 'rain', label: 'Rain falling now (NASA)' },
  { id: 'floods', label: 'Floods worldwide (GDACS)' },
  { id: 'sensors', label: 'FloodNet sensors' },
  { id: 'storm', label: 'Heavy-rain flooding (NYC model)' },
  { id: 'fema', label: 'FEMA flood zones' },
]

interface Props {
  layers: LayerVisibility
  onToggle: (id: LayerId, on: boolean) => void
  floods: Loadable<GlobalFloodCollection>
  stormNote: string | null
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export function LayersCard({ layers, onToggle, floods, stormNote, isOpen, onOpenChange }: Props) {
  const id = useId()
  const presence = usePresence(isOpen)
  const shown = LAYERS.filter((l) => layers[l.id]).length

  let globalNote = 'Loading worldwide flood reports…'
  if (floods === 'error') globalNote = "Worldwide flood reports didn't load. GDACS may be busy; reload to try again."
  else if (floods) {
    const active = floods.features.filter((f) => f.properties.active).length
    globalNote = `${active} active floods worldwide, ${floods.features.length} in the past 30 days. Rain shows the newest NASA image, a few hours old.`
  }

  return (
    <div className="layers">
      <button type="button" className={isOpen ? 'map-card layers-toggle is-open' : 'map-card layers-toggle'}
        aria-expanded={isOpen} aria-controls={id} onClick={() => onOpenChange(!isOpen)}>
        <Icon name="layers" size={18} />
        <span className="layers-toggle-label">Layers</span>
        <span className="layers-count" aria-label={`${shown} of ${LAYERS.length} shown`}>{shown}/{LAYERS.length}</span>
        <span className="layers-chev" aria-hidden="true" />
      </button>
      {presence.isMounted ? (
        <section id={id} aria-label="Map layers" onAnimationEnd={presence.onAnimationEnd}
          className={presence.isClosing ? 'map-card layers-panel is-closing' : 'map-card layers-panel'}>
          <ul className="layers-list">
            {LAYERS.map((l) => (
              <li key={l.id}>
                <LayerSwitch label={l.label} swatch={l.id} isOn={layers[l.id]} onChange={(on) => onToggle(l.id, on)} />
              </li>
            ))}
          </ul>
          <div className="rain-scale" aria-hidden="true">
            <span className="rain-scale-bar" />
            <span className="rain-scale-ends"><span>Light rain</span><span>Heavy</span></span>
          </div>
          {stormNote ? <p className="map-meta">{stormNote}</p> : null}
          <p className="map-meta">{globalNote}</p>
        </section>
      ) : null}
    </div>
  )
}
