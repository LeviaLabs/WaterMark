import { useState } from 'react'
import type { Scenario } from '../../scripting/content/scenarios'
import { ScenarioPicker } from '../features/ScenarioPicker'

export function ScenarioPreview() {
  const [scenario, setScenario] = useState<Scenario>('moderate')
  return <ScenarioPicker value={scenario} onChange={setScenario} />
}
