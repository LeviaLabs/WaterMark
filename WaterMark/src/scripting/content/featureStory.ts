import type { EvidenceKind } from './dataSources'

/**
 * The steps of the scroll-driven flood story (components/landing/FloodStory).
 * Each step introduces one feature from the planning doc. As the reader
 * scrolls, the water in the city rises one step at a time.
 *
 * `status` is honest build status as of the last credits update:
 *   built     merged on main
 *   review    code exists on a teammate's branch, not merged yet
 *   planned   assigned in the planning doc, not started in the repo
 * Priority comes from README Section 8.
 */

export type BuildStatus = 'built' | 'review' | 'planned'

export const STATUS_LABELS: Record<BuildStatus, string> = {
  built: 'Built',
  review: 'In review',
  planned: 'Planned',
}

export type StoryPreview = 'search' | 'alerts' | 'rainfall' | 'stormwater' | 'sensors' | 'area' | 'assistant' | 'digest'

export type StoryStep = {
  id: StoryPreview
  eyebrow: string
  title: string
  body: string
  kinds: readonly EvidenceKind[]
  priority: 'P0' | 'P1' | 'P2'
  owners: string
  status: BuildStatus
  statusNote: string
}

export const STORY_STEPS: readonly StoryStep[] = [
  {
    id: 'search',
    eyebrow: 'Any place on Earth',
    title: 'Start with your own block.',
    body: 'Search a neighborhood, a city or coordinates. The 2D map works everywhere, with extra street-level layers for New York City. No account needed.',
    kinds: ['reference'],
    priority: 'P0',
    owners: 'Ryan Lin',
    status: 'review',
    statusNote: 'Map page on branch ryan-l/map-page',
  },
  {
    id: 'alerts',
    eyebrow: 'Official warnings first',
    title: 'The agency’s words, not ours.',
    body: 'Active NWS flood and heavy-rain alerts sit on top, word for word, with when they start and end. If no alert comes back, WaterMark says so, and never calls it an all-clear.',
    kinds: ['official'],
    priority: 'P0',
    owners: 'Decong Huang · Ryan Lin',
    status: 'built',
    statusNote: 'NWS adapter merged in the data API',
  },
  {
    id: 'rainfall',
    eyebrow: 'Rainfall forecast',
    title: 'See the storm before it arrives.',
    body: 'Hour-by-hour rainfall in millimeters, with the time the model was issued. A forecast says how much rain may fall. It does not say whether your street floods.',
    kinds: ['forecast'],
    priority: 'P0',
    owners: 'Decong Huang · Ryan Lin',
    status: 'built',
    statusNote: 'Open-Meteo adapter merged · chart in review',
  },
  {
    id: 'stormwater',
    eyebrow: 'Stormwater scenarios',
    title: 'Where a cloudburst could pond.',
    body: 'New York City’s stormwater maps show where water could collect in limited, moderate and extreme rain. They are modeled scenarios, so WaterMark never shows them as today’s flooding.',
    kinds: ['scenario'],
    priority: 'P0',
    owners: 'Ryan Lin',
    status: 'review',
    statusNote: 'Stormwater layer on branch ryan-l/map-page',
  },
  {
    id: 'sensors',
    eyebrow: 'Sensors & tides',
    title: 'Real readings, pinned to their spot.',
    body: 'FloodNet street sensors, NOAA tide gauges and USGS stream gauges, each with the time of its reading and a reminder that it measures one place.',
    kinds: ['observed'],
    priority: 'P0',
    owners: 'Decong Huang · Ryan Lin',
    status: 'built',
    statusNote: 'FloodNet adapter merged in the data API',
  },
  {
    id: 'area',
    eyebrow: 'Circle an area',
    title: 'Draw a circle, get the numbers.',
    body: 'Drag a circle over a neighborhood to count the sensors, past flood events and 311 reports inside it. Missing counts read “Unknown”, never zero.',
    kinds: ['observed', 'historical'],
    priority: 'P1',
    owners: 'Ryan Lin · Decong Huang',
    status: 'review',
    statusNote: 'Area report on branch ryan-l/map-page · PostGIS query merged',
  },
  {
    id: 'assistant',
    eyebrow: 'Ask WaterMark',
    title: 'Plain answers, with receipts.',
    body: 'Ask in plain language, or out loud. The assistant can only summarize data WaterMark already fetched, cites every source, and never invents a number or overrides a warning.',
    kinds: ['official', 'forecast'],
    priority: 'P1',
    owners: 'Ryan Bergman',
    status: 'planned',
    statusNote: 'Gemini / OpenRouter and ElevenLabs under evaluation',
  },
  {
    id: 'digest',
    eyebrow: 'Digests & languages',
    title: 'Alerts in your inbox, in your language.',
    body: 'Agentboxd reads official NWS and FEMA alert emails and writes short summaries, always linking back to the original. The app speaks English, Spanish, Chinese, Russian and Hindi.',
    kinds: ['official'],
    priority: 'P2',
    owners: 'Decong Huang · Ryan Bergman',
    status: 'review',
    statusNote: 'Localization and sign-in on Decong’s branches · digests planned',
  },
]

/** Maps scroll progress (0 to 1) through the story to the step in focus. */
export function activeStepIndex(progress: number, count = STORY_STEPS.length): number {
  const clamped = Math.min(Math.max(Number.isFinite(progress) ? progress : 0, 0), 0.9999)
  return Math.floor(clamped * count)
}
