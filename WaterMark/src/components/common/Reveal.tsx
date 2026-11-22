import { useRef, type ReactNode } from 'react'
import { useInView } from '../../hooks/useInView'

/** Fades and lifts its content in the first time it scrolls into view (CSS in base.css). */
export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInView(ref, { once: true, rootMargin: '0px 0px -10% 0px' })
  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
