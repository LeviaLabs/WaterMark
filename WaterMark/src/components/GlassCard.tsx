import { useRef, type ReactNode } from 'react'
import { useTilt } from '../hooks/useTilt.ts'

export function GlassCard({
  children,
  marked = false,
}: {
  children: ReactNode
  marked?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  useTilt(ref)
  return (
    <article ref={ref} className={marked ? 'glass-card glass-card--mark' : 'glass-card'}>
      {children}
    </article>
  )
}
