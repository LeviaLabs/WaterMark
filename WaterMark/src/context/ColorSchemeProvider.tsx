// Light / dark color scheme for the whole app. Remembers the choice, defaults to the OS setting,
// sets <html data-theme> for our CSS, and passes the same mode to the Astryx <Theme>.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Theme } from '@astryxdesign/core/theme'
import { themes, defaultThemeSlug } from '../astryx-themes'
import { ColorSchemeContext } from './colorSchemeContext'
import type { ColorScheme } from '../scripting/types'

const KEY = 'wm-color-scheme'

function initialScheme(): ColorScheme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage can be blocked (private mode); fall through to the OS setting.
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>(initialScheme)

  useEffect(() => {
    document.documentElement.dataset.theme = scheme
    document.documentElement.style.colorScheme = scheme
  }, [scheme])

  const value = useMemo(() => ({
    scheme,
    setScheme: (next: ColorScheme) => {
      setSchemeState(next)
      try { localStorage.setItem(KEY, next) } catch { /* not persisted; still applied */ }
    },
  }), [scheme])

  return (
    <ColorSchemeContext.Provider value={value}>
      <Theme theme={themes[defaultThemeSlug]} mode={scheme}>
        {children}
      </Theme>
    </ColorSchemeContext.Provider>
  )
}
