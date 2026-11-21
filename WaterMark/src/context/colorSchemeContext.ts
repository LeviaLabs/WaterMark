import { createContext } from 'react'
import type { ColorScheme } from '../scripting/types'

export interface ColorSchemeValue {
  scheme: ColorScheme
  setScheme: (scheme: ColorScheme) => void
}

export const ColorSchemeContext = createContext<ColorSchemeValue | null>(null)
