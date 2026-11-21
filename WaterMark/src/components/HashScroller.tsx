import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.ts'

export function HashScroller() {
  const { hash, pathname } = useLocation()
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (!hash) return
    const target = document.getElementById(hash.slice(1))
    if (!target) return
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }, [hash, pathname, reduced])

  return null
}
