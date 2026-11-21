import type { LocaleCode } from '../locales.ts'
import { en, type Messages } from './en.ts'
import { es } from './es.ts'
import { hi } from './hi.ts'
import { ru } from './ru.ts'
import { zhHans } from './zh-Hans.ts'

export type { MessageKey, Messages } from './en.ts'

export const MESSAGES: Record<LocaleCode, Messages> = {
  en,
  es,
  'zh-Hans': zhHans,
  ru,
  hi,
}
