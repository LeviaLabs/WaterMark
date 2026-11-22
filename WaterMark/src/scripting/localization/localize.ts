// Localization helpers: supported languages, locale detection, message lookup and Intl
// formatting. Plain TypeScript with no React or DOM, so `npm test` runs it under Node.

import { MESSAGES, type MessageKey } from './messages/index.ts'

export type LocaleCode = 'en' | 'es' | 'zh-Hans' | 'ru' | 'hi'

/**
 * Interface languages, each name written in its own language for the picker.
 * `pending`: the team has not confirmed this language yet (Hindi is a candidate; README
 * section 9 asks which Indian languages to support). It works but is marked in the picker.
 */
export const LOCALES: readonly { code: LocaleCode; nativeName: string; pending?: true }[] = [
  { code: 'en', nativeName: 'English' },
  { code: 'es', nativeName: 'Español' },
  { code: 'zh-Hans', nativeName: '中文（简体）' },
  { code: 'ru', nativeName: 'Русский' },
  { code: 'hi', nativeName: 'हिन्दी', pending: true },
]

export const DEFAULT_LOCALE: LocaleCode = 'en'
export const LOCALE_STORAGE_KEY = 'wm-locale'

/** Map any BCP 47 tag ("es-US", "zh-CN", "ru") to a supported locale, or null. */
export function matchLocale(tag: string | null | undefined): LocaleCode | null {
  const t = String(tag ?? '').trim().toLowerCase()
  if (!t) return null
  const exact = LOCALES.find((l) => l.code.toLowerCase() === t)
  if (exact) return exact.code
  if (t === 'zh' || t.startsWith('zh-')) {
    // Traditional-script regions are not supported yet; do not show them Simplified text.
    return /(^|-)(hant|tw|hk|mo)($|-)/.test(t) ? null : 'zh-Hans'
  }
  const base = t.split('-')[0]
  return LOCALES.find((l) => l.code === base)?.code ?? null
}

/** Choice order: `?lang=` in the URL, saved choice, browser languages, English. */
export function detectLocale({ query, saved, browser = [] }: {
  query?: string | null
  saved?: string | null
  browser?: readonly string[]
}): LocaleCode {
  return matchLocale(query) ?? matchLocale(saved) ?? browser.map(matchLocale).find((m) => m !== null) ?? DEFAULT_LOCALE
}

/**
 * Look up a message. Falls back to English, then to the key, so text never disappears.
 * Variables are inserted as plain text; render the result as text, never as HTML.
 */
export function translate(locale: LocaleCode, key: MessageKey, vars: Record<string, string | number> = {}): string {
  const template = MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match))
}

const isMissing = (value: number | null | undefined): value is null | undefined =>
  value === null || value === undefined || !Number.isFinite(value)

/** Locale-aware number. Missing values show the "Unknown" label, never 0. */
export function formatNumber(locale: LocaleCode, value: number | null | undefined, options?: Intl.NumberFormatOptions): string {
  if (isMissing(value)) return translate(locale, 'status.unknown')
  return new Intl.NumberFormat(locale, options).format(value)
}

/** A value with its unit exactly as the source gave it ("in", "ft", "m³/s" are never converted). */
export function formatMeasurement(locale: LocaleCode, value: number | null | undefined, unit: string): string {
  if (isMissing(value)) return translate(locale, 'status.unknown')
  return `${formatNumber(locale, value, { maximumFractionDigits: 2 })} ${unit}`
}

/**
 * Date and time in the reader's language, always with the time zone so a source timestamp is
 * never ambiguous. Pass the place's zone (for NYC, "America/New_York") when known.
 * Keep the original ISO string in <time dateTime>.
 */
export function formatDateTime(locale: LocaleCode, iso: string | null | undefined, timeZone?: string): string {
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return translate(locale, 'status.unknown')
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone,
  }).format(d)
}

/** Name of a language in the reader's language, e.g. ("es", "en") gives "inglés". */
export function languageName(locale: LocaleCode, tag: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(tag) ?? tag
  } catch {
    return tag
  }
}
