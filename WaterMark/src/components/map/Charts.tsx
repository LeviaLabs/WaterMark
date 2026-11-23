// Small inline SVG charts for the data panel: no chart library, one accent color per chart, thin
// rounded bars and a 2px line, a recessive baseline, and a hover (or touch) readout that names the
// exact value instead of numbers on every mark. Each chart also has an aria-label summary.
import { useId, useState, type PointerEvent, type ReactNode } from 'react'

const W = 320
const H = 96
const PAD_TOP = 6

interface Readout { label: string; value: string }

/** Tracks which of `n` columns the pointer is over. */
function useHover(n: number) {
  const [i, setI] = useState<number | null>(null)
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setI(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n))))
  }
  return { i, bind: { onPointerMove: onMove, onPointerDown: onMove, onPointerLeave: () => setI(null) } }
}

function Frame({ title, readout, fallback, ends, children }: {
  title: string; readout: Readout | null; fallback: ReactNode; ends: [string, string]; children: ReactNode
}) {
  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <span className="chart-title">{title}</span>
        <span className="chart-readout" aria-live="polite">
          {readout ? <><span className="chart-readout-label">{readout.label}</span> {readout.value}</> : fallback}
        </span>
      </figcaption>
      {children}
      <p className="chart-ends" aria-hidden="true"><span>{ends[0]}</span><span>{ends[1]}</span></p>
    </figure>
  )
}

/** One bar per year. */
export function YearBars({ title, data, format, summary, accent = 'accent', highlight = null }: {
  title: string; data: { year: number; value: number }[]; format: (v: number) => string; summary: ReactNode; accent?: 'accent' | 'warm'
  /** A year to mark (the time slider's); the other bars dim. */
  highlight?: number | null
}) {
  const { i: hovered, bind } = useHover(data.length)
  if (!data.length) return null
  const marked = highlight == null ? -1 : data.findIndex((d) => d.year === highlight)
  // The readout shows the hovered year, else the slider's.
  const i = hovered ?? (marked >= 0 ? marked : null)
  const max = Math.max(...data.map((d) => d.value)) || 1
  const step = W / data.length
  const gap = Math.min(2, step * 0.25)
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a))
  return (
    <Frame title={title} fallback={summary} ends={[String(data[0].year), String(data.at(-1)!.year)]}
      readout={i == null ? null : { label: String(data[i].year), value: format(data[i].value) }}>
      <svg className={`chart-svg chart--${accent}${marked >= 0 ? ' has-current' : ''}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
        aria-label={`${title}, ${data[0].year} to ${data.at(-1)!.year}. Highest: ${format(peak.value)} in ${peak.year}.`} {...bind}>
        <line className="chart-base" x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} />
        {data.map((d, k) => {
          // A zero year gets a short tick on the baseline, so it reads as "none" rather than "no data".
          const isZero = !(d.value > 0)
          const h = isZero ? 3 : Math.max(2, ((H - PAD_TOP) * d.value) / max)
          return (
            <rect key={d.year} className={`chart-bar${isZero ? ' is-zero' : ''}${k === hovered ? ' is-hot' : ''}${k === marked ? ' is-current' : ''}`} x={k * step + gap / 2} y={H - h}
              width={Math.max(1, step - gap)} height={h} rx={isZero ? 0 : Math.min(2, (step - gap) / 2)} />
          )
        })}
      </svg>
    </Frame>
  )
}

/** Daily rain bars: the past 30 days muted, today marked, the forecast in the accent. Null days are gaps, not zero. */
export function RainOutlookChart({ time, mm, today, format, summary }: {
  time: string[]; mm: readonly (number | null)[]; today: number; format: (mm: number) => string; summary: ReactNode
}) {
  const { i, bind } = useHover(time.length)
  const known = mm.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const max = Math.max(5, ...known)
  const step = W / time.length
  const gap = Math.min(2, step * 0.3)
  const day = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const at = i == null ? null : mm[i]
  return (
    <Frame title="Rain, past 30 days and next 16" fallback={summary} ends={[day(time[0]), day(time.at(-1)!)]}
      readout={i == null ? null : {
        label: `${day(time[i])}${i > today ? ' (forecast)' : i === today ? ' (today)' : ''}`,
        value: at == null || !Number.isFinite(at) ? '—' : format(at),
      }}>
      <svg className="chart-svg chart--accent" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
        aria-label={`Daily rain from ${day(time[0])} to ${day(time.at(-1)!)}; days after today are forecast.`} {...bind}>
        <line className="chart-base" x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} />
        {today >= 0 ? <rect className="chart-future" x={today * step} y="0" width={W - today * step} height={H} /> : null}
        {mm.map((v, k) => {
          const amount = typeof v === 'number' && Number.isFinite(v) ? v : null
          const h = amount == null ? 0 : Math.max(amount > 0 ? 1.5 : 0, ((H - PAD_TOP) * amount) / max)
          const cls = `chart-bar${today >= 0 && k < today ? ' is-past' : ''}${k === i ? ' is-hot' : ''}`
          return <rect key={time[k]} className={cls} x={k * step + gap / 2} y={H - h} width={Math.max(1, step - gap)} height={h} rx="1.5" />
        })}
        {today >= 0 ? <line className="chart-today" x1={today * step} x2={today * step} y1="0" y2={H} /> : null}
      </svg>
    </Frame>
  )
}

/** River flow: the forecast spread as bands (min to max, 25th to 75th percentile) and the flow as a line. */
export function FlowChart({ time, flow, p25, p75, min, max, today, format, summary }: {
  time: string[]; flow: (number | null)[]; p25: (number | null)[]; p75: (number | null)[]
  min: (number | null)[]; max: (number | null)[]; today: number; format: (v: number) => string; summary: ReactNode
}) {
  const clip = useId()
  const { i, bind } = useHover(time.length)
  const all = [...flow, ...max].filter((v): v is number => v != null)
  if (!all.length) return null
  const top = Math.max(...all) * 1.05 || 1
  const x = (k: number) => (k / Math.max(1, time.length - 1)) * W
  const y = (v: number) => H - ((H - PAD_TOP) * v) / top
  const line = (vals: (number | null)[]) => vals.map((v, k) => (v == null ? '' : `${x(k)},${y(v)}`)).filter(Boolean).join(' ')
  const band = (lo: (number | null)[], hi: (number | null)[]) => {
    const idx = time.map((_, k) => k).filter((k) => lo[k] != null && hi[k] != null)
    if (idx.length < 2) return ''
    return [...idx.map((k) => `${x(k)},${y(hi[k]!)}`), ...idx.reverse().map((k) => `${x(k)},${y(lo[k]!)}`)].join(' ')
  }
  const day = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const at = i == null ? null : flow[i] ?? null
  return (
    <Frame title="River flow, past 60 days and next 3 months" fallback={summary} ends={[day(time[0]), day(time.at(-1)!)]}
      readout={i == null || at == null ? null : {
        label: `${day(time[i])}${i > today ? ' (forecast)' : ''}`,
        value: `${format(at)}${i > today && p25[i] != null && p75[i] != null ? `, likely ${format(p25[i]!)} to ${format(p75[i]!)}` : ''}`,
      }}>
      <svg className="chart-svg chart--accent" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
        aria-label={`Modeled river flow from ${day(time[0])} to ${day(time.at(-1)!)}, with the forecast range shaded.`} {...bind}>
        <defs><clipPath id={clip}><rect x="0" y="0" width={W} height={H} /></clipPath></defs>
        <g clipPath={`url(#${clip})`}>
          <line className="chart-base" x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} />
          <polygon className="chart-band chart-band--wide" points={band(min, max)} />
          <polygon className="chart-band" points={band(p25, p75)} />
          <polyline className="chart-line" points={line(flow)} vectorEffect="non-scaling-stroke" />
          {today >= 0 ? <line className="chart-today" x1={x(today)} x2={x(today)} y1="0" y2={H} /> : null}
          {i != null && at != null ? <line className="chart-cross" x1={x(i)} x2={x(i)} y1="0" y2={H} /> : null}
        </g>
      </svg>
    </Frame>
  )
}

