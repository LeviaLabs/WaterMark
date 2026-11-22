import type { Building } from './skyline'

/**
 * One SVG path for a building's body and roof, so each building is a single
 * element. Roof details are scaled to the layer's grid cell, so far towers
 * get thin spires and near walk-ups get chunky water tanks.
 */
export function buildingPath(building: Building, cell: number): string {
  const { x, y, width, height } = building
  let d = rect(x, y, width, height)
  const center = x + width / 2

  switch (building.roof) {
    case 'antenna': {
      const mast = Math.max(2, cell * 0.25)
      d += rect(center - cell, y - cell, cell * 2, cell)
      d += rect(center - mast / 2, y - cell * 4, mast, cell * 3)
      break
    }
    case 'spire': {
      const base = Math.min(width * 0.5, cell * 3)
      d += rect(center - base / 2, y - cell, base, cell)
      d += `M${n(center - base / 2)} ${n(y - cell)}L${n(center)} ${n(y - cell * 5)}L${n(center + base / 2)} ${n(y - cell)}Z`
      break
    }
    case 'stepped': {
      const inset = Math.max(cell, Math.round(width / cell / 5) * cell)
      if (width - inset * 2 >= cell * 2) {
        d += rect(x + inset, y - cell * 2, width - inset * 2, cell * 2)
        if (width - inset * 4 >= cell * 2) d += rect(x + inset * 2, y - cell * 3.5, width - inset * 4, cell * 1.5)
      }
      break
    }
    case 'tank': {
      // A New York rooftop water tower: legs, a barrel and a cone.
      const tankWidth = cell * 1.6
      const left = x + Math.min(width - tankWidth - cell * 0.5, cell)
      const legHeight = cell * 0.7
      const barrel = cell * 1.3
      const leg = Math.max(1.5, cell * 0.12)
      d += rect(left + cell * 0.15, y - legHeight, leg, legHeight)
      d += rect(left + tankWidth - cell * 0.15 - leg, y - legHeight, leg, legHeight)
      d += rect(left, y - legHeight - barrel, tankWidth, barrel)
      d += `M${n(left - cell * 0.1)} ${n(y - legHeight - barrel)}L${n(left + tankWidth / 2)} ${n(y - legHeight - barrel - cell * 0.7)}L${n(left + tankWidth + cell * 0.1)} ${n(y - legHeight - barrel)}Z`
      break
    }
    case 'dome': {
      const radius = Math.min(width / 2 - cell / 2, cell * 1.8)
      if (radius > 2) d += `M${n(center - radius)} ${n(y)}A${n(radius)} ${n(radius)} 0 0 1 ${n(center + radius)} ${n(y)}Z`
      break
    }
    case 'flat':
      d += rect(x - 1, y - Math.max(2, cell * 0.2), width + 2, Math.max(2, cell * 0.2))
      break
  }

  return d
}

/** Where the blinking aviation light sits on an antenna, or null. */
export function beaconPoint(building: Building, cell: number): { x: number; y: number } | null {
  if (building.roof !== 'antenna') return null
  return { x: building.x + building.width / 2, y: building.y - cell * 4 }
}

const n = (value: number) => Number(value.toFixed(1))
const rect = (x: number, y: number, w: number, h: number) => `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`
