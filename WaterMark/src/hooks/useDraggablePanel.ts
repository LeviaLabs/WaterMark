// Position and mode (open, stowed to an edge tab, closed) for the floating data panel.
// Drag by the header with a pointer or the arrow keys; double-click resets. Phones get a bottom sheet.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { PanelMode } from '../scripting/types'

const KEY = 'wm-panel'
const MOBILE = '(max-width: 700px)'
const KEEP_VISIBLE = 48 // px of header that must stay on screen

interface Saved { mode: PanelMode; x: number | null; y: number | null }

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>
    // Every visit starts tucked away (only the position is remembered); choosing an area opens it.
    return { mode: 'stowed', x: s.x ?? null, y: s.y ?? null }
  } catch {
    return { mode: 'stowed', x: null, y: null }
  }
}
function save(s: Saved) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* position just won't persist */ }
}

export function useDraggablePanel() {
  const [state, setState] = useState<Saved>(load)
  const panelRef = useRef<HTMLElement>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const isMobile = () => matchMedia(MOBILE).matches

  const clamp = useCallback((x: number, y: number) => {
    const w = panelRef.current?.offsetWidth ?? 0
    return {
      x: Math.max(0, Math.min(x, innerWidth - Math.min(w, innerWidth))),
      y: Math.max(0, Math.min(y, innerHeight - KEEP_VISIBLE)),
    }
  }, [])

  const update = useCallback((next: Partial<Saved>, persist = true) => {
    setState((s) => {
      const merged = { ...s, ...next }
      if (persist) save(merged)
      return merged
    })
  }, [])

  // Re-clamp once when the window is resized so the panel can't end up off screen.
  useEffect(() => {
    const onResize = () => setState((s) => (s.x == null || s.y == null ? s : { ...s, ...clamp(s.x, s.y) }))
    addEventListener('resize', onResize)
    return () => removeEventListener('resize', onResize)
  }, [clamp])

  const handleProps = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (isMobile() || e.button !== 0 || !panelRef.current) return
      if ((e.target as HTMLElement).closest('button')) return
      const r = panelRef.current.getBoundingClientRect()
      drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (!drag.current) return
      update(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy), false)
    },
    onPointerUp: () => {
      if (!drag.current) return
      drag.current = null
      setState((s) => { save(s); return s })
    },
    onPointerCancel: () => { drag.current = null },
    onDoubleClick: () => update({ x: null, y: null }),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      const step = e.shiftKey ? 60 : 20
      const d = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as const)[
        e.key as 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown']
      if (!d || isMobile() || !panelRef.current) return
      e.preventDefault()
      const r = panelRef.current.getBoundingClientRect()
      update(clamp((state.x ?? r.left) + d[0], (state.y ?? r.top) + d[1]))
    },
  }

  const style = state.x == null || state.y == null ? undefined : { left: state.x, top: state.y, right: 'auto' }

  return {
    mode: state.mode,
    setMode: (mode: PanelMode) => update({ mode }),
    panelRef,
    handleProps,
    style,
  }
}
