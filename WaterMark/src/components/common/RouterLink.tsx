import type { ComponentProps } from 'react'
import { Link } from 'react-router'

type Props = Omit<ComponentProps<typeof Link>, 'to'> & { href: string }

/**
 * Lets Astryx components that render links (Button, Avatar) navigate with
 * React Router: pass `as={RouterLink}` and `href`. Astryx hands us `href`;
 * React Router's <Link> wants `to`.
 */
export function RouterLink({ href, ...rest }: Props) {
  return <Link to={href} {...rest} />
}
