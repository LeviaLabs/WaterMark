import { useId } from 'react'
import { LOCALES } from './locales.ts'
import { useI18n } from './useI18n.ts'
import './i18n.css'

interface Props {
  className?: string
  /** Hide the visible label (it stays available to screen readers). */
  hideLabel?: boolean
}

/**
 * Accessible language picker: a native <select> with a real <label>, so it works with
 * keyboard, screen readers and mobile pickers without extra code. Each option carries its
 * own lang attribute so screen readers pronounce the language names correctly.
 */
export function LanguageSelect({ className, hideLabel = false }: Props) {
  const { locale, setLocale, t } = useI18n()
  const id = useId()
  return (
    <div className={['wm-lang', className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={hideLabel ? 'wm-visually-hidden' : 'wm-lang__label'}>
        {t('lang.label')}
      </label>
      <select id={id} className="wm-lang__select" value={locale} onChange={(e) => setLocale(e.target.value)}>
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.status === 'pending' ? t('lang.pending', { language: l.nativeName }) : l.nativeName}
          </option>
        ))}
      </select>
    </div>
  )
}
