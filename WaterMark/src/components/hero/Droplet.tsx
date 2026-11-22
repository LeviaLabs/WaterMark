import type { CSSProperties } from 'react'

/**
 * The hero's centerpiece: the WaterMark droplet as a glass drop of water.
 *
 * It is one shape (the logo's own outline) drawn in layers: tinted glass, the
 * water inside with two waves sliding over each other, drifting light and a
 * few rising bubbles, then the rim and highlights on top. A hairline waterline
 * runs from the water's surface across the whole hero.
 *
 * Nothing here is data and nothing needs explaining. Moving the pointer tips
 * the drop and the water sloshes level against it (CSS transitions do the
 * easing, from the hero's --px); scrolling down fills it (the hero's
 * --progress), leading into "Watch the water rise" below. All motion is
 * transform and opacity.
 */

const DROP = 'M16 2.5c5.4 6.6 10 12.3 10 17.6a10 10 0 0 1-20 0C6 14.8 10.6 9.1 16 2.5Z'
const VIEW_BOX = '6 2.5 20 27.6'

/** Two periods of a gentle wave over a 400-wide tile; sliding it by half loops seamlessly. */
const WAVE = 'M0 14 C25 4 75 4 100 14 S175 24 200 14 S275 4 300 14 S375 24 400 14 V40 H0 Z'

const BUBBLES = [
  { x: 0.34, size: 7, rise: 7, start: -1 },
  { x: 0.58, size: 5, rise: 9, start: -4 },
  { x: 0.46, size: 9, rise: 11, start: -7 },
  { x: 0.68, size: 4, rise: 8, start: -2.5 },
  { x: 0.4, size: 5, rise: 10, start: -5.5 },
]

export function Droplet() {
  return (
    <div className="droplet" aria-hidden="true">
      <span className="droplet-waterline">
        <span className="droplet-glint" />
      </span>

      <span className="droplet-floor">
        <span className="droplet-ripple" />
        <span className="droplet-ripple" />
        <span className="droplet-ripple" />
      </span>

      <span className="droplet-body">
        <span className="droplet-glass" />

        <span className="droplet-water">
          <span className="droplet-slosh">
            <span className="droplet-level">
              <svg className="droplet-wave droplet-wave--back" viewBox="0 0 400 40" preserveAspectRatio="none">
                <path d={WAVE} />
              </svg>
              <svg className="droplet-wave droplet-wave--front" viewBox="0 0 400 40" preserveAspectRatio="none">
                <path d={WAVE} />
              </svg>
              <span className="droplet-deep">
                <span className="droplet-caustic" />
                <span className="droplet-caustic droplet-caustic--2" />
              </span>
            </span>
          </span>
          {BUBBLES.map((bubble, index) => (
            <span
              key={index}
              className="droplet-bubble"
              style={
                {
                  '--x': bubble.x,
                  '--size': `${bubble.size}px`,
                  '--rise': `${bubble.rise}s`,
                  '--start': `${bubble.start}s`,
                } as CSSProperties
              }
            />
          ))}
        </span>

        <svg className="droplet-shine" viewBox={VIEW_BOX} preserveAspectRatio="none">
          <defs>
            <linearGradient id="droplet-rim" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className="droplet-rim-a" />
              <stop offset="0.55" className="droplet-rim-b" />
              <stop offset="1" className="droplet-rim-c" />
            </linearGradient>
            <linearGradient id="droplet-gleam" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="droplet-rim" d={DROP} />
          {/* A long curved highlight down the left side, and a bright spot where the light hits. */}
          <path className="droplet-gleam" d="M10.4 15.6c1.3-3 3-5.6 4.6-8-1.1 2.6-2.4 5.4-3.2 8.6-.7 2.6-.8 5.2-.2 7.6-1.6-2.3-2.1-5.2-1.2-8.2Z" />
          <ellipse className="droplet-spark" cx="21.2" cy="15.4" rx="0.9" ry="1.6" transform="rotate(-28 21.2 15.4)" />
        </svg>
      </span>
    </div>
  )
}
