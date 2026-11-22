// Audience views are a picker, not an account. The map works the same without one.
export const AUDIENCE_ROLES = ['explore', 'school', 'home', 'responder'] as const
export type AudienceRole = (typeof AUDIENCE_ROLES)[number]

export const ROLE_LABEL: Record<AudienceRole, string> = {
  explore: 'Everyone',
  school: 'School',
  home: 'Homeowner',
  responder: 'Fire & CERT',
}

export function parseRole(value: string | null): AudienceRole {
  return value === 'school' || value === 'home' || value === 'responder' ? value : 'explore'
}
