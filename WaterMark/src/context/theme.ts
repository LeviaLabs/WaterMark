import { createContext } from 'react'
import type { ColorMode } from '../scripting/themeMode.ts'

export type ThemeContextValue = {
  mode: ColorMode
  /** True once the visitor has chosen a mode. Until then, the OS preference can still change it. */
  isChosen: boolean
  setMode: (mode: ColorMode) => void
  toggleMode: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
