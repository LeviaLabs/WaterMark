import { useRef, type ReactNode } from 'react'
import { useTilt } from '../hooks/useTilt.ts'

export function GlassCard({
  children,
  marked = false,
  wide = false,
}: {
  children: ReactNode
  marked?: boolean
  wide?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  useTilt(ref)
  const classes = ['glass-card', marked ? 'glass-card--mark' : '', wide ? 'glass-card--wide' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <article ref={ref} className={classes}>
      {children}
    </article>
  )
}
