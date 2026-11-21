import type { ComponentProps } from 'react'
import { Link } from 'react-router'

type AppLinkProps = ComponentProps<'a'>

function isRouterHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//')
}

/** Astryx links pass `href`. In-app paths use the router; hashes and external URLs stay native. */
export function AppLink({ href, children, ...rest }: AppLinkProps) {
  if (!href || !isRouterHref(href)) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <Link to={href} {...rest}>
      {children}
    </Link>
  )
}
