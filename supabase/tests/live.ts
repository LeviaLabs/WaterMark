// Explicit opt-in network checks; never part of deterministic unit tests.
import assert from "node:assert/strict";
import { alerts, floodnet, forecast } from "../functions/_shared/providers.ts";

const point = { lat: 40.588256, lon: -73.984969 };
const now = new Date();
const results = await Promise.all([
  forecast("rainfall", point, now),
  forecast("river", { lat: 52.52, lon: 13.41 }, now),
  alerts(point, "WaterMark/0.1 (https://github.com/LeviaLabs/WaterMark)", now),
  floodnet({ lat: 40.591699, lon: -73.809929 }, now),
]);
for (const result of results) {
  console.log(
    JSON.stringify({
      source: result.source.id,
      status: result.status,
      fetchedAt: result.fetchedAt,
      sourceUpdatedAt: result.sourceUpdatedAt,
      units: result.units,
      error: result.error?.code,
      qualityFlags: result.qualityFlags,
    }),
  );
  assert.notEqual(result.status, "error", `${result.source.id}: ${result.error?.code}`);
  assert.notEqual(result.status, "unsupported");
}
assert.ok(results[0].data?.samples.length);
assert.ok(results[1].data?.samples.length);
assert.ok(results[3].data?.stations.length);
assert.ok(
  results[3].data?.events.length,
  "Verified Rockaway historical-event sample should include at least one event; investigate upstream changes if empty.",
);
