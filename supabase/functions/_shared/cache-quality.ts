import type { EnvironmentalResult } from "./contracts.ts";

export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export function cacheFreshness<T>(
  result: EnvironmentalResult<T>,
  timestamps: string[],
  now: Date,
): boolean {
  const times = [...timestamps].sort();
  result.cacheOldestFetchedAt = times[0] ?? null;
  result.cacheNewestFetchedAt = times.at(-1) ?? null;
  const staleCount =
    times.filter((time) => now.getTime() - Date.parse(time) > CACHE_MAX_AGE_MS).length;
  if (staleCount) result.qualityFlags.push("STALE_CACHE");
  if (staleCount && staleCount < times.length) result.qualityFlags.push("PARTIALLY_STALE_CACHE");
  return staleCount > 0;
}
