// Supported interface languages. Codes are BCP 47 tags used for <html lang>, Intl formatting
// and the voice contract (src/voice/contract.ts).
//
// `status: "pending"` means the team has not confirmed the language yet (README section 9 asks
// to name specific Indian languages; Hindi is the current candidate). Pending languages still
// work but are marked in the picker.

export type LocaleCode = 'en' | 'es' | 'zh-Hans' | 'ru' | 'hi'

export interface LocaleInfo {
  code: LocaleCode
  /** Name in the language itself, shown in the picker. */
  nativeName: string
  /** English name, for logs and docs. */
  englishName: string
  dir: 'ltr' | 'rtl'
  status: 'active' | 'pending'
}

export const LOCALES: readonly LocaleInfo[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', dir: 'ltr', status: 'active' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', dir: 'ltr', status: 'active' },
  { code: 'zh-Hans', nativeName: '中文（简体）', englishName: 'Chinese (Simplified)', dir: 'ltr', status: 'active' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian', dir: 'ltr', status: 'active' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', dir: 'ltr', status: 'pending' },
]

export const DEFAULT_LOCALE: LocaleCode = 'en'

export const LOCALE_STORAGE_KEY = 'wm-locale'

export function getLocaleInfo(code: LocaleCode): LocaleInfo {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0]
}
