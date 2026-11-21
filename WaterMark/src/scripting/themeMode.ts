/** localStorage key. The inline script in index.html must use this same string. */
export const THEME_STORAGE_KEY = 'watermark-color-mode'

export type ColorMode = 'light' | 'dark'

export function parseStoredTheme(value: string | null): ColorMode | null {
  if (value === 'light' || value === 'dark') return value
  return null
}

export function resolveThemeMode(stored: ColorMode | null, prefersDark: boolean): ColorMode {
  if (stored) return stored
  return prefersDark ? 'dark' : 'light'
}

export function themeColorMeta(mode: ColorMode): string {
  return mode === 'dark' ? '#1b1b1b' : '#f1f1f1'
}
