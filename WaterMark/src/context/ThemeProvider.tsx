import { useEffect, useState, type ReactNode } from 'react'
import { Theme } from '@astryxdesign/core/theme'
import { themes, defaultThemeSlug } from '../astryx-themes'
import { ThemeContext } from './ThemeContext'
import {
  readSavedScheme,
  resolveInitialScheme,
  saveScheme,
  type ColorScheme,
} from '../scripting/theme/themeStorage'

function initialScheme(): ColorScheme {
  // index.html already set data-theme before first paint; reuse it so React
  // and the pre-paint script can never disagree.
  const fromDocument = document.documentElement.dataset.theme
  if (fromDocument === 'light' || fromDocument === 'dark') return fromDocument
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
  return resolveInitialScheme(readSavedScheme(window.localStorage), prefersLight)
}

/**
 * Light/dark mode for the whole app. Writes `data-theme` on <html> for our
 * CSS in src/styling and passes the same mode to Astryx's <Theme>, so Astryx
 * components (buttons, inputs, avatars) switch with everything else.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>(initialScheme)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = scheme
    root.style.colorScheme = scheme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', scheme === 'dark' ? '#03101c' : '#eaf4fa')
  }, [scheme])

  const setScheme = (next: ColorScheme) => {
    setSchemeState(next)
    saveScheme(window.localStorage, next)
  }

  const value = {
    scheme,
    setScheme,
    toggleScheme: () => setScheme(scheme === 'dark' ? 'light' : 'dark'),
  }

  return (
    <ThemeContext value={value}>
      <Theme theme={themes[defaultThemeSlug]} mode={scheme}>
        {children}
      </Theme>
    </ThemeContext>
  )
}
