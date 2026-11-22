/**
 * The three NYC Stormwater Flood Map scenarios (NYC Open Data 9i7c-xyvv).
 * Descriptions stay qualitative on purpose; the exact rainfall rates and sea
 * level assumptions belong to the dataset's own documentation, linked on screen.
 */
export type Scenario = 'limited' | 'moderate' | 'extreme'

export const SCENARIOS: readonly { id: Scenario; label: string; description: string }[] = [
  { id: 'limited', label: 'Limited', description: 'A heavy downpour with today’s sea levels.' },
  { id: 'moderate', label: 'Moderate', description: 'A rarer, more intense storm with higher future sea levels.' },
  { id: 'extreme', label: 'Extreme', description: 'A very rare cloudburst with much higher future sea levels.' },
]

export const SCENARIO_ORDER: Record<Scenario, number> = { limited: 0, moderate: 1, extreme: 2 }
