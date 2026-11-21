export type WaterQuality = {
  pixelRatio: number
  detail: number
}

export type WaterQualityInput = {
  devicePixelRatio: number
  viewportWidth: number
  hardwareConcurrency: number
  saveData: boolean
}

/**
 * Caps the canvas backing-store ratio. Small, low-core, and data-saver
 * devices get a cheaper buffer and a simpler shader (detail < 0.5).
 */
export function chooseGridSize(detail: number): { cols: number; rows: number } {
  if (detail < 0.45) return { cols: 64, rows: 44 }
  if (detail < 0.75) return { cols: 110, rows: 72 }
  return { cols: 168, rows: 112 }
}

export function chooseWaterQuality(input: WaterQualityInput): WaterQuality {
  let cap = 1.75
  let detail = 1

  if (input.viewportWidth < 900) {
    cap = 1.35
    detail = 0.65
  }
  if (input.viewportWidth < 600) {
    cap = 1.15
    detail = 0.4
  }
  if (input.hardwareConcurrency > 0 && input.hardwareConcurrency <= 4) {
    cap = Math.min(cap, 1.25)
    detail = Math.min(detail, 0.5)
  }
  if (input.saveData) {
    cap = 1
    detail = Math.min(detail, 0.35)
  }

  const raw = Number.isFinite(input.devicePixelRatio) ? input.devicePixelRatio : 1
  const pixelRatio = Math.min(Math.max(raw, 1), cap)
  return {
    pixelRatio: Math.round(pixelRatio * 100) / 100,
    detail,
  }
}
