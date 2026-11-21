# WM-CODEX-001 integration handoff

**Current behavior/test counts: [WM-CODEX-001-R1](WM-CODEX-001-R1.md).** This
original handoff records `dbd2922`; its area, alert, credential and health
descriptions are superseded by the R1 corrections.

Human owner: Decong. Feature branch: `feat/decong-data-api`.
Baseline: clean `main` at `9f862b5`. Status: implemented and locally tested draft;
Ryan Lin contract acceptance and Grokbot overlap review remain pending, as
explicitly requested by the owner. No merge or hosted deployment is authorized
by this handoff.

## Result and files

The repository previously had a Vite app and historical-data Python script,
with no Supabase configuration, migrations, functions, shared contract or tests.
The new backend provides guest-readable environmental responses, validated
provider adapters, server-only spatial/history storage, and bounded request
budgets. A real provider → Edge Function → PostgreSQL/PostGIS → JSON response
flow was exercised locally.

- `supabase/functions/watermark-v1/index.ts`: public environmental Edge Function entry.
- `supabase/functions/_shared/`: typed contracts, validation, transport, four
  provider adapters, server-side database transport, routing and failure states.
- `supabase/migrations/`: four additive CLI-generated migrations for the schema,
  provenance, bounded historical event series and provider-aware quota budget.
- `supabase/tests/`: deterministic unit/API tests, pgTAP authorization/spatial
  tests, opt-in live tests, local integration, separate strict CORS gate.
- `supabase/package.json`, lockfile, Deno configuration, Supabase configuration,
  environment template and ignore files: project-local setup only.
- `docs/API_CONTRACTS.md`, `docs/BACKEND_SETUP.md`, `docs/DATA_SOURCES.md` and
  this file: interface proposal, setup/schema/security, source evidence and handoff.
- Backend `.gitignore`: ignores dependencies and local env files without editing the shared root file.

No existing frontend, map, AI, auth UI, deployment configuration, README,
AGENTS instructions or historical Python implementation was changed.

## Interface for Ryan Lin

Review [the API proposal](API_CONTRACTS.md) before mounting it in the map.
The exact base path is `/functions/v1/watermark-v1`; production hostname is
not provisioned. Type-only exports are in `_shared/contracts.ts`, including
`ApiResponse`, `LocationSummary`, `EnvironmentalResult`, `ForecastData`,
`OfficialAlert`, `FloodNetData`, `Location`, and `Area`.

1. Configure the frontend's proposed `VITE_WATERMARK_API_BASE_URL` only after
   the backend target and contract are approved. No server key is needed.
2. Request `/location-summary?lat=...&lon=...` on selected-location changes.
3. Render the five independent result states separately. An error, unsupported,
   stale or insufficient-data result never means a location is safe.
4. Plot forecast samples using each `validFrom`/`validTo` interval and units.
   Keep null samples missing and issuance time unknown when null.
5. Render `officialAlerts.data` as plain text; preserve source language, severity, times
   and source link. The subset covers flood/rain event names only.
6. POST validated center/radius data to `/area-summary`. Metrics are limited
   cached sensor statistics, not area-wide rainfall or flood probabilities.
7. Read `/series?lat=...&lon=...&kind=historical_flood_events` after the location
   summary caches public FloodNet records. Historical peaks and exact sensor
   footprints do not establish current neighborhood conditions.

`/flood-exposure` is explicitly insufficient-data in the NYC envelope until
scenario polygons are implemented. Current gauge observation ingestion is not
implemented; `/series` with `historical_observations` correctly returns missing
data for an empty cache. Do not represent either as a completed live layer.

Grokbot: inspect this namespace for any unpushed overlap before acceptance.
The report on `research/decong-alert-integrations`, §5, was reviewed after it
appeared remotely. Its flat alert envelope/version, provider-status route and
notification schema remain proposals and conflict with parts of this draft.
Those differences are recorded in `API_CONTRACTS.md`; neither is claimed approved.
No notification tables, subscriptions or delivery endpoints were finalized.
Claude: login/auth UI and session behavior are untouched; guest access works.
Your proposed source-language metadata is implemented for official alerts from
the NWS CAP `language` field (nullable if absent). No official text is translated;
the general result language is unknown unless explicitly supplied. No proposed
MojoAuth verification endpoint or saved-profile schema was implemented.
Ryan B: no AWS/Amplify/AI settings were changed. Coordinate actual backend and
frontend origins before deployment. All variables are documented by name only.

