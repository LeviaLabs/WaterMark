import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import { useInView } from '../../hooks/useInView'
import { SKYLINE_LAYERS, viewBoxFor } from '../../scripting/city/skyline'
import { FloodWater } from './FloodWater'
import { Skyline } from './Skyline'

/** Share of the scene height the skyline box takes (matches .city-skyline in city.css). */
const SKYLINE_SHARE = 0.64
/** The skyline box is a little wider than the scene so parallax never shows an edge. */
const SKYLINE_OVERSCAN = 1.08

type Props = {
  /** Water level, 0 (dry) to 1. Omit when a hook writes `--level` directly. */
  level?: number
  /** Rain intensity, 0 to 1. */
  rain?: number
  /** The level is driven every frame by script: skip the CSS easing. */
  live?: boolean
  boat?: boolean
  className?: string
  sceneRef?: Ref<HTMLDivElement>
  children?: ReactNode
}

/**
 * The flooding 2D city: sky, three skyline layers and three water surfaces
 * woven between them, plus rain. Day and night come from the theme (lit
 * windows, stars and the moon at night). Built from SVG and CSS only, so it
 * draws on every device, with or without hardware graphics. Animations pause
 * while the scene is off screen.
 */
export function CityScene({ level, rain = 0, live = false, boat = false, className = '', sceneRef, children }: Props) {
  const layersRef = useRef<HTMLDivElement>(null)
  const visible = useInView(layersRef, { rootMargin: '120px' })
  const [viewBox, setViewBox] = useState(() => viewBoxFor(16 / 9))

  // Recompute the visible slice of the city only when the box changes shape
  // (window resize, browser zoom, phone rotation). No resize listener.
  useEffect(() => {
    const element = layersRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (height <= 0) return
      setViewBox(viewBoxFor((width * SKYLINE_OVERSCAN) / (height * SKYLINE_SHARE)))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const style = {
    ...(level === undefined ? null : { '--level': level.toFixed(4) }),
    '--rain': rain.toFixed(3),
  } as CSSProperties

  const [far, mid, near] = SKYLINE_LAYERS

  return (
    <div
      ref={sceneRef}
      className={`city ${live ? 'city--live' : ''} ${rain > 0 ? 'city--raining' : ''} ${visible ? '' : 'city--paused'} ${className}`}
      style={style}
    >
      <div className="city-sky" aria-hidden="true">
        <span className="city-stars" />
        <span className="city-stars city-stars--twinkle" />
        <span className="city-orb city-orb--sun" />
        <span className="city-orb city-orb--moon" />
        <span className="city-cloud city-cloud--one" />
        <span className="city-cloud city-cloud--two" />
        <span className="city-cloud city-cloud--three" />
      </div>

      <div className="city-layers" ref={layersRef}>
        <Skyline layer={far} viewBox={viewBox} className="city-depth city-depth--far" beacons />
        <FloodWater depth="back" />
        <Skyline layer={mid} viewBox={viewBox} className="city-depth city-depth--mid" beacons />
        <FloodWater depth="mid" />
        <Skyline layer={near} viewBox={viewBox} className="city-depth city-depth--near" />
        <FloodWater depth="front" boat={boat} />
      </div>

      <span className="city-rain" aria-hidden="true" />
      {children}
    </div>
  )
}
