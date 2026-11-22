// Past National Flood Insurance Program (NFIP) claims for one ZIP code, live from OpenFEMA
// (NFIP Redacted Claims v3). The API cannot total on the server, so the browser downloads only
// the four columns it needs (about 10 kB gzipped for a busy NYC ZIP) and totals them here.
import { ENDPOINTS } from './endpoints'
import { getJSON } from './http'
import { markFetched } from '../scripting/freshness'

export interface ClaimsSummary {
  zip: string
  claims: number
  /** Building + contents + increased cost of compliance, US dollars as reported. */
  totalPaidUsd: number
  firstYear: number | null
  lastYear: number | null
  /** Years with the most claims, most first (at most 3). */
  topYears: { year: number; claims: number }[]
  /** True when the ZIP had more claims than we page through; totals are then a lower bound. */
  partial: boolean
}

interface RawClaim {
  yearOfLoss?: unknown
  amountPaidOnBuildingClaim?: unknown
  amountPaidOnContentsClaim?: unknown
  amountPaidOnIncreasedCostOfComplianceClaim?: unknown
}

const PAGE = 10000
const MAX_PAGES = 5
const money = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

/** Pure totals over raw rows (exported for tests). */
export function summarizeClaims(zip: string, rows: readonly RawClaim[], partial: boolean): ClaimsSummary {
  const byYear = new Map<number, number>()
  let total = 0
  for (const r of rows) {
    total += money(r.amountPaidOnBuildingClaim) + money(r.amountPaidOnContentsClaim) + money(r.amountPaidOnIncreasedCostOfComplianceClaim)
    if (typeof r.yearOfLoss === 'number' && Number.isInteger(r.yearOfLoss)) byYear.set(r.yearOfLoss, (byYear.get(r.yearOfLoss) ?? 0) + 1)
  }
  const years = [...byYear.keys()].sort((a, b) => a - b)
  return {
    zip,
    claims: rows.length,
    totalPaidUsd: Math.round(total),
    firstYear: years[0] ?? null,
    lastYear: years.at(-1) ?? null,
    topYears: [...byYear].sort((a, b) => b[1] - a[1] || b[0] - a[0]).slice(0, 3).map(([year, claims]) => ({ year, claims })),
    partial,
  }
}

const cache = new Map<string, Promise<ClaimsSummary>>()

async function download(zip: string): Promise<ClaimsSummary> {
  const rows: RawClaim[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = new URLSearchParams({
      $filter: `reportedZipCode eq '${zip}'`,
      $select: 'yearOfLoss,amountPaidOnBuildingClaim,amountPaidOnContentsClaim,amountPaidOnIncreasedCostOfComplianceClaim',
      $top: String(PAGE), $skip: String(page * PAGE), $metadata: 'false',
    })
    // OpenFEMA answers most ZIPs in a second but has taken over 30 s on a cold query, so allow a minute.
    const j = await getJSON<{ NfipClaims?: unknown }>(`${ENDPOINTS.nfipClaims}?${q}`, { timeoutMs: 60_000 })
    if (!Array.isArray(j.NfipClaims)) throw new Error('OpenFEMA returned an unexpected response.')
    rows.push(...(j.NfipClaims as RawClaim[]))
    if (j.NfipClaims.length < PAGE) {
      markFetched('nfip')
      return summarizeClaims(zip, rows, false)
    }
  }
  markFetched('nfip')
  return summarizeClaims(zip, rows, true)
}

/**
 * Claim totals for a US ZIP code. Each ZIP is downloaded once per visit; the download is shared
 * and keeps going if this caller aborts, so reselecting the same area later is instant.
 */
export function fetchClaims(zip: string, signal: AbortSignal): Promise<ClaimsSummary> {
  if (!/^\d{5}$/.test(zip)) return Promise.reject(new Error(`Not a US ZIP code: ${zip}`))
  let job = cache.get(zip)
  if (!job) {
    job = download(zip)
    cache.set(zip, job)
    job.catch(() => cache.delete(zip))
  }
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    job.then(resolve, reject)
  })
}
