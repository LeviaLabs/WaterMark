// Deterministic synthetic fixtures. These values are never live environmental evidence.
import assert from "node:assert/strict";
import type {
  Area,
  BackendStore,
  EnvironmentalResult,
  FloodNetData,
  Location,
} from "../../functions/_shared/contracts.ts";
import { createHandler, historicalResult } from "../../functions/_shared/handler.ts";
import { type Fetcher, fetchJson, ProviderError, record } from "../../functions/_shared/http.ts";
import { alerts, classifyDepth, floodnet, forecast } from "../../functions/_shared/providers.ts";
import { createStore } from "../../functions/_shared/store.ts";
import { area, location, query, queryLocation } from "../../functions/_shared/validation.ts";

const point = { lat: 40.588256, lon: -73.984969 };
const now = new Date("2026-11-21T12:00:00Z");
const json = (value: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
function weather(values: (number | null)[] = [0, 2], units = "mm") {
  return {
    latitude: 40.59,
    longitude: -73.99,
    utc_offset_seconds: 0,
    hourly_units: { time: "iso8601", precipitation: units },
    hourly: { time: ["2026-11-21T12:00", "2026-11-21T13:00"], precipitation: values },
  };
}
function alertRow(overrides = {}) {
  return {
    id: "https://api.weather.gov/alerts/fixture",
    properties: {
      event: "Flood Warning",
      severity: "Severe",
      urgency: "Immediate",
      certainty: "Observed",
      sent: "2026-11-21T11:00:00Z",
      effective: "2026-11-21T11:00:00Z",
      expires: "2026-11-21T15:00:00Z",
      status: "Actual",
      messageType: "Alert",
      areaDesc: "Synthetic fixture area",
      headline: "Synthetic fixture warning",
      description: "Fixture only",
      instruction: null,
      language: "en-US",
      ...overrides,
    },
  };
}
const fixtureFetch: Fetcher = (input) => {
  const url = String(input);
  if (url.includes("api.weather.gov")) {
    return Promise.resolve(
      json({ type: "FeatureCollection", updated: now.toISOString(), features: [alertRow()] }),
    );
  }
  if (url.includes("flood-api")) {
    return Promise.resolve(
      json({
        latitude: point.lat,
        longitude: point.lon,
        utc_offset_seconds: 0,
        daily_units: { time: "iso8601", river_discharge: "m³/s" },
        daily: { time: ["2026-11-21", "2026-11-22"], river_discharge: [10, 12] },
      }),
    );
  }
  if (url.includes("kb2e-tjy3")) {
    return Promise.resolve(
      json([{
        sensor_id: "fixture-station",
        sensor_name: "Synthetic fixture",
        latitude: String(point.lat),
        longitude: String(point.lon),
      }]),
    );
  }
  if (url.includes("aq7i-eu5q")) {
    return Promise.resolve(
      json([{
        sensor_id: "fixture-station",
        flood_start_time: "2026-11-20T11:00:00",
        flood_end_time: "2026-11-20T12:00:00",
        max_depth_inches: "1",
      }]),
    );
  }
  return Promise.resolve(json(weather()));
};
class Store implements BackendStore {
  allowed = true;
  lastArea: Area | null = null;
  cached: FloodNetData | null = null;
  statuses: EnvironmentalResult[] = [];
  takeBudget() {
    return Promise.resolve(this.allowed);
  }
  providerStatus() {
    return Promise.resolve([]);
  }
  recordStatus(result: EnvironmentalResult) {
    this.statuses.push(result);
    return Promise.resolve();
  }
  cacheFloodNet(data: FloodNetData) {
    this.cached = data;
    return Promise.resolve();
  }
  area(selection: Area) {
    this.lastArea = selection;
    return Promise.resolve({ stationCount: 0, areaForecastStatus: "insufficient_data" });
  }
  history(_location: Location) {
    return Promise.resolve([]);
  }
  eventHistory(_location: Location) {
    return Promise.resolve([]);
  }
}
function setup(store = new Store(), fetcher = fixtureFetch) {
  return {
    store,
    handler: createHandler({
      store,
      origins: ["https://watermark.example"],
      userAgent: "WaterMark fixture test",
      now: () => now,
      fetcher,
    }),
  };
}
function request(path: string, init?: RequestInit) {
  return new Request(`https://project.example/functions/v1/watermark-v1${path}`, init);
}

Deno.test("coordinates reject nonfinite, missing, out-of-range, and malformed query values", () => {
  for (const value of [NaN, Infinity, -91, 91, null, "40"]) {
    assert.throws(() => location({ lat: value, lon: 0 }));
  }
  for (const value of ["", " ", "NaN", "40;drop table", "0x10", "1e2"]) {
    assert.throws(() => queryLocation({ lat: value, lon: "0" }));
  }
  assert.throws(() => location({ lat: 0, lon: 181 }));
  assert.deepEqual(location({ lat: -90, lon: 180 }), { lat: -90, lon: 180 });
});
Deno.test("areas and query parameters are bounded and reject extra fields", () => {
  for (const radius of [0, 99, 10001, Infinity, "1000"]) {
    assert.throws(() => area({ center: point, radiusMeters: radius }));
  }
  assert.throws(() => area({ center: point, radiusMeters: 100, arbitrary: true }));
  assert.throws(() => query(new URL("https://test.example/?lat=1&lat=2"), ["lat"]));
  assert.throws(() =>
    query(new URL("https://test.example/?url=https://attacker.example"), ["lat"])
  );
});
Deno.test("provider timeout is bounded through abort", async () => {
  const stalled: Fetcher = (_input, init) =>
    new Promise((_resolve, reject) =>
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true })
    );
  await assert.rejects(
    () => fetchJson("https://fixture.example", {}, stalled, 5),
    (e: unknown) => e instanceof ProviderError && e.code === "PROVIDER_TIMEOUT",
  );
});
Deno.test("provider rate limits preserve a bounded retry delay and do not retry", async () => {
  let calls = 0;
  const limited: Fetcher = () => {
    calls++;
    return Promise.resolve(json({}, 429, { "Retry-After": "99999" }));
  };
  await assert.rejects(
    () => fetchJson("https://fixture.example", {}, limited),
    (e: unknown) =>
      e instanceof ProviderError && e.code === "PROVIDER_RATE_LIMITED" &&
      e.retryAfterSeconds === 3600,
  );
  assert.equal(calls, 1);
});
Deno.test("provider HTTP failure and malformed JSON become structured errors", async () => {
  for (
    const fetcher of [() => Promise.resolve(json({}, 503)), () =>
      Promise.resolve(
        new Response("not JSON", { headers: { "Content-Type": "application/json" } }),
      )]
  ) {
    const result = await forecast("rainfall", point, now, fetcher);
    assert.equal(result.status, "error");
    assert.equal(result.data, null);
    assert.ok(result.error?.code);
  }
});
Deno.test("wrong units fail rather than silently normalize unknown units", async () => {
  const result = await forecast(
    "rainfall",
    point,
    now,
    () => Promise.resolve(json(weather([0, 1], "inch"))),
  );
  assert.equal(result.status, "error");
  assert.equal(result.error?.code, "INVALID_PROVIDER_UNITS");
});
Deno.test("null model measurements remain missing and never become zero", async () => {
  const result = await forecast(
    "rainfall",
    point,
    now,
    () => Promise.resolve(json(weather([null, null]))),
  );
  assert.equal(result.status, "insufficient_data");
  assert.equal(result.data?.samples[0].value, null);
  assert.ok(result.qualityFlags.includes("MISSING_MEASUREMENTS"));
});
Deno.test("precipitation interval ends at provider timestamp; retrieval is not issuance", async () => {
  const result = await forecast("rainfall", point, now, fixtureFetch);
  assert.equal(result.status, "available");
  assert.equal(result.data?.samples.length, 1);
  assert.equal(result.data?.samples[0].validFrom, "2026-11-21T12:00:00.000Z");
  assert.equal(result.data?.samples[0].validTo, "2026-11-21T13:00:00.000Z");
  assert.equal(result.forecastIssuedAt, null);
  assert.equal(result.observedAt, null);
  assert.notDeepEqual(result.location, result.coverage.sampledLocation);
});
Deno.test("river output retains daily modeled discharge units", async () => {
  const result = await forecast("river", point, now, fixtureFetch);
  assert.equal(result.units, "m3/s");
  assert.equal(result.data?.samples[0].value, 10);
  assert.equal(result.data?.samples[0].validTo, "2026-11-22T00:00:00.000Z");
});
Deno.test("official severity is unchanged and unrelated, canceled, test, expired alerts are excluded", async () => {
  const fetcher: Fetcher = () =>
    Promise.resolve(json({
      type: "FeatureCollection",
      updated: now.toISOString(),
      features: [
        alertRow(),
        alertRow({ event: "Small Craft Advisory" }),
        alertRow({ messageType: "Cancel" }),
        alertRow({ status: "Test" }),
        alertRow({ expires: "2026-11-21T10:00:00Z" }),
      ],
    }));
  const result = await alerts(point, "WaterMark fixture", now, fetcher);
  assert.equal(result.data?.length, 1);
  assert.equal(result.data?.[0].severity, "Severe");
  assert.equal(result.data?.[0].sourceLanguage, "en-US");
});
Deno.test("empty alerts remain available with limitations; old provider updates are stale", async () => {
  const result = await alerts(
    point,
    "WaterMark fixture",
    now,
    () =>
      Promise.resolve(
        json({ type: "FeatureCollection", updated: "2026-11-21T10:00:00Z", features: [] }),
      ),
  );
  assert.equal(result.status, "stale");
  assert.deepEqual(result.data, []);
  assert.ok(result.limitations.length);
  assert.equal(result.sourceUpdatedAt, "2026-11-21T10:00:00.000Z");
});
Deno.test("FloodNet historical GMT timestamps and inches-to-mm conversion preserve meaning", async () => {
  const result = await floodnet(point, now, fixtureFetch);
  assert.equal(result.kind, "historical_flood_events");
  assert.equal(result.status, "available");
  assert.equal(result.data?.events[0].startedAt, "2026-11-20T11:00:00.000Z");
  assert.equal(result.data?.events[0].maxDepthMm, 25.4);
  assert.equal(result.observedAt, null);
});
Deno.test("FloodNet threshold is source-defined, strict, and is not a risk percentage", () => {
  assert.equal(classifyDepth(10).label, "reported_peak_not_above_threshold");
  assert.equal(classifyDepth(10.1).label, "reported_peak_above_threshold");
  assert.throws(() => classifyDepth(NaN));
  assert.match(classifyDepth(11).basis, /FloodNet/);
});
Deno.test("missing FloodNet measurements fail; out-of-coverage points make no request", async () => {
  const result = await floodnet(
    point,
    now,
    (input, init) =>
      String(input).includes("aq7i")
        ? Promise.resolve(
          json([{ sensor_id: "fixture-station", flood_start_time: "2026-11-20T11:00:00" }]),
        )
        : fixtureFetch(input, init),
  );
  assert.equal(result.status, "error");
  assert.equal(result.data, null);
  let calls = 0;
  const outside = await floodnet({ lat: 0, lon: 0 }, now, () => {
    calls++;
    return Promise.resolve(json([]));
  });
  assert.equal(outside.status, "unsupported");
  assert.equal(calls, 0);
});
Deno.test("old observations stay stale despite a fresh retrieval", () => {
  const result = historicalResult(point, [{
    source_id: "nyc_floodnet",
    source_name: "Synthetic",
    source_url: "https://fixture.example",
    station_id: "fixture-station",
    observed_at: "2026-11-20T10:00:00Z",
    fetched_at: now.toISOString(),
    metric: "water_depth",
    value: 25.4,
    units: "mm",
    quality_flags: [],
    stale: true,
  }], now);
  assert.equal(result.status, "stale");
  assert.equal(result.observedAt, "2026-11-20T10:00:00.000Z");
  assert.equal(result.forecastIssuedAt, null);
  assert.equal(historicalResult(point, [], now).status, "insufficient_data");
});
Deno.test("API rejects malformed coordinates, unknown parameters, and incorrect methods before provider calls", async () => {
  let calls = 0;
  const { handler } = setup(new Store(), () => {
    calls++;
    return Promise.resolve(json({}));
  });
  for (
    const path of [
      "/rainfall?lat=NaN&lon=0",
      "/alerts?lat=91&lon=0",
      "/rainfall?lat=0&lon=0&url=x",
      "/series?lat=0&lon=0&kind=unknown",
    ]
  ) assert.equal((await handler(request(path))).status, 400);
  assert.equal((await handler(request("/alerts", { method: "POST" }))).status, 405);
  assert.equal(calls, 0);
});
Deno.test("API validates radius, body size, and JSON content type", async () => {
  const { handler } = setup();
  const post = (body: string) =>
    handler(
      request("/area-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
    );
  assert.equal((await post(JSON.stringify({ center: point, radiusMeters: -1 }))).status, 400);
  assert.equal((await post("{".repeat(5000))).status, 413);
  assert.equal(
    (await handler(request("/area-summary", { method: "POST", body: "{}" }))).status,
    400,
  );
});
Deno.test("API area summary calls PostGIS only, not point forecast providers", async () => {
  let calls = 0;
  const { handler, store } = setup(new Store(), () => {
    calls++;
    return Promise.resolve(json({}));
  });
  const response = await handler(
    request("/area-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ center: point, radiusMeters: 1000 }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(store.lastArea?.radiusMeters, 1000);
  assert.equal(calls, 0);
});
Deno.test("guest API works, has a versioned envelope, and persists historical sensor evidence", async () => {
  const { handler, store } = setup();
  const response = await handler(request(`/location-summary?lat=${point.lat}&lon=${point.lon}`));
  const body = record(await response.json());
  assert.equal(response.status, 200);
  assert.equal(body.apiVersion, "1.0");
  assert.equal(record(record(body.data).modeledExposure).status, "insufficient_data");
  assert.equal(store.statuses.length, 4);
  assert.equal(store.cached?.events.length, 1);
});
Deno.test("a provider failure does not hide the other independent results", async () => {
  const { handler } = setup(
    new Store(),
    (input, init) =>
      String(input).includes("api.open-meteo.com/")
        ? Promise.resolve(json({}, 503))
        : fixtureFetch(input, init),
  );
  const response = await handler(request(`/location-summary?lat=${point.lat}&lon=${point.lon}`));
  const data = record(record(await response.json()).data);
  assert.equal(response.status, 200);
  assert.equal(record(data.rainfall).status, "error");
  assert.equal(record(data.officialAlerts).status, "available");
});
Deno.test("distributed budget failure stops provider work and exposes no internal diagnostic", async () => {
  const store = new Store();
  store.allowed = false;
  let calls = 0;
  const { handler } = setup(store, () => {
    calls++;
    return Promise.resolve(json({}));
  });
  assert.equal((await handler(request("/rainfall?lat=0&lon=0"))).status, 429);
  assert.equal(calls, 0);
  const internal = crypto.randomUUID();
  store.takeBudget = () => Promise.reject(new Error(internal));
  const response = await handler(request("/health"));
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes(internal), false);
});
Deno.test("CORS matches configured origins exactly and never enables credentialed access", async () => {
  const { handler } = setup();
  assert.equal(
    (await handler(request("/health", { headers: { Origin: "https://attacker.example" } }))).status,
    403,
  );
  const allowed = await handler(
    request("/health", { headers: { Origin: "https://watermark.example" } }),
  );
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), "https://watermark.example");
  assert.equal(allowed.headers.get("Access-Control-Allow-Credentials"), null);
});
Deno.test("missing backend configuration fails closed before external calls", async () => {
  const handler = createHandler({ store: null, origins: [], userAgent: "fixture" });
  assert.equal((await handler(request("/health"))).status, 503);
});
Deno.test("server credential stays in server headers and never becomes response data", async () => {
  const credential = crypto.randomUUID();
  let captured = "";
  const store = createStore("https://database.example", credential, (_input, init) => {
    captured = new Headers(init?.headers).get("apikey") ?? "";
    return Promise.resolve(json([]));
  });
  const rows = await store.providerStatus();
  assert.equal(captured, credential);
  assert.equal(JSON.stringify(rows).includes(credential), false);
});

Deno.test("successful empty cache acknowledgements do not report a failed write", async () => {
  const store = createStore(
    "https://database.example",
    crypto.randomUUID(),
    () => Promise.resolve(new Response(null, { status: 204 })),
  );
  await store.cacheFloodNet({ stations: [], events: [] });
});
