// Floating data panel: drag it by its header, stow it to an edge tab, or close it.
import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import { Icon } from '../common/Icon'
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
  onStow: () => void
  onClose: () => void
  area: ReactNode
  alerts: ReactNode
  sources: ReactNode
}

export function DataPanel({ title, alertCount, panelRef, style, handleProps, onStow, onClose, area, alerts, sources }: Props) {
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
          <IconButton variant="ghost" size="sm" label="Stow panel to the edge" icon={<StowIcon />} onClick={onStow} />
          <IconButton variant="ghost" size="sm" label="Close panel" icon={<Icon name="close" size={18} />} onClick={onClose} />
        </span>
      </header>
      <nav className="panel-tabs">
        <TabList value={tab} onChange={(v) => setTab(v as TabId)} size="sm">
          <Tab value="area" label="Area" />
          <Tab value="alerts" label={alertCount ? `Alerts (${alertCount})` : 'Alerts'} />
          <Tab value="sources" label="Sources" />
        </TabList>
      </nav>
      <div className="panel-body">
        {tab === 'area' ? area : tab === 'alerts' ? alerts : sources}
      </div>
    </aside>
  )
}

export function StowTab({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="stow-tab" onClick={onOpen} aria-label="Open data panel">
      <span>Area data</span>
    </button>
  )
}
