import { Suspense, use, type ReactElement } from 'react'
import {
  EXAMPLE_RAINFALL,
  EXAMPLE_THREAD,
  EXAMPLE_TIDE,
  EXAMPLE_TIME_ZONE,
  PILOT_PLACES,
} from '../../scripting/content/featureExamples'
import { chunk, type Chunk } from '../../scripting/lazy/chunk'
import type { StoryPreview } from '../../scripting/content/featureStory'

/** Search ranks places near the New York pilot area first; it still finds places anywhere. */
const NYC = { lat: 40.7128, lon: -74.006 }

/**
 * Each panel's code loads the first time its step comes up (a few kB each),
 * with a skeleton in its place until it arrives.
 */
const PREVIEWS: Record<StoryPreview, Chunk<ReactElement>> = {
  search: chunk(() =>
    Promise.all([import('../features/PlaceSearch'), import('../../services/geocoding/photon')]).then(([m, photon]) => (
      <article className="evidence-panel" aria-label="Place search">
        <header className="evidence-panel-head">
          <h3>Find a place</h3>
          <span className="evidence-panel-tags">
            <span className="example-badge">Live search · OpenStreetMap</span>
          </span>
        </header>
        <m.PlaceSearch
          places={PILOT_PLACES}
          lookup={(query, signal) => photon.searchPlaces(query, signal, { near: NYC })}
          credit={photon.PHOTON_ATTRIBUTION}
          minLength={photon.MIN_QUERY_LENGTH}
          hint="Any place, address or ZIP code"
        />
      </article>
    )),
  ),
  zoom: chunk(() => import('./ZoomTimelinePreview').then((m) => <m.ZoomTimelinePreview />)),
  alerts: chunk(() => import('./AlertsPreview').then((m) => <m.AlertsPreview />)),
  rainfall: chunk(() =>
    import('../features/RainfallChart').then((m) => <m.RainfallChart result={EXAMPLE_RAINFALL} isExample timeZone={EXAMPLE_TIME_ZONE} />),
  ),
  stormwater: chunk(() => import('./ScenarioPreview').then((m) => <m.ScenarioPreview />)),
  sensors: chunk(() =>
    import('../features/SensorSparkline').then((m) => <m.SensorSparkline result={EXAMPLE_TIDE} isExample timeZone={EXAMPLE_TIME_ZONE} />),
  ),
  area: chunk(() => import('./AreaOutlookPreview').then((m) => <m.AreaOutlookPreview />)),
  assistant: chunk(() =>
    import('../features/AssistantThread').then((m) => <m.AssistantThread messages={EXAMPLE_THREAD} isExample voicePreview />),
  ),
  audiences: chunk(() => import('./AudiencesPreview').then((m) => <m.AudiencesPreview />)),
  digest: chunk(() => import('../features/AlertDigest').then((m) => <m.AlertDigest isExample />)),
}

function Loaded({ id }: { id: StoryPreview }) {
  return <div className="preview-arrive">{use(PREVIEWS[id]())}</div>
}

/** Placeholder shaped like a panel: a header, a chart block and two rows. */
function PanelSkeleton() {
  return (
    <div className="evidence-panel panel-skeleton" aria-busy="true" aria-label="Loading example panel">
      <span className="skeleton-line panel-skeleton-title" />
      <span className="skeleton-block panel-skeleton-chart" />
      <span className="skeleton-line" />
      <span className="skeleton-line panel-skeleton-short" />
    </div>
  )
}

/**
 * The live feature component for one story step, fed with clearly labeled
 * example data. These are the same components the map page can render with
 * real API results.
 */
export function FeaturePreview({ id }: { id: StoryPreview }) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <Loaded id={id} />
    </Suspense>
  )
}