## Verification evidence

Verification date: November 21, 2026 (Eastern Time).

| Check | Actual result |
| --- | --- |
| TypeScript check, including live/local scripts | PASS |
| Deno lint and formatting | PASS |
| Deterministic unit/API tests | PASS, 25 tests |
| Local PostgreSQL/pgTAP tests | PASS, 37 tests |
| Selected real provider adapters | PASS: NWS, Open-Meteo precipitation, GloFAS river discharge, FloodNet sensor/event APIs |
| Served local API → provider → database → API | PASS: guest access, independent source states, persisted metadata/events, bounded spatial query, cached event series, invalid-input handling, application Origin enforcement |
| Real historical event evidence | Rockaway returned events; database series returned 100 events with cache/truncation limits disclosed |
| Missing measurements | Coney Island query returned four sensor metadata rows and no recent events; correctly insufficient-data. Empty measurement cache stays insufficient-data. |
| Supabase database advisors | PASS at warning/error level; no issues reported |
| Added backend npm dependencies | Audit reported 0 known vulnerabilities |
| Strict effective CORS response header | FAIL locally: gateway overrides the handler with wildcard `*`. Kept as a separate failing test. |
| Hosted project, migrations, function URL and effective headers | UNVERIFIED; no WaterMark project is connected and none was created/deployed |
| Frontend/map integration and full frontend build | UNVERIFIED; outside this backend branch and pending Ryan Lin |

The deterministic suite includes malformed coordinates, excessive radius,
missing values, provider timeouts/HTTP failures/rate limits, wrong units,
historical/forecast/retrieval timestamp separation, stale observations, source
threshold comparison, partial provider outage, missing configuration, sanitized
errors and server credential boundaries. pgTAP exercises real roles/RLS,
negative SELECT/INSERT/UPDATE/DELETE behavior, forged metadata, spatial meter
queries including the antimeridian, bounds, units, private RPC execution and
atomic request limits. Database fixtures roll back.

The HTTP check discovered an empty successful database RPC acknowledgement
being misreported as a failed cache write. That handling was corrected and
covered by a regression test before the local flow passed. The separate CORS
gate remains failed; it was not removed or reported as passing.

## Risks and next action

This is not a production-ready or complete hackathon MVP claim. Contract
acceptance, unpushed work coordination, hosted credentials/project setup,
effective gateway headers, privacy/log retention and public deployment remain
owner/team decisions. See the setup document for the actual local CORS failure
and its [upstream report](https://github.com/supabase/supabase/issues/52346).

Global quotas bound this prototype's provider traffic but can be exhausted by
abuse and do not account for other applications sharing a provider egress IP.
No stress test, availability guarantee, independent forecast validation,
property-level flood estimate or legal-compliance assessment was performed.

The repository instructions flag a credential-like value in the planning doc.
Its provider/privilege and rotation state are not verified here. The owner should
verify and revoke/rotate it as appropriate; no value is reproduced or committed.
An unrelated repository-history secret audit was not performed.

Remote context was refreshed before commit: `main` advanced to `4d020c9`,
adding Astryx/frontend tooling and a root ignore file. The new Astryx rules
concern UI and do not apply to these backend-only changes. Relevant reports on
the auth/i18n, notification-research and frontend-CI branches were inspected.
They have not been merged into this worktree; their test claims were not treated
as this branch's verification evidence. The existing root ignore file on `main`
is left for the normal reviewed integration; backend ignores are scoped locally.

Exact next action: Decong, Ryan Lin and Grokbot review the draft contract and
backend diff. After acceptance, explicitly select/authorize a development
Supabase target, verify its effective headers and credentials, then let Ryan Lin
integrate the typed response. Merging and shared deployment remain separate
owner decisions. Keep scenario exposure and missing observations visibly unknown.
