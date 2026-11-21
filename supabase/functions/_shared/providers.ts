import type {
  EnvironmentalResult,
  FloodNetData,
  ForecastData,
  Location,
  OfficialAlert,
  Source,
  Station,
} from "./contracts.ts";
import { nwsCandidate, parseAlert } from "./alert-semantics.ts";
import { type Fetcher, fetchJson, finite, ProviderError, record, text, timestamp } from "./http.ts";

export const SOURCES: Record<string, Source> = {
  rainfall: {
    id: "open_meteo_weather",
    name: "Open-Meteo Weather",
    url: "https://open-meteo.com/en/docs",
    geographicCoverage: "Global model coverage varies by location",
  },
  river: {
    id: "open_meteo_glofas",
    name: "Open-Meteo / Copernicus GloFAS",
    url: "https://open-meteo.com/en/docs/flood-api",
    geographicCoverage: "Modeled rivers; not coastal surge or street inundation",
  },
  alerts: {
    id: "nws",
    name: "US National Weather Service",
    url: "https://www.weather.gov/documentation/services-web-api",
    geographicCoverage: "US NWS forecast/alert areas only",
  },
  floodnet: {
    id: "nyc_floodnet",
    name: "FloodNet / NYC Open Data",
    url: "https://data.cityofnewyork.us/d/aq7i-eu5q",
    geographicCoverage: "NYC sensor locations only",
  },
  exposure: {
    id: "nyc_stormwater",
    name: "NYC Stormwater Flood Maps",
    url: "https://data.cityofnewyork.us/d/9i7c-xyvv",
    geographicCoverage: "NYC modeled scenarios only",
  },
};
export function base<T>(
  source: Source,
  kind: string,
  location: Location,
  now: Date,
): EnvironmentalResult<T> {
  return {
    status: "insufficient_data",
    kind,
    source,
    location,
    coverage: { method: "point query" },
    observedAt: null,
    forecastIssuedAt: null,
    validFrom: null,
    validTo: null,
    fetchedAt: now.toISOString(),
    sourceUpdatedAt: null,
    sourceLanguage: null,
    units: null,
    data: null,
    qualityFlags: [],
    limitations: [],
  };
}
export async function safely<T>(
  result: EnvironmentalResult<T>,
  load: () => Promise<EnvironmentalResult<T>>,
): Promise<EnvironmentalResult<T>> {
  try {
    return await load();
  } catch (error) {
    const e = error instanceof ProviderError
      ? error
      : new ProviderError("INVALID_PROVIDER_RESPONSE");
    return {
      ...result,
      data: null,
      status: "error",
      error: {
        code: e.code,
        message: "The provider did not return usable data.",
        ...(e.retryAfterSeconds ? { retryAfterSeconds: e.retryAfterSeconds } : {}),
      },
    };
  }
}
export async function forecast(
  kind: "rainfall" | "river",
  location: Location,
  now = new Date(),
  fetcher: Fetcher = fetch,
): Promise<EnvironmentalResult<ForecastData>> {
  const result = base<ForecastData>(
    SOURCES[kind],
    kind === "rainfall" ? "forecast_rainfall" : "forecast_river_discharge",
    location,
    now,
  );
  return await safely(result, async () => {
    const rain = kind === "rainfall",
      group = rain ? "hourly" : "daily",
      field = rain ? "precipitation" : "river_discharge";
    const url = new URL(
      rain ? "https://api.open-meteo.com/v1/forecast" : "https://flood-api.open-meteo.com/v1/flood",
    );
    url.search = new URLSearchParams({
      latitude: String(location.lat),
      longitude: String(location.lon),
      [group]: field,
      forecast_days: rain ? "3" : "7",
      timezone: "GMT",
      ...(rain ? { precipitation_unit: "mm" } : {}),
    }).toString();
    const raw = record(await fetchJson(url.href, {}, fetcher));
    if (raw.utc_offset_seconds !== 0) throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    const units = record(raw[`${group}_units`]);
    if (units[field] !== (rain ? "mm" : "m³/s") || units.time !== "iso8601") {
      throw new ProviderError("INVALID_PROVIDER_UNITS");
    }
    const sampledLocation = { lat: finite(raw.latitude), lon: finite(raw.longitude) };
    if (Math.abs(sampledLocation.lat) > 90 || Math.abs(sampledLocation.lon) > 180) {
      throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    }
    const series = record(raw[group]);
    const times = series.time, values = series[field];
    if (
      !Array.isArray(times) || !Array.isArray(values) || times.length !== values.length ||
      times.length > (rain ? 72 : 7)
    ) throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    const samples = times.map((time, index) => {
      const instant = rain ? timestamp(time, true) : timestamp(text(time, 10) + "T00:00:00Z");
      const start = rain ? new Date(Date.parse(instant) - 3600000).toISOString() : instant;
      const value = values[index] === null ? null : finite(values[index]);
      if (value !== null && value < 0) throw new ProviderError("INVALID_PROVIDER_RESPONSE");
      return {
        validFrom: start,
        validTo: rain ? instant : new Date(Date.parse(start) + 86400000).toISOString(),
        value,
      };
    });
    if (samples.some((s, i) => i > 0 && s.validFrom <= samples[i - 1].validFrom)) {
      throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    }
    const future = samples.filter((s) => Date.parse(s.validTo) > now.getTime());
    result.units = rain ? "mm" : "m3/s";
    result.coverage = {
      method: "provider model grid sample; not an area aggregate",
      sampledLocation,
      resolution: rain
        ? "Model-dependent; not property-level"
        : "GloFAS v4 approximately 5 km; daily",
    };
    result.qualityFlags = ["ISSUANCE_TIME_NOT_PROVIDED"];
    if (future.some((s) => s.value === null)) result.qualityFlags.push("MISSING_MEASUREMENTS");
    result.limitations = [
      rain
        ? "Precipitation includes rain and other precipitation; it is not observed rainfall or a flood severity."
        : "Closest modeled river can differ from the intended river. Not suitable for coastal or street-flood predictions.",
      "No calibrated local flood probability or flood threshold is supplied.",
    ];
    result.data = { samples: future, model: rain ? "Open-Meteo best match" : "GloFAS v4 seamless" };
    result.validFrom = future[0]?.validFrom ?? null;
    result.validTo = future.at(-1)?.validTo ?? null;
    result.status = future.some((s) => s.value !== null) ? "available" : "insufficient_data";
    return result;
  });
}
export async function alerts(
  location: Location,
  userAgent: string,
  now = new Date(),
  fetcher: Fetcher = fetch,
): Promise<EnvironmentalResult<OfficialAlert[]>> {
  const result = base<OfficialAlert[]>(SOURCES.alerts, "official_alert", location, now);
  const unsupported = (): EnvironmentalResult<OfficialAlert[]> => ({
    ...result,
    status: "unsupported",
    limitations: [
      "This adapter requires a verified NWS forecast point in its documented US/territory candidate regions. Marine-only and other regions are not supported; this says nothing about flood safety.",
    ],
  });
  if (!nwsCandidate(location)) return unsupported();
  return await safely(result, async () => {
    if (!userAgent.trim()) throw new ProviderError("PROVIDER_NOT_CONFIGURED");
    try {
      // NWS canonicalizes this endpoint to four decimals with a 301. Keep
      // redirects disabled and construct the canonical lookup directly.
      const pointLat = Number(location.lat.toFixed(4)), pointLon = Number(location.lon.toFixed(4));
      const point = record(
        await fetchJson(`https://api.weather.gov/points/${pointLat},${pointLon}`, {
          headers: { "User-Agent": userAgent, Accept: "application/geo+json" },
        }, fetcher),
      );
      if (!/^[A-Z]{3}$/.test(text(record(point.properties).cwa, 3))) {
        throw new ProviderError("INVALID_PROVIDER_RESPONSE");
      }
    } catch (error) {
      if (
        error instanceof ProviderError && (error.httpStatus === 400 || error.httpStatus === 404)
      ) return unsupported();
      throw error;
    }
    const raw = record(
      await fetchJson(
        `https://api.weather.gov/alerts/active?point=${location.lat},${location.lon}`,
        { headers: { "User-Agent": userAgent, Accept: "application/geo+json" } },
        fetcher,
      ),
    );
    if (
      raw.type !== "FeatureCollection" || !Array.isArray(raw.features) ||
      raw.features.length > 500 || raw.pagination
    ) throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    let updated: string | null = null;
    try {
      updated = raw.updated == null ? null : timestamp(raw.updated);
    } catch {
      result.qualityFlags.push("INVALID_SOURCE_UPDATE_TIME");
    }
    if (!updated) result.qualityFlags.push("SOURCE_UPDATE_TIME_UNKNOWN");
    result.sourceUpdatedAt = updated;
    const rows: OfficialAlert[] = [];
    let rejectedAlertRecords = 0, excludedAlertRecords = 0;
    for (const feature of raw.features) {
      try {
        const alert = parseAlert(feature, now);
        if (alert) rows.push(alert);
        else excludedAlertRecords++;
      } catch {
        rejectedAlertRecords++;
      }
    }
    result.status = updated && now.getTime() - Date.parse(updated) > 15 * 60000
      ? "stale"
      : "available";
    if (result.status === "stale") {
      result.qualityFlags.push("STALE_PROVIDER_UPDATE", "SOURCE_UPDATE_TIME_IS_NOT_A_HEARTBEAT");
    }
    result.diagnostics = { rejectedAlertRecords, excludedAlertRecords };
    if (rejectedAlertRecords) result.qualityFlags.push("ALERT_RECORD_REJECTED");
    if (rows.some((r) => r.sourceLanguage === null)) {
      result.qualityFlags.push("SOURCE_LANGUAGE_NOT_PROVIDED");
    }
    result.data = rows;
    result.validFrom = rows.map((r) =>
      r.onset ?? r.effective ?? r.sent
    ).filter((t): t is string => t !== null).sort()[0] ?? null;
    result.validTo = rows.map((r) =>
      r.ends ?? (r.expires && (!r.onset || r.expires >= r.onset) ? r.expires : null)
    ).filter((t): t is string =>
      t !== null
    ).sort().at(-1) ?? null;
    if (!rows.length && rejectedAlertRecords) {
      result.status = "error";
      result.data = null;
      result.error = {
        code: "NO_VALID_ALERT_RECORDS",
        message: "No usable alert records remain; warning status is unknown.",
      };
    }
    result.coverage.method =
      "NWS forecast-point verification and point-filtered alert areas; polygons can be absent";
    result.limitations = [
      "No matching messages does not establish safe conditions. Active means the expected official/fallback hazard window, not an observed flood.",
      "Hurricane and tropical-storm messages are multi-hazard context, not direct evidence of flooding. Missing or expired hazard bounds never imply safety.",
      "Alert text is untrusted plain text; never render as HTML.",
    ];
    return result;
  });
}
export function classifyDepth(depthMm: number) {
  if (!Number.isFinite(depthMm) || depthMm < 0) throw new ProviderError("MISSING_MEASUREMENTS");
  return {
    label: depthMm > 10 ? "reported_peak_above_threshold" : "reported_peak_not_above_threshold",
    thresholdMm: 10,
    basis:
      "FloodNet defines events using a series of measurements greater than 10 mm. This compares only the rounded reported peak; it cannot establish or invalidate an event or current hazard.",
  };
}
export async function floodnet(
  location: Location,
  now = new Date(),
  fetcher: Fetcher = fetch,
): Promise<EnvironmentalResult<FloodNetData>> {
  const result = base<FloodNetData>(SOURCES.floodnet, "historical_flood_events", location, now);
  if (
    location.lat < 40.45 || location.lat > 40.95 || location.lon < -74.3 || location.lon > -73.65
  ) {
    return {
      ...result,
      status: "unsupported",
      limitations: ["FloodNet covers selected NYC sensors only."],
    };
  }
  return await safely(result, async () => {
    const sensorUrl = new URL("https://data.cityofnewyork.us/resource/kb2e-tjy3.json");
    sensorUrl.search = new URLSearchParams({
      "$select": "sensor_id,sensor_name,latitude,longitude",
      "$where": `within_circle(location,${location.lat},${location.lon},1000)`,
      "$order": "sensor_id",
      "$limit": "51",
    }).toString();
    const raw = await fetchJson(sensorUrl.href, {}, fetcher);
    if (!Array.isArray(raw) || raw.length > 51) {
      throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    }
    const stations = raw.slice(0, 50).map((row): Station => {
      const r = record(row);
      const id = text(r.sensor_id, 120);
      if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new ProviderError("INVALID_PROVIDER_RESPONSE");
      const lat = Number(text(r.latitude, 30)), lon = Number(text(r.longitude, 30));
      if (
        !Number.isFinite(lat) || !Number.isFinite(lon) || lat < 40.45 || lat > 40.95 ||
        lon < -74.3 || lon > -73.65
      ) throw new ProviderError("INVALID_PROVIDER_RESPONSE");
      return {
        id,
        name: text(r.sensor_name, 200),
        location: { lat, lon },
        geometry: { type: "Point", coordinates: [lon, lat] },
      };
    });
    result.coverage = {
      method: "up to 50 sensors within 1000 m; measurements apply only beneath sensors",
    };
    result.units = "mm";
    result.data = {
      stations,
      events: [],
      queryEvidence: {
        eventSearchCompleted: false,
        zeroEventMatchesVerified: false,
        windowStart: null,
        windowEnd: now.toISOString(),
      },
    };
    result.limitations = [
      "Historical event peaks, not current street conditions or neighborhood flood frequency.",
      "Dataset is periodically published; fetch time is not observation time.",
    ];
    if (raw.length > 50) result.qualityFlags.push("TRUNCATED_STATIONS");
    if (!stations.length) {
      result.qualityFlags.push("SOURCE_SENSOR_QUERY_EMPTY");
      return result;
    }
    const since = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 19);
    const eventUrl = new URL("https://data.cityofnewyork.us/resource/aq7i-eu5q.json");
    eventUrl.search = new URLSearchParams({
      "$select": "sensor_id,flood_start_time,flood_end_time,max_depth_inches",
      "$where": `sensor_id in(${
        stations.map((s) => `'${s.id}'`).join(",")
      }) AND flood_start_time >= '${since}'`,
      "$order": "flood_start_time DESC,sensor_id",
      "$limit": "101",
    }).toString();
    const events = await fetchJson(eventUrl.href, {}, fetcher);
    if (!Array.isArray(events) || events.length > 101) {
      throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    }
    result.data.queryEvidence = {
      eventSearchCompleted: true,
      zeroEventMatchesVerified: events.length === 0,
      windowStart: since + "Z",
      windowEnd: now.toISOString(),
    };
    if (!events.length) result.qualityFlags.push("NO_EVENTS_IN_FETCHED_SENSOR_QUERY");
    result.data.events = events.slice(0, 100).map((row) => {
      const r = record(row), stationId = text(r.sensor_id, 120);
      if (!stations.some((s) => s.id === stationId)) {
        throw new ProviderError("INVALID_PROVIDER_RESPONSE");
      }
      const rawDepth = text(r.max_depth_inches, 30);
      if (!/^\d+(?:\.\d+)?$/.test(rawDepth)) throw new ProviderError("INVALID_PROVIDER_UNITS");
      const maxDepthMm = Number(rawDepth) * 25.4;
      const startedAt = timestamp(r.flood_start_time, true),
        endedAt = r.flood_end_time ? timestamp(r.flood_end_time, true) : null;
      if (Date.parse(startedAt) > now.getTime() || (endedAt && endedAt < startedAt)) {
        throw new ProviderError("INVALID_PROVIDER_RESPONSE");
      }
      return {
        stationId,
        startedAt,
        endedAt,
        maxDepthMm,
        classification: classifyDepth(maxDepthMm),
      };
    });
    if (events.length > 100) result.qualityFlags.push("TRUNCATED_EVENTS");
    result.status = result.data.events.length ? "available" : "insufficient_data";
    result.validFrom = result.data.events.map((e) => e.startedAt).sort()[0] ?? null;
    result.validTo = result.data.events.map((e) => e.endedAt ?? e.startedAt).sort().at(-1) ?? null;
    return result;
  });
}
export function exposure(location: Location, now = new Date()): EnvironmentalResult {
  return {
    ...base(SOURCES.exposure, "modeled_flood_exposure", location, now),
    status: location.lat >= 40.45 && location.lat <= 40.95 && location.lon >= -74.3 &&
        location.lon <= -73.65
      ? "insufficient_data"
      : "unsupported",
    limitations: [
      "Official catalog supplies a GIS ZIP; scenario polygons have not been imported or validated. No exposure classification is inferred from missing polygons.",
    ],
  };
}
