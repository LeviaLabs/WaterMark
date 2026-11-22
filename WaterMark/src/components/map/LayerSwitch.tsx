// One choice in the Overlay list: the whole row is a radio button (only one overlay shows at a
// time; choosing the selected one again turns it off). The thumb slides with a transform so it
// animates smoothly everywhere (this team keeps animations on).
interface Props {
  label: string
  /** Where the layer has data, and from whom. */
  detail?: string
  swatch: string
  isOn: boolean
  onChange: (isOn: boolean) => void
}

export function LayerSwitch({ label, detail, swatch, isOn, onChange }: Props) {
  return (
    <button type="button" role="radio" aria-checked={isOn} className={isOn ? 'layer-switch is-on' : 'layer-switch'}
      onClick={() => onChange(!isOn)}>
      <span className="layer-switch-track" aria-hidden="true"><span className="layer-switch-thumb" /></span>
      <span className={`layer-swatch layer-swatch--${swatch}`} aria-hidden="true" />
      <span className="layer-switch-label">{label}{detail ? <span className="layer-switch-detail">{detail}</span> : null}</span>
    </button>
  )
}
