import type {
  Area,
  BackendStore,
  EnvironmentalResult,
  FloodNetData,
  Location,
  ProviderStatus,
} from "./contracts.ts";
import { type Fetcher, fetchJson, record, text, timestamp } from "./http.ts";

export function createStore(baseUrl: string, key: string, fetcher: Fetcher = fetch): BackendStore {
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  const rpc = (name: string, body: unknown = {}, allowNoContent = false) =>
    fetchJson(
      `${baseUrl}/rest/v1/rpc/${name}`,
      { method: "POST", headers, body: JSON.stringify(body) },
      fetcher,
      4000,
      allowNoContent,
    );
  return {
    async takeBudget() {
      const value = await rpc("watermark_take_budget");
      if (typeof value !== "boolean") throw new Error("Invalid budget response");
      return value;
    },
    async providerStatus() {
      const value = await fetchJson(
        `${baseUrl}/rest/v1/source_status?select=source_id,status,checked_at,error_code&order=source_id`,
        { headers },
        fetcher,
        4000,
      );
      if (!Array.isArray(value)) throw new Error("Invalid provider status");
      return value.map((v): ProviderStatus => {
        const row = record(v);
        return {
          source_id: text(row.source_id, 100),
          status: text(row.status, 30),
          checked_at: row.checked_at === null ? null : timestamp(row.checked_at),
          error_code: row.error_code === null ? null : text(row.error_code, 100),
        };
      });
    },
    async recordStatus(result: EnvironmentalResult) {
      const response = await fetcher(
        `${baseUrl}/rest/v1/source_status?source_id=eq.${encodeURIComponent(result.source.id)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            status: result.status,
            checked_at: result.fetchedAt,
            error_code: result.error?.code ?? null,
          }),
          signal: AbortSignal.timeout(4000),
          redirect: "error",
        },
      );
      await response.body?.cancel();
      if (!response.ok) throw new Error("Status update failed");
    },
    async cacheFloodNet(data: FloodNetData) {
      await rpc(
        "watermark_cache_floodnet",
        { p_stations: data.stations, p_events: data.events },
        true,
      );
    },
    area: (area: Area) =>
      rpc("watermark_area_summary", {
        p_lat: area.center.lat,
        p_lon: area.center.lon,
        p_radius_m: area.radiusMeters,
      }),
    history: (point: Location) => rpc("watermark_history", { p_lat: point.lat, p_lon: point.lon }),
    eventHistory: (point: Location) =>
      rpc("watermark_event_history", { p_lat: point.lat, p_lon: point.lon }),
  };
}
