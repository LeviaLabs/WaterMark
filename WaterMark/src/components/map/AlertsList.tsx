import { fmtTime } from '../../scripting/format'
import type { Loadable, WeatherAlert } from '../../scripting/types'

export function AlertsList({ alerts }: { alerts: Loadable<WeatherAlert[]> }) {
  if (alerts === null) return <p className="map-meta">Loading…</p>
  if (alerts === 'error') {
    return <p className="map-meta">Couldn't load weather alerts right now. Alerts cover the US only.</p>
  }
  const fetched = <p className="map-meta">From the National Weather Service, fetched {fmtTime(new Date())}</p>
  if (!alerts.length) {
    return (
      <>
        <p className="callout callout-info">No active weather alerts at the center of this area. That is not a guarantee that it won't flood.</p>
        {fetched}
      </>
    )
  }
  return (
    <>
      {alerts.map((a, i) => {
        const until = a.ends || a.expires
        return (
          <article key={`${a.event}-${i}`} className="callout callout-alert">
            <strong>{a.event}</strong>
            {a.headline ? <p>{a.headline}</p> : null}
            <p className="map-meta">Until {until ? fmtTime(new Date(until)) : 'further notice'}</p>
            {a.instruction ? <p>{a.instruction}</p> : null}
          </article>
        )
      })}
      {fetched}
    </>
  )
}
