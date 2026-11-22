import { WAVE_BOX, WAVE_PATHS } from '../../scripting/city/wave'

type Depth = keyof typeof WAVE_PATHS

/**
 * One water surface. The curved wave is an SVG twice the scene's width that
 * CSS slides sideways forever; the whole surface rides up and down on the
 * `--level` variable with a transform. Nothing here repaints per frame.
 */
export function FloodWater({ depth, boat = false }: { depth: Depth; boat?: boolean }) {
  return (
    <div className={`flood flood--${depth}`} aria-hidden="true">
      <div className="flood-surface">
        <span className="flood-swell">
          <svg
            className="flood-wave"
            viewBox={`0 0 ${WAVE_BOX.period * 2} ${WAVE_BOX.height}`}
            preserveAspectRatio="none"
            focusable="false"
          >
            <path d={WAVE_PATHS[depth]} />
          </svg>
        </span>
        <span className="flood-body" />
        {boat && (
          <span className="flood-boat">
            <svg viewBox="0 0 64 44" focusable="false">
              <path className="flood-boat-sail" d="M30 4 30 30 12 30Z" />
              <path className="flood-boat-sail flood-boat-sail--small" d="M34 10 34 30 48 30Z" />
              <path className="flood-boat-mast" d="M31 2h3v29h-3Z" />
              <path className="flood-boat-hull" d="M4 31h56l-8 11H12Z" />
              <circle className="flood-boat-lamp" cx="32.5" cy="3" r="2.2" />
            </svg>
          </span>
        )}
      </div>
    </div>
  )
}
