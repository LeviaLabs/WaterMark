// Pure localization helpers. No React, no DOM, so they run under `node --test`.

import { DEFAULT_LOCALE, LOCALES, type LocaleCode } from './locales.ts'
import { MESSAGES, type MessageKey } from './messages/index.ts'

export type MessageVars = Record<string, string | number>

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

export interface LocaleSources {
  /** `?lang=` from the URL, for shareable links and demos. */
  query?: string | null
  /** Previously saved choice. */
  saved?: string | null
  /** navigator.languages */
  browser?: readonly string[]
}

/** Choice order: URL, saved choice, browser languages, English. */
export function detectLocale({ query, saved, browser = [] }: LocaleSources): LocaleCode {
  return matchLocale(query) ?? matchLocale(saved) ?? browser.map(matchLocale).find((m) => m !== null) ?? DEFAULT_LOCALE
}

/**
 * Look up a message. Falls back to English, then to the key, so text never disappears.
 * Variables are inserted as plain text. Render the result as text (React does this by default);
 * never pass it to dangerouslySetInnerHTML.
 */
export function translate(locale: LocaleCode, key: MessageKey, vars: MessageVars = {}): string {
  const template = MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match))
}

/** Locale-aware number. Returns the "Unknown" label for missing values instead of 0. */
export function formatNumber(locale: LocaleCode, value: number | null | undefined, options: Intl.NumberFormatOptions = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return translate(locale, 'status.unknown')
  return new Intl.NumberFormat(locale, options).format(value)
}

/**
 * A value with its unit, exactly as the source reported it. The unit string is never
 * converted or translated (for example "in", "ft", "m³/s" stay as given).
 */
export function formatMeasurement(
  locale: LocaleCode,
  value: number | null | undefined,
  unit: string,
  options: Intl.NumberFormatOptions = { maximumFractionDigits: 2 },
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return translate(locale, 'status.unknown')
  return `${formatNumber(locale, value, options)} ${unit}`
}

/**
 * Date and time in the reader's language, with the time zone shown so a source timestamp is
 * never ambiguous. Pass the place's zone (for NYC, "America/New_York") when known.
 * Invalid or missing input returns the "Unknown" label. Keep the original ISO string for
 * <time dateTime>.
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
    ...(timeZone ? { timeZone } : {}),
  }).format(d)
}

/** Name of a language in the reader's language, e.g. ("es", "en") -> "inglés". */
export function languageName(locale: LocaleCode, tag: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(tag) ?? tag
  } catch {
    return tag
  }
}
