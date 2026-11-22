// Floating data panel: drag it by its header, or collapse it into a small card (CollapsedPanel)
// that keeps the area's name and alert count in view. The body scrolls with the site's glowing
// scrollbar (common/ScrollArea).
import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import { ScrollArea } from '../common/ScrollArea'
import { StowIcon } from './icons'
import '../../styling/data-panel.css'

type TabId = 'area' | 'alerts' | 'sources'

interface Props {
  title: string
  alertCount: number
  panelRef: RefObject<HTMLElement | null>
  style: CSSProperties | undefined
  handleProps: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void
    onPointerMove: (e: PointerEvent<HTMLElement>) => void
    onPointerUp: () => void
    onPointerCancel: () => void
    onDoubleClick: () => void
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  }
  onCollapse: () => void
  area: ReactNode
  alerts: ReactNode
  sources: ReactNode
}

export function DataPanel({ title, alertCount, panelRef, style, handleProps, onCollapse, area, alerts, sources }: Props) {
  const [tab, setTab] = useState<TabId>('area')
  return (
    <aside ref={panelRef} className="map-card data-panel" style={style} aria-label="Area data">
      <header className="panel-head">
        <div className="panel-handle" tabIndex={0} {...handleProps}
          aria-label="Data panel header. Drag, or use the arrow keys, to move it. Double-click to reset its position.">
          <p className="panel-eyebrow">Area data</p>
          <h2 className="panel-title">{title}</h2>
        </div>
        <span className="panel-actions">
          <IconButton variant="ghost" size="sm" label="Collapse panel" icon={<StowIcon />} onClick={onCollapse} />
        </span>
      </header>
      <nav className="panel-tabs">
        <TabList value={tab} onChange={(v) => setTab(v as TabId)} size="sm">
          <Tab value="area" label="Area" />
          <Tab value="alerts" label={alertCount ? `Alerts (${alertCount})` : 'Alerts'} />
          <Tab value="sources" label="Sources" />
        </TabList>
      </nav>
      <ScrollArea className="panel-scroll">
        <div className="panel-body">
          {tab === 'area' ? area : tab === 'alerts' ? alerts : sources}
        </div>
      </ScrollArea>
    </aside>
  )
}

/** The panel folded away: a small card in the panel's place that opens it again. */
export function CollapsedPanel({ title, alertCount, onOpen }: { title: string; alertCount: number; onOpen: () => void }) {
  return (
    <button type="button" className="map-card panel-collapsed" onClick={onOpen} aria-label={`Open area data for ${title}`}>
      <span className="panel-collapsed-text">
        <span className="panel-eyebrow">Area data</span>
        <span className="panel-collapsed-title">{title}</span>
      </span>
      {alertCount ? (
        <span className="panel-collapsed-alerts">{alertCount} alert{alertCount === 1 ? '' : 's'}</span>
      ) : null}
      <svg className="panel-collapsed-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  )
}
