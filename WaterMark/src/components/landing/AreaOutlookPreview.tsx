import { useState } from 'react'
import { EXAMPLE_AREA, EXAMPLE_TIME_ZONE } from '../../scripting/content/featureExamples'
import { Icon } from '../common/Icon'
import { AreaSummary } from '../features/AreaSummary'

/** Switches between the Circle Area Summary and the Flood Outlook + AI block summary. */
export function AreaOutlookPreview() {
  const [tab, setTab] = useState<'outlook' | 'circle'>('outlook')

  return (
    <>
      <span className="preview-switch" role="group" aria-label="Area analysis mode">
        <button type="button" aria-pressed={tab === 'outlook'} onClick={() => setTab('outlook')}>
          Outlook &amp; AI summary
        </button>
        <button type="button" aria-pressed={tab === 'circle'} onClick={() => setTab('circle')}>
          Circle area stats
        </button>
      </span>
      {tab === 'circle' ? (
        <AreaSummary result={EXAMPLE_AREA} isExample timeZone={EXAMPLE_TIME_ZONE} />
      ) : (
        <article className="evidence-panel outlook-preview" aria-label="Flood outlook and AI block summary preview">
          <header className="evidence-panel-head">
            <h3>Flood outlook · Red Hook block</h3>
            <span className="evidence-panel-tags">
              <span className="example-badge">Example · AI summary</span>
            </span>
          </header>

          <div className="outlook-preview-status">
            <span className="outlook-pill">Flood watch</span>
            <span>Coastal Flood Advisory + 30 mm forecast rain</span>
          </div>

          <figure className="outlook-preview-quote">
            <blockquote>
              <p>
                Kings County recorded 84 flood episodes (2016–2025), with 62% occurring between August and October. An
                active Coastal Flood Advisory and ~30 mm of forecast rain fall inside that peak coastal window.
              </p>
            </blockquote>
            <figcaption>
              <Icon name="spark" size={14} /> AI summary checked to quote only computed block figures.
            </figcaption>
          </figure>

          <dl className="outlook-preview-facts">
            <div>
              <dt>Recurrence</dt>
              <dd>~8.4 episodes / yr in Kings County</dd>
            </div>
            <div>
              <dt>Busiest season</dt>
              <dd>Aug – Oct (62% of past floods)</dd>
            </div>
            <div>
              <dt>Rain extremes</dt>
              <dd>ERA5 reanalysis since 1991</dd>
            </div>
          </dl>

          <p className="evidence-limit">
            Every AI block summary runs after deterministic recurrence math and rejects any number not in the source record.
          </p>
        </article>
      )}
    </>
  )
}
