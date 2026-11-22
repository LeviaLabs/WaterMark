import { useState } from 'react'
import { rankParking } from '../../../scripting/audiences/parking'
import { firstFloodAlert, nextRainDay } from '../../../scripting/audiences/approach'
import { todayIndex } from '../../../scripting/climate'
import { fmtTime } from '../../../scripting/format'
import { distanceKm } from '../../../scripting/geo'
import type { PlaceSamples } from '../../../hooks/usePlaceSamples'
import type { AreaReport, GlobalFloodCollection, LngLat } from '../../../scripting/types'

function situation(report: AreaReport, floods: GlobalFloodCollection | null, origin: LngLat): 'alert' | 'rain' | 'past' {
  if (firstFloodAlert(report.alerts)) return 'alert'
  if (floods?.features.some((feature) => feature.properties.active && distanceKm(origin, feature.geometry.coordinates as LngLat) < 80)) return 'alert'
  if (report.rain && report.rain !== 'error' && nextRainDay(report.rain.time, report.rain.mm, todayIndex(report.rain.time))) return 'rain'
  return 'past'
}

export function MoveCar({
  place, origin, samples, report, floods, onLocate,
}: {
  place: string
  origin: LngLat | null
  samples: PlaceSamples & { retry: () => void }
  report: AreaReport
  floods: GlobalFloodCollection | null
  onLocate: (at: LngLat) => void
}) {
  const [locNote, setLocNote] = useState<string | null>(null)
  const askHere = () => {
    if (!navigator.geolocation) { setLocNote('This browser has no location service. Search for the car, or click the map.'); return }
    setLocNote('Asking for this device’s location…')
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocNote(null); onLocate([pos.coords.longitude, pos.coords.latitude]) },
      () => setLocNote('Location was blocked or unavailable. Search for the car, or click the map.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
  }
  if (!origin) {
    return (
      <section className="aud-block">
        <p className="aud-kicker">Move your car</p>
        <h3 className="aud-title">Where could it go?</h3>
        <p>Click where the car is parked, or search for that place. Suggestions are higher sampled ground outside mapped flood extents. They are not a guarantee, and the line on the map is straight, not a driving route.</p>
        <p><button type="button" className="aud-text-btn" onClick={askHere}>Use this device’s location</button></p>
        {locNote ? <p className="map-meta">{locNote}</p> : null}
      </section>
    )
  }
  const mode = situation(report, floods, origin)
  const lead = mode === 'alert'
    ? 'A flood alert is active in the sources checked. Suggestions below are higher sampled spots outside the mapped extents. They are not a guarantee the spot or the street stays dry.'
    : mode === 'rain'
      ? 'No flood alert was found. A rainfall forecast includes a day of at least 10 mm. That is rain, not a flood warning. The same higher-ground spots are suggestions for planning, not a statement that streets will flood.'
      : 'No active flood alert or heavy rainfall day was found in the sources checked. That does not mean this spot is safe. The suggestions are where a car could have been moved during past mapped floods here, and where to plan to move it next time.'
  if (samples.status === 'loading' || samples.status === 'idle') {
    return (
      <section className="aud-block">
        <p className="aud-kicker">Move your car</p>
        <p className="report-skeleton" aria-busy="true">Checking higher ground around {place}…</p>
      </section>
    )
  }
  if (samples.status === 'error') {
    return <section className="aud-block"><p className="panel-failed">Could not sample ground height. No suggestion was made. <button type="button" className="panel-retry" onClick={samples.retry}>Try again</button></p></section>
  }
  const ranked = rankParking(samples.centerElevationM, samples.samples)
  return (
    <section className="aud-block">
      <p className="aud-kicker">Move your car · suggestion</p>
      <h3 className="aud-title">{ranked.suggestions.length ? `${ranked.suggestions.length} higher spot${ranked.suggestions.length === 1 ? '' : 's'} sampled` : 'No sampled spot qualified'}</h3>
      <p>{lead}</p>
      {ranked.suggestions.length ? (
        <ol className="aud-list">
          {ranked.suggestions.map((spot, index) => (
            <li key={`${spot.compass}-${spot.distanceKm}`}>
              <strong>{index === 0 ? 'First suggestion' : 'Also sampled'}: {spot.compass}, {spot.distanceKm.toFixed(1)} km</strong>
              <span className="map-meta">{spot.outsideMappedExtent ? 'Outside the mapped extents that were checked here.' : 'Higher ground only. Flood maps were not confirmed at this spot, so it is not described as outside a flood extent.'}</span>
              <ul>{spot.checks.map((check) => <li key={check}>{check}</li>)}</ul>
            </li>
          ))}
        </ol>
      ) : <p className="callout callout-info">{ranked.emptyNote}</p>}
      <p className="map-meta">The line is a straight bearing, not a road route. {samples.fetchedAt ? `Sampled ${fmtTime(new Date(samples.fetchedAt))}.` : ''}</p>
      <p><button type="button" className="aud-text-btn" onClick={askHere}>Use this device’s location instead</button></p>
      {locNote ? <p className="map-meta">{locNote}</p> : null}
    </section>
  )
}
