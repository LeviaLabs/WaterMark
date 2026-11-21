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
  { title: 'Homeowners & renters', body: 'Understand the alerts, forecasts and mapped exposure around home.', icon: 'pin' },
  { title: 'Schools', body: 'Review warnings and documented flood exposure near a campus.', icon: 'layers' },
  { title: 'CERT volunteers', body: 'Check official alerts and past events for situational awareness.', icon: 'shield' },
  { title: 'Volunteer fire departments', body: 'See conditions and evidence before coordinating with incident command.', icon: 'bell' },
]
