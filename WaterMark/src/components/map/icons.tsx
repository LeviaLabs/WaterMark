// Map-only stroke icons, drawn like components/common/Icon (24px grid, 1.8 stroke, currentColor).
// The dashed circle and panel shapes need more than one path, so they live here.
const common = {
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
} as const

export const CircleAreaIcon = () => (
  <svg {...common}><circle cx="12" cy="12" r="9" strokeDasharray="3 3" /><path d="M12 8v8M8 12h8" /></svg>
)
export const StowIcon = () => <svg {...common}><path d="M6 12h12" /></svg>
export const PanelIcon = () => (
  <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M14 4v16" /></svg>
)
