import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { resolveVoiceLanguage, LOCALE_CHANGE_EVENT, type LocaleChangeDetail } from '../voice/contract.ts'
import { I18nContext, type I18nValue } from './context.ts'
import { detectLocale, formatDateTime, formatMeasurement, formatNumber, languageName, matchLocale, translate } from './core.ts'
import { getLocaleInfo, LOCALE_STORAGE_KEY, type LocaleCode } from './locales.ts'

function readInitialLocale(): LocaleCode {
  let query: string | null = null
  let saved: string | null = null
  try { query = new URLSearchParams(window.location.search).get('lang') } catch { /* no URL */ }
  try { saved = window.localStorage.getItem(LOCALE_STORAGE_KEY) } catch { /* storage blocked */ }
  return detectLocale({ query, saved, browser: navigator.languages ?? [navigator.language] })
}

interface Props {
  children: ReactNode
  /** Force a locale (tests, previews). Otherwise detected from URL, saved choice, browser. */
  initialLocale?: LocaleCode
}

/**
 * Provides the interface language to the app. Mount once near the root (Ryan B owns the
 * entry file; see docs/auth-i18n-contract.md). Sets <html lang> and dir, saves the choice,
 * and announces changes to the voice assistant through LOCALE_CHANGE_EVENT.
 */
export function I18nProvider({ children, initialLocale }: Props) {
  const [locale, setLocaleState] = useState<LocaleCode>(() => initialLocale ?? readInitialLocale())

  useEffect(() => {
    const info = getLocaleInfo(locale)
    document.documentElement.lang = info.code
    document.documentElement.dir = info.dir
  }, [locale])

  const setLocale = useCallback((code: string) => {
    const next = matchLocale(code)
    if (!next) return
    setLocaleState(next)
    try { window.localStorage.setItem(LOCALE_STORAGE_KEY, next) } catch { /* storage blocked */ }
    const detail: LocaleChangeDetail = { locale: next, voice: resolveVoiceLanguage(next) }
    window.dispatchEvent(new CustomEvent(LOCALE_CHANGE_EVENT, { detail }))
  }, [])

  const value = useMemo<I18nValue>(() => ({
    locale,
    info: getLocaleInfo(locale),
    setLocale,
    t: (key, vars) => translate(locale, key, vars),
    formatNumber: (v, o) => formatNumber(locale, v, o),
    formatMeasurement: (v, unit) => formatMeasurement(locale, v, unit),
    formatDateTime: (iso, tz) => formatDateTime(locale, iso, tz),
    languageName: (tag) => languageName(locale, tag),
  }), [locale, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
