// Small stroke icons on a 24px grid, drawn with currentColor.
const common = {
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
} as const

export const CircleAreaIcon = () => (
  <svg {...common}><circle cx="12" cy="12" r="9" strokeDasharray="3 3" /><path d="M12 8v8M8 12h8" /></svg>
)
export const SearchIcon = () => (
  <svg {...common}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
)
export const StowIcon = () => <svg {...common}><path d="M6 12h12" /></svg>
export const CloseIcon = () => <svg {...common}><path d="M6 6l12 12M18 6L6 18" /></svg>
export const PanelIcon = () => (
  <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M14 4v16" /></svg>
)
