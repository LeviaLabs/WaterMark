import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Theme } from '@astryxdesign/core/theme'
import { defaultThemeSlug, themes } from '../astryx-themes.ts'
import {
  parseStoredTheme,
  resolveThemeMode,
  THEME_STORAGE_KEY,
  themeColorMeta,
  type ColorMode,
} from '../scripting/themeMode.ts'
import { ThemeContext } from './theme.ts'

function readInitialMode(): { mode: ColorMode; isChosen: boolean } {
  let stored: ColorMode | null
  try {
    stored = parseStoredTheme(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    stored = null
  }
  const prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  return { mode: resolveThemeMode(stored, prefersDark), isChosen: stored !== null }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(readInitialMode)

  const setMode = useCallback((mode: ColorMode) => {
    setState({ mode, isChosen: true })
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode)
    } catch {
      /* private mode or a full store: the choice still applies for this visit */
    }
  }, [])

  const toggleMode = useCallback(() => {
    setState((current) => {
      const mode: ColorMode = current.mode === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(THEME_STORAGE_KEY, mode)
      } catch {
        /* keep the in-memory choice */
      }
      return { mode, isChosen: true }
    })
  }, [])

  useEffect(() => {
    if (state.isChosen) return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      setState({ mode: query.matches ? 'dark' : 'light', isChosen: false })
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [state.isChosen])

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', themeColorMeta(state.mode))
  }, [state.mode])

  const value = useMemo(
    () => ({ mode: state.mode, isChosen: state.isChosen, setMode, toggleMode }),
    [state.mode, state.isChosen, setMode, toggleMode],
  )

  return (
    <ThemeContext.Provider value={value}>
      <Theme theme={themes[defaultThemeSlug]} mode={state.mode}>
        {children}
      </Theme>
    </ThemeContext.Provider>
  )
}
