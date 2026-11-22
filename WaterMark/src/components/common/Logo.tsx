import { Link } from 'react-router'

/** The WaterMark mark: a droplet with a waterline through it. Same art as public/favicon.svg. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="wm-logo-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fe3f0" />
          <stop offset="1" stopColor="#0b7fa6" />
        </linearGradient>
        <clipPath id="wm-logo-drop">
          <path d="M16 2.5c5.4 6.6 10 12.3 10 17.6a10 10 0 0 1-20 0C6 14.8 10.6 9.1 16 2.5Z" />
        </clipPath>
      </defs>
      <path d="M16 2.5c5.4 6.6 10 12.3 10 17.6a10 10 0 0 1-20 0C6 14.8 10.6 9.1 16 2.5Z" fill="url(#wm-logo-fill)" />
      <g clipPath="url(#wm-logo-drop)">
        <path d="M4 19.5c3 0 3-1.6 6-1.6s3 1.6 6 1.6 3-1.6 6-1.6 3 1.6 6 1.6V32H4Z" fill="#04324a" opacity="0.55" />
        <path d="M4 19.5c3 0 3-1.6 6-1.6s3 1.6 6 1.6 3-1.6 6-1.6 3 1.6 6 1.6" fill="none" stroke="#e9fbff" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </svg>
  )
}

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="WaterMark home">
      <LogoMark />
      <span className="logo-word">
        Water<span className="logo-word-accent">Mark</span>
      </span>
    </Link>
  )
}
