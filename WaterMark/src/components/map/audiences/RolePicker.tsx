import { AUDIENCE_ROLES, ROLE_LABEL, type AudienceRole } from '../../../scripting/audiences/role'

export function RolePicker({ role, onChange }: { role: AudienceRole; onChange: (role: AudienceRole) => void }) {
  return (
    <div className="map-card aud-roles" role="radiogroup" aria-label="Audience view">
      {AUDIENCE_ROLES.map((id) => (
        <button key={id} type="button" className={role === id ? 'aud-role is-on' : 'aud-role'}
          role="radio" aria-checked={role === id} onClick={() => onChange(id)}>
          {ROLE_LABEL[id]}
        </button>
      ))}
    </div>
  )
}
