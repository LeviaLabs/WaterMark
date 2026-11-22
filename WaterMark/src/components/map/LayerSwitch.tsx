// An on/off row for one map layer: the whole row is the switch, and the thumb slides with a
// transform so it animates smoothly everywhere (the design system's switch turns its motion off
// when the system asks for reduced motion, and this team keeps animations on).
interface Props {
  label: string
  swatch: string
  isOn: boolean
  onChange: (isOn: boolean) => void
}

export function LayerSwitch({ label, swatch, isOn, onChange }: Props) {
  return (
    <button type="button" role="switch" aria-checked={isOn} className={isOn ? 'layer-switch is-on' : 'layer-switch'}
      onClick={() => onChange(!isOn)}>
      <span className="layer-switch-track" aria-hidden="true"><span className="layer-switch-thumb" /></span>
      <span className={`layer-swatch layer-swatch--${swatch}`} aria-hidden="true" />
      <span className="layer-switch-label">{label}</span>
    </button>
  )
}
