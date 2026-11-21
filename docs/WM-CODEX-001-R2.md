# WM-CODEX-001-R2 reliability corrections

Human owner: Decong. Branch: `feat/decong-data-api`. Target: **draft PR #4**.
Reviewed baseline: `888e071ed10bce051c81586d44b5c64b066f16aa`.
This report supersedes R1's remaining adapter issues, not its recorded test history.
No frontend, unrelated PR, schema, hosted project or infrastructure was changed.

## Findings and disposition

Actual sources: [Grokbot's correction verification](https://github.com/LeviaLabs/WaterMark/pull/4#issuecomment-7069600884)
and [Ryan Lin's preliminary support/request](https://github.com/LeviaLabs/WaterMark/pull/4#issuecomment-7069514336),
read before changes. Current repository code and executed checks are the evidence
for implementation; neither comment is merge or deployment authorization.

| Concern | Disposition |
| --- | --- |
| R1-N3 malformed FloodNet rows | FIXED. Each sensor/event is parsed separately. Missing names/depth, invalid units/coordinates/IDs/times and foreign station references are rejected and counted. Usable rows survive with partial-data flags and aggregated reason codes. Only validated station IDs enter SoQL and only validated records enter the cache. All-rejected rows remain insufficient data, never a verified zero. |
| R1-N1 secondary NWS lookup | FIXED. Non-authoritative lookup failures no longer suppress an independently successful point-filtered alert response. The lookup stage/code/HTTP status or retry delay survives with incomplete-geographic-resolution flags. Candidate rejection and authoritative point 400/404 still avoid unsupported alert requests. No zone lookup is required. Failed alert retrieval still produces a structured error, retaining lookup diagnostics. |
| R1-N2 ended hazard | FIXED IN DRAFT CONTRACT. `hazardTiming` gains `ended`; explicit expected end is separate from message validity. An update issued after the expected end does not invent a later hazard start. Future onset remains upcoming; contradictory explicit bounds stay unknown. No state is treated as observed flooding or confirmed safety. Ryan Lin must accept the enum addition. |
| Intermittent FloodNet failure | DIAGNOSTICS/HANDLING FIXED; ORIGINAL CAUSE UNVERIFIED. Failed sensor retrieval remains error/null. Failed event retrieval preserves validated sensor metadata with insufficient-data status, structured error, partial flag and request-stage diagnostics. Transport, HTTP, JSON/shape, timeout and rate-limit cases are distinct where evidence permits. The earlier failure lacked diagnostics, so a cause cannot be reconstructed. Successful live samples do not establish uptime. |
| M5 frontend interface | PENDING. Ryan's preliminary support is not final acceptance. A full dated area response and proposed map/panel/landing field mapping are now in the API contract. Existing paths, root version, status enum and center/radius request stay. Explicit acceptance is needed for R1 nullable/envelope changes, R2 `ended`, partial results with errors and diagnostics. No new table is needed. |

## Verification actually run

Run November 21, 2026 (Eastern Time), against local tools pinned in
`supabase/package.json`. Provider checks use real upstream responses; regression
fixtures are synthetic and never presented as live hazard evidence.

| Check | Result |
| --- | --- |
| Baseline before edits | PASS: 54 unit/API tests at `888e071` |
| Final deterministic suite | PASS: **72 tests**, including **18 new R2 tests**, all 25 foundation and 29 R1 cases retained |
| Type checking | PASS: function entry, scripts, and test compilation |
| Deno lint / formatting / Git whitespace | PASS |
| PostgreSQL/pgTAP | PASS: **57 tests** across unchanged foundation/review SQL suites on actual local PostgreSQL/PostGIS; no reset or new migration |
| Migration history | Five existing migrations match the local database; no hosted target was used |
| Local database advisors | PASS: no warning/error findings |
| Real provider adapters | PASS: NYC NWS point/alerts, Open-Meteo rainfall, Berlin GloFAS, Rockaway FloodNet sensor/events; no rejected rows in these FloodNet samples |
| Unsupported NWS locations | PASS: London unsupported with zero NWS requests, Toronto unsupported after one point lookup and no alert request |
| Local Edge Function/database integration | PASS: guest access, live providers, persisted valid records, bounded PostGIS area, null unknown counts, 100 Rockaway cached historical events, source-status isolation, malformed coordinates/radius and application Origin checks |
| Area example | Captured actual local response, parsed JSON; canonical metrics and compatibility alias match; five station points and 100 historical cached events; incomplete coverage remains explicit |
| Strict effective CORS gate | **FAIL retained**: expected `http://localhost:5173`, actual gateway ACAO `*`; unchanged `tests/cors.ts` exits 1 |
| Hosted deployment | **UNVERIFIED**; no hosted target linked, migrated or deployed |

The two old expectations affected by intentional corrections were updated:
missing event measurements now preserve valid station metadata instead of
discarding the layer, and an ended hazard is explicitly `ended` instead of
`unknown`. Their missing-data/not-active controls remain, strengthened with
unknown-zero and preserved-station assertions. No tests were removed or skipped.

The 18 R2 regressions cover mixed malformed sensor/event collections, SoQL ID
isolation, all-rejected versus actually empty data, per-stage timeout behavior,
503/429 diagnostics and request counts, transport versus malformed collection,
actual abort handling, the **real six-second FloodNet event request deadline**,
NWS timeout/5xx/malformed lookup fallback, dual lookup/alerts failure, ended/future/
active/unknown timing, post-hazard updates and HTTP serialization/cache isolation.
No automatic retry was added; request-count assertions verify one request per
stage. Two sequential provider calls can consume two six-second deadlines.
429 numeric retry delays are bounded; sanitized diagnostics omit raw provider
bodies, exception messages, credentials and authentication headers.

## Files changed

- Runtime: `supabase/functions/_shared/providers.ts`, `alert-semantics.ts`,
  `contracts.ts`, `http.ts`.
- Tests: new `supabase/tests/unit/reliability_test.ts`; adjusted assertions in
  `backend_test.ts` and `review_test.ts`; fuller sanitized failures in
  `supabase/tests/live.ts` and `local.ts` (including partial results with errors).
- Documentation: `docs/API_CONTRACTS.md`, `BACKEND_SETUP.md`, R1 supersession note,
  this report, and `docs/examples/area-summary.local.json`.

The area example is dated local evidence, not a new hosted endpoint or a frontend
implementation. [Consumer fields and request](API_CONTRACTS.md#ryan-lin-integration-example--acceptance-pending)
are the proposal for Ryan. Public cache evidence remains incomplete after
partial requests; request-specific diagnostic counts are not persisted as a
claim of survey completeness. R2 needs no migration or notification table.

## Remaining gates and hosted verification plan

PR #4 stays **draft**. M5, landing-page integration and the effective CORS gate
remain open. No final merge approval is requested by this correction. R1's eight
assumption dispositions remain: U5 source GMT and local SQL evidence are
verified; hosted key privilege mapping, guest access, effective CORS, runtime/
database parity and shared-egress behavior remain unverified. NWS content-age
semantics and exhaustive territory/marine coverage remain documented limitations.
Current gauge and scenario-polygon ingestion, notifications and backend CI are
still unimplemented; no arbitrary probability or safety claim was introduced.

After Ryan accepts the concrete contract, an owner must select and authorize a
**hosted development target** and intended frontend origin. This plan is not
authorization to execute hosted changes:

1. Verify target/project identity and migration parity. Preview the five existing
   additive migrations; apply only to the authorized development target. R2 adds
   none. Preserve unrelated data; never reset a shared database for tests.
2. Confirm server-only environment **names** (`WATERMARK_ALLOWED_ORIGINS`,
   `WATERMARK_NWS_USER_AGENT`, `SUPABASE_URL`, injected `SUPABASE_SECRET_KEYS` /
   legacy service credential, or `WATERMARK_SUPABASE_SECRET_KEY` override).
   Verify injected default-key privileges through a controlled backend call,
   without logging values. Missing/malformed configuration must fail closed.
3. Deploy the reviewed function only after target authorization. Verify guest
   environmental GET with the actual deployed public-function setting; verify
   browser roles cannot write/read privileged tables or execute cache/budget/
   status RPCs directly. Run role/RLS checks with rollback fixtures on that
   development database, including rejected privileged writes.
4. Record **OPTIONS and GET**, HTTP status, ACAO, allowed methods/headers, Vary
   and credential behavior from the intended frontend origin, a disallowed
   origin and no Origin. Match the approved exact-origin policy; no credentials
   or privileged response fields. Strict CORS failure remains a release blocker.
   Local diagnosis is the functions gateway CORS plugin, not proof of hosted
   behavior. Do not patch production gateway configuration to make a test pass.
5. Run NYC and unsupported-location live checks through the hosted preview,
   then location → valid-record cache → area → historical series and monotonic
   successful-contact health. Record source times, flags and sanitized failures.
   Regression-injected malformed/timeout cases remain local deterministic tests;
   do not corrupt hosted provider data or disable validation for testing.
6. Have Ryan consume the accepted fields in the preview and record integration
   evidence. Observe 429/error behavior without a saturation test or retry storm.
   Record all remaining UNVERIFIED items; a few successes do not establish an
   availability guarantee. Obtain separate merge/production authorization.

Rollback is the previous reviewed function version; keep additive schema and
valid cached data in place. No destructive rollback is proposed.

Primary documentation checked for this work: [NWS API](https://www.weather.gov/documentation/services-web-api),
[Supabase changelog](https://supabase.com/changelog.md),
[Edge Function testing](https://supabase.com/docs/guides/functions/unit-test).
NWS source field definitions/CAP semantics and FloodNet GMT evidence remain
linked in the R1 report and API contract.
