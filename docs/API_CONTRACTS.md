# WaterMark data API v1 — proposal for integration review

Task: WM-CODEX-001. Human owner: Decong. Branch: `feat/decong-data-api`.
Status: proposed; Ryan Lin's acceptance and Grokbot's overlap check are pending.
This interface was proposed before implementation; a tested local draft now
exists. Existing README endpoint names are retained under one versioned Supabase
Edge Function. This is not an approved frontend or hosted deployment contract.

Base: `/functions/v1/watermark-v1`. Public environmental reads require no account.
No notification, login, assistant, frontend, or deployment interface is changed.

| Method | Path | Input | Result |
| --- | --- | --- | --- |
| GET | `/health` | none | API readiness and last recorded provider checks; never synthetic upstream health |
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
Health provider rows describe the **last recorded request**, not continuous
monitoring or a claim of global provider availability; inspect `checked_at`.

Database access is through server-side credentials only. Public browser roles
cannot insert, update, delete, or execute privileged budget/cache operations.
Global database-backed request budgets bound unauthenticated provider traffic.
The prototype admits at most 40 API requests/minute and 4,000/day globally.
Queries and response sizes are bounded. No raw IPs, accounts, notification
subscriptions, or exact user-location history are collected.

The handler enforces an exact Origin allowlist. The local Supabase gateway
currently overwrites its response CORS header with `*`; `test:cors` remains a
separate failing platform gate. Hosted effective headers are UNVERIFIED.

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
`source_status` for last-request results. Neither proposal is approved.

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
