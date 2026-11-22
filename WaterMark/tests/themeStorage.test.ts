import { describe, expect, it } from 'vitest'
import {
  THEME_STORAGE_KEY,
  readSavedScheme,
  resolveInitialScheme,
  saveScheme,
} from '../src/scripting/theme/themeStorage'

describe('resolveInitialScheme', () => {
  it('prefers a saved choice over the system setting', () => {
    expect(resolveInitialScheme('light', false)).toBe('light')
    expect(resolveInitialScheme('dark', true)).toBe('dark')
  })

  it('falls back to the system setting, then dark', () => {
    expect(resolveInitialScheme(null, true)).toBe('light')
    expect(resolveInitialScheme(null, false)).toBe('dark')
    expect(resolveInitialScheme('purple', false)).toBe('dark')
  })
})

describe('theme storage', () => {
  it('round-trips a valid scheme', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    }
    saveScheme(storage, 'light')
    expect(store.get(THEME_STORAGE_KEY)).toBe('light')
    expect(readSavedScheme(storage)).toBe('light')
  })

  it('ignores garbage and survives storage that throws', () => {
    expect(readSavedScheme({ getItem: () => 'neon' })).toBeNull()
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readSavedScheme(throwing)).toBeNull()
    expect(() => saveScheme(throwing, 'dark')).not.toThrow()
    expect(readSavedScheme(undefined)).toBeNull()
  })
})
