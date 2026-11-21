// The Watermark mark: a flood staff gauge with the waterline in gauge yellow.
// Colors come from CSS (styling/brand.css) so the tile flips for dark mode.
import { useId } from 'react'
import '../../styling/brand.css'

export function LogoMark({ size = 26 }: { size?: number }) {
  const clip = useId()
  return (
    <svg className="logo-mark" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs><clipPath id={clip}><rect width="64" height="64" rx="14" /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>
        <rect className="logo-tile" width="64" height="64" />
        <g className="logo-ticks">
          <rect x="12" y="11" width="20" height="3.6" />
          <rect x="12" y="19" width="11" height="3.6" />
          <rect x="12" y="27" width="20" height="3.6" />
          <rect x="12" y="35" width="11" height="3.6" />
        </g>
        <path className="logo-water" d="M0 44 C6 40 10 40 16 44 S26 48 32 44 S42 40 48 44 S58 48 64 44 V64 H0 Z" />
        <rect className="logo-under" x="12" y="51" width="20" height="3.6" />
      </g>
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <LogoMark />
      Watermark
    </span>
  )
}
