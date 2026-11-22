import { useEffect, useRef, type PointerEvent } from 'react'
import { scrollForOffset, thumbGeometry } from '../../scripting/scroll/thumb'

/**
 * A glowing scrollbar on the right edge, in place of the browser's (hidden
 * in scrollbar.css). Drag the thumb or click the track to move; keyboard,
 * wheel and touch scrolling are untouched, so it is hidden from assistive
 * tech as pure decoration.
 *
 * One passive scroll listener (the page position is truly needed here) does
 * its work at most once per frame, writing only `transform`. A
 * ResizeObserver catches page-length and window changes.
 */
export function ScrollGlow() {
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startY: number; startScroll: number } | null>(null)

  useEffect(() => {
    const track = trackRef.current
    const thumb = thumbRef.current
    if (!track || !thumb) return
    let frame = 0
    let size = 0

    const update = () => {
      frame = 0
      const thumbBox = thumbGeometry({
        scrollTop: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        trackHeight: track.clientHeight,
      })
      track.classList.toggle('scroll-glow--idle', thumbBox === null)
      if (!thumbBox) return
      if (Math.abs(thumbBox.size - size) > 0.5) {
        size = thumbBox.size
        thumb.style.height = `${size.toFixed(1)}px`
      }
      thumb.style.transform = `translate3d(0, ${thumbBox.offset.toFixed(1)}px, 0)`
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    window.addEventListener('scroll', schedule, { passive: true })
    const observer = new ResizeObserver(schedule)
    observer.observe(document.body)
    observer.observe(track)
    schedule()

    return () => {
      window.removeEventListener('scroll', schedule)
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  const metrics = () => {
    const track = trackRef.current
    const thumb = thumbRef.current
    if (!track || !thumb) return null
    return {
      trackHeight: track.clientHeight,
      size: thumb.offsetHeight,
      scrollable: document.documentElement.scrollHeight - window.innerHeight,
    }
  }

  const onThumbDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { startY: event.clientY, startScroll: window.scrollY }
    trackRef.current?.classList.add('is-dragging')
  }

  const onThumbMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    const m = metrics()
    if (!start || !m || m.trackHeight <= m.size) return
    const top = start.startScroll + ((event.clientY - start.startY) * m.scrollable) / (m.trackHeight - m.size)
    window.scrollTo({ top, behavior: 'instant' })
  }

  const onThumbUp = () => {
    drag.current = null
    trackRef.current?.classList.remove('is-dragging')
  }

  const onTrackDown = (event: PointerEvent<HTMLDivElement>) => {
    const m = metrics()
    const track = trackRef.current
    if (event.button !== 0 || !m || !track) return
    const offset = event.clientY - track.getBoundingClientRect().top - m.size / 2
    window.scrollTo({ top: scrollForOffset(offset, m.trackHeight, m.size, m.scrollable), behavior: 'smooth' })
  }

  return (
    <div ref={trackRef} className="scroll-glow scroll-glow--idle" aria-hidden="true" onPointerDown={onTrackDown}>
      <div
        ref={thumbRef}
        className="scroll-glow-thumb"
        onPointerDown={onThumbDown}
        onPointerMove={onThumbMove}
        onPointerUp={onThumbUp}
        onPointerCancel={onThumbUp}
        onLostPointerCapture={onThumbUp}
      />
    </div>
  )
}
