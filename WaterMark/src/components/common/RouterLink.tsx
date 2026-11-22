import type { ComponentProps } from 'react'
import { Link } from 'react-router'

type Props = Omit<ComponentProps<typeof Link>, 'to'> & { href: string }

/**
 * Lets Astryx components that render links (Button, Avatar) navigate with
 * React Router: pass `as={RouterLink}` and `href`. Astryx hands us `href`;
 * React Router's <Link> wants `to`. Page changes use a view transition
 * (styled in transitions.css) where the browser supports it.
 */
export function RouterLink({ href, ...rest }: Props) {
  return <Link to={href} viewTransition {...rest} />
}
