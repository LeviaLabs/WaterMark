import { useState } from 'react'
import { Icon } from '../common/Icon'

const ROLES = [
  {
    id: 'homeowner',
    label: 'Homeowner',
    headline: 'NFIP claims & Move Your Car',
    metric: '142 past claims in ZIP 11231 · +3.4 m higher ground 420 m NE',
    bullets: [
      'Shows ZIP-level OpenFEMA flood insurance claims without inferring individual home policies.',
      'Move Your Car samples surrounding Copernicus elevation points to highlight nearby higher ground.',
    ],
    note: 'Higher ground is elevation context only—never a guarantee against blocked roads or storm drains.',
  },
  {
    id: 'school',
    label: 'School',
    headline: 'Campus approach & warnings',
    metric: 'Nearest GloFAS river cell 4.2 km NW · 1 active coastal advisory',
    bullets: [
      'Estimates approach bearing from nearby elevation slopes and nearest modeled river point.',
      'Keeps active NWS alerts and stormwater scenario exposure visible ahead of arrival or dismissal.',
    ],
    note: 'Directional bearings show terrain slope, not a property-level hydraulic inundation path.',
  },
  {
    id: 'responder',
    label: 'Fire & CERT',
    headline: 'Priority blocks to check first',
    metric: '3 priority grid blocks · 4 FloodNet sensors · 63 historical 311 calls',
    bullets: [
      'Ranks neighboring blocks by historical flood episodes, sensor activity, and 311 street-flood reports.',
      'Links directly to screened Agentboxd alert digests and hands-free voice lookups in the field.',
    ],
    note: 'Supplemental situational awareness; follow official dispatch and incident command.',
  },
] as const

export function AudiencesPreview() {
  const [selected, setSelected] = useState<(typeof ROLES)[number]['id']>('homeowner')
  const role = ROLES.find((r) => r.id === selected) ?? ROLES[0]

  return (
    <article className="evidence-panel audiences-preview" aria-label="Role views preview">
      <header className="evidence-panel-head">
        <h3>Tailored map views</h3>
        <span className="evidence-panel-tags">
          <span className="example-badge">Example · Role views</span>
        </span>
      </header>

      <div className="digest-tabs" role="tablist" aria-label="Audience role">
        {ROLES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === role.id}
            className={`digest-tab ${item.id === role.id ? 'is-active' : ''}`}
            onClick={() => setSelected(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="role-card" role="tabpanel">
        <p className="role-card-title">
          <Icon name="shield" size={16} /> {role.headline}
        </p>
        <p className="role-card-metric">{role.metric}</p>
        <ul className="role-card-list">
          {role.bullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <p className="evidence-limit">{role.note}</p>
    </article>
  )
}