/** Twelve month bars for "when floods happen here". */
export function MonthBars({ counts, summary }: { counts: number[]; summary: ReactNode }) {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const { i, bind } = useHover(12)
  const max = Math.max(1, ...counts)
  const step = W / 12
  return (
    <Frame title="By month" fallback={summary} ends={['Jan', 'Dec']}
      readout={i == null ? null : { label: names[i], value: `${counts[i].toLocaleString('en-US')} recorded` }}>
      <svg className="chart-svg chart--accent chart-svg--short" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
        aria-label={`Recorded floods by month; most in ${names[counts.indexOf(Math.max(...counts))]}.`} {...bind}>
        <line className="chart-base" x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} />
        {counts.map((c, k) => {
          const h = c > 0 ? Math.max(2, ((H - PAD_TOP) * c) / max) : 3
          return <rect key={names[k]} className={`chart-bar${c > 0 ? '' : ' is-zero'}${k === i ? ' is-hot' : ''}`} x={k * step + 2} y={H - h} width={step - 4} height={h} rx="2" />
        })}
      </svg>
    </Frame>
  )
}

/** A row of buttons that switches which measure a chart shows. */
export function MetricSwitch({ label, value, options, onChange }: {
  label: string; value: string; options: { id: string; label: string }[]; onChange: (id: string) => void
}) {
  return (
    <p className="metric-switch" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === value}
          className={o.id === value ? 'metric-switch-btn is-on' : 'metric-switch-btn'} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </p>
  )
}
