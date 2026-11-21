import { useState } from 'react'
import {
  EXAMPLE_ALERTS,
  EXAMPLE_AREA,
  EXAMPLE_NO_ALERTS,
  EXAMPLE_RAINFALL,
  EXAMPLE_THREAD,
  EXAMPLE_TIDE,
  EXAMPLE_TIME_ZONE,
  PILOT_PLACES,
} from '../../scripting/content/featureExamples'
import type { Scenario } from '../../scripting/content/scenarios'
import type { StoryPreview } from '../../scripting/content/featureStory'
import { AlertDigest } from '../features/AlertDigest'
import { AlertList } from '../features/AlertList'
import { AreaSummary } from '../features/AreaSummary'
import { AssistantThread } from '../features/AssistantThread'
import { PlaceSearch } from '../features/PlaceSearch'
import { RainfallChart } from '../features/RainfallChart'
import { ScenarioPicker } from '../features/ScenarioPicker'
import { SensorSparkline } from '../features/SensorSparkline'

/** Alerts preview with a switch between "alert in effect" and the honest empty state. */
function AlertsPreview() {
  const [empty, setEmpty] = useState(false)
  return (
    <>
      <span className="preview-switch" role="group" aria-label="Example state">
        <button type="button" aria-pressed={!empty} onClick={() => setEmpty(false)}>
          Alert issued
        </button>
        <button type="button" aria-pressed={empty} onClick={() => setEmpty(true)}>
          No alerts returned
        </button>
      </span>
      <AlertList result={empty ? EXAMPLE_NO_ALERTS : EXAMPLE_ALERTS} isExample timeZone={EXAMPLE_TIME_ZONE} />
    </>
  )
}

function ScenarioPreview() {
  const [scenario, setScenario] = useState<Scenario>('moderate')
  return <ScenarioPicker value={scenario} onChange={setScenario} />
}

/**
 * The live feature component for one story step, fed with clearly labeled
 * example data. These are the same components the map page can render with
 * real API results.
 */
export function FeaturePreview({ id }: { id: StoryPreview }) {
  switch (id) {
    case 'search':
      return (
        <article className="evidence-panel" aria-label="Place search">
          <header className="evidence-panel-head">
            <h3>Find a place</h3>
            <span className="evidence-panel-tags">
              <span className="example-badge">Pilot neighborhoods</span>
            </span>
          </header>
          <PlaceSearch places={PILOT_PLACES} />
        </article>
      )
    case 'alerts':
      return <AlertsPreview />
    case 'rainfall':
      return <RainfallChart result={EXAMPLE_RAINFALL} isExample timeZone={EXAMPLE_TIME_ZONE} />
    case 'stormwater':
      return <ScenarioPreview />
    case 'sensors':
      return <SensorSparkline result={EXAMPLE_TIDE} isExample timeZone={EXAMPLE_TIME_ZONE} />
    case 'area':
      return <AreaSummary result={EXAMPLE_AREA} isExample timeZone={EXAMPLE_TIME_ZONE} />
    case 'assistant':
      return <AssistantThread messages={EXAMPLE_THREAD} isExample />
    case 'digest':
      return <AlertDigest isExample />
  }
}
