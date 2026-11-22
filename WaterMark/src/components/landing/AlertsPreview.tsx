import { useState } from 'react'
import { EXAMPLE_ALERTS, EXAMPLE_NO_ALERTS, EXAMPLE_TIME_ZONE } from '../../scripting/content/featureExamples'
import { AlertList } from '../features/AlertList'

/** Alerts preview with a switch between "alert in effect" and the honest empty state. */
export function AlertsPreview() {
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
