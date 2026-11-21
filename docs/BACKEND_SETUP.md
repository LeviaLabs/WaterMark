# WaterMark backend setup and schema

WM-CODEX-001. Draft for Decong and teammate review. No hosted project was
created, linked, migrated, or deployed. The existing `WaterMark/` app is unchanged.

Current correction evidence and the authorization-gated hosted verification plan
are in [WM-CODEX-001-R2.md](WM-CODEX-001-R2.md). Provider requests do not retry
automatically. Partial FloodNet results can contain sensor data plus an event
retrieval error; inspect diagnostics/quality flags as described in the API contract.

## Local tools

Verified on Windows with Git 2.55.0, Node 24.22.1, npm 12.2.1, Docker 29.9.3,
project-local Supabase CLI 3.2.0, and Deno 2.9.6. The served Supabase Edge Runtime
reported version 1.79.1 / Deno 2.1.4. Backend dependencies are pinned separately
in `supabase/package.json` and its lockfile; no global installation is required.

From the repository root in PowerShell:

```powershell
npm.cmd --prefix supabase ci
$env:SUPABASE_TELEMETRY_DISABLED = '1'
$env:DO_NOT_TRACK = '1'
./supabase/node_modules/.bin/supabase.cmd start --exclude gotrue,realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor
./supabase/node_modules/.bin/supabase.cmd migration up
```

The local project identifier is `watermark-wm-codex-001`; API/database ports are
55321/55322. It is isolated from other local projects. Do not link a shared
project or add `--remote` without owner authorization. Local Docker networking
and firewall exposure must be reviewed before sharing the machine's ports.

Copy `supabase/.env.example` to the ignored `supabase/functions/.env` and configure:

| Variable name | Purpose |
| --- | --- |
| `WATERMARK_ALLOWED_ORIGINS` | Exact comma-separated frontend origins; empty means browser requests are rejected |
| `WATERMARK_NWS_USER_AGENT` | Application identity and public project/contact reference for NWS |
| `SUPABASE_URL` | Runtime backend URL, supplied automatically by local/hosted Supabase |
| `SUPABASE_SECRET_KEYS` | Platform-injected JSON dictionary; default server secret is supported |
| `WATERMARK_SUPABASE_SECRET_KEY` | Optional server-only override using a permitted custom secret name |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy server-only credential supplied by the Supabase function runtime |

Only WaterMark-prefixed variables belong in custom secrets. The `SUPABASE_`
prefix is reserved; do not attempt to configure a custom singular
`SUPABASE_SECRET_KEY`. Its legacy read is retained only for runtime compatibility.
Malformed injected dictionaries fail closed without logging values. Hosted
injection/permissions remain unverified. `WATERMARK_NWS_USER_AGENT` is required
for supported NWS queries; an owner-supplied monitored contact is a release prerequisite.
Never
put privileged credentials in frontend variables, examples, logs, or handoffs.
The browser needs only the proposed `VITE_WATERMARK_API_BASE_URL` variable after
Ryan Lin agrees to integrate; it does not need a server credential.

Serve the Edge Function in another terminal:

```powershell
$env:SUPABASE_TELEMETRY_DISABLED = '1'
$env:DO_NOT_TRACK = '1'
./supabase/node_modules/.bin/supabase.cmd functions serve watermark-v1
```

Base path: `/functions/v1/watermark-v1`. `verify_jwt=false` is scoped to this
public environmental-read function. Database tables/RPCs remain server-only.
There are no account, subscription, notification, or privileged write routes.

## Verification commands

```powershell
npm.cmd --prefix supabase run check
npm.cmd --prefix supabase run lint
npm.cmd --prefix supabase test
./supabase/node_modules/.bin/supabase.cmd test db
npm.cmd --prefix supabase run test:live
npm.cmd --prefix supabase run test:local
npm.cmd --prefix supabase run test:cors
./supabase/node_modules/.bin/supabase.cmd db advisors --type all --level warn --fail-on error
```

Unit tests use clearly synthetic fixtures and make no external requests.
`test:live` opts into the actual providers. `test:local` targets only this
loopback project but the function itself calls real providers; it writes public
sensor/event records to this local cache. No exact selected-location history is
stored. `test:cors` intentionally retains the strict effective-header check;
it currently fails against the local gateway as explained below.

Stop the dedicated test stack without deleting its data:

```powershell
./supabase/node_modules/.bin/supabase.cmd stop
```

Do not use database resets, volume deletion, `--no-backup`, or remote flags as a
substitute for applying these additive migrations.

## Schema

Five CLI-generated migrations create and refine these tables:

