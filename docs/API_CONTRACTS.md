# WaterMark data API v1 — proposal for integration review

Task: WM-CODEX-001. Human owner: Decong. Branch: `feat/decong-data-api`.
Status: proposed; Ryan Lin's acceptance and Grokbot's overlap check are pending.
Revision proposal: WM-CODEX-001-R1. Existing endpoint paths, `apiVersion: "1.0"`,
status values and center/radius input remain in place. The corrections below
require Ryan Lin's explicit acceptance before integration; nullable alert text
and unknown (null) area counts correct unsafe assumptions in the original draft.

R1 adds message validity separately from hazard timing, nullable official
onset/end times, message type, per-alert diagnostic flags, coastal-warning
categories and nullable GeoJSON alert geometry. Station records gain GeoJSON
Point geometry in [longitude, latitude] order. Hurricane/tropical-storm messages
are contextual multi-hazard alerts, never direct evidence of flooding.

Area results gain the standard environmental envelope while retaining the
existing `center`, `radiusMeters` and `metrics` aliases. Unknown area counts are
null; positive cached counts remain explicitly incomplete lower bounds.
`cacheNewestFetchedAt`/`cacheOldestFetchedAt` disclose cache age independently
of event/observation time. The prototype cache freshness policy is 24 hours.

Polygon request input remains a pending decision: it will be explicitly rejected
with `GEOMETRY_CONTRACT_PENDING`, rather than approximated as a circle. This
avoids silently changing arbitrary polygon semantics before Ryan Lin accepts
the bounded PostGIS geometry contract. No status is silently renamed to
`unavailable`; provider failures remain `error` and lack of evidence remains
`insufficient_data` until an agreed version change.
This interface was proposed before implementation; a tested local draft now
exists. Existing README endpoint names are retained under one versioned Supabase
Edge Function. This is not an approved frontend or hosted deployment contract.

Base: `/functions/v1/watermark-v1`. Public environmental reads require no account.
No notification, login, assistant, frontend, or deployment interface is changed.

| Method | Path | Input | Result |
| --- | --- | --- | --- |
| GET | `/health` | none | API readiness and last successful provider contacts; global availability remains unknown |
| GET | `/location-summary` | `lat`, `lon` | Separate rainfall, river discharge, alerts, and NYC evidence results |
| GET | `/rainfall` | `lat`, `lon` | Hourly model precipitation in mm, bounded forecast window |
| GET | `/alerts` | `lat`, `lon` | Applicable official NWS flood/rain alerts, preserving source severity |
| GET | `/flood-exposure` | `lat`, `lon` | NYC scenario exposure when verified; otherwise explicit insufficient data |
| POST | `/area-summary` | `{ "center": { "lat": number, "lon": number }, "radiusMeters": number }` | Bounded PostGIS station coverage and historical measurements; no invented area rainfall |
| GET | `/series` | `lat`, `lon`, `kind=rainfall\|river_discharge\|historical_observations\|historical_flood_events` | Typed series with forecast and historical timestamps kept separate; historical event series reads the limited database cache |

Coordinates: finite WGS84 numbers, latitude [-90,90], longitude [-180,180].
GeoJSON, when returned, uses [longitude, latitude]. Radius: 100–10,000 meters.
Unknown fields, duplicate parameters, malformed numbers, and oversized bodies
are rejected. Polygon input is deferred; the assignment permits center/radius.

All JSON responses have `apiVersion: "1.0"`, `generatedAt` in UTC, and either
`data` or a sanitized `error: { code, message }`. HTTP 400 invalid input, 403
disallowed browser origin, 404 unknown route, 405 method, 413 oversized body,
429 quota, 503 database/readiness failure. Provider failures remain individual
results in successful summary responses, so one unavailable source does not
hide usable sources.

Each environmental result has:

- `status`: `available | stale | insufficient_data | unsupported | error`.
- `kind`: observed, forecast, historical, scenario, or official alert category.
- `source`: stable ID, provider name, source URL, coverage description.
- `location`: requested coordinate; `coverage`: sampled location/resolution or
  sensor footprint and method. A point model sample is never a circle average.
