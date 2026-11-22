import { Logo } from '../common/Logo'
import { ThemeToggle } from '../layout/ThemeToggle'
import { CircleAreaIcon } from './icons'
import { MapSearch } from './MapSearch'
import type { GeocodedPlace } from '../../services/geocoding/photon'
import type { LngLat } from '../../scripting/types'

interface Props {
  isDrawing: boolean
  onToggleDraw: () => void
  searchNear: LngLat | null
  onPick: (place: GeocodedPlace) => void
  carOn: boolean
  onToggleCar: () => void
}

/**
 * Floating top bar on /map: the site logo (links home), place search, the circle tool and the theme
 * toggle. Always one row: as the window narrows the search shrinks, then the circle button and the
 * logo drop their words and keep their icons.
 */
export function TopBar({ isDrawing, onToggleDraw, searchNear, onPick, carOn, onToggleCar }: Props) {
  return (
    <header className="map-topbar">
      <span className="map-card map-brand"><Logo /></span>
      <MapSearch near={searchNear} onPick={onPick} />
      <div className="map-toolbar">
        {/* The label hides on narrow screens (map-page.css); the accessible name stays. */}
        <button type="button" className={isDrawing ? 'draw-btn is-active' : 'draw-btn'} onClick={onToggleDraw}
          aria-pressed={isDrawing} aria-label={isDrawing ? 'Cancel circle' : 'Circle an area'}
          title={isDrawing ? 'Cancel circle' : 'Circle an area'}>
          <CircleAreaIcon />
          <span className="draw-btn-label">{isDrawing ? 'Cancel circle' : 'Circle an area'}</span>
        </button>
        <button type="button" className={carOn ? 'draw-btn is-active' : 'draw-btn'} onClick={onToggleCar}
          aria-pressed={carOn} aria-label={carOn ? 'Hide move your car' : 'Move your car'}
          title={carOn ? 'Hide move your car' : 'Move your car'}>
          <CircleAreaIcon />
          <span className="draw-btn-label">{carOn ? 'Hide car spots' : 'Move your car'}</span>
        </button>
        <span className="map-card map-theme"><ThemeToggle /></span>
      </div>
    </header>
  )
}
