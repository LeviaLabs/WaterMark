import type { EvidenceKind } from './dataSources'

/**
 * The steps of the scroll-driven flood story (components/landing/FloodStory).
 * Each step introduces one shipped capability from the planning doc and main.
 * As the reader scrolls, the water in the city rises one step at a time.
 *
 * `status` reflects verified state on main:
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

export type StoryPreview =
  | 'search'
  | 'zoom'
  | 'alerts'
  | 'rainfall'
  | 'stormwater'
  | 'sensors'
  | 'area'
  | 'assistant'
  | 'audiences'
  | 'digest'

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
    eyebrow: 'Any place',
    title: 'Start with your own block.',
    body: 'Search a neighborhood, ZIP code or coordinates with Photon geocoding, or toggle NASA rainfall and 30-day GDACS flood layers on the 2D MapLibre map in light or dark mode.',
    kinds: ['reference'],
    priority: 'P0',
    owners: 'Ryan Lin · Ryan Bergman',
    status: 'built',
    statusNote: 'Live on /map with Photon search & global layers',
  },
  {
    id: 'zoom',
    eyebrow: 'Zoom & timeline',
    title: 'Zoom from globe to block. Scrub every year.',
    body: 'Zooming automatically drills from country to state, US county and grid block under your cursor. Scrub the play/pause timeline to replay NOAA flood episodes and flood causes year by year.',
    kinds: ['historical'],
    priority: 'P0',
    owners: 'Ryan Bergman',
    status: 'built',
    statusNote: 'Live: auto zoom-to-focus & NOAA/GDACS flood timeline',
  },
  {
    id: 'alerts',
    eyebrow: 'Official alerts',
    title: 'The agency’s words, not ours.',
    body: 'Active NWS flood and heavy-rain alerts sit on top, word for word, with start and end times. If no alert comes back, WaterMark says so, and never calls it an all-clear.',
    kinds: ['official'],
    priority: 'P0',
    owners: 'Decong Huang · Ryan Lin',
    status: 'built',
    statusNote: 'Live: NWS alerts in every area report',
  },
  {
    id: 'rainfall',
    eyebrow: 'Rain forecast',
    title: 'See the storm before it arrives.',
    body: 'Hour-by-hour Open-Meteo rainfall in millimeters alongside Copernicus GloFAS river discharge forecasts, always stamped with model issue times.',
    kinds: ['forecast', 'modeled'],
    priority: 'P0',
    owners: 'Decong Huang · Ryan Lin',
    status: 'built',
    statusNote: 'Live: Open-Meteo rain & GloFAS river charts',
  },
  {
    id: 'stormwater',
    eyebrow: 'Stormwater',
    title: 'Where a cloudburst could pond.',
    body: 'Static NYC stormwater vector tiles and FEMA flood zones show modeled limited, moderate and extreme scenarios—always labeled as scenarios, never today’s water.',
    kinds: ['scenario', 'reference'],
    priority: 'P0',
    owners: 'Ryan Lin · Ryan Bergman',
    status: 'built',
    statusNote: 'Live: NYC stormwater tiles & FEMA NFHL layer',
  },
  {
    id: 'sensors',
    eyebrow: 'Sensors & tides',
    title: 'Real readings, pinned to their spot.',
    body: 'FloodNet street sensors, NOAA tide gauges and USGS stream gauges, each with its exact timestamp and a reminder that one gauge measures one place.',
    kinds: ['observed'],
    priority: 'P0',
    owners: 'Decong Huang · Ryan Lin',
    status: 'built',
    statusNote: 'Live: FloodNet, NOAA tides & USGS readings',
  },
  {
    id: 'area',
    eyebrow: 'Circle & outlook',
    title: 'Area stats, outlook & AI block summaries.',
    body: 'Draw a circle for Turf.js and PostGIS counts, inspect historical recurrence and busiest flood season in the Flood Outlook, and read an AI block summary checked to quote only computed figures.',
    kinds: ['observed', 'historical'],
    priority: 'P1',
    owners: 'Ryan Bergman · Ryan Lin · Decong Huang',
    status: 'built',
    statusNote: 'Live: circle tool, Flood Outlook & AI block summaries',
  },
  {
    id: 'assistant',
    eyebrow: 'Voice assistant',
    title: 'Ask by text or voice, with receipts.',
    body: 'Speak into the mic or type a question. The Gemini flood assistant runs grounded tool calls over live map datasets, reads answers aloud via ElevenLabs or browser speech, and cites every source.',
    kinds: ['official', 'forecast'],
    priority: 'P1',
    owners: 'Ryan Bergman · Decong Huang · Daniel Manita',
    status: 'built',
    statusNote: 'Live: Gemini voice assistant, ElevenLabs TTS & rate limits',
  },
  {
    id: 'audiences',
    eyebrow: 'Role views',
    title: 'Tailored views for every responder.',
    body: 'Switch between Homeowner (NFIP claims + Move Your Car higher-ground lookup), School (campus approach direction), and Fire & CERT (priority flood blocks) with breadcrumb and Escape navigation.',
    kinds: ['reference', 'historical'],
    priority: 'P2',
    owners: 'Daniel Manita · Ryan Lin',
    status: 'built',
    statusNote: 'Live: audience views & Move Your Car on /map',
  },
  {
    id: 'digest',
    eyebrow: 'Inbox & 5 languages',
    title: 'Alerts in your inbox, in your language.',
    body: 'Agentboxd screens official USGS, NWS and FEMA alert emails at /alerts, optional MojoAuth and Agentboxd sign-in stays guest-first, and the app speaks English, Spanish, Chinese, Russian and Hindi.',
    kinds: ['official'],
    priority: 'P2',
    owners: 'Decong Huang · Ryan Bergman',
    status: 'built',
    statusNote: 'Live: /alerts inbox, optional sign-in & 5 languages',
  },
]

/** Maps scroll progress (0 to 1) through the story to the step in focus. */
export function activeStepIndex(progress: number, count = STORY_STEPS.length): number {
  const clamped = Math.min(Math.max(Number.isFinite(progress) ? progress : 0, 0), 0.9999)
  return Math.floor(clamped * count)
}