- `observedAt`, `forecastIssuedAt`, `validFrom`, `validTo`, `fetchedAt`: nullable
  UTC timestamps with separate meanings. Retrieval time is not model issuance.
- `units`, `data`, `qualityFlags`, `limitations`, optional structured `error`.

Missing provider issuance times remain null with an explicit quality flag.
Forecast precipitation is not labeled a gauge observation. GloFAS values are
modeled daily river discharge in m3/s, not flood depth or coastal surge.
Historical rows never become current observations by virtue of recent fetch time.
No generic risk score, probability, rainfall-derived flood severity, or claim of
property precision is returned. Only source-defined alert/threshold categories
can carry a severity, together with their source and basis.

The selected NYC adapter is FloodNet sensor metadata and QC historical events.
It queries sensors within 1,000 m and up to 100 events from the last 90 days;
truncation is explicit. `/series` can read those cached events after a location
summary populates them. Event peaks do not substitute for current sensor
measurements or modeled exposure polygons. `classification` compares the rounded
reported peak with the source's 10 mm event threshold; it neither reconstructs
nor invalidates an event and is not a danger label.

Forecast samples are `{ validFrom, validTo, value }`; null values stay null.
Precipitation is the preceding-hour total, including rain, showers, and snow.
Weather uses a three-day requested window; only still-valid intervals are
returned. River discharge is daily over a seven-day requested window.
`sourceUpdatedAt` is separate from the observation/issuance/retrieval times.
Official alert records preserve NWS CAP `language` as BCP 47 `sourceLanguage`;
missing language remains null with a quality flag. General results also carry
nullable `sourceLanguage`. Backend code never machine-translates official text.
R1 health rows describe the **last successful provider contact**, not continuous
monitoring or global availability. `scope: last_successful_contact` and
`globalAvailability: unknown` make this explicit. `checked_at` maps to the
monotonic `last_success_at`; location absence, unsupported coverage and individual
errors cannot overwrite it. Contact age over one hour is shown as stale, using
a prototype display policy rather than a provider uptime/SLA claim.

Database access is through server-side credentials only. Public browser roles
cannot insert, update, delete, or execute privileged budget/cache operations.
Global database-backed request budgets bound unauthenticated provider traffic.
The prototype admits at most 40 API requests/minute and 4,000/day globally.
Queries and response sizes are bounded. No raw IPs, accounts, notification
subscriptions, or exact user-location history are collected.

The handler enforces an exact Origin allowlist. The local Supabase gateway
currently overwrites its response CORS header with `*`; `test:cors` remains a
separate failing platform gate. Hosted effective headers are UNVERIFIED.

## R1 alert and cache details

`OfficialAlert` now preserves nullable `sent`, `effective`, `expires`, `onset`
and `ends`, plus `messageType` (Alert/Update). `messageInForce` is true inside
the known message interval, false before effectiveness, or null if unknown.
Expired messages are excluded and counted in diagnostics. For retained records,
`messageValidity` is `in_force | upcoming | unknown`.

`hazardTiming` is `upcoming | active | unknown`. A future onset remains upcoming
even if the message expires earlier. Hazard start uses onset, else effective,
else sent; end uses ends, else message expiry as an uncertain fallback.
`timingAssumptions` distinguishes CAP's effective-to-sent default from the
WaterMark hazard fallbacks. Missing/ended/inconsistent windows remain unknown,
with `hazardTimingReason` and quality flags. Active means inside the expected
official/fallback window, never an observed flood. Result `validFrom`/`validTo`
span hazard windows, not message validity; use individual alert times for display.

Nullable headline/description/instruction are preserved. Per-record validation
rejects malformed warnings with `ALERT_RECORD_REJECTED` and a count in
`diagnostics`; unrelated valid warnings survive. All rejected records produce
error/unknown, not a verified empty warning list. Optional invalid geometry
becomes null with a diagnostic without discarding warning text.

Exact accepted event names are: Flash Flood Warning/Watch/Statement;
Flood Warning/Watch/Advisory/Statement; Coastal Flood Warning/Watch/Advisory/Statement;
Lakeshore Flood Warning/Watch/Advisory/Statement; Storm Surge Warning/Watch;
Heavy Rain Warning; Excessive Rainfall Warning. These use
`floodRelevance: flood_hazard_notice`, which is not an observation. Hurricane
Warning/Watch and Tropical Storm Warning/Watch use `multi_hazard_context` and
are never presented as direct flood evidence.

