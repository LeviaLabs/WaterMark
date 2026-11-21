// Pre-downloaded NFIP claim summary written by scripts/watermark_data.py.
// Copy its summary.json to WaterMark/public/data/summary.json; without it the panel says so.
import { ENDPOINTS } from './endpoints'

export interface ClaimsSummary {
  generated_at_utc: string
  neighborhoods: Record<string, {
    zip_codes: string[]
    nfip: { claims: number; total_paid_usd: number; top_events: Record<string, number> }
  }>
}

export async function fetchClaimsSummary(signal?: AbortSignal): Promise<ClaimsSummary | null> {
  try {
    const res = await fetch(ENDPOINTS.claimsSummary, { signal })
    if (!res.ok) return null
    return (await res.json()) as ClaimsSummary
  } catch {
    return null
  }
}

export function neighborhoodForZip(summary: ClaimsSummary, zip: string) {
  return Object.entries(summary.neighborhoods).find(([, v]) => v.zip_codes.includes(zip)) ?? null
}
