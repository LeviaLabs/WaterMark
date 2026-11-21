import { createContext } from 'react'
import type { MessageVars } from './core.ts'
import type { LocaleCode, LocaleInfo } from './locales.ts'
import type { MessageKey } from './messages/index.ts'

export interface I18nValue {
  locale: LocaleCode
  info: LocaleInfo
  setLocale: (code: string) => void
  t: (key: MessageKey, vars?: MessageVars) => string
  formatNumber: (value: number | null | undefined, options?: Intl.NumberFormatOptions) => string
  formatMeasurement: (value: number | null | undefined, unit: string) => string
  formatDateTime: (iso: string | null | undefined, timeZone?: string) => string
  languageName: (tag: string) => string
}

export const I18nContext = createContext<I18nValue | null>(null)
