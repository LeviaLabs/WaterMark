/**
 * Priorities from README Section 8 and the audiences from the planning doc.
 * The features themselves live in featureStory.ts (the flood story steps).
 */

export type Priority = 'P0' | 'P1' | 'P2'

export const PRIORITY_LABELS: Record<Priority, string> = {
  P0: 'Core',
  P1: 'Next',
  P2: 'Stretch',
}

export const AUDIENCES: readonly { title: string; body: string; icon: 'pin' | 'layers' | 'shield' | 'bell' }[] = [
  {
    title: 'Homeowners & renters',
    body: 'Check active warnings, historical NFIP flood claims, stormwater exposure, and the Move Your Car higher-ground lookup around your block.',
    icon: 'pin',
  },
  {
    title: 'Schools',
    body: 'See campus flood exposure, nearest river and elevation approach direction, and active warnings before arrival or dismissal.',
    icon: 'layers',
  },
  {
    title: 'CERT volunteers',
    body: 'Inspect ranked priority flood blocks, screened Agentboxd alert digests, and verified sensor and 311 records in one view.',
    icon: 'shield',
  },
  {
    title: 'Volunteer fire departments',
    body: 'Spot streets to check first, FloodNet sensor readings, NOAA tide gauges, and hands-free voice lookups before coordinating response.',
    icon: 'bell',
  },
]
