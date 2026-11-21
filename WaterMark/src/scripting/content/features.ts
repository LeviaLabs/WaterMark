/**
 * What the app does, with its priority from README Section 8.
 * Priority is a plan, not a claim that the feature already ships.
 */

export type Priority = 'P0' | 'P1' | 'P2'

export const PRIORITY_LABELS: Record<Priority, string> = {
  P0: 'Core',
  P1: 'Next',
  P2: 'Stretch',
}

export type Feature = {
  title: string
  body: string
  priority: Priority
  owner: string
}

export const FEATURES: readonly Feature[] = [
  { title: 'A 2D map of the whole world', body: 'Pan anywhere on Earth, with richer coastal and street-level detail for New York City.', priority: 'P0', owner: 'Ryan Lin' },
  { title: 'No account needed', body: 'Search a city, ZIP code or coordinates and start exploring. Signing in is optional, never a wall.', priority: 'P0', owner: 'Ryan Lin · Decong Huang' },
  { title: 'An evidence panel for every place', body: 'Warnings, forecasts and measurements side by side, each with its source, units and timestamps.', priority: 'P0', owner: 'Ryan Lin · Decong Huang' },
  { title: 'Draw a circle, get the numbers', body: 'Select an area to summarize the sensors, reports and flood zones inside it.', priority: 'P1', owner: 'Ryan Lin' },
  { title: 'Explanations you can ask for', body: 'An AI assistant that only summarizes cited data, never invents a number or overrides a warning.', priority: 'P1', owner: 'Ryan Bergman' },
  { title: 'Alert digests by email', body: 'Agentboxd reads official alert emails and writes plain-language summaries, as a supplement to the source.', priority: 'P1', owner: 'Decong Huang' },
  { title: 'Five languages, spoken too', body: 'English, Spanish, Hindi, Russian and Simplified Chinese, with an ElevenLabs voice assistant.', priority: 'P2', owner: 'Decong Huang · Ryan Bergman' },
]

export const AUDIENCES: readonly { title: string; body: string }[] = [
  { title: 'Homeowners & renters', body: 'Understand the alerts, forecasts and mapped exposure around home.' },
  { title: 'Schools', body: 'Review warnings and documented flood exposure near a campus.' },
  { title: 'CERT volunteers', body: 'Check official alerts and past events for situational awareness.' },
  { title: 'Volunteer fire departments', body: 'See conditions and evidence before coordinating with incident command.' },
]
