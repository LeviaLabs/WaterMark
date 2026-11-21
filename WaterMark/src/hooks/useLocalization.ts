import { createContext, useContext } from 'react'
import type { LocaleCode } from '../scripting/localization/localize.ts'
import type { MessageKey } from '../scripting/localization/messages/index.ts'

export interface LocalizationValue {
  locale: LocaleCode
  setLocale: (code: string) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  formatNumber: (value: number | null | undefined, options?: Intl.NumberFormatOptions) => string
  formatMeasurement: (value: number | null | undefined, unit: string) => string
  formatDateTime: (iso: string | null | undefined, timeZone?: string) => string
  languageName: (tag: string) => string
}

/** Filled by <LocalizationProvider> in src/context. */
export const LocalizationContext = createContext<LocalizationValue | null>(null)

/** Current language, plus translation and formatting bound to it. */
export function useLocalization(): LocalizationValue {
  const value = useContext(LocalizationContext)
  if (!value) throw new Error('useLocalization must be used inside <LocalizationProvider>.')
  return value
}
