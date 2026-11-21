import type { ReactNode } from 'react'
import { SiteFooter } from './SiteFooter.tsx'
import { SiteNav } from './SiteNav.tsx'

export function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <SiteNav />
      <main id="content" tabIndex={-1} className="site-main">
        {children}
      </main>
      <SiteFooter />
    </>
  )
}
