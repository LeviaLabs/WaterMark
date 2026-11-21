// Synthetic regression fixtures for WM-GROK-003; never live hazard evidence.
import assert from "node:assert/strict";
import { alerts, base, floodnet, SOURCES } from "../../functions/_shared/providers.ts";
import {
  areaResult,
  createHandler,
  eventHistoryResult,
  historicalResult,
} from "../../functions/_shared/handler.ts";
import { serverCredential } from "../../functions/_shared/config.ts";
import { createStore } from "../../functions/_shared/store.ts";
import { area } from "../../functions/_shared/validation.ts";
import { type Fetcher, record } from "../../functions/_shared/http.ts";
const point = { lat: 40.588256, lon: -73.984969 }, now = new Date("2026-11-21T12:00:00Z");
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
function row(overrides = {}, geometry: unknown = null) {
  return {
    id: "https://api.weather.gov/alerts/fixture-r1",
    geometry,
    properties: {
      event: "Flood Warning",
      status: "Actual",
      messageType: "Alert",
      sent: "2026-11-21T10:00:00Z",
      effective: "2026-11-21T10:00:00Z",
      expires: "2026-11-21T18:00:00Z",
      onset: "2026-11-21T11:00:00Z",
      ends: "2026-11-21T17:00:00Z",
      severity: "Severe",
      urgency: "Expected",
      certainty: "Likely",
      areaDesc: "Synthetic area",
      headline: "Fixture only",
      description: "Fixture only",
      instruction: null,
      language: "en-US",
      ...overrides,
    },
  };
}
const feed = (features: unknown[], updated: unknown = now.toISOString()): Fetcher => (input) =>
  Promise.resolve(
    json(
      String(input).includes("/points/")
        ? { type: "Feature", properties: { cwa: "OKX" } }
        : { type: "FeatureCollection", updated, features },
    ),
  );
const get = (features: unknown[]) =>
  alerts(point, "WaterMark synthetic tests", now, feed(features));

