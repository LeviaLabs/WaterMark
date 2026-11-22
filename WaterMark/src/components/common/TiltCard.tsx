import { useRef, type ReactNode } from 'react'
import { usePointerTilt } from '../../hooks/usePointerTilt'

type Props = {
  children: ReactNode
  className?: string
  maxDegrees?: number
}

/**
 * Frosted-glass card that tilts toward the mouse in 3D with a moving glare.
 * The look lives in styling/glass.css (.glass-card); touch devices get a flat card.
 */
export function TiltCard({ children, className = '', maxDegrees = 7 }: Props) {
  const ref = useRef<HTMLElement>(null)
  usePointerTilt(ref, maxDegrees)
  return (
    <article ref={ref} className={`glass-card tilt-card ${className}`}>
      <span className="tilt-card-glare" aria-hidden="true" />
      {children}
    </article>
  )
}
