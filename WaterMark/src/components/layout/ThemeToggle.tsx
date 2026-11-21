import { useTheme } from '../../hooks/useTheme'
import { Icon } from '../common/Icon'

/** Glass switch between night and day; the sun and moon cross-fade in CSS. */
export function ThemeToggle() {
  const { scheme, toggleScheme } = useTheme()
  const next = scheme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className={`theme-toggle theme-toggle--${scheme}`}
      onClick={toggleScheme}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      <Icon name="sun" className="theme-toggle-sun" />
      <Icon name="moon" className="theme-toggle-moon" />
    </button>
  )
}
