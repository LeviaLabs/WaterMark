import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { LocalizationContext, type LocalizationValue } from '../hooks/useLocalization.ts'
import {
  detectLocale,
  formatDateTime,
  formatMeasurement,
  formatNumber,
  languageName,
  LOCALE_STORAGE_KEY,
  matchLocale,
  translate,
  type LocaleCode,
} from '../scripting/localization/localize.ts'

function readSavedLocale(): string | null {
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY)
  } catch {
    return null // storage blocked (private mode or browser setting)
  }
}

/**
 * Provides the interface language. Mount once around <App /> (Ryan B owns main.tsx).
 * Picks the language from ?lang=, the saved choice or the browser, keeps <html lang> in step,
 * and saves the reader's choice.
 */
export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(() =>
    detectLocale({
      query: new URLSearchParams(window.location.search).get('lang'),
      saved: readSavedLocale(),
      browser: navigator.languages,
    }),
  )

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<LocalizationValue>(() => ({
    locale,
    setLocale: (code) => {
      const next = matchLocale(code)
      if (!next) return
      setLocaleState(next)
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next)
      } catch {
        // storage blocked: the choice still applies for this visit
      }
    },
    t: (key, vars) => translate(locale, key, vars),
    formatNumber: (v, options) => formatNumber(locale, v, options),
    formatMeasurement: (v, unit) => formatMeasurement(locale, v, unit),
    formatDateTime: (iso, timeZone) => formatDateTime(locale, iso, timeZone),
    languageName: (tag) => languageName(locale, tag),
  }), [locale])

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>
}
