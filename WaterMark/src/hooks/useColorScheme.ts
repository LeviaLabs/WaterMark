import { useTheme } from './useTheme'

/**
 * The map page's view of the app-wide light/dark mode. It reads the same
 * ThemeProvider as the landing page, so the scheme stays in sync across routes.
 */
export function useColorScheme() {
  const { scheme, setScheme } = useTheme()
  return { scheme, setScheme }
}
