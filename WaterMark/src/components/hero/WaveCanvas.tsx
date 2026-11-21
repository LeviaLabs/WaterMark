import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../../hooks/useTheme'
import { useInView } from '../../hooks/useInView'
import { useFinePointer, usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import { WaveRenderer } from '../../scripting/graphics/WaveRenderer'

/**
 * Interactive WebGL sea. Move the pointer to stir the surface, tap or click to
 * drop a ripple. Draws only while on screen, at reduced resolution (lower on
 * touch devices), capped near 60 fps, and as one still frame when the user
 * prefers reduced motion. Without WebGL the CSS gradient behind it shows.
 */
export function WaveCanvas({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WaveRenderer | null>(null)
  const [failed, setFailed] = useState(false)
  const { scheme } = useTheme()
  const schemeRef = useRef(scheme)
  const visible = useInView(canvasRef)
  const reducedMotion = usePrefersReducedMotion()
  const finePointer = useFinePointer()

  // Create the renderer once per canvas; it lives outside React state.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const renderScale = dpr * (finePointer ? 0.75 : 0.55)
    const renderer = WaveRenderer.create(canvas, schemeRef.current, { renderScale })
    if (!renderer) {
      setFailed(true)
      return
    }
    rendererRef.current = renderer

    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      renderer.resize(width, height)
    })
    resizeObserver.observe(canvas)

    const local = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return [event.clientX - rect.left, event.clientY - rect.top] as const
    }
    const onMove = (event: PointerEvent) => renderer.pointerMove(...local(event))
    const onDown = (event: PointerEvent) => renderer.pointerDown(...local(event))
    const onLeave = () => renderer.pointerLeave()
    canvas.addEventListener('pointermove', onMove, { passive: true })
    canvas.addEventListener('pointerdown', onDown, { passive: true })
    canvas.addEventListener('pointerleave', onLeave, { passive: true })

    const onLost = (event: Event) => {
      event.preventDefault()
      renderer.stop()
      setFailed(true)
    }
    canvas.addEventListener('webglcontextlost', onLost)

    return () => {
      resizeObserver.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('webglcontextlost', onLost)
      renderer.dispose()
      rendererRef.current = null
    }
  }, [finePointer])

  // Animate only while visible and motion is allowed.
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return
    if (visible && !reducedMotion) {
      renderer.start()
    } else {
      renderer.stop()
      renderer.renderStill()
    }
  }, [visible, reducedMotion, finePointer])

  // Day/night crossfade.
  useEffect(() => {
    schemeRef.current = scheme
    rendererRef.current?.setScheme(scheme, !reducedMotion)
  }, [scheme, reducedMotion, finePointer])

  return (
    <canvas
      ref={canvasRef}
      className={`wave-canvas ${failed ? 'wave-canvas--failed' : ''} ${className}`}
      aria-hidden="true"
    />
  )
}
