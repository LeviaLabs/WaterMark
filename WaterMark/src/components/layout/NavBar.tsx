import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '@astryxdesign/core/Button'
import { useInView } from '../../hooks/useInView'
import { Icon } from '../common/Icon'
import { Logo } from '../common/Logo'
import { RouterLink } from '../common/RouterLink'
import { ThemeToggle } from './ThemeToggle'

const SECTIONS = [
  { hash: '#how', label: 'How it works' },
  { hash: '#data', label: 'Data' },
  { hash: '#features', label: 'Features' },
  { hash: '#team', label: 'Team' },
]

/**
 * Floating glass navigation. Transparent over the hero, frosted once the page
 * scrolls (detected with an IntersectionObserver on a tiny sentinel at the top
 * of the document, not a scroll listener). Log in / Sign up sit on the right.
 */
export function NavBar() {
  const sentinel = useRef<HTMLSpanElement>(null)
  const atTop = useInView(sentinel)
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const onLanding = pathname === '/'

  // Escape closes the mobile menu; the listener exists only while it is open.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)
  const sectionLinks = SECTIONS.map(({ hash, label }) =>
    onLanding ? (
      <a key={hash} href={hash} className="nav-link" onClick={closeMenu}>
        {label}
      </a>
    ) : (
      <Link key={hash} to={`/${hash}`} className="nav-link" onClick={closeMenu}>
        {label}
      </Link>
    ),
  )

  return (
    <>
      <span id="top" ref={sentinel} className="nav-sentinel" aria-hidden="true" />
      <header className={`nav ${atTop && !menuOpen ? '' : 'nav--solid'}`}>
        <nav className="nav-inner" aria-label="Main">
          <Logo />
          <div className="nav-links">{sectionLinks}</div>
          <div className="nav-actions">
            <ThemeToggle />
            <span className="nav-auth">
              <Button label="Log in" variant="ghost" size="sm" href="/login" as={RouterLink} />
              <Button label="Sign up" variant="primary" size="sm" href="/signup" as={RouterLink} />
            </span>
            <button
              type="button"
              className="nav-menu-button"
              aria-expanded={menuOpen}
              aria-controls="nav-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
            </button>
          </div>
        </nav>
        {menuOpen && (
          <div id="nav-menu" className="nav-menu">
            {sectionLinks}
            <span className="nav-menu-auth" onClick={closeMenu}>
              <Button label="Log in" variant="secondary" href="/login" as={RouterLink} width="100%" />
              <Button label="Sign up" variant="primary" href="/signup" as={RouterLink} width="100%" />
            </span>
          </div>
        )}
      </header>
    </>
  )
}
