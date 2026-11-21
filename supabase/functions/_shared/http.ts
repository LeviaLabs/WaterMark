import { readBounded } from "./validation.ts";
export type Fetcher = typeof fetch;
export class ProviderError extends Error {
  constructor(public code: string, public retryAfterSeconds?: number, public httpStatus?: number) {
    super(code);
  }
}
export async function fetchJson(
  url: string,
  init: RequestInit = {},
  fetcher: Fetcher = fetch,
  timeoutMs = 6000,
  allowNoContent = false,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetcher(url, { ...init, redirect: "error", signal: controller.signal });
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(
        controller.signal.aborted ? "PROVIDER_TIMEOUT" : "PROVIDER_NETWORK_ERROR",
      );
    }
    if (response.status === 429) {
      const retry = Number(response.headers.get("retry-after"));
      await response.body?.cancel();
      throw new ProviderError(
        "PROVIDER_RATE_LIMITED",
        Number.isFinite(retry) && retry > 0 ? Math.min(retry, 3600) : 60,
        429,
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new ProviderError("PROVIDER_HTTP_ERROR", undefined, response.status);
    }
    if (allowNoContent && response.status === 204) return null;
    if (
      !/(?:application\/(?:[\w.+-]*\+)?json|application\/geo\+json)/i.test(
        response.headers.get("content-type") ?? "",
      )
    ) throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    return JSON.parse(await readBounded(response.body, 2_000_000));
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      controller.signal.aborted ? "PROVIDER_TIMEOUT" : "INVALID_PROVIDER_RESPONSE",
    );
  } finally {
    clearTimeout(timer);
  }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProviderError("INVALID_PROVIDER_RESPONSE");
  }
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 20000): string {
  if (typeof value !== "string" || value.length > max) {
    throw new ProviderError("INVALID_PROVIDER_RESPONSE");
  }
  return value;
}
export function finite(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ProviderError("INVALID_PROVIDER_RESPONSE");
  }
  return value;
}
export function timestamp(value: unknown, naiveUtc = false): string {
  const raw = text(value, 60);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(raw)) {
    throw new ProviderError("INVALID_PROVIDER_RESPONSE");
  }
  const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(raw);
  if (!hasZone && !naiveUtc) throw new ProviderError("INVALID_PROVIDER_RESPONSE");
  const date = new Date(raw + (hasZone ? "" : "Z"));
  if (!Number.isFinite(date.getTime())) throw new ProviderError("INVALID_PROVIDER_RESPONSE");
  return date.toISOString();
}
