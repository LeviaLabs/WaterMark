import { useState, type FormEvent } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Icon } from '../common/Icon'
import { Logo } from '../common/Logo'
import { ThemeToggle } from '../layout/ThemeToggle'
import { CircleAreaIcon, PanelIcon } from './icons'

interface Props {
  isDrawing: boolean
  onToggleDraw: () => void
  onSearch: (text: string) => void
  isSearching: boolean
  showReopen: boolean
  onReopen: () => void
}

/** Floating top bar on /map: the site logo (links home), place search, the circle tool and the theme toggle. */
export function TopBar({ isDrawing, onToggleDraw, onSearch, isSearching, showReopen, onReopen }: Props) {
  const [text, setText] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = text.trim()
    if (q) onSearch(q)
  }

  return (
    <header className="map-topbar">
      <span className="map-card map-brand"><Logo /></span>
      <form className="map-card map-search" role="search" onSubmit={submit}>
        <Icon name="search" size={18} />
        <label htmlFor="map-search-input" className="visually-hidden">Search for a place</label>
        <input id="map-search-input" className="map-search-input" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Search a ZIP code, neighborhood or address" autoComplete="off" />
        <Button type="submit" variant="ghost" label="Search" isLoading={isSearching} />
      </form>
      <div className="map-toolbar">
        <span className={isDrawing ? 'draw-btn is-active' : 'draw-btn'}>
          <Button variant="primary" size="lg" icon={<CircleAreaIcon />}
            label={isDrawing ? 'Cancel circle' : 'Circle an area'} onClick={onToggleDraw} />
        </span>
        <span className="map-card map-theme"><ThemeToggle /></span>
        {showReopen ? (
          <span className="map-card">
            <Button variant="ghost" size="lg" icon={<PanelIcon />} label="Show data panel" onClick={onReopen} />
          </span>
        ) : null}
      </div>
    </header>
  )
}
