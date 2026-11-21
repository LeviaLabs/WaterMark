import { useId } from 'react'
import { useI18n } from './useI18n.ts'
import './i18n.css'

export interface OfficialTextTranslation {
  text: string
  /** BCP 47 code of the translation. */
  locale: string
  /** How it was produced. Shown to reviewers in data attributes, not hidden. */
  method: 'machine' | 'human'
}

interface Props {
  /** Official text exactly as the agency issued it. Rendered verbatim, never rewritten. */
  text: string
  /** Agency or feed name, e.g. "National Weather Service". */
  sourceName: string
  sourceUrl?: string
  /** BCP 47 code of the official text, e.g. "en". */
  sourceLanguage: string
  /** ISO 8601 issue time from the source. */
  issuedAt?: string
  /** IANA time zone of the affected area, e.g. "America/New_York". */
  timeZone?: string
  /** Optional translation. Always shown after the original and labeled unofficial. */
  translation?: OfficialTextTranslation
}

/**
 * Shows an official warning so that its meaning cannot be changed by localization:
 * the original text first, in its own language, with source, issue time and link;
 * an optional translation second, clearly marked as unofficial.
 */
export function OfficialText({ text, sourceName, sourceUrl, sourceLanguage, issuedAt, timeZone, translation }: Props) {
  const { t, formatDateTime, languageName } = useI18n()
  const headingId = useId()
  return (
    <figure className="wm-official" aria-labelledby={headingId}>
      <figcaption id={headingId} className="wm-official__caption">
        {t('official.asIssued', { source: sourceName })}
      </figcaption>
      <p className="wm-official__meta">
        {t('official.originalLanguage', { language: languageName(sourceLanguage) })}
        {issuedAt && (
          <>
            {' · '}
            <time dateTime={issuedAt}>{t('data.issuedAt', { time: formatDateTime(issuedAt, timeZone) })}</time>
          </>
        )}
      </p>
      <blockquote className="wm-official__text" lang={sourceLanguage} cite={sourceUrl}>
        {text}
      </blockquote>
      {sourceUrl && (
        <p className="wm-official__link">
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            {t('official.openSource', { source: sourceName })}
          </a>
        </p>
      )}
      {translation && (
        <section className="wm-official__translation" data-method={translation.method}>
          <h4 className="wm-official__translation-label">{t('official.unofficialTranslation')}</h4>
          <p lang={translation.locale} className="wm-official__text">{translation.text}</p>
          <p className="wm-official__note">{t('official.translationNote')}</p>
        </section>
      )}
    </figure>
  )
}
