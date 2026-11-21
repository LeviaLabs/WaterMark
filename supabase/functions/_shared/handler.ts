import type {
  BackendStore,
  EnvironmentalResult,
  HistoricalMeasurement,
  Location,
} from "./contracts.ts";
import { alerts, base, classifyDepth, exposure, floodnet, forecast } from "./providers.ts";
import { type Fetcher, finite, record, text, timestamp } from "./http.ts";
import { area, InputError, query, queryLocation, readBounded } from "./validation.ts";

interface Options {
  store: BackendStore | null;
  origins: string[];
  userAgent: string;
  fetcher?: Fetcher;
  now?: () => Date;
}
export function historicalResult(point: Location, rows: unknown, now: Date): EnvironmentalResult {
  const result = base<HistoricalMeasurement[]>(
    {
      id: "watermark_cache",
      name: "WaterMark historical cache",
      url: "https://github.com/LeviaLabs/WaterMark",
      geographicCoverage: "Cached public sensor footprints only",
    },
    "historical_observations",
    point,
    now,
  );
  if (!Array.isArray(rows)) throw new Error("Invalid history response");
  result.coverage.method = "up to 100 cached measurements within 1000 m; not an area average";
  result.data = rows.map((value) => {
    const r = record(value);
    if (
      typeof r.stale !== "boolean" || !Array.isArray(r.quality_flags) ||
      r.quality_flags.some((f) => typeof f !== "string")
    ) throw new Error("Invalid historical row");
    return {
      source_id: text(r.source_id, 100),
      source_name: text(r.source_name, 200),
      source_url: text(r.source_url, 500),
      station_id: text(r.station_id, 120),
      observed_at: timestamp(r.observed_at),
      fetched_at: timestamp(r.fetched_at),
      metric: text(r.metric, 30),
      value: finite(r.value),
      units: text(r.units, 20),
      quality_flags: r.quality_flags.map((f) => text(f, 100)),
      stale: r.stale,
    };
  });
  result.observedAt = result.data[0]?.observed_at ?? null;
  result.status = !result.data.length
    ? "insufficient_data"
    : result.data.every((r) => r.stale)
    ? "stale"
    : "available";
  result.qualityFlags = rows.length ? ["LIMITED_HISTORICAL_CACHE"] : ["MISSING_MEASUREMENTS"];
  result.limitations = [
    "No current observations are inferred from missing or old sensor measurements. Units and source are attached to each row.",
  ];
  return result;
}
export function eventHistoryResult(point: Location, rows: unknown, now: Date): EnvironmentalResult {
  const result = base(
    {
      id: "watermark_cache",
      name: "WaterMark historical event cache",
      url: "https://github.com/LeviaLabs/WaterMark",
      geographicCoverage: "Cached public sensor footprints only",
    },
    "historical_flood_events",
    point,
    now,
  );
  if (!Array.isArray(rows) || rows.length > 101) throw new Error("Invalid event history");
  const events = rows.slice(0, 100).map((value) => {
    const r = record(value), maxDepthMm = finite(r.max_depth_mm);
    if (r.units !== "mm" || maxDepthMm < 0) throw new Error("Invalid cached event units");
    return {
      sourceId: text(r.source_id, 100),
      sourceName: text(r.source_name, 200),
      sourceUrl: text(r.source_url, 500),
      stationId: text(r.station_id, 120),
      startedAt: timestamp(r.started_at),
      endedAt: r.ended_at === null ? null : timestamp(r.ended_at),
      fetchedAt: timestamp(r.fetched_at),
      maxDepthMm,
      classification: classifyDepth(maxDepthMm),
    };
  });
  result.units = "mm";
  result.data = { events };
  result.status = events.length ? "available" : "insufficient_data";
  result.validFrom = events.map((e) => e.startedAt).sort()[0] ?? null;
  result.validTo = events.map((e) => e.endedAt ?? e.startedAt).sort().at(-1) ?? null;
  result.coverage.method =
    "cached events at sensors within 1000 m; 90-day window, at most 100 events";
  result.qualityFlags = [
    "LIMITED_HISTORICAL_CACHE",
    ...(rows.length > 100 ? ["TRUNCATED_EVENTS"] : []),
  ];
  result.limitations = [
    "Incomplete historical sample; counts are not a flood frequency or a current hazard. Query location is not stored.",
  ];
  return result;
}
export function createHandler(options: Options): (request: Request) => Promise<Response> {
  return async (request) => {
    const now = options.now?.() ?? new Date();
    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      Vary: "Origin",
    };
    const reply = (status: number, value: unknown) =>
      new Response(
        JSON.stringify({ apiVersion: "1.0", generatedAt: now.toISOString(), ...value as object }),
        { status, headers },
      );
    try {
      const origin = request.headers.get("Origin");
      if (origin) {
        if (!options.origins.includes(origin)) {
          throw new InputError("ORIGIN_NOT_ALLOWED", "Browser origin is not configured.", 403);
        }
        headers["Access-Control-Allow-Origin"] = origin;
      }
      if (request.method === "OPTIONS") {
        headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
        headers["Access-Control-Allow-Headers"] =
          "content-type, apikey, authorization, x-client-info";
        return new Response(null, { status: 204, headers });
      }
      const url = new URL(request.url);
      const path = url.pathname.replace(/^\/(?:functions\/v1\/)?watermark-v1(?=\/|$)/, "");
      const routes = [
        "/health",
        "/location-summary",
        "/rainfall",
        "/alerts",
        "/flood-exposure",
        "/area-summary",
        "/series",
      ];
      if (!routes.includes(path)) throw new InputError("NOT_FOUND", "Unknown API route.", 404);
      if (request.method !== (path === "/area-summary" ? "POST" : "GET")) {
        throw new InputError("METHOD_NOT_ALLOWED", "Method is not supported.", 405);
      }
      const values = query(
        url,
        path === "/health" || path === "/area-summary"
          ? []
          : path === "/series"
          ? ["lat", "lon", "kind"]
          : ["lat", "lon"],
      );
      let selection;
      if (path === "/area-summary") {
        if (!request.headers.get("Content-Type")?.startsWith("application/json")) {
          throw new InputError("INVALID_INPUT", "Expected application/json.");
        }
        try {
          selection = area(JSON.parse(await readBounded(request.body, 4096)));
        } catch (error) {
          if (error instanceof InputError) throw error;
          throw new InputError("INVALID_INPUT", "Malformed JSON body.");
        }
      }
      const point = path === "/health" || selection ? null : queryLocation(values);
      if (
        path === "/series" &&
        !["rainfall", "river_discharge", "historical_observations", "historical_flood_events"]
          .includes(values.kind)
      ) throw new InputError("INVALID_INPUT", "Unsupported series kind.");
      const store = options.store;
      if (!store) {
        return reply(503, {
          error: {
            code: "BACKEND_NOT_CONFIGURED",
            message: "Backend configuration is incomplete.",
          },
        });
      }
      if (!await store.takeBudget()) {
        headers["Retry-After"] = "60";
        return reply(429, {
          error: {
            code: "RATE_LIMITED",
            message: "Public API request budget reached. Retry later.",
          },
        });
      }
      if (path === "/health") {
        return reply(200, { data: { status: "ready", providers: await store.providerStatus() } });
      }
      if (selection) {
        return reply(200, {
          data: {
            ...selection,
            metrics: await store.area(selection),
            limitations: [
              "Cached sensor evidence only; no complete flood frequency or circle-wide forecast is calculated.",
            ],
          },
        });
      }
      const selected = point!;
      const remember = async <T>(
        result: EnvironmentalResult<T>,
      ): Promise<EnvironmentalResult<T>> => {
        try {
          await store.recordStatus(result);
        } catch {
          result.qualityFlags.push("PROVIDER_STATUS_NOT_PERSISTED");
        }
        return result;
      };
      if (path === "/rainfall" || (path === "/series" && values.kind === "rainfall")) {
        return reply(200, {
          data: await remember(await forecast("rainfall", selected, now, options.fetcher)),
        });
      }
      if (path === "/alerts") {
        return reply(200, {
          data: await remember(await alerts(selected, options.userAgent, now, options.fetcher)),
        });
      }
      if (path === "/flood-exposure") return reply(200, { data: exposure(selected, now) });
      if (path === "/series") {
        return reply(200, {
          data: values.kind === "river_discharge"
            ? await remember(await forecast("river", selected, now, options.fetcher))
            : values.kind === "historical_flood_events"
            ? eventHistoryResult(selected, await store.eventHistory(selected), now)
            : historicalResult(selected, await store.history(selected), now),
        });
      }
      const [rainfall, riverDischarge, officialAlerts, historicalFloods] = await Promise.all([
        forecast("rainfall", selected, now, options.fetcher),
        forecast("river", selected, now, options.fetcher),
        alerts(selected, options.userAgent, now, options.fetcher),
        floodnet(selected, now, options.fetcher),
      ]);
      for (const result of [rainfall, riverDischarge, officialAlerts, historicalFloods]) {
        await remember<unknown>(result);
      }
      if (historicalFloods.data && historicalFloods.status !== "error") {
        try {
          await store.cacheFloodNet(historicalFloods.data);
        } catch {
          historicalFloods.qualityFlags.push("HISTORICAL_CACHE_NOT_PERSISTED");
        }
      }
      return reply(200, {
        data: {
          location: selected,
          rainfall,
          riverDischarge,
          officialAlerts,
          historicalFloods,
          modeledExposure: exposure(selected, now),
        },
      });
    } catch (error) {
      if (error instanceof InputError) {
        return reply(error.status, { error: { code: error.code, message: error.message } });
      }
      return reply(503, {
        error: { code: "BACKEND_UNAVAILABLE", message: "Backend is temporarily unavailable." },
      });
    }
  };
}