Deno.test("H1 future onset is upcoming while message remains in force", async () => {
  const result = await get([row({ onset: "2026-11-23T11:00:00Z", ends: "2026-11-25T12:00:00Z" })]);
  assert.equal(result.data?.[0].messageInForce, true);
  assert.equal(result.data?.[0].hazardTiming, "upcoming");
  assert.equal(result.validFrom, "2026-11-23T11:00:00.000Z");
  assert.equal(result.validTo, "2026-11-25T12:00:00.000Z");
});
Deno.test("H1 onset after message expiry with missing ends remains upcoming, not inconsistent or active", async () => {
  const result = await get([row({ onset: "2026-11-23T11:00:00Z", ends: null })]);
  assert.equal(result.data?.[0].hazardTiming, "upcoming");
  assert.equal(result.validTo, null);
  assert.ok(
    result.data?.[0].timingAssumptions.includes("MESSAGE_EXPIRES_BEFORE_HAZARD_START_END_UNKNOWN"),
  );
});
Deno.test("H1 active official window is distinct from measured flooding", async () => {
  const result = await get([row()]);
  assert.equal(result.data?.[0].hazardTiming, "active");
  assert.equal(result.data?.[0].messageValidity, "in_force");
  assert.match(result.data?.[0].severityBasis ?? "", /not a flood observation/);
});
Deno.test("H1 expired messages are excluded and ended hazard windows are never active", async () => {
  const expired = await get([row({ expires: "2026-11-21T11:59:00Z" })]);
  assert.deepEqual(expired.data, []);
  const ended = await get([row({ ends: "2026-11-21T11:59:00Z" })]);
  assert.equal(ended.data?.[0].messageInForce, true);
  assert.equal(ended.data?.[0].hazardTiming, "ended");
  assert.equal(ended.data?.[0].hazardTimingReason, "hazard_window_ended");
});
Deno.test("H1 updated messages preserve Update and their revised future onset", async () => {
  const result = await get([row({ messageType: "Update", onset: "2026-11-21T16:00:00Z" })]);
  assert.equal(result.data?.[0].messageType, "Update");
  assert.equal(result.data?.[0].hazardTiming, "upcoming");
});
Deno.test("H1 missing timestamps remain unknown; source fallback assumptions are explicit", async () => {
  const unknown = await get([
    row({ sent: null, effective: null, expires: null, onset: null, ends: null }),
  ]);
  assert.equal(unknown.data?.[0].hazardTiming, "unknown");
  assert.equal(unknown.data?.[0].messageInForce, null);
  const fallback = await get([row({ onset: null, ends: null, effective: null })]);
  assert.equal(fallback.data?.[0].hazardTiming, "active");
  assert.ok(
    fallback.data?.[0].timingAssumptions.includes("MESSAGE_EFFECTIVE_DEFAULTS_TO_SENT_CAP_1_2"),
  );
});
Deno.test("H2 optional null and absent text does not discard an official warning", async () => {
  const result = await get([row({ headline: null, instruction: undefined, description: null })]);
  assert.equal(result.data?.length, 1);
  assert.equal(result.data?.[0].headline, null);
  assert.equal(result.data?.[0].instruction, null);
  assert.equal(result.diagnostics?.rejectedAlertRecords, 0);
});
Deno.test("H2 malformed records are isolated and valid warnings survive", async () => {
  const result = await get([
    row(),
    row({ severity: 123 }),
    row({ onset: "invalid" }),
    row({ status: undefined }),
    null,
  ]);
  assert.equal(result.status, "available");
  assert.equal(result.data?.length, 1);
  assert.equal(result.diagnostics?.rejectedAlertRecords, 4);
  assert.ok(result.qualityFlags.includes("ALERT_RECORD_REJECTED"));
});
Deno.test("H2 all rejected matching records never become a verified empty warning list", async () => {
  const result = await get([row({ severity: 123 }), row({ status: undefined })]);
  assert.equal(result.status, "error");
  assert.equal(result.data, null);
  assert.equal(result.error?.code, "NO_VALID_ALERT_RECORDS");
  assert.equal(result.diagnostics?.rejectedAlertRecords, 2);
});
Deno.test("H2 missing collection update time retains valid records with diagnostic metadata", async () => {
  const result = await alerts(point, "WaterMark synthetic tests", now, feed([row()], null));
  assert.equal(result.data?.length, 1);
  assert.equal(result.sourceUpdatedAt, null);
  assert.ok(result.qualityFlags.includes("SOURCE_UPDATE_TIME_UNKNOWN"));
});
Deno.test("M1 surge and coastal flood warnings are included; unrelated small craft remains excluded", async () => {
  const result = await get([
    row({ event: "Storm Surge Warning" }),
    row({ event: "Coastal Flood Warning" }),
    row({ event: "Small Craft Advisory" }),
  ]);
  assert.equal(result.data?.length, 2);
  assert.ok(result.data?.every((r) => r.floodRelevance === "flood_hazard_notice"));
});
Deno.test("M1 hurricane and tropical-storm warnings are contextual, never asserted flood evidence", async () => {
  const result = await get([
    row({ event: "Hurricane Warning" }),
    row({ event: "Tropical Storm Warning" }),
  ]);
  assert.equal(result.data?.length, 2);
  assert.ok(result.data?.every((r) => r.floodRelevance === "multi_hazard_context"));
});
const snapshot = (overrides = {}) => ({
  stationCount: null,
  cachedEventCount: null,
  sampledHistoricalMaxDepthMm: null,
  coverageStatus: "incomplete",
  areaForecastStatus: "insufficient_data",
  stations: [],
  windowStart: "2026-08-23T12:00:00Z",
  windowEnd: now.toISOString(),
  cacheNewestFetchedAt: null,
  cacheOldestFetchedAt: null,
  ...overrides,
});
Deno.test("M2 uncached area counts are unknown and carry status/source/cache metadata", () => {
  const result = areaResult(
    { center: point, radiusMeters: 1000 },
    snapshot({ stationCount: 0, cachedEventCount: 0 }),
    now,
  );
  assert.equal(result.status, "insufficient_data");
  assert.equal(result.metrics.cachedEventCount, null);
  assert.equal(result.metrics.zeroMatchesVerified, false);
  assert.equal(result.cacheNewestFetchedAt, null);
  assert.equal(result.source.id, "nyc_floodnet");
});
Deno.test("M2 partial positive cache counts do not assert complete circle coverage", () => {
  const result = areaResult(
    { center: point, radiusMeters: 10000 },
    snapshot({
      stationCount: 4,
      cachedEventCount: 10,
      sampledHistoricalMaxDepthMm: 20,
      cacheNewestFetchedAt: now.toISOString(),
      cacheOldestFetchedAt: now.toISOString(),
    }),
    now,
  );
  assert.equal(result.metrics.cachedEventCount, 10);
  assert.equal(result.status, "insufficient_data");
  assert.ok(result.qualityFlags.includes("CACHE_COVERAGE_INCOMPLETE"));
});
Deno.test("M2 malformed spatial RPC output is rejected, not passed to the browser", () => {
  assert.throws(() =>
    areaResult({ center: point, radiusMeters: 1000 }, { stationCount: "none" }, now)
  );
});
Deno.test("M2 verified empty upstream event query differs from unqueried area/cache absence", async () => {
  const result = await floodnet(
    point,
    now,
    (input) =>
      Promise.resolve(json(
        String(input).includes("kb2e")
          ? [{
            sensor_id: "fixture",
            sensor_name: "Synthetic",
            latitude: String(point.lat),
            longitude: String(point.lon),
          }]
          : [],
      )),
  );
  assert.equal(result.data?.queryEvidence?.zeroEventMatchesVerified, true);
  assert.equal(result.data?.queryEvidence?.eventSearchCompleted, true);
  assert.deepEqual(result.data?.stations[0].geometry, {
    type: "Point",
    coordinates: [point.lon, point.lat],
  });
  assert.equal(result.status, "insufficient_data");
});
function historicalEvent(fetchedAt: string, startedAt = "2026-11-20T10:00:00Z") {
  return {
    source_id: "nyc_floodnet",
    source_name: "Synthetic",
    source_url: SOURCES.floodnet.url,
    station_id: "fixture",
    started_at: startedAt,
    ended_at: new Date(Date.parse(startedAt) + 3600000).toISOString(),
    fetched_at: fetchedAt,
    max_depth_mm: 25.4,
    units: "mm",
  };
}
Deno.test("M3 old historical cache is stale even when read now", () => {
  const result = eventHistoryResult(point, [
    historicalEvent("2026-09-02T12:00:00Z", "2026-09-01T10:00:00Z"),
  ], now);
  assert.equal(result.status, "stale");
  assert.ok(result.qualityFlags.includes("STALE_CACHE"));
  assert.equal(result.cacheNewestFetchedAt, "2026-09-02T12:00:00.000Z");
  assert.equal(result.fetchedAt, now.toISOString());
});
Deno.test("M3 mixed cache ages stay visible; a fresh historical fetch is not a current observation", () => {
  const mixed = eventHistoryResult(point, [
    historicalEvent(now.toISOString()),
    historicalEvent("2026-11-18T12:00:00Z"),
  ], now);
  assert.equal(mixed.status, "stale");
  assert.ok(mixed.qualityFlags.includes("PARTIALLY_STALE_CACHE"));
  const fresh = eventHistoryResult(point, [
    historicalEvent(now.toISOString(), "2026-09-10T12:00:00Z"),
  ], now);
  assert.equal(fresh.status, "available");
  assert.equal(fresh.observedAt, null);
});
Deno.test("M3 stale observation and stale cache timestamps are separate evidence", () => {
  const result = historicalResult(point, [{
    source_id: "nyc_floodnet",
    source_name: "Synthetic",
    source_url: SOURCES.floodnet.url,
    station_id: "fixture",
    observed_at: "2026-11-20T12:00:00Z",
    fetched_at: "2026-11-19T12:00:00Z",
    metric: "water_depth",
    value: 1,
    units: "mm",
    quality_flags: [],
    stale: true,
  }], now);
  assert.equal(result.status, "stale");
  assert.ok(result.qualityFlags.includes("STALE_OBSERVATIONS"));
  assert.ok(result.qualityFlags.includes("STALE_CACHE"));
});
Deno.test("M3 area results expose stale cache age while retaining incomplete coverage", () => {
  const result = areaResult(
    { center: point, radiusMeters: 1000 },
    snapshot({
      cacheOldestFetchedAt: "2026-11-18T12:00:00Z",
      cacheNewestFetchedAt: "2026-11-18T12:00:00Z",
    }),
    now,
  );
  assert.equal(result.status, "stale");
  assert.equal(result.metrics.coverageStatus, "incomplete");
});
Deno.test("M4 clearly unsupported locations make no NWS request", async () => {
  let calls = 0;
  const result = await alerts({ lat: 51.5, lon: -0.12 }, "fixture", now, () => {
    calls++;
    return Promise.resolve(json({}));
  });
  assert.equal(result.status, "unsupported");
  assert.equal(calls, 0);
});
Deno.test("M4 border-region point lookup rejects unsupported location before requesting alerts", async () => {
  const requests: string[] = [];
  const result = await alerts({ lat: 43.65, lon: -79.38 }, "fixture", now, (input) => {
    requests.push(String(input));
    return Promise.resolve(json({}, 404));
  });
  assert.equal(result.status, "unsupported");
  assert.equal(requests.length, 1);
  assert.match(requests[0], /\/points\//);
});
Deno.test("M4 NWS point lookup is canonicalized without enabling redirects", async () => {
  const requests: string[] = [], fetcher = feed([]);
  const result = await alerts(point, "fixture", now, (input, init) => {
    requests.push(String(input));
    assert.equal(init?.redirect, "error");
    return fetcher(input, init);
  });
  assert.equal(result.status, "available");
  assert.equal(requests[0], "https://api.weather.gov/points/40.5883,-73.985");
  assert.match(requests[1], /alerts\/active\?point=40.588256,-73.984969/);
});
Deno.test("M5 nullable alert geometry preserves GeoJSON longitude/latitude", async () => {
  const geometry = { type: "Polygon", coordinates: [[[-74, 40], [-73, 40], [-73, 41], [-74, 40]]] };
  const result = await get([row({}, geometry), row({}, { type: "Polygon", coordinates: "bad" })]);
  assert.deepEqual(result.data?.[0].geometry, geometry);
  assert.equal(result.data?.[1].geometry, null);
  assert.ok(result.data?.[1].qualityFlags.includes("ALERT_GEOMETRY_REJECTED"));
});
Deno.test("M5 polygon requests are explicitly pending; center/radius stays compatible", () => {
  assert.throws(
    () => area({ geometry: { type: "Polygon", coordinates: [] }, layers: [] }),
    /agreed frontend contract/,
  );
  assert.equal(area({ center: point, radiusMeters: 1000 }).radiusMeters, 1000);
});
Deno.test("M6 only successful contacts are persisted; location errors and missing data cannot overwrite health", async () => {
  const calls: unknown[] = [];
  const store = createStore("https://fixture.invalid", crypto.randomUUID(), (_input, init) => {
    calls.push(JSON.parse(String(init?.body)));
    return Promise.resolve(json(true));
  });
  const result = base(SOURCES.floodnet, "historical_flood_events", point, now);
  for (const status of ["unsupported", "insufficient_data", "error"] as const) {
    await store.recordStatus({ ...result, status });
  }
  assert.equal(calls.length, 0);
  await store.recordStatus({ ...result, status: "available" });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { p_source_id: "nyc_floodnet", p_checked_at: now.toISOString() });
});
Deno.test("M6 legacy location outcomes never become global availability", async () => {
  const store = createStore(
    "https://fixture.invalid",
    crypto.randomUUID(),
    () => Promise.resolve(json([{ source_id: "nyc_floodnet", last_success_at: null }])),
  );
  const [status] = await store.providerStatus();
  assert.equal(status.status, "unknown");
  assert.equal(status.checked_at, null);
  assert.equal(status.globalAvailability, "unknown");
});
Deno.test("U2 injected secret dictionaries and permitted override names work without revealing values", () => {
  const generated = crypto.randomUUID();
  assert.equal(
    serverCredential((key) =>
      key === "SUPABASE_SECRET_KEYS" ? JSON.stringify({ default: generated }) : undefined
    ),
    generated,
  );
  assert.equal(
    serverCredential((key) => key === "WATERMARK_SUPABASE_SECRET_KEY" ? generated : undefined),
    generated,
  );
  assert.equal(
    serverCredential((key) => key === "SUPABASE_SECRET_KEYS" ? "malformed" : undefined),
    undefined,
  );
});

Deno.test("H2 HTTP endpoint preserves valid warnings and serializes rejection diagnostics", async () => {
  const store = createStore(
    "https://fixture.invalid",
    crypto.randomUUID(),
    () => Promise.resolve(json(true)),
  );
  const handler = createHandler({
    store,
    origins: [],
    userAgent: "fixture",
    now: () => now,
    fetcher: feed([row(), row({ severity: 3 })]),
  });
  const response = await handler(
    new Request(`https://fixture.invalid/watermark-v1/alerts?lat=${point.lat}&lon=${point.lon}`),
  );
  assert.equal(response.status, 200);
  const result = record(record(await response.json()).data);
  assert.equal(result.status, "available");
  assert.ok(Array.isArray(result.data));
  assert.equal(result.data.length, 1);
  assert.equal(record(result.diagnostics).rejectedAlertRecords, 1);
});
