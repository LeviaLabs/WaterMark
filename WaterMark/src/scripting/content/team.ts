/**
 * Team credits, from the Assignments tab of the EvoHacks2.0 planning doc
 * (README Section 10). Update this list, not the components, when roles change.
 */

export type TeamMember = {
  name: string
  role: string
  work: readonly string[]
}

export const TEAM: readonly TeamMember[] = [
  {
    name: 'Ryan Bergman',
    role: 'Frontend & AI experience',
    work: [
      'Landing page, routing and visual design',
      'AI assistant and ElevenLabs voice',
      'AWS Amplify automatic deployments',
    ],
  },
  {
    name: 'Ryan Lin',
    role: 'Map & data visualization',
    work: [
      '2D world map and demo page',
      'Draggable data panel and circle-area statistics',
      'Forecast charts and the resources bibliography',
    ],
  },
  {
    name: 'Decong Huang',
    role: 'Backend, data & localization',
    work: [
      'Supabase PostGIS database and Edge Functions',
      'Multilingual support and MojoAuth sign-in',
      'Agentboxd alert digests and the .xyz domain',
    ],
  },
]

export const EVENT = {
  name: 'EvoHacks II',
  theme: 'Projects for Social Good',
}

/** Sponsors listed in the EvoHacks II announcement. */
export const SPONSORS: readonly string[] = [
  'Codecrafters',
  'SSOJet',
  'Formaloo',
  'Praksha',
  'Scrimba',
  '.xyz',
  'Agentboxd',
  'MojoAuth',
  'Momen',
]

export const REPOSITORY_URL = 'https://github.com/LeviaLabs/WaterMark'
