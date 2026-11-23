import type { BuildStatus } from './featureStory'

/**
 * Team credits. Cross-referenced on 2026-11-23 against two sources:
 *   1. the Assignments tab of the EvoHacks2.0 planning doc (highlight colors:
 *      green Ryan B, pink Ryan L, blue Decong, yellow Daniel/joint), and
 *   2. merged pull requests and commits on main.
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
    role: 'Frontend, Voice AI & Map Systems',
    work: [
      { text: 'Landing page, 2D flooding city parallax, EvidenceSea & Astryx design system', status: 'built' },
      { text: 'Voice-enabled Gemini flood assistant with grounded map tool calls & mic input', status: 'built' },
      { text: 'AI summaries for blocks & areas and Flood Outlook recurrence analysis', status: 'built' },
      { text: 'Automatic zoom-to-focus region & block selection (world to street block)', status: 'built' },
      { text: 'Interactive flood timeline slider (play/pause) & NOAA episode cause analytics', status: 'built' },
      { text: 'Static NYC stormwater vector tiles, Photon search, MapLibre v6 fix & GitHub Pages CI/CD', status: 'built' },
    ],
  },
  {
    name: 'Daniel Manita',
    role: 'Audience Views, Safety & Navigation',
    work: [
      { text: 'School, Homeowner, and Fire & CERT audience views on the flood map', status: 'built' },
      { text: 'Move Your Car parking exposure view and finer detail at high zoom', status: 'built' },
      { text: 'Flood assistant rate limits, kill switch, bounded requests & untrusted data checks', status: 'built' },
      { text: 'Back button, breadcrumbs, Escape key & World reset navigation', status: 'built' },
      { text: 'Cross-branch merge-conflict resolution and PR integration', status: 'built' },
    ],
  },
  {
    name: 'Ryan Lin',
    role: '2D Map, Data Panel & Global Layers',
    work: [
      { text: 'Interactive 2D MapLibre flood map with light and dark map styles', status: 'built' },
      { text: 'Draggable, stowable data panel and Turf.js circle-area report', status: 'built' },
      { text: 'Global hazard layers: NASA GPM IMERG rainfall and 30-day GDACS floods', status: 'built' },
      { text: 'FloodNet & NFIP claims starter data pipeline and toggleable sources bibliography', status: 'built' },
      { text: '“Move Your Car” concept and multi-audience hazard research', status: 'built' },
    ],
  },
  {
    name: 'Decong Huang',
    role: 'Backend, Auth, TTS & Languages',
    work: [
      { text: 'Supabase PostGIS & Edge Function flood data API (NWS, Open-Meteo, GloFAS, FloodNet)', status: 'built' },
      { text: 'Budgeted ElevenLabs voice read-aloud Edge Function with browser speech fallback', status: 'built' },
      { text: 'Agentboxd alert inbox (/alerts) with sender authentication & quarantine', status: 'built' },
      { text: 'Optional guest-first auth: MojoAuth email codes & Agentboxd OIDC + PKCE', status: 'built' },
      { text: 'Five-language localization, voice language contract, CI gates & 200 SPA route indexes', status: 'built' },
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
