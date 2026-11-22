import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useSmoothScroll } from '../../hooks/useSmoothScroll'
import { Footer } from './Footer'
import { NavBar } from './NavBar'

/** Shared frame for every route: nav on top, page in the middle, footer below. */
export function SiteLayout() {
  const { pathname, hash } = useLocation()
  useSmoothScroll()

  // New page, new scroll position (links with a #hash scroll themselves).
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash])

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <NavBar />
      <main id="main" className="main">
        <Suspense fallback={<span className="route-loading" aria-label="Loading" />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