Alert geometry is nullable, bounded GeoJSON Polygon/MultiPolygon in WGS84
`[longitude, latitude]`. Source topology is not repaired or used for property
claims. Sensors and up to 100 cached area stations expose GeoJSON Points.
References: [NWS schema](https://api.weather.gov/openapi.json) and
[CAP 1.2](https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2-os.html).

NWS queries first require a verified `/points` forecast-office lookup within
documented candidate regions: CONUS, Alaska/Aleutians, Hawaii, Puerto Rico/USVI,
Guam/CNMI and American Samoa. Candidate bounds are not political boundaries.
The lookup uses NWS's observed four-decimal canonical form, without enabling
redirects; alert queries retain original coordinates. Clearly outside candidates
returns unsupported without network access. Coverage lookup 400/404 returns
unsupported before requesting alerts. Marine-only and other NWS coverage is
not supported by this adapter; unsupported never means safe or globally down.

Area `body.data` now has the environmental envelope. Canonical metrics are in
`body.data.data`, with compatibility aliases `center`, `radiusMeters` and
`metrics` retained. Missing counts are null. Positive cache counts are incomplete
lower bounds, not flood frequency; `coverageStatus` stays `incomplete` and
`zeroMatchesVerified` stays false because no complete area survey is cached.
Selected-location query history is not persisted to claim complete coverage.
A live FloodNet query separately records `queryEvidence`: verified zero source
event matches concern only that actual query/window, not area-wide flood absence.

Oldest/newest stored cache fetch times are exposed independently of source
event/observation times. Any row cached over 24 hours ago marks the result stale,
including mixed-age samples. Old measurement freshness remains separate from
cache freshness. A fresh archive fetch never turns an old event into a current
observation; missing source publication time remains unknown.

The 15-minute NWS update-age flag remains a conservative draft content-age policy,
with `SOURCE_UPDATE_TIME_IS_NOT_A_HEARTBEAT`; it does not set provider health or
hide retained warnings. Live empty collections carried recent updates, but the
field's all-conditions heartbeat semantics remain unverified (U4 in the R1 report).

## Review requests

Ryan Lin: confirm endpoint names, envelope/status handling, UTC units, and
center/radius payload before frontend integration. Use the TypeScript exports
in `supabase/functions/_shared/contracts.ts`; no frontend edits are included.

Grokbot: confirm that no unpushed backend endpoint overlaps this namespace.
Notification tables and delivery endpoints are intentionally deferred until
their consent, deduplication, and ownership contract is agreed.

Changes to this proposal must be recorded here before API finalization. Local
implementation may be reviewed as a draft while these acceptances are pending.

## Unresolved cross-branch differences discovered during refresh

Grokbot's `docs/research/WM-GROK-001-report.md` §5 (research branch / draft PR #2)
is a proposal, not an implemented competing backend. It suggests flat public
responses with `contractVersion: alerts-notify/0.1`, an alert object containing
`alerts` and `emailReports`, `/provider-status`, `NWS_USER_AGENT`, and a
`provider_sync_status` table. This branch proposes the nested v1 data envelope,
an official-alert array, `/health`, `WATERMARK_NWS_USER_AGENT`, and
`source_status` for successful-contact evidence in R1. Neither proposal is approved.

Proposed resolution for review: retain one approved environmental data
namespace/envelope, keep private email reports and subscription/dispatch routes
separate, and design sync status as a distinct operational concern only when
notification ingestion is implemented. Do not silently mount both `/alerts`
shapes or expose private raw-email fields. No notification tables or endpoints
from that report have been implemented here.

Claude's `docs/auth-i18n-contract.md` (auth branch / draft PR #1) asks for provider
source language. The local draft now preserves NWS language with unknowns left
nullable; future auth verification remains deferred. Grokbot's frontend quality
workflow (PR #3) does not run this backend suite; separate backend CI remains a
future integration decision, and no CI pass is claimed for these new files.
