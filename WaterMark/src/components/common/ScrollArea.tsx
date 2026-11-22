import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react'
import { scrollForOffset, thumbGeometry } from '../../scripting/scroll/thumb'

/**
 * An inner scroll area with the native scrollbar hidden and a slim glowing
 * thumb in its place (the same look and math as the page scrollbar). The
 * thumb only shows when there is something to scroll, brightens while you
 * scroll or hover, and can be dragged. Smooth page scrolling leaves it alone
 * (data-lenis-prevent).
 */
export function ScrollArea({ className = '', children }: { className?: string; children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLSpanElement>(null)
  const drag = useRef<{ startY: number; startOffset: number } | null>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    const thumb = thumbRef.current
    if (!viewport || !thumb) return
    let frame = 0
    const draw = () => {
      frame = 0
      const geometry = thumbGeometry({
        scrollTop: viewport.scrollTop,
        scrollHeight: viewport.scrollHeight,
        viewportHeight: viewport.clientHeight,
        trackHeight: viewport.clientHeight - 16,
        minThumb: 28,
      })
      // A few pixels of overflow (borders, rounding) is not worth a scrollbar.
      if (!geometry || viewport.scrollHeight - viewport.clientHeight < 8) {
        thumb.dataset.hidden = ''
        return
      }
      delete thumb.dataset.hidden
      thumb.style.height = `${geometry.size}px`
      thumb.style.transform = `translateY(${geometry.offset}px)`
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw)
    }
    const resize = new ResizeObserver(schedule)
    resize.observe(viewport)
    if (viewport.firstElementChild) resize.observe(viewport.firstElementChild)
    viewport.addEventListener('scroll', schedule, { passive: true })
    schedule()
    return () => {
      resize.disconnect()
      viewport.removeEventListener('scroll', schedule)
      cancelAnimationFrame(frame)
    }
  }, [])

  const onThumbDown = (event: PointerEvent<HTMLSpanElement>) => {
    const viewport = viewportRef.current
    if (!viewport || event.button !== 0) return
    event.preventDefault()
    const offset = new DOMMatrixReadOnly(getComputedStyle(event.currentTarget).transform).m42
    drag.current = { startY: event.clientY, startOffset: offset }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onThumbMove = (event: PointerEvent<HTMLSpanElement>) => {
    const viewport = viewportRef.current
    const start = drag.current
    if (!viewport || !start) return
    const track = viewport.clientHeight - 16
    const size = event.currentTarget.offsetHeight
    viewport.scrollTop = scrollForOffset(
      start.startOffset + event.clientY - start.startY,
      track,
      size,
      viewport.scrollHeight - viewport.clientHeight,
    )
  }

  const onThumbUp = () => {
    drag.current = null
  }

  return (
    <div className={`scroll-area ${className}`}>
      <div ref={viewportRef} className="scroll-area-viewport" data-lenis-prevent>
        {children}
      </div>
      <span
        ref={thumbRef}
        className="scroll-area-thumb"
        data-hidden=""
        aria-hidden="true"
        onPointerDown={onThumbDown}
        onPointerMove={onThumbMove}
        onPointerUp={onThumbUp}
        onPointerCancel={onThumbUp}
      />
    </div>
  )
}
