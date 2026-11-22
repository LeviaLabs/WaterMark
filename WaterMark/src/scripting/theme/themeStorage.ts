export type ColorScheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'watermark-theme'

export function isColorScheme(value: unknown): value is ColorScheme {
  return value === 'light' || value === 'dark'
}

/**
 * Picks the first color scheme: a saved choice wins, then the operating
 * system preference, then dark (the hero reads best at night).
 */
export function resolveInitialScheme(saved: unknown, prefersLight: boolean): ColorScheme {
  if (isColorScheme(saved)) return saved
  return prefersLight ? 'light' : 'dark'
}

/** Storage can throw in private windows or when site data is blocked. */
export function readSavedScheme(storage: Pick<Storage, 'getItem'> | undefined): ColorScheme | null {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY)
    return isColorScheme(value) ? value : null
  } catch {
    return null
  }
}

export function saveScheme(storage: Pick<Storage, 'setItem'> | undefined, scheme: ColorScheme): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, scheme)
  } catch {
    // Not saving only means the choice resets on the next visit.
  }
}
