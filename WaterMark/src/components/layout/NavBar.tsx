import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '@astryxdesign/core/Button'
import { useAuth } from '../../hooks/useAuth'
import { useInView } from '../../hooks/useInView'
import { isAgentAccount } from '../../services/auth/session'
import { Icon } from '../common/Icon'
import { Logo } from '../common/Logo'
import { RollText } from '../common/RollText'
import { RouterLink } from '../common/RouterLink'
import { ThemeToggle } from './ThemeToggle'

const SECTIONS = [
  { hash: '#how', label: 'How it works' },
  { hash: '#data', label: 'Data' },
  { hash: '#audiences', label: 'Who it’s for' },
  { hash: '#team', label: 'Team' },
]

/** Short nav label for an account: the part of the email before "@", at most 16 characters. */
function accountLabel(displayName: string | null | undefined) {
  const local = (displayName ?? '').split('@')[0].trim()
  if (!local) return 'Account'
  return local.length > 16 ? `${local.slice(0, 15)}…` : local
}

/**
 * Floating glass navigation. Transparent over the hero, frosted once the page
 * scrolls (detected with an IntersectionObserver on a tiny sentinel at the top
 * of the document, not a scroll listener). The right side follows the sign-in
 * state: Log in / Sign up for guests, the account and Sign out when signed in,
 * and nothing while a stored session is being re-checked.
 */
export function NavBar() {
  const sentinel = useRef<HTMLSpanElement>(null)
  const atTop = useInView(sentinel)
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const onLanding = pathname === '/'
  const { state, signOut } = useAuth()
  const signedIn = state.status === 'signed-in'
  const checking = state.status === 'loading'
  const account = state.account?.displayName ?? ''
  // Agentboxd sessions are AI agents; say so wherever the account is named.
  const agent = isAgentAccount(state.account)
  const label = agent ? `Agent · ${accountLabel(account || 'Agent')}` : accountLabel(account)

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
        <RollText text={label} />
      </a>
    ) : (
      <Link key={hash} to={`/${hash}`} className="nav-link" onClick={closeMenu}>
        <RollText text={label} />
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
            <span className="nav-auth" aria-busy={checking || undefined}>
              {signedIn ? (
                <>
                  <Button label={`${agent ? 'AI agent account' : 'Account'}: ${account || label}`} variant="ghost" size="sm" href="/login" as={RouterLink}>
                    <RollText text={label} />
                  </Button>
                  <Button label="Sign out" variant="secondary" size="sm" onClick={() => void signOut()}>
                    <RollText text="Sign out" />
                  </Button>
                </>
              ) : checking ? null : (
                <>
                  <Button label="Log in" variant="ghost" size="sm" href="/login" as={RouterLink}>
                    <RollText text="Log in" />
                  </Button>
                  <Button label="Sign up" variant="primary" size="sm" href="/signup" as={RouterLink}>
                    <RollText text="Sign up" />
                  </Button>
                </>
              )}
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
              {signedIn ? (
                <>
                  <Button label={`Signed in as ${label}`} variant="secondary" href="/login" as={RouterLink} width="100%" />
                  <Button label="Sign out" variant="primary" width="100%" onClick={() => void signOut()} />
                </>
              ) : checking ? null : (
                <>
                  <Button label="Log in" variant="secondary" href="/login" as={RouterLink} width="100%" />
                  <Button label="Sign up" variant="primary" href="/signup" as={RouterLink} width="100%" />
                </>
              )}
            </span>
          </div>
        )}
      </header>
    </>
  )
}
