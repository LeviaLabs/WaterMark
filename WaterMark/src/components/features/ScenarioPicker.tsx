import { useId } from 'react'
import { SCENARIOS, SCENARIO_ORDER, type Scenario } from '../../scripting/content/scenarios'
import { EvidenceTag } from '../common/EvidenceTag'
import { Icon } from '../common/Icon'

/** Stylized ponding shapes for the preview map, one group per scenario. */
const PONDS: Record<Scenario, readonly string[]> = {
  limited: ['M88 96c10-8 30-6 34 4s-8 18-22 16-20-12-12-20Z', 'M182 150c8-6 24-4 26 4s-8 12-18 11-14-9-8-15Z'],
  moderate: [
    'M70 90c18-16 58-12 62 8s-18 32-40 28-36-20-22-36Z',
    'M168 140c14-12 44-8 46 8s-14 24-32 22-28-16-14-30Z',
    'M228 70c8-6 24-4 26 4s-8 12-18 11-14-9-8-15Z',
  ],
  extreme: [
    'M50 82c28-26 92-20 96 12s-30 48-62 42-56-30-34-54Z',
    'M150 130c22-20 72-14 74 14s-24 38-52 34-44-26-22-48Z',
    'M214 58c14-12 44-8 46 8s-14 24-32 22-28-16-14-30Z',
    'M110 190c10-8 32-6 34 6s-10 16-24 15-20-12-10-21Z',
  ],
}

type Props = {
  value: Scenario
  onChange: (scenario: Scenario) => void
}

/**
 * Picker for the NYC Stormwater Flood Map scenarios, with a legend that says
 * what the polygons mean. The preview shapes are illustrative; on the map
 * page the same control switches the real NYC Open Data layer.
 */
export function ScenarioPicker({ value, onChange }: Props) {
  const name = useId()
  const level = SCENARIO_ORDER[value]
  const current = SCENARIOS[level]

  return (
    <article className="evidence-panel scenario" aria-label="Stormwater flood scenarios">
      <header className="evidence-panel-head">
        <h3>Stormwater scenarios</h3>
        <span className="evidence-panel-tags">
          <EvidenceTag kind="scenario" />
          <span className="example-badge">Illustrative shapes</span>
        </span>
      </header>

      <fieldset className="scenario-picker">
        <legend className="visually-hidden">Rain scenario</legend>
        {SCENARIOS.map((scenario) => (
          <label key={scenario.id} className={`scenario-option ${scenario.id === value ? 'is-checked' : ''}`}>
            <input
              type="radio"
              name={name}
              value={scenario.id}
              checked={scenario.id === value}
              onChange={() => onChange(scenario.id)}
            />
            <span>{scenario.label}</span>
          </label>
        ))}
        <span className="scenario-thumb" style={{ transform: `translateX(${level * 100}%)` }} aria-hidden="true" />
      </fieldset>

      <svg className="scenario-map" viewBox="0 0 300 230" aria-hidden="true" focusable="false">
        <path className="scenario-land" d="M0 0H300V170C262 160 250 196 210 206S130 214 96 230H0Z" />
        <g className="scenario-streets">
          {[40, 90, 140, 190, 240].map((x) => (
            <path key={`v${x}`} d={`M${x} 0V230`} />
          ))}
          {[30, 75, 120, 165].map((y) => (
            <path key={`h${y}`} d={`M0 ${y}H300`} />
          ))}
        </g>
        {(Object.keys(PONDS) as Scenario[]).map((scenario) => (
          <g
            key={scenario}
            className={`scenario-ponds scenario-ponds--${scenario} ${SCENARIO_ORDER[scenario] <= level ? 'is-shown' : ''}`}
          >
            {PONDS[scenario].map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        ))}
        <path className="scenario-shore" d="M300 170C262 160 250 196 210 206S130 214 96 230" />
      </svg>

      <p className="scenario-description" aria-live="polite" key={value}>
        <strong>{current.label}:</strong> {current.description}
      </p>
      <p className="scenario-legend">
        <span className="scenario-swatch" aria-hidden="true" /> Areas of at least ¼ acre modeled to pond 4 inches of water
        or more.
      </p>
      <footer className="evidence-panel-foot">
        <p className="evidence-limit">A modeled scenario. It shows where water could collect, not what is flooding today.</p>
        <a className="evidence-source" href="https://data.cityofnewyork.us/d/9i7c-xyvv" target="_blank" rel="noreferrer">
          <span>Source: NYC Stormwater Flood Maps (NYC Open Data)</span>
          <Icon name="external" size={14} />
        </a>
      </footer>
    </article>
  )
}
