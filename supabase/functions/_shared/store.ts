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
        `${baseUrl}/rest/v1/source_status?select=source_id,last_success_at&order=source_id`,
        { headers },
        fetcher,
        4000,
      );
      if (!Array.isArray(value)) throw new Error("Invalid provider status");
      return value.map((v): ProviderStatus => {
        const row = record(v);
        const checkedAt = row.last_success_at === null ? null : timestamp(row.last_success_at);
        return {
          source_id: text(row.source_id, 100),
          status: checkedAt === null
            ? "unknown"
            : Date.now() - Date.parse(checkedAt) > 3600000
            ? "stale"
            : "available",
          checked_at: checkedAt,
          error_code: null,
          scope: "last_successful_contact",
          globalAvailability: "unknown",
        };
      });
    },
    async recordStatus(result: EnvironmentalResult) {
      // Location absence, coverage and individual errors are not global outages.
      // A successful contact is only evidence of reachability, never global uptime.
      if (result.status !== "available" && result.status !== "stale") return;
      await rpc("watermark_record_provider_success", {
        p_source_id: result.source.id,
        p_checked_at: result.fetchedAt,
      });
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
