import { Icon } from '../common/Icon'
import { TiltCard } from '../common/TiltCard'

/**
 * Anatomy of one evidence record: the fields every value in the app carries.
 * Values are an illustrative example and are labeled as such on screen.
 */
const FIELDS = [
  { key: 'provider', value: 'NOAA Tides & Currents', hint: 'Who measured it' },
  { key: 'location', value: 'Station 8518750 · The Battery, NY', hint: 'Exactly where' },
  { key: 'type', value: 'observed', hint: 'Observed, forecast, scenario…' },
  { key: 'units', value: 'feet above MLLW', hint: 'Never a bare number' },
  { key: 'observedAt', value: 'timestamp from the provider', hint: 'When it was true' },
  { key: 'fetchedAt', value: 'timestamp of our request', hint: 'When we asked' },
  { key: 'limitations', value: 'one station, not the whole shoreline', hint: 'What it cannot tell you' },
]

export function ProvenanceCard() {
  return (
    <TiltCard className="provenance" maxDegrees={5}>
      <header className="provenance-header">
        <span className="provenance-icon">
          <Icon name="shield" size={22} />
        </span>
        <span>
          <h3>Every value carries its receipts</h3>
          <p className="provenance-caption">Illustrative example · not a live reading</p>
        </span>
      </header>
      <dl className="provenance-fields">
        {FIELDS.map((field) => (
          <div key={field.key} className="provenance-row">
            <dt>
              <code>{field.key}</code>
              <span className="provenance-hint">{field.hint}</span>
            </dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
    </TiltCard>
  )
}