| Table | Keys, data and purpose |
| --- | --- |
| `public.source_status` | Provider ID primary key; name, official URL, legacy outcome columns and atomic `last_success_at`. R1 health ignores legacy location outcomes; only newer successful contacts update success/check timestamps. |
| `public.monitoring_stations` | Composite provider/station primary key; source foreign key; name; `geography(Point,4326)`; metadata fetch time; measurement freshness interval. GiST location index. |
| `public.flood_events` | Composite provider/station/event-start primary key; composite station foreign key; UTC start/end; peak depth in mm; fetch time; time index. Event peaks are not instantaneous gauge readings. |
| `public.historical_observations` | UUID primary key; composite station foreign key; unique provider/station/metric/observation time; UTC observation and retrieval times; metric, normalized units, value and quality flags. Station/time index. No production measurement ingestion is claimed. |
| `watermark_private.request_budgets` | Fixed global time-bucket primary key, atomic request count and expiry. No IP, user, coordinate or session identifier. |

All timestamps use `timestamptz`; API times are UTC ISO 8601. Values must be
finite and nonnegative. Unit constraints pair water depth with mm and river
discharge with m3/s. Station geometry uses longitude/latitude; PostGIS geography
distances use meters. SQL validates bounds independently of the HTTP layer.

All tables enable RLS. Browser roles have no table grants or matching policies;
only `service_role` has backend policies/grants. Public-schema RPCs are
`SECURITY INVOKER`, use an empty search path, and revoke default PUBLIC/browser
execution. Tests temporarily grant browser table privileges inside a rolled-back
transaction to prove that RLS still denies access.

`watermark_area_summary` counts cached sensor coverage/events within 100–10,000 m
and reports a historical maximum **among those cached sensors**. It does not
return a circle-average rainfall estimate or complete flood frequency.
`watermark_history` and `watermark_event_history` select bounded 1,000 m / 90-day
samples. All counts explicitly have incomplete cache coverage.
R1 changes absent counts to null, exposes oldest/newest cache fetch times and up
to 100 GeoJSON station points, and validates the RPC response in the HTTP layer.
Cached rows over 24 hours old are stale, independently of source measurement time.
`watermark_record_provider_success` is a server-only invoker RPC with conditional
timestamp updates. Health describes contact evidence, not continuous monitoring;
global availability stays unknown. Apply the R1 migration before using its handler.

`watermark_cache_floodnet` accepts up to 50 validated stations and 100 historical
events per batch; it upserts source records and prunes records older than 90 days
when invoked. Retention is lazy, not a scheduled deletion guarantee. Forecasts
and NWS alerts are fetched on demand rather than bulk-ingested.

`risk_assessments` and notification tables are omitted because no validated
derived risk model or agreed notification contract exists.

## Boundaries and outstanding platform issue

The trust boundary is anonymous request → strict validation → distributed budget
→ fixed provider URLs / bounded SQL → sanitized typed response. Upstream data
are untrusted; redirects, oversized payloads, malformed units, null values,
errors and timeouts are handled. Alert strings must be rendered as plain text.
Database failures fail closed before provider requests. No application secrets
or diagnostics are returned to clients.

Budgets are global: 40 requests/minute and 4,000/day. A location summary makes
at most two Open-Meteo calls, so this implementation is bounded to 4,800/hour
and 8,000/day for that provider. This is below its currently published free-tier
limits; shared egress use by other applications can still cause 429 responses.
An attacker can exhaust the shared availability budget; fair per-client limits
and operational monitoring remain a production decision.

**FAIL — local effective CORS response header.** The handler returns only its
configured Origin, and an actual request with an unconfigured Origin returns
403. The local Supabase gateway replaces the response header with `*` and may
handle preflight itself. No credentialed CORS response is enabled. This matches
the [upstream gateway report](https://github.com/supabase/supabase/issues/52346).
No gateway image/configuration was patched as an undocumented workaround.
R1 directly inspected this stack's `functions-v1` CORS plugin: origins are unset,
`preflight_continue=false`, credentials disabled. Allowed/disallowed GET statuses
were 200/403 with wildcard headers; OPTIONS for either origin returned 200 with
wildcard headers. This establishes local gateway interception rather than merely
assuming it shares an upstream self-hosting issue. Hosted behavior remains unknown.
Run the retained strict `test:cors` gate against the eventual deployment and
resolve effective headers before claiming a restricted production CORS policy.
Hosted behavior remains **UNVERIFIED**.

Coordinates are processed transiently and sent to NWS, Open-Meteo, and NYC Open
Data for the selected public-data queries. Persisted content contains public
station coordinates, public event records, provider status and quota buckets.
There is no user-location history, account data, raw-IP logging, analytics or
notification collection in this backend. Supabase/gateway and upstream logging,
retention, privacy notices, deployed HTTPS/headers and operational cost monitoring
need owner review before public launch. No legal-compliance conclusion is made.
