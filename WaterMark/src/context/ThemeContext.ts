import { createContext } from 'react'
import type { ColorScheme } from '../scripting/theme/themeStorage'

export type ThemeContextValue = {
  scheme: ColorScheme
  setScheme: (scheme: ColorScheme) => void
  toggleScheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
