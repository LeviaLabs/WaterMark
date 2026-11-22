import { Button } from '@astryxdesign/core/Button'
import { Logo } from '../common/Logo'
import { ThemeToggle } from '../layout/ThemeToggle'
import { CircleAreaIcon } from './icons'
import { MapSearch } from './MapSearch'
import type { GeocodedPlace } from '../../services/geocoding/photon'
import type { LngLat } from '../../scripting/types'

interface Props {
  isDrawing: boolean
  onToggleDraw: () => void
  searchNear: LngLat
  onPick: (place: GeocodedPlace) => void
}

/** Floating top bar on /map: the site logo (links home), place search, the circle tool and the theme toggle. */
export function TopBar({ isDrawing, onToggleDraw, searchNear, onPick }: Props) {
  return (
    <header className="map-topbar">
      <span className="map-card map-brand"><Logo /></span>
      <MapSearch near={searchNear} onPick={onPick} />
      <div className="map-toolbar">
        <span className={isDrawing ? 'draw-btn is-active' : 'draw-btn'}>
          <Button variant="primary" size="lg" icon={<CircleAreaIcon />}
            label={isDrawing ? 'Cancel circle' : 'Circle an area'} onClick={onToggleDraw} />
        </span>
        <span className="map-card map-theme"><ThemeToggle /></span>
      </div>
    </header>
  )
}
