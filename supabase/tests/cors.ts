// Separate platform-level gate. Intentionally fails when the local gateway
// overrides the handler's restricted Origin header with '*'. Do not hide it.
import assert from "node:assert/strict";
const response = await fetch("http://127.0.0.1:55321/functions/v1/watermark-v1/health", {
  headers: { Origin: "http://localhost:5173" },
  signal: AbortSignal.timeout(5000),
});
await response.body?.cancel();
const actual = response.headers.get("Access-Control-Allow-Origin");
console.log(
  JSON.stringify({
    check: "effective gateway CORS header",
    expected: "http://localhost:5173",
    actual,
    status: actual === "http://localhost:5173" ? "PASS" : "FAIL",
  }),
);
assert.equal(
  actual,
  "http://localhost:5173",
  "Gateway overrides function CORS; see docs/BACKEND_SETUP.md. Hosted behavior remains unverified.",
);
