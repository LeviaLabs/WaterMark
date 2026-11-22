import type { MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { useTheme } from '../../hooks/useTheme'
import { Icon } from '../common/Icon'

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> }
}

/**
 * Glass switch between night and day; the sun and moon swap in CSS. Where the
 * browser supports view transitions, the new theme spreads out in a circle
 * from the button (transitions.css).
 */
export function ThemeToggle() {
  const { scheme, toggleScheme } = useTheme()
  const next = scheme === 'dark' ? 'light' : 'dark'

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    const doc = document as ViewTransitionDocument
    if (!doc.startViewTransition) {
      toggleScheme()
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    const root = document.documentElement
    root.style.setProperty('--vt-x', `${x}px`)
    root.style.setProperty('--vt-y', `${y}px`)
    root.style.setProperty('--vt-r', `${radius}px`)
    root.classList.add('theme-switching')
    const transition = doc.startViewTransition(() => {
      flushSync(toggleScheme)
    })
    transition.finished.finally(() => root.classList.remove('theme-switching'))
  }

  return (
    <button
      type="button"
      className={`theme-toggle theme-toggle--${scheme}`}
      onClick={onClick}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      <Icon name="sun" className="theme-toggle-sun" />
      <Icon name="moon" className="theme-toggle-moon" />
    </button>
  )
}
