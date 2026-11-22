import type { BuildStatus } from './featureStory'

/**
 * Team credits. Cross-referenced on 2026-11-21 against two sources:
 *   1. the Assignments tab of the EvoHacks2.0 planning doc (highlight colors:
 *      green Ryan B, pink Ryan L, blue Decong; README Section 10), and
 *   2. what each person has actually pushed to the repository.
 * `status` says which: built (merged on main), review (on a branch, not merged
 * yet) or planned (assigned, not started). Update this list, not the
 * components, when work lands.
 */

export type WorkItem = { text: string; status: BuildStatus }

export type TeamMember = {
  name: string
  role: string
  work: readonly WorkItem[]
}

export const TEAM: readonly TeamMember[] = [
  {
    name: 'Ryan Bergman',
    role: 'Frontend, AI & deployment',
    work: [
      { text: 'Landing page design, theme, routing and frontend conventions', status: 'built' },
      { text: 'Vite + React app setup and the Astryx design system for the team', status: 'built' },
      { text: 'AI assistant (Gemini or OpenRouter) and ElevenLabs voice', status: 'planned' },
      { text: 'AWS Amplify automatic deployments', status: 'planned' },
      { text: 'Decodo scraping research, only if the public APIs fall short', status: 'planned' },
    ],
  },
  {
    name: 'Ryan Lin',
    role: 'Map, data panel & charts',
    work: [
      { text: '2D flood map with light and dark map styles', status: 'review' },
      { text: 'Draggable, stowable data panel and circle-area report', status: 'review' },
      { text: 'Global layers: NASA rainfall and GDACS floods', status: 'review' },
      { text: 'FloodNet and NFIP claims starter data, and the sources list', status: 'review' },
      { text: '“Move Your Car” concept, research only', status: 'planned' },
    ],
  },
  {
    name: 'Decong Huang',
    role: 'Backend, data & languages',
    work: [
      { text: 'Supabase Edge Function data API: NWS, Open-Meteo, GloFAS, FloodNet', status: 'built' },
      { text: 'PostGIS area queries, request budgets and provider health', status: 'built' },
      { text: 'Five-language localization and the voice language contract', status: 'review' },
      { text: 'Optional MojoAuth email-code sign-in', status: 'review' },
      { text: 'Agentboxd alert digests, the .xyz domain and SMS research', status: 'planned' },
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
