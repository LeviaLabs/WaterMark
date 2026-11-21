import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@astryxdesign/core/Button'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Wordmark } from '../brand/Logo'
import { CircleAreaIcon, PanelIcon, SearchIcon } from './icons'
import { useColorScheme } from '../../hooks/useColorScheme'
import type { ColorScheme } from '../../scripting/types'

interface Props {
  isDrawing: boolean
  onToggleDraw: () => void
  onSearch: (text: string) => void
  isSearching: boolean
  showReopen: boolean
  onReopen: () => void
}

export function TopBar({ isDrawing, onToggleDraw, onSearch, isSearching, showReopen, onReopen }: Props) {
  const { scheme, setScheme } = useColorScheme()
  const [text, setText] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = text.trim()
    if (q) onSearch(q)
  }

  return (
    <header className="map-topbar">
      <Link to="/" className="map-card map-brand" aria-label="Watermark home"><Wordmark /></Link>
      <form className="map-card map-search" role="search" onSubmit={submit}>
        <SearchIcon />
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
        <span className="map-card map-segment">
          <SegmentedControl label="Map colors" value={scheme} onChange={(v) => setScheme(v as ColorScheme)}>
            <SegmentedControlItem value="light" label="Light" />
            <SegmentedControlItem value="dark" label="Dark" />
          </SegmentedControl>
        </span>
        {showReopen ? (
          <span className="map-card">
            <Button variant="ghost" size="lg" icon={<PanelIcon />} label="Show data panel" onClick={onReopen} />
          </span>
        ) : null}
      </div>
    </header>
  )
}
