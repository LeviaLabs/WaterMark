export type FeatureStatus = 'in-progress' | 'research' | 'planned'

export type Feature = {
  id: string
  title: string
  status: FeatureStatus
  statusLabel: string
  owner: string
  summary: string
  limit: string
}

export const FEATURES: Feature[] = [
  {
    id: 'circle',
    title: 'Circle on a 2D map',
    status: 'in-progress',
    statusLabel: 'In progress',
    owner: 'Ryan Lin',
    summary:
      'Draw a circle, keep the geometry, and ask only for statistics that make sense at that scale: what fell inside, the units, and what the sources do not cover.',
    limit: 'The map page is a placeholder. This landing page does not measure an area or invent a count.',
  },
  {
    id: 'forecasts',
    title: 'Forecasts, labeled as forecasts',
    status: 'in-progress',
    statusLabel: 'In progress',
    owner: 'Ryan Lin',
    summary:
      'Rainfall from a weather model, and river flow where a river model applies, each with the provider, the units, and the time the forecast is valid.',
    limit: 'There is no WaterMark flood percentage. A rainfall total is not a claim that one street floods.',
  },
  {
    id: 'move-your-car',
    title: 'Move Your Car',
    status: 'research',
    statusLabel: 'Research',
    owner: 'Ryan Lin',
    summary:
      'The distinguishing idea: point toward a nearby area a forecast does not currently flag, so a resident can think about moving a car before heavy rain.',
    limit:
      'Research only, and not on the map yet. It cannot promise that a street, a parking spot, or a destination stays dry. That would need live flood, road-closure, and parking data this project does not have.',
  },
  {
    id: 'assistant',
    title: 'An assistant you can talk to',
    status: 'planned',
    statusLabel: 'Planned',
    owner: 'Ryan Bergman, with Decong on languages',
    summary:
      'Optional Gemini chat and ElevenLabs voice. Hindi, Chinese, Russian, and Spanish are the languages the team wants to support.',
    limit:
      'Not wired up. The assistant may only summarize data WaterMark already retrieved. It must not invent a number or override the National Weather Service.',
  },
  {
    id: 'agentboxd',
    title: 'Alert email summaries',
    status: 'planned',
    statusLabel: 'Planned',
    owner: 'Decong Huang',
    summary:
      'Agentboxd can read NWS and FEMA alert emails and draft a summary for people who opted in. The official alert remains the source of truth.',
    limit: 'Not connected. Email can arrive late, twice, or stale. A summary is not proof an alert is current.',
  },
  {
    id: 'audiences',
    title: 'Views for different crews',
    status: 'planned',
    statusLabel: 'Planned',
    owner: 'Joint, if the map is solid',
    summary:
      'Homeowners, schools, CERT teams, and volunteer fire departments could see the same evidence with a different emphasis: a block, a campus, or streets worth checking.',
    limit:
      'Not started. These views will not predict which side of a building floods. That is outside what these datasets can support.',
  },
]

export const AUDIENCES = [
  {
    id: 'homeowners',
    title: 'Homeowners',
    text: 'Official alerts, rainfall timing, mapped exposure, and preparedness links for a chosen place.',
  },
  {
    id: 'schools',
    title: 'Schools',
    text: 'Warnings and mapped exposure near a campus. Not a path of water along one wall.',
  },
  {
    id: 'cert',
    title: 'CERT teams',
    text: 'Alerts and documented past events for situational awareness before checking with officials.',
  },
  {
    id: 'fire',
    title: 'Volunteer fire',
    text: 'A shared picture of conditions and evidence. Not a dispatch order from WaterMark.',
  },
] as const

export const EVIDENCE_KINDS = [
  {
    id: 'warning',
    kicker: 'Official warning',
    title: 'An agency issued it',
    text: 'An NWS flood warning has a type, an area, and a clock. It does not tell you the depth at one door.',
  },
  {
    id: 'forecast',
    kicker: 'Forecast',
    title: 'A model, a unit, a valid time',
    text: 'Predicted rain or river flow stays labeled as a forecast. It is not a statement that a particular street floods.',
  },
  {
    id: 'scenario',
    kicker: 'Scenario map',
    title: 'Exposure, not this hour',
    text: 'NYC stormwater scenarios and FEMA flood zones describe mapped hazard. They are not a live flood.',
  },
  {
    id: 'history',
    kicker: 'History',
    title: 'What was recorded before',
    text: '311 reports and NFIP claims are past records. A quiet history is not proof that today is safe.',
  },
] as const
