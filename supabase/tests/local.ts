// Local Supabase integration only. Does not accept a remote URL or credentials.
import assert from "node:assert/strict";
import { record } from "../functions/_shared/http.ts";

const baseUrl = "http://127.0.0.1:55321/functions/v1/watermark-v1";
const point = "lat=40.588256&lon=-73.984969";
async function get(path: string, init?: RequestInit) {
  const response = await fetch(baseUrl + path, { ...init, signal: AbortSignal.timeout(20000) });
  const body = record(await response.json());
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.apiVersion, "1.0");
  return body.data;
}
const health = record(await get("/health"));
assert.equal(health.status, "ready");
const summary = record(await get(`/location-summary?${point}`));
for (const name of ["rainfall", "riverDischarge", "officialAlerts", "historicalFloods"]) {
  const result = record(summary[name]);
  assert.notEqual(result.status, "error", name);
  const flags = result.qualityFlags;
  assert.ok(Array.isArray(flags));
  assert.equal(flags.includes("PROVIDER_STATUS_NOT_PERSISTED"), false);
  assert.equal(flags.includes("HISTORICAL_CACHE_NOT_PERSISTED"), false);
}
assert.equal(record(summary.modeledExposure).status, "insufficient_data");
const area = record(
  await get("/area-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ center: { lat: 40.588256, lon: -73.984969 }, radiusMeters: 1000 }),
  }),
);
const metrics = record(area.metrics);
assert.equal(area.status, "insufficient_data");
assert.equal(record(area.source).id, "nyc_floodnet");
assert.ok(typeof metrics.stationCount === "number" && metrics.stationCount > 0);
assert.equal(metrics.areaForecastStatus, "insufficient_data");
const historical = record(await get(`/series?${point}&kind=historical_observations`));
assert.equal(historical.status, "insufficient_data");
const invalid = await fetch(`${baseUrl}/rainfall?lat=bad&lon=0`);
assert.equal(invalid.status, 400);
await invalid.body?.cancel();
const invalidRadius = await fetch(`${baseUrl}/area-summary`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ center: { lat: 0, lon: 0 }, radiusMeters: 999999 }),
});
assert.equal(invalidRadius.status, 400);
await invalidRadius.body?.cancel();
const cors = await fetch(`${baseUrl}/health`, { headers: { Origin: "http://localhost:5173" } });
assert.equal(cors.status, 200);
assert.equal(cors.headers.get("Access-Control-Allow-Credentials"), null);
await cors.body?.cancel();
const denied = await fetch(`${baseUrl}/health`, {
  headers: { Origin: "https://attacker.invalid" },
});
assert.equal(denied.status, 403);
await denied.body?.cancel();
const rockaway = record(await get("/location-summary?lat=40.591699&lon=-73.809929"));
const rockawayHistory = record(rockaway.historicalFloods);
assert.equal(rockawayHistory.status, "available");
const rockawayEvents = record(rockawayHistory.data).events;
assert.ok(Array.isArray(rockawayEvents) && rockawayEvents.length > 0);
const rockawayFlags = rockawayHistory.qualityFlags;
assert.ok(Array.isArray(rockawayFlags));
assert.equal(rockawayFlags.includes("HISTORICAL_CACHE_NOT_PERSISTED"), false);
const cachedSeries = record(
  await get("/series?lat=40.591699&lon=-73.809929&kind=historical_flood_events"),
);
assert.equal(cachedSeries.status, "available");
const cachedEvents = record(cachedSeries.data).events;
assert.ok(Array.isArray(cachedEvents) && cachedEvents.length > 0);
const before = record(await get("/health")), statusesBefore = before.providers;
assert.ok(Array.isArray(statusesBefore));
const floodnetBefore = record(
  statusesBefore.find((value) => record(value).source_id === "nyc_floodnet"),
);
assert.equal(floodnetBefore.status, "available");
assert.equal(floodnetBefore.globalAvailability, "unknown");
const abroad = record(await get("/location-summary?lat=51.5&lon=-0.12"));
assert.equal(record(abroad.officialAlerts).status, "unsupported");
assert.equal(record(abroad.historicalFloods).status, "unsupported");
const after = record(await get("/health")), statusesAfter = after.providers;
assert.ok(Array.isArray(statusesAfter));
const floodnetAfter = record(
  statusesAfter.find((value) => record(value).source_id === "nyc_floodnet"),
);
assert.equal(floodnetAfter.checked_at, floodnetBefore.checked_at);
assert.equal(floodnetAfter.status, "available");
const uncachedArea = record(
  await get("/area-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ center: { lat: 0, lon: 0 }, radiusMeters: 1000 }),
  }),
);
assert.equal(uncachedArea.status, "insufficient_data");
assert.equal(record(uncachedArea.metrics).cachedEventCount, null);
assert.equal(record(uncachedArea.metrics).zeroMatchesVerified, false);
console.log(JSON.stringify({
  outcome: "PASS",
  layers: Object.fromEntries(
    ["rainfall", "riverDischarge", "officialAlerts", "historicalFloods", "modeledExposure"].map((
      name,
    ) => [name, record(summary[name]).status]),
  ),
  stationCount: metrics.stationCount,
  cachedEventCount: metrics.cachedEventCount,
  historicalMeasurements: historical.status,
  cachedHistoricalEventCount: cachedEvents.length,
  checks:
    "guest HTTP, live providers, database persistence, spatial aggregation, unknown area data, cached event freshness, unsupported coverage, provider health isolation, malformed coordinates, radius bounds, application origin enforcement; effective CORS headers tested separately",
}));
