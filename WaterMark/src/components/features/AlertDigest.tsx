import { useId, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { DIGEST_LANGUAGES } from '../../scripting/content/featureExamples'
import { Icon } from '../common/Icon'

type Language = (typeof DIGEST_LANGUAGES)[number]

type Props = {
  languages?: readonly Language[]
  isExample?: boolean
}

/**
 * An alert digest email, previewed in each supported language. The digest's
 * own words are translated, but the official alert text stays exactly as the
 * agency issued it (the data API never machine-translates official text).
 * Tabs follow the ARIA tabs pattern: arrow keys move between languages.
 */
export function AlertDigest({ languages = DIGEST_LANGUAGES, isExample = false }: Props) {
  const id = useId()
  const [index, setIndex] = useState(0)
  const language = languages[index]

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + languages.length) % languages.length
    setIndex(next)
    document.getElementById(`${id}-tab-${next}`)?.focus()
  }

  return (
    <article className="evidence-panel digest" aria-label={isExample ? 'Alert digest, example' : 'Alert digest'}>
      <header className="evidence-panel-head">
        <h3>Alert digest</h3>
        <span className="evidence-panel-tags">{isExample && <span className="example-badge">Example email</span>}</span>
      </header>

      <div className="digest-tabs" role="tablist" aria-label="Language">
        {languages.map((item, i) => (
          <button
            key={item.code}
            id={`${id}-tab-${i}`}
            type="button"
            role="tab"
            lang={item.code}
            aria-selected={i === index}
            aria-controls={`${id}-panel`}
            tabIndex={i === index ? 0 : -1}
            className={`digest-tab ${i === index ? 'is-active' : ''}`}
            onClick={() => setIndex(i)}
            onKeyDown={onKeyDown}
          >
            {item.name}
          </button>
        ))}
      </div>

      <section
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${index}`}
        className="digest-mail"
        key={language.code}
      >
        <p className="digest-from">
          <Icon name="mail" size={16} /> WaterMark digest · via Agentboxd
        </p>
        <p className="digest-subject" lang={language.code}>
          {language.subject}
        </p>
        <p className="digest-note" lang={language.code}>
          {language.note}
        </p>
        <blockquote className="digest-official" lang="en" style={{ '--i': 0 } as CSSProperties}>
          <span className="digest-official-label">Official text, as issued (English)</span>
          Coastal Flood Advisory · Kings (Brooklyn), NY · example
        </blockquote>
        <a className="digest-link" href="https://alerts.weather.gov/" target="_blank" rel="noreferrer">
          Open the original NWS alert <Icon name="external" size={14} />
        </a>
      </section>
      <p className="evidence-limit">Digests are a supplement and can arrive late. The live alert on the map is the source of truth.</p>
    </article>
  )
}
