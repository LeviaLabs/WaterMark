import type { ResponderModel } from '../../../hooks/useResponderModel'

export function ResponderView({ model, onFocus }: { model: ResponderModel | null; onFocus: (bounds: [number, number, number, number]) => void }) {
  const ranked = model
  if (!ranked) return <section className="aud-block"><p className="report-skeleton" aria-busy="true">Loading flood squares…</p></section>
  return (
    <section className="aud-block">
      <p className="aud-kicker">Fire & CERT</p>
      <h3 className="aud-title">Squares with the most mapped evidence</h3>
      <p>
        Ranked from what is mapped, not from a flood probability. {ranked.source}, {ranked.years[0]}–{ranked.years[1]}, in {ranked.size}° squares
        {ranked.focused ? ' inside the region in focus' : ' (the squares with the most reports, until a region is focused)'}.
        An empty list is not an all-clear.
      </p>
      <AreaList title="Response" areas={ranked.response} onFocus={onFocus} empty="No flood reports in the squares checked." />
      <AreaList title="Fewer records nearby" areas={ranked.staging} onFocus={onFocus} empty="No neighboring square was available." />
      {ranked.sensors.recorded.length ? (
        <>
          <h4 className="aud-title">FloodNet sensors with the most recorded floods</h4>
          <p className="map-meta">Street sensors in New York City. A sensor count is that sensor, not the whole neighborhood. Depth is inches.</p>
          <ol className="aud-list">
            {ranked.sensors.recorded.map((sensor) => (
              <li key={sensor.id}>
                <button type="button" className="aud-jump" onClick={() => onFocus([sensor.point[0] - 0.01, sensor.point[1] - 0.01, sensor.point[0] + 0.01, sensor.point[1] + 0.01])}>
                  <strong>{sensor.name}</strong>
                  <span className="map-meta">{sensor.events} recorded floods · deepest {sensor.depthIn} in{sensor.last ? ` · last ${sensor.last.slice(0, 10)}` : ''}</span>
                </button>
              </li>
            ))}
          </ol>
          {ranked.sensors.quiet.length ? (
            <>
              <h4 className="aud-title">Sensors with no recorded flood</h4>
              <p className="map-meta">Near the busiest sensor. A quiet sensor can miss a flood. It is not a staging clearance.</p>
              <ul className="aud-list">
                {ranked.sensors.quiet.map((sensor) => (
                  <li key={sensor.id}><strong>{sensor.name}</strong><span className="map-meta">No FloodNet flood on record</span></li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : <p className="map-meta">FloodNet sensors load when New York City is on screen. Outside the city they are not part of this ranking.</p>}
    </section>
  )
}

function AreaList({ title, areas, onFocus, empty }: {
  title: string
  areas: { id: string; name: string; bounds: [number, number, number, number]; items: { source: string; detail: string }[] }[]
  onFocus: (bounds: [number, number, number, number]) => void
  empty: string
}) {
  return (
    <>
      <h4 className="aud-title">{title}</h4>
      {areas.length ? (
        <ol className="aud-list">
          {areas.map((area, index) => (
            <li key={area.id}>
              <button type="button" className="aud-jump" onClick={() => onFocus(area.bounds)}>
                <strong>{index + 1}. {area.name}</strong>
                {area.items.map((item) => <span key={item.source + item.detail} className="map-meta">{item.source}: {item.detail}</span>)}
              </button>
            </li>
          ))}
        </ol>
      ) : <p className="map-meta">{empty}</p>}
    </>
  )
}
