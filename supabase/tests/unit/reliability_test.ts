// Synthetic R2 fixtures, never evidence of live flooding.
import assert from "node:assert/strict";
import { alerts, floodnet } from "../../functions/_shared/providers.ts";
import { parseAlert } from "../../functions/_shared/alert-semantics.ts";
import { createHandler } from "../../functions/_shared/handler.ts";
import { createStore } from "../../functions/_shared/store.ts";
import { type Fetcher, fetchJson, ProviderError, record } from "../../functions/_shared/http.ts";

const point = { lat: 40.588256, lon: -73.984969 }, now = new Date("2026-11-21T12:00:00Z");
const json = (value: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
const sensor = {
  sensor_id: "valid",
  sensor_name: "Fixture",
  latitude: String(point.lat),
  longitude: String(point.lon),
};
const event = {
  sensor_id: "valid",
  flood_start_time: "2026-11-20T11:00:00",
  flood_end_time: "2026-11-20T12:00:00",
  max_depth_inches: "1",
};
function floodFeed(stations: unknown[], events: unknown[]): Fetcher {
  return (input) => Promise.resolve(json(String(input).includes("kb2e-tjy3") ? stations : events));
}
function warning(times = {}) {
  return {
    id: "fixture",
    geometry: null,
    properties: {
      event: "Flood Warning",
      status: "Actual",
      messageType: "Update",
      severity: "Severe",
      urgency: "Expected",
      certainty: "Likely",
      areaDesc: "Fixture",
      language: "en-US",
      sent: "2026-11-21T10:00:00Z",
      effective: "2026-11-21T10:00:00Z",
      expires: "2026-11-21T18:00:00Z",
      onset: "2026-11-21T11:00:00Z",
      ends: "2026-11-21T17:00:00Z",
      ...times,
    },
  };
}

Deno.test("R2 FloodNet isolates missing names, invalid coordinates and unsafe sensor IDs", async () => {
  let eventQuery = "";
  const feed = floodFeed([sensor, { ...sensor, sensor_name: undefined }, {
    ...sensor,
    latitude: "bad",
  }, { ...sensor, sensor_id: "x') OR true" }], [event]);
  const result = await floodnet(point, now, (input, init) => {
    if (String(input).includes("aq7i")) {
      eventQuery = new URL(String(input)).searchParams.get("$where") ?? "";
    }
    return feed(input, init);
  });
  assert.equal(result.status, "available");
  assert.equal(result.data?.stations.length, 1);
  assert.equal(result.data?.events.length, 1);
  assert.equal(result.diagnostics?.rejectedStationRecords, 3);
  assert.ok(result.qualityFlags.includes("PARTIAL_DATA"));
  assert.ok(result.qualityFlags.includes("STATION_RECORD_REJECTED"));
  assert.match(eventQuery, /^sensor_id in\('valid'\)/);
  assert.equal(eventQuery.includes("OR true"), false);
});
Deno.test("R2 FloodNet isolates omitted depths, wrong units, foreign stations and invalid times", async () => {
  const result = await floodnet(
    point,
    now,
    floodFeed([sensor], [
      event,
      { ...event, max_depth_inches: undefined },
      { ...event, max_depth_inches: "12 mm" },
      { ...event, sensor_id: "unqueried" },
      { ...event, flood_start_time: "bad" },
      { ...event, flood_end_time: "2026-11-19T12:00:00" },
      { ...event, flood_start_time: "2026-11-22T11:00:00" },
    ]),
  );
  assert.equal(result.status, "available");
  assert.equal(result.data?.events.length, 1);
  assert.equal(result.data?.events[0].maxDepthMm, 25.4);
  assert.equal(result.diagnostics?.rejectedEventRecords, 6);
  assert.ok(
    result.diagnostics?.recordErrors?.some((r) =>
      r.code === "INVALID_PROVIDER_UNITS" && r.count === 1
    ),
  );
  assert.ok(result.qualityFlags.includes("EVENT_RECORD_REJECTED"));
});
Deno.test("R2 all invalid sensors preserve unknown status and skip the event request", async () => {
  let calls = 0;
  const result = await floodnet(point, now, () => {
    calls++;
    return Promise.resolve(json([{ sensor_id: "bad" }]));
  });
  assert.equal(calls, 1);
  assert.equal(result.status, "insufficient_data");
  assert.deepEqual(result.data?.stations, []);
  assert.equal(result.data?.queryEvidence?.eventSearchCompleted, false);
  assert.equal(result.data?.queryEvidence?.zeroEventMatchesVerified, false);
  assert.ok(result.qualityFlags.includes("NO_VALID_STATION_RECORDS"));
  assert.equal(result.qualityFlags.includes("SOURCE_SENSOR_QUERY_EMPTY"), false);
});
Deno.test("R2 all invalid events preserve stations without claiming a verified zero", async () => {
  const result = await floodnet(
    point,
    now,
    floodFeed([sensor], [{ ...event, max_depth_inches: null }]),
  );
  assert.equal(result.status, "insufficient_data");
  assert.equal(result.data?.stations.length, 1);
  assert.deepEqual(result.data?.events, []);
  assert.equal(result.data?.queryEvidence?.eventSearchCompleted, true);
  assert.equal(result.data?.queryEvidence?.zeroEventMatchesVerified, false);
  assert.ok(result.qualityFlags.includes("NO_VALID_EVENT_RECORDS"));
});
Deno.test("R2 empty FloodNet source query remains distinguishable from rejected records", async () => {
  const result = await floodnet(point, now, floodFeed([sensor], []));
  assert.equal(result.data?.queryEvidence?.zeroEventMatchesVerified, true);
  assert.equal(result.diagnostics?.rejectedEventRecords, 0);
  assert.equal(result.qualityFlags.includes("PARTIAL_DATA"), false);
});
for (const stage of ["stations", "events"] as const) {
  Deno.test(`R2 FloodNet ${stage} timeout diagnostics survive without automatic retry`, async () => {
    let calls = 0;
    const result = await floodnet(point, now, (input) => {
      calls++;
      if (stage === "events" && String(input).includes("kb2e")) {
        return Promise.resolve(json([sensor]));
      }
      return Promise.reject(new ProviderError("PROVIDER_TIMEOUT"));
    });
    assert.equal(calls, stage === "stations" ? 1 : 2);
    assert.equal(result.error?.code, "PROVIDER_TIMEOUT");
    assert.equal(result.diagnostics?.failures?.[0].stage, `floodnet_${stage}`);
    assert.equal(result.status, stage === "stations" ? "error" : "insufficient_data");
    if (stage === "events") {
      assert.equal(result.data?.stations.length, 1);
      assert.equal(result.data?.queryEvidence?.eventSearchCompleted, false);
      assert.equal(result.data?.queryEvidence?.zeroEventMatchesVerified, false);
    } else assert.equal(result.data, null);
  });
}
Deno.test("R2 FloodNet 503 and 429 retain stage, HTTP status or retry delay and do not retry", async () => {
  for (const status of [503, 429]) {
    let calls = 0;
    const result = await floodnet(point, now, (input) => {
      calls++;
      return Promise.resolve(
        String(input).includes("kb2e")
          ? json([sensor])
          : json({}, status, { "Retry-After": "120" }),
      );
    });
    assert.equal(calls, 2);
    assert.equal(result.data?.stations.length, 1);
    assert.equal(result.status, "insufficient_data");
    assert.equal(result.diagnostics?.failures?.[0].stage, "floodnet_events");
    if (status === 503) assert.equal(result.diagnostics?.failures?.[0].httpStatus, 503);
    else assert.equal(result.error?.retryAfterSeconds, 120);
  }
});
Deno.test("R2 FloodNet transport and malformed collection failures retain distinct diagnostics", async () => {
  const transport = await floodnet(
    point,
    now,
    () => Promise.reject(new TypeError("private details must not escape")),
  );
  assert.equal(transport.error?.code, "PROVIDER_NETWORK_ERROR");
  assert.equal(JSON.stringify(transport).includes("private details"), false);
  const malformed = await floodnet(
    point,
    now,
    (input) => Promise.resolve(json(String(input).includes("kb2e") ? [sensor] : { invalid: true })),
  );
  assert.equal(malformed.error?.code, "INVALID_PROVIDER_RESPONSE");
  assert.equal(malformed.data?.stations.length, 1);
  assert.equal(malformed.diagnostics?.failures?.[0].stage, "floodnet_events");
});
Deno.test("R2 actual fetch abort deadline and malformed JSON remain distinct", async () => {
  const stalled: Fetcher = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError")), { once: true });
    });
  await assert.rejects(
    () => fetchJson("https://fixture.invalid", {}, stalled, 5),
    (e: unknown) => e instanceof ProviderError && e.code === "PROVIDER_TIMEOUT",
  );
  await assert.rejects(
    () =>
      fetchJson("https://fixture.invalid", {}, () =>
        Promise.resolve(
          new Response("bad JSON", { headers: { "Content-Type": "application/json" } }),
        )),
    (e: unknown) => e instanceof ProviderError && e.code === "INVALID_PROVIDER_RESPONSE",
  );
});
Deno.test("R2 FloodNet event request enforces the actual six-second abort deadline", async () => {
  let calls = 0;
  const result = await floodnet(point, now, (input, init) => {
    calls++;
    if (String(input).includes("kb2e")) return Promise.resolve(json([sensor]));
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("aborted", "AbortError")),
        { once: true },
      );
    });
  });
  assert.equal(calls, 2);
  assert.equal(result.error?.code, "PROVIDER_TIMEOUT");
  assert.equal(result.diagnostics?.failures?.[0].stage, "floodnet_events");
  assert.equal(result.data?.stations.length, 1);
  assert.equal(result.data?.queryEvidence?.eventSearchCompleted, false);
});
for (
  const failure of [
    new ProviderError("PROVIDER_TIMEOUT"),
    new ProviderError("PROVIDER_HTTP_ERROR", undefined, 503),
    new ProviderError("INVALID_PROVIDER_RESPONSE"),
  ]
) {
  Deno.test(`R2 NWS ${failure.code} lookup retains independently returned warnings`, async () => {
    let calls = 0;
    const result = await alerts(point, "fixture", now, (input) => {
      calls++;
      if (String(input).includes("/points/")) return Promise.reject(failure);
      return Promise.resolve(
        json({ type: "FeatureCollection", updated: now.toISOString(), features: [warning()] }),
      );
    });
    assert.equal(calls, 2);
    assert.equal(result.status, "available");
    assert.equal(result.data?.length, 1);
    assert.equal(result.data?.[0].hazardTiming, "active");
    assert.ok(result.qualityFlags.includes("GEOGRAPHIC_RESOLUTION_INCOMPLETE"));
    assert.equal(result.diagnostics?.failures?.[0].code, failure.code);
    assert.equal(result.diagnostics?.rejectedAlertRecords, 0);
  });
}
Deno.test("R2 NWS failed lookup plus failed alert request preserves both incomplete resolution and failure", async () => {
  const result = await alerts(point, "fixture", now, () => Promise.resolve(json({}, 503)));
  assert.equal(result.status, "error");
  assert.equal(result.data, null);
  assert.ok(result.qualityFlags.includes("GEOGRAPHIC_RESOLUTION_INCOMPLETE"));
  assert.equal(result.diagnostics?.failures?.[0].httpStatus, 503);
  assert.equal(result.error?.code, "PROVIDER_HTTP_ERROR");
});
Deno.test("R2 valid message distinguishes ended, future, active and unknown hazard windows", () => {
  for (
    const [times, expected] of [
      [{ ends: "2026-11-21T11:59:00Z" }, "ended"],
      [{ ends: now.toISOString() }, "ended"],
      [{ onset: null, ends: "2026-11-21T11:59:00Z" }, "ended"],
      [{ onset: null, effective: "2026-11-21T11:59:30Z", ends: "2026-11-21T11:59:00Z" }, "ended"],
      [{ onset: "2026-11-21T13:00:00Z" }, "upcoming"],
      [{}, "active"],
      [{ onset: "2026-11-21T13:00:00Z", ends: "2026-11-21T12:00:00Z" }, "unknown"],
    ] as const
  ) {
    const alert = parseAlert(warning(times), now);
    assert.equal(alert?.messageValidity, "in_force");
    assert.equal(alert?.hazardTiming, expected);
    assert.equal(alert?.messageType, "Update");
  }
  assert.equal(parseAlert(warning({ expires: now.toISOString() }), now), null);
  const futureMessage = parseAlert(
    warning({ onset: null, effective: "2026-11-21T13:00:00Z", ends: "2026-11-21T11:59:00Z" }),
    now,
  );
  assert.equal(futureMessage?.messageValidity, "upcoming");
  assert.equal(futureMessage?.hazardTiming, "ended");
});
Deno.test("R2 HTTP summary caches only valid FloodNet rows and retains partial diagnostics", async () => {
  let cached: unknown;
  const store = createStore("https://fixture.invalid", crypto.randomUUID(), (_input, init) => {
    if (String(_input).includes("cache_floodnet")) cached = JSON.parse(String(init?.body));
    return Promise.resolve(json(true));
  });
  const handler = createHandler({
    store,
    origins: [],
    userAgent: "fixture",
    now: () => now,
    fetcher: floodFeed([sensor], [event, { ...event, max_depth_inches: null }]),
  });
  const response = await handler(
    new Request(
      `https://fixture.invalid/watermark-v1/location-summary?lat=${point.lat}&lon=${point.lon}`,
    ),
  );
  assert.equal(response.status, 200);
  const result = record(record(record(await response.json()).data).historicalFloods);
  assert.equal(result.status, "available");
  assert.equal(record(result.diagnostics).rejectedEventRecords, 1);
  const cache = record(cached);
  assert.ok(Array.isArray(cache.p_events));
  assert.equal(cache.p_events.length, 1);
});
Deno.test("R2 post-hazard update without onset does not invent a later hazard start", async () => {
  const result = await alerts(point, "fixture", now, (input) =>
    Promise.resolve(json(
      String(input).includes("/points/") ? { properties: { cwa: "OKX" } } : {
        type: "FeatureCollection",
        updated: now.toISOString(),
        features: [
          warning({ onset: null, effective: "2026-11-21T11:59:30Z", ends: "2026-11-21T11:59:00Z" }),
        ],
      },
    )));
  assert.equal(result.data?.[0].messageValidity, "in_force");
  assert.equal(result.data?.[0].hazardTiming, "ended");
  assert.equal(result.validFrom, null);
  assert.equal(result.validTo, "2026-11-21T11:59:00.000Z");
});
