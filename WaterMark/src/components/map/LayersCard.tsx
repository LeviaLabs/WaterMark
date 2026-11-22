import { Switch } from '@astryxdesign/core/Switch'
import { Icon } from '../common/Icon'
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
}

const startsOpen = typeof matchMedia === 'undefined' || !matchMedia('(max-width: 700px)').matches

export function LayersCard({ layers, onToggle, floods, stormNote }: Props) {
  let globalNote = 'Loading worldwide flood reports…'
  if (floods === 'error') globalNote = "Worldwide flood reports didn't load. GDACS may be busy; reload to try again."
  else if (floods) {
    const active = floods.features.filter((f) => f.properties.active).length
    globalNote = `${active} active floods worldwide, ${floods.features.length} in the past 30 days. Rain shows the newest NASA image, a few hours old.`
  }

  return (
    // A <details> so phones can fold the card away; it starts open on wider screens.
    <details className="map-card layers-card" open={startsOpen}>
      <summary className="layers-title"><Icon name="layers" size={18} />Layers</summary>
      <ul className="layers-list">
        {LAYERS.map((l) => (
          <li key={l.id}>
            <Switch size="sm" label={l.label} value={layers[l.id]} onChange={(on) => onToggle(l.id, on)}
              labelIcon={<span className={`layer-swatch layer-swatch--${l.id}`} />} />
          </li>
        ))}
      </ul>
      <div className="rain-scale" aria-hidden="true">
        <span className="rain-scale-bar" />
        <span className="rain-scale-ends"><span>Light rain</span><span>Heavy</span></span>
      </div>
      {stormNote ? <p className="map-meta">{stormNote}</p> : null}
      <p className="map-meta">{globalNote}</p>
    </details>
  )
}
