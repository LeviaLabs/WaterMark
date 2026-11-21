import type { LayerPattern } from '../../scripting/content/evidenceLayers'

/** Same stylized coastline on every plate so the layers read as one place. */
const LAND = 'M0 0H124C112 28 138 46 120 72C102 96 130 112 113 140C99 162 122 180 106 200H0Z'

/** Artwork for one plate of the evidence stack. Decorative: colors come from CSS. */
export function LayerArt({ pattern }: { pattern: LayerPattern }) {
  return (
    <svg className={`layer-art layer-art--${pattern}`} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <path className="layer-land" d={LAND} />
      <path className="layer-coast" d="M124 0C112 28 138 46 120 72C102 96 130 112 113 140C99 162 122 180 106 200" />
      {pattern === 'warning' && (
        <g className="layer-ink">
          <path className="layer-dash" d="M40 30L150 22L176 96L150 170L56 178L22 104Z" />
          <path d="M100 76L120 112H80Z" />
          <path className="layer-cut" d="M100 88V100M100 105V106" />
        </g>
      )}
      {pattern === 'rain' && (
        <g className="layer-ink">
          {Array.from({ length: 24 }, (_, i) => {
            const x = 18 + (i % 6) * 32 + (Math.floor(i / 6) % 2) * 14
            const y = 22 + Math.floor(i / 6) * 44
            return <path key={i} d={`M${x} ${y}l-7 16`} />
          })}
        </g>
      )}
      {pattern === 'river' && (
        <g className="layer-ink">
          <path d="M20 0C40 40 10 70 46 96C78 118 60 150 112 140" />
          <circle cx="46" cy="96" r="5" />
          <circle cx="86" cy="134" r="5" />
        </g>
      )}
      {pattern === 'stormwater' && (
        <g className="layer-ink layer-fill">
          <ellipse cx="62" cy="58" rx="26" ry="14" />
          <ellipse cx="90" cy="118" rx="20" ry="12" />
          <ellipse cx="44" cy="150" rx="30" ry="16" />
          <ellipse cx="96" cy="176" rx="14" ry="8" />
        </g>
      )}
      {pattern === 'sensors' && (
        <g className="layer-ink">
          {[
            [56, 48],
            [100, 92],
            [40, 128],
            [92, 166],
            [150, 60],
          ].map(([cx, cy]) => (
            <g key={`${cx}-${cy}`}>
              <circle className="layer-dot" cx={cx} cy={cy} r="4" />
              <circle cx={cx} cy={cy} r="11" />
            </g>
          ))}
        </g>
      )}
      {pattern === 'history' && (
        <g className="layer-ink">
          <path className="layer-hatch" d="M70 90C90 70 128 88 116 118C108 138 128 160 104 186L46 190C30 160 40 112 70 90Z" />
          <path d="M26 36h18M26 46h28M26 56h12" />
        </g>
      )}
    </svg>
  )
}
