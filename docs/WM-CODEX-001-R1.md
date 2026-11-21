# WM-CODEX-001-R1 backend review corrections

Human owner: Decong. Branch: `feat/decong-data-api`. Target: draft PR #4.
Reviewed baseline: `dbd292288052205ff1b9b98d6a36107d31209eb5`.
No teammate files, unrelated PRs, hosted project or infrastructure were changed.

Sources actually read: [WM-GROK-003 review](https://github.com/LeviaLabs/WaterMark/pull/4#issuecomment-7068821547),
[Ryan Lin's health/race comment](https://github.com/LeviaLabs/WaterMark/pull/4#issuecomment-7068775560),
repository instructions/README/contracts and current implementation, NWS OpenAPI,
CAP 1.2, Supabase environment-variable documentation and official FloodNet metadata.

## Disposition

| Finding | Result and evidence |
| --- | --- |
| H1 alert timing | FIXED. Message validity and expected hazard window are separate. Onset/end/message type are preserved; future onset remains upcoming even after message expiry; missing/inconsistent/ended bounds remain unknown with explicit fallback assumptions. Active is not an observation. Deterministic future/active/expired/update/missing-time tests pass. |
| H2 malformed alerts | FIXED. Optional text is nullable. Per-record errors are isolated and counted; valid warnings survive. All-rejected records produce unknown/error rather than false empty assurance. Malformed optional geometry degrades independently. Provider and HTTP endpoint regressions pass. |
| M1 coastal/tropical coverage | FIXED. Explicit flood/coastal/lakeshore/surge allowlist; Hurricane/Tropical Storm Watch/Warning are contextual multi-hazard notices, never direct flood evidence. Tests and API documentation distinguish them. |
| M2 missing area data | FIXED. Validated environmental envelope with public attribution and cache age; unknown counts are null. Positive cache counts remain incomplete lower bounds. Complete area coverage and verified zero are never asserted by the cache. A real empty upstream event query has separate query evidence. SQL and HTTP tests pass. |
| M3 historical freshness | FIXED. Original event/observation and cache times remain separate. Cache over 24 hours old, including mixed snapshots, is stale. Observation staleness is also retained. Area cache oldest/newest times and row timestamps are tested. Source publication freshness is not fabricated. |
| M4 provider coverage | FIXED within the explicitly documented adapter scope. Unsupported candidates make no NWS request; border-region point verification prevents unsupported alert queries. Marine-only/other NWS coverage remains unsupported by this adapter. NYC, London and Toronto were tested live. |
| M5 frontend contract | PARTIAL / ACCEPTANCE DEFERRED. GeoJSON alert/station output is added; existing paths, enum and center/radius input remain. Polygon input has an explicit pending-contract error, not an unsafe circle approximation. Nullable fields, null counts and envelope additions are documented and proposed to Ryan Lin. No acceptance has been received; do not treat this as a final agreed contract. |
| M6 provider health | FIXED. Location unsupported/missing/error outcomes never overwrite contact evidence. Newer successful contacts are persisted atomically; reverse-arriving older writes are ignored. Health explicitly says global availability is unknown. Unit, real SQL and NYC→outside-NYC HTTP regressions pass. |

The M5 proposal was posted for Ryan Lin's decision in
[this PR #4 comment](https://github.com/LeviaLabs/WaterMark/pull/4#issuecomment-7068917730).
The outstanding decisions are polygon input/bounds/layers, status mapping versus
the README proposal, and acceptance of the corrected nullable/envelope fields.
No version/status rename, alternate endpoint namespace, frontend edits or implicit
approval was introduced. PR #4 must remain draft until acceptance.

## Verification

Run on November 21, 2026 (Eastern Time):

| Check | Observed result |
| --- | --- |
| Original deterministic tests | PASS, all 25 retained; only NWS coverage fixtures and area RPC fixture metadata adapted to the corrected implementation |
| New review unit/API regressions | PASS, 29 additional tests; total 54 |
| Original pgTAP | PASS, all 37 retained unchanged |
| New real PostgreSQL regressions | PASS, 20 additional tests; total 57 |
| Typecheck / lint / format | PASS |
| Actual provider adapters | PASS: Open-Meteo rainfall and GloFAS, NWS verified NYC point/alerts, FloodNet Rockaway events |
| Unsupported locations | PASS: London unsupported with zero adapter NWS calls; Toronto unsupported after one coverage lookup and no alert request |
| Local Edge Function / PostgreSQL flow | PASS: persisted real records, bounded spatial evidence, 100 cached Rockaway events, null uncached-area counts, independent historical status, public guest access and successful-contact isolation |
| Database advisors | No warning/error issues reported |
| Strict effective CORS gate | FAIL remains visible: local gateway emits wildcard ACAO |
| Hosted credentials, migrations, public deployment, effective headers | UNVERIFIED; no hosted operation performed |

The live coverage check caught NWS's 301 canonicalization of high-precision
`/points` coordinates. The lookup now constructs four-decimal coordinates and
keeps redirects disabled; the alerts query retains the original coordinates.
A deterministic regression and live NYC verification cover this correction.

One later repeat HTTP smoke check failed at the FloodNet layer; its original
assertion did not retain the structured error code. The next diagnostic Coney
query and full smoke rerun passed without a runtime-code change. The cause of
that intervening provider failure is **UNVERIFIED**, not assumed to be a timeout
or quota error. The smoke assertion now includes sanitized layer errors/flags
for future diagnostics. Successful samples are not an uninterrupted availability claim.

No live severe-warning occurrence was fabricated to test temporal semantics;
those edge cases use clearly synthetic deterministic fixtures. Historical
queries remain bounded/incomplete, not a calibrated flood frequency or probability.

## Eight review assumptions and impact

| ID | Evidence / classification | Impact and remaining gate |
| --- | --- | --- |
| U1 local gateway CORS | VERIFIED LOCALLY. Direct inspection found the isolated `functions-v1` CORS plugin, unset origins, `preflight_continue=false`, credentials disabled. Allowed/disallowed GET were 200/403 with wildcard ACAO; both OPTIONS were 200/wildcard. Handler unit tests retain exact-origin behavior. | HIGH integration gate. Gateway interception is observed locally; hosted behavior is not inferred from it. Strict gate remains failed, no gateway patch. Run allowed/disallowed GET and preflight against an owner-selected dev deployment before release. |
| U2 hosted credentials | DOCUMENTATION CONFIRMED; HOSTED PATH UNVERIFIED. Current Supabase docs reserve the prefix and inject `SUPABASE_SECRET_KEYS`. Resolver now supports that dictionary, a permitted `WATERMARK_SUPABASE_SECRET_KEY` override and runtime legacy fallback; malformed dictionaries fail closed. Unit tests use generated ephemeral values; local real RPC flow succeeds. | HIGH deployment gate. Actual hosted dictionary contents, new-key privilege mapping and project-specific legacy settings must be tested without printing credentials. A custom singular reserved-prefix secret is not a supported setup instruction. |
| U3 hosted public-function setting | LOCAL VERIFIED; HOSTED UNVERIFIED. Guest local HTTP succeeds with the scoped `verify_jwt=false` setting. | HIGH integration gate. Confirm guest GET works on the selected hosted development target; config presence is not proof of deployed behavior. |
| U4 NWS update timestamp | PARTIALLY VERIFIED. Live empty NYC collections carried recent `updated` times. OpenAPI definitions confirm message versus hazard times; no all-conditions heartbeat guarantee was established for collection `updated`. | MEDIUM display-quality uncertainty. Existing conservative 15-minute source-content age flag is retained and explicitly not a provider-health signal; it never hides retained warnings. Agree on display freshness policy or verify a true feed-age signal before operational claims. |
| U5 FloodNet timezone | VERIFIED. Official `aq7i-eu5q` column definitions explicitly describe event start/end in GMT; real sensor/event adapters passed. | Timestamp-shift concern resolved for these columns. Source publication lag and missing publication time remain disclosed. |
| U6 pgTAP/PostGIS | VERIFIED LOCALLY. All original 37 and new 20 SQL tests pass on actual local PostgreSQL/PostGIS, including meter bounds, antimeridian, role/RLS denials and reverse status writes. | Hosted runtime/database parity remains a deployment check, not an inferred pass. No database reset or production test was used. |
| U7 non-US NWS behavior | VERIFIED for representative probes. Direct London/Toronto alert queries returned 400, point lookups 404; NYC returned 200. Adapter now avoids those alert requests. | Resolved for tested examples. Candidate envelopes are not exact political boundaries; point lookup is authoritative within them. All marine/territory edge cases have not been exhaustively tested and remain limited by the documented scope. |
| U8 provider quotas / egress | PROVIDER RULE VERIFIED; HOSTED EGRESS UNVERIFIED. Published Open-Meteo terms apply limits by IP/application. Existing 40/min, 4,000/day bounds and 429 handling remain; no shared-egress topology or saturation test was performed. | MEDIUM availability risk. Other traffic sharing provider accounting could trigger 429 below this app's budget. Structured errors and no retry storm are verified; quotas are not an availability guarantee. |

Primary references: [NWS schema](https://api.weather.gov/openapi.json),
[CAP 1.2](https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2-os.html),
[Supabase environment variables](https://supabase.com/docs/guides/functions/secrets),
[FloodNet metadata](https://data.cityofnewyork.us/api/views/aq7i-eu5q.json),
[Open-Meteo terms](https://open-meteo.com/en/terms).

## Files and remaining work

Code: `contracts.ts`, `providers.ts`, `http.ts`, `handler.ts`, `store.ts`,
`validation.ts`, function entry; new `alert-semantics.ts`, `cache-quality.ts`,
`config.ts`, and one additive review migration. Tests: adapted baseline fixtures,
new `review_test.ts` and `review.test.sql`, extended `live.ts` and `local.ts`.
Documentation: API contract, setup, source catalog, original handoff marked
superseded, and this report. The retained `cors.ts` failure is unchanged.

Lower-priority review items: current-gauge ingestion and backend CI remain
explicitly unimplemented; no operational notification/auth work was added.
Health still uses the bounded public budget rather than creating an unbounded
database endpoint; per-endpoint availability budgets/dedicated DB role remain
post-review decisions. Required NWS contact configuration has no private-repo
fallback, and cached attribution points to the public source dataset.

Exact next action: Ryan Lin accepts or revises the linked R1 contract proposal;
Grokbot can independently review this correction commit and regression evidence.
Only after contract acceptance should the owner authorize a development target
for hosted credential/public-access/CORS checks. No merge, force-push or hosted
deployment is part of this correction. No security/safety or compliance guarantee
is claimed.
