import { useEffect, useId, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { Button } from '@astryxdesign/core/Button'
import { Icon } from '@astryxdesign/core/Icon'
import { Link } from '@astryxdesign/core/Link'
import { useTheme } from '../hooks/useTheme.ts'
import { MoonIcon, SunIcon } from './icons.tsx'
import '../styling/nav.css'

const LINKS = [
  { href: '/#idea', label: 'The idea' },
  { href: '/#features', label: 'Features' },
  { href: '/#sources', label: 'Sources' },
  { href: '/#team', label: 'Team' },
]

export function SiteNav() {
  const { mode, toggleMode } = useTheme()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [menuPath, setMenuPath] = useState(pathname)
  if (menuPath !== pathname) {
    setMenuPath(pathname)
    setOpen(false)
  }
  const panelId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const query = window.matchMedia('(min-width: 880px)')
    const onChange = () => {
      if (query.matches) setOpen(false)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const previouslyFocused = document.activeElement
    const selectors = 'a, button'
    const items = () => [...(panel?.querySelectorAll<HTMLElement>(selectors) ?? [])]
    items()[0]?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = items()
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [open])

  return (
    <header className="nav">
      <div className="nav__bar">
        <Link href="/" className="nav__brand" color="inherit" label="WaterMark, home">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          WaterMark
        </Link>
        <nav className="nav__links" aria-label="Page sections">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} color="inherit">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="nav__auth">
          <Button
            label="Log in"
            variant="ghost"
            href="/login"
            aria-current={pathname === '/login' ? 'page' : undefined}
          />
          <Button
            label="Sign up"
            variant="primary"
            href="/signup"
            aria-current={pathname === '/signup' ? 'page' : undefined}
          />
        </div>
        <div className="nav__tools">
          <Button
            label={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            variant="ghost"
            isIconOnly
            icon={<Icon icon={mode === 'dark' ? SunIcon : MoonIcon} />}
            onClick={toggleMode}
            aria-pressed={mode === 'dark'}
          />
          <Button
            ref={menuButtonRef}
            className="nav__menu-button"
            label={open ? 'Close menu' : 'Open menu'}
            variant="ghost"
            isIconOnly
            icon={<Icon icon={open ? 'close' : 'menu'} />}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          />
        </div>
      </div>
      {open ? (
        <>
          <button type="button" className="nav__scrim" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} />
          <div className="nav__panel" id={panelId} ref={panelRef} role="dialog" aria-modal="true" aria-label="Menu">
          <nav className="nav__panel-links" aria-label="Page sections">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} color="primary" display="block">
                {link.label}
              </Link>
            ))}
          </nav>
          <Button label="Log in" variant="secondary" href="/login" />
          <Button label="Sign up" variant="primary" href="/signup" />
          </div>
        </>
      ) : null}
    </header>
  )
}
