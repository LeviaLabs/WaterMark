// End-to-end checks for a deployed auth-verify function (WM-CLAUDE-002).
// Explicit opt-in network test; never part of the deterministic unit tests.
//
//   AUTH_VERIFY_URL=https://<project-ref>.supabase.co/functions/v1/auth-verify \
//   AUTH_VERIFY_ORIGIN=https://watermark.works \
//   [WATERMARK_TEST_TOKEN=<a fresh MojoAuth access token>] \
//   deno run --allow-env=AUTH_VERIFY_URL,AUTH_VERIFY_ORIGIN,WATERMARK_TEST_TOKEN,AUTH_VERIFY_ALLOW_HTTP \
//     --allow-net supabase/tests/auth-verify/hosted.ts
//
// WATERMARK_TEST_TOKEN is optional: copy it from sessionStorage "wm-auth" right after a real
// sign-in on the deployed site. It is sent only to AUTH_VERIFY_URL and never printed.
// AUTH_VERIFY_ALLOW_HTTP=1 allows an http:// URL, for a dry run against `deno run` on localhost.

const url = Deno.env.get("AUTH_VERIFY_URL")?.trim() ?? "";
const origin = Deno.env.get("AUTH_VERIFY_ORIGIN")?.trim() ?? "";
const token = Deno.env.get("WATERMARK_TEST_TOKEN")?.trim() ?? "";
const allowHttp = Deno.env.get("AUTH_VERIFY_ALLOW_HTTP") === "1";

if (!url || !origin) {
  console.error("Set AUTH_VERIFY_URL and AUTH_VERIFY_ORIGIN.");
  Deno.exit(2);
}

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}

const b64url = (o: unknown) =>
  btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const forged = `${b64url({ alg: "RS256", typ: "JWT" })}.${
  b64url({ sub: "forged", exp: Math.floor(Date.now() / 1000) + 3600 })
}.c2ln`;

const post = (body: string, from = origin) =>
  fetch(url, {
    method: "POST",
    headers: { Origin: from, "Content-Type": "application/json" },
    body,
    redirect: "manual",
  });
const errorCode = async (res: Response) => {
  try {
    return String((await res.json()).error ?? "");
  } catch {
    return "";
  }
};

// 1. Production must not depend on localhost or plain HTTP.
const target = new URL(url);
check("verify URL uses HTTPS", target.protocol === "https:" || allowHttp, target.protocol);
check(
  "verify URL is not localhost",
  allowHttp || !/^(localhost|.+\.localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1?\])$/i.test(target.hostname),
  target.hostname,
);
check("site origin uses HTTPS", new URL(origin).protocol === "https:" || allowHttp, origin);

// 2. CORS: the site origin is allowed; localhost and other sites are not.
const preflight = (from: string) =>
  fetch(url, {
    method: "OPTIONS",
    headers: { Origin: from, "Access-Control-Request-Method": "POST" },
  });
{
  const res = await preflight(origin);
  await res.body?.cancel();
  check(
    "preflight from site origin -> 204 + Allow-Origin",
    res.status === 204 && res.headers.get("access-control-allow-origin") === origin,
    `${res.status}`,
  );
}
for (const other of ["http://localhost:5173", "https://evil.example"]) {
  const res = await preflight(other);
  const code = await errorCode(res);
  check(
    `preflight from ${other} -> 403, no Allow-Origin`,
    res.status === 403 && !res.headers.get("access-control-allow-origin"),
    `${res.status} ${code}`,
  );
}

// 3. Bad input and bad tokens are rejected without reaching a signed-in state.
{
  const res = await fetch(url, { method: "GET", headers: { Origin: origin } });
  check("GET -> 405", res.status === 405, `${res.status} ${await errorCode(res)}`);
}
{
  const res = await post("not json");
  check("malformed body -> 400", res.status === 400, `${res.status} ${await errorCode(res)}`);
}
{
  const res = await post(JSON.stringify({ token: forged }));
  const code = await errorCode(res);
  check("forged JWT -> 401 invalid-token", res.status === 401 && code === "invalid-token", `${res.status} ${code}`);
  check("no-store on responses", res.headers.get("cache-control") === "no-store");
}

// 4. Optional: a real token from a fresh sign-in returns only the account fields.
if (token) {
  const res = await post(JSON.stringify({ token }));
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch { /* checked below */ }
  const account = (body.account ?? {}) as Record<string, unknown>;
  const keys = Object.keys(account).sort().join(",");
  check("real token -> 200", res.status === 200, `${res.status}`);
  check("only id, displayName, expiresAt returned", keys === "displayName,expiresAt,id", keys);
  check("response does not echo the token", !JSON.stringify(body).includes(token));
  check("expiresAt is in the future", typeof account.expiresAt === "number" && account.expiresAt > Date.now());
} else {
  console.log("SKIP  real-token check (WATERMARK_TEST_TOKEN not set)");
}

console.log(failed ? `\n${failed} check(s) failed.` : "\nAll checks passed.");
Deno.exit(failed ? 1 : 0);
