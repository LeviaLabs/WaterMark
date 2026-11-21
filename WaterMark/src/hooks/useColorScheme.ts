import { useContext } from 'react'
import { ColorSchemeContext, type ColorSchemeValue } from '../context/colorSchemeContext'

export function useColorScheme(): ColorSchemeValue {
  const value = useContext(ColorSchemeContext)
  if (!value) throw new Error('useColorScheme must be used inside <ColorSchemeProvider>')
  return value
}
