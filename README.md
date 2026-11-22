# WaterMark

**Flood and extreme-rainfall intelligence for communities.**

**Status:** EvoHacks 2.0 hackathon prototype, in development  
**Theme:** Projects for Social Good  
**Submission deadline:** November 22, 2026, 3:00 PM Eastern Time  
**Planning source:** [EvoHacks2.0 Planning (team Google Doc)](https://docs.google.com/document/d/1VLHw8AHFrXIV64P9YD5abx2CkHGvjEz97zxK9glnjhw/edit)  
**Developer instructions:** [AGENTS.md](./AGENTS.md)

> **Safety and honesty:** WaterMark is a prototype for exploring environmental data, not an official warning service, certified flood model, evacuation system, or guarantee of safe conditions. Follow authoritative government warnings and local emergency instructions. A lack of data is **not** a lack of risk.

## 1. Why WaterMark exists

Flooding and extreme rainfall can affect homes, schools, public infrastructure, and emergency response. Relevant information is scattered across weather forecasts, government flood maps, tide gauges, local sensors, and historical incident datasets. Many residents and volunteer responders cannot quickly reconcile those sources for a location they care about.

WaterMark aims to make this information **accessible, understandable, and actionable**. A user should be able to select a location or draw an area on a 2D map, inspect current warnings and forecast conditions, explore documented flood exposure and historical events, and see exactly where the information came from.

The initial motivation includes coastal and flood-prone communities such as **Coney Island, the Rockaways, and Red Hook** in New York City. Additional example regions under consideration include the Outer Banks and parts of California. The global map should remain useful outside these pilot areas, while clearly showing where specialized local datasets are unavailable.

### Intended users

- **Homeowners and residents:** Understand official alerts, local rainfall forecasts, mapped exposure, and preparedness resources.
- **Schools:** Review available flood exposure and warnings affecting a campus or vicinity; never claim a precise inundation path without suitable data.
- **Community Emergency Response Teams (CERT):** Inspect alerts and documented past events to inform situational awareness.
- **Volunteer fire departments and community groups:** Review conditions and evidence before contacting official incident coordinators or checking on vulnerable areas.

**Impact we can demonstrate in the hackathon:** Fewer manual steps to find relevant, correctly labeled hazard information for a selected location; accurate source attribution; and the ability to distinguish forecast, historical, and current information. We cannot claim that the prototype has prevented property damage or improved public safety without real-world evaluation.

## 2. Scope and non-goals

### In scope

1. **Extreme rainfall:** Forecast precipitation amounts and intensity, plus official heavy-rain alerts where available.
2. **Flooding:** Official warning information, mapped flood exposure, observed flooding data where supported, and modeled **river** flood forecasts at supported locations.
3. **Interactive 2D map:** Explore globally, search locations, select points, and, if ready, draw a circle to summarize supported geographic data.
4. **Evidence-backed explanations:** Measurements, timestamps, units, severity rationale, historical context, source links, and uncertainty.
5. **NYC demonstration:** Richer stormwater, coastal, and street-flood context than can be provided globally.

### Explicitly out of scope for the hackathon MVP

- Drought, water scarcity, lake/reservoir depletion, and groundwater depletion.
- Predicting an exact home's flood depth, the direction water will enter a school, or a street's future flood condition without a validated local hydraulic model.
- Claiming a location or driving route **will not flood**.
- Issuing original evacuation orders or replacing official NWS, NYC, NOAA, or FEMA warnings.
- Training an unvalidated AI model and describing its numerical output as a measured flood probability.
- Global street-level flood precision. Worldwide weather/river coverage and NYC-specific local layers are **different coverage levels**.

## 3. The product experience

1. **Open the map:** Start with a fast, responsive 2D world map. **MVP recommendation:** do not require sign-in to evaluate public flood data.
2. **Choose a place:** Search a city, address, ZIP/postal code where supported, or use map coordinates. Telephone area codes are **not** reliable geographic identifiers.
3. **Choose data layers:** Rainfall forecast, active alerts, river conditions, modeled flood exposure, historical incidents, or coastal levels, depending on coverage.
4. **Inspect a point:** Show a side panel on desktop and a bottom sheet on mobile. Display the **observation time** separately from the **retrieval time**.
5. **Review the evidence:** Show a short explanation, source links, relevant charts, and an **unknown/insufficient data** state when the evidence does not support a classification.
6. **Explore an area (stretch goal):** Draw a circle and receive statistics that are valid at that geographic scale, with units, assumptions, and coverage bounds.

### UI requirements

- Accessible navigation, keyboard support, high-contrast text, readable severity labels, and visible focus indicators.
- Distinguish **current alerts**, **observations**, **forecasts**, **scenario maps**, and **historical records** in the interface.
- A collapsible or dismissible data/AI panel that does not obscure map controls.
- Display local time with an explicit timezone, and retain UTC internally.
- Clear loading, no-data, stale-data, upstream-error, and success states.
- No globe/3D requirement. The agreed map direction is **2D**.
- Plain language first, with expandable scientific details for advanced users.

## 4. Hazard interpretation: do not confuse these data types

| Data type | Example | What it can support | What it does **not** prove |
| --- | --- | --- | --- |
| Official active warning | NWS flood warning | An authority issued a warning covering an area | Precise water depth at an individual property |
| Forecast precipitation | Hourly rainfall forecast | Predicted amount and timing of rain | That a particular street will flood |
| Modeled river discharge | Open-Meteo/GloFAS | Expected river flow at supported river locations | Coastal storm surge or urban storm-drain flooding |
| Scenario-based exposure | NYC stormwater flood maps | Areas modeled to flood under specified rain scenarios | That flooding is occurring now |
| Regulatory mapped hazard | FEMA NFHL flood zones | Designated mapped flood hazard areas | A live flood observation or deterministic short-term forecast |
| Sensor reading | FloodNet / NOAA tide gauge | Measurements at the sensor's place and time | Conditions at every nearby street or home |
| Historical report | NYC 311 / FEMA claims | Prior reports or claims in a geographic area | Current flooding or proof an unreported location is safe |

### Severity and confidence

There is **no universal WaterMark flood percentage** computed by mixing arbitrary features. Represent the following separately:

- `officialAlert`: official alert type, severity/urgency if supplied, area, issuance, and expiration.
- `forecast`: numeric rainfall or discharge forecast, units, model/source, valid period, and uncertainty if published.
- `exposure`: whether the selected point/area intersects a mapped flood-exposure layer and the layer's scenario or classification.
- `observation`: recorded level/depth/flow with units, quality flags, and timestamp.
- `dataStatus`: `available | stale | unavailable | unsupported | error`.

A human-readable severity badge may be displayed **only when its derivation is explicit**: for example, an official NWS warning level or a documented data-provider classification. Do not silently convert forecast rainfall millimeters into a property-level flood danger category. Unknown is not green.

### Predictions

When WaterMark shows a prediction, identify whether it is **provided by an external forecast model** or **derived by WaterMark**. Do not invent probabilistic confidence. Backtesting against historical observations is required before presenting independent model accuracy claims.

## 5. Geographic coverage strategy

**Global baseline:** Map navigation, place search, Open-Meteo rainfall forecasts, and modeled river discharge forecasts at supported locations. Geographic coverage and model resolution must be disclosed.

**US baseline:** NWS alerts and appropriate NOAA/USGS datasets where available.

**NYC enriched demo:** Stormwater flood scenario polygons, street-flood sensor records, FEMA mapped flood zones, NOAA coastal water levels, NYC hurricane evacuation zones, and optionally 311/FEMA history.

**Important:** The NYC coastal pilot requires coastal and stormwater data. GloFAS **does not** provide a substitute for local coastal surge or street-level pluvial flood modeling.

## 6. Planned data sources

The following providers are named in the team plan. **They are candidate integrations, not a claim that all connectors have already passed tests.** Validate response schemas, attribution/licensing, coverage, rate limits, timestamps, and production suitability before shipping.

| Provider / dataset | Intended use | Geography / interpretation |
| --- | --- | --- |
| [NWS alerts API](https://www.weather.gov/documentation/services-web-api) | Active official warnings | US; check `api.weather.gov/alerts/active?point=LAT,LON`, provide required User-Agent/contact |
| [Open-Meteo weather API](https://open-meteo.com/en/docs) | Forecast and historical precipitation | Broad geographic coverage; values are model/reanalysis products |
| [Open-Meteo Flood API / GloFAS](https://open-meteo.com/en/docs/flood-api) | Modeled river discharge forecasts | Global modeled **river** data, not street-level inundation or coastal surge |
| [NYC Stormwater Flood Maps](https://data.cityofnewyork.us/d/9i7c-xyvv) | Rainfall-driven flood scenario polygons | NYC scenario/exposure, **not live events** |
| [FloodNet event records](https://data.cityofnewyork.us/d/aq7i-eu5q) and [sensor locations](https://data.cityofnewyork.us/d/kb2e-tjy3) | Observed street flooding and sensor context | NYC, limited sensor footprint; confirm update frequency before calling it live |
| [FloodNet dashboard](https://dataviz.floodnet.nyc/) | Visual cross-check for sensor reports | NYC; confirm whether any feed supports direct real-time access |
| [NYC 311 service requests](https://data.cityofnewyork.us/d/erm2-nwe9) | Historical public reports | Reports are not verified flood-depth observations |
| [FEMA National Flood Hazard Layer](https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer) | Regulatory flood-hazard polygons | Static/mapped hazard context, not live predictions |
| [NOAA Tides & Currents API](https://api.tidesandcurrents.noaa.gov/api/prod/) | Coastal water-level measurements | Selected stations, e.g. The Battery and Sandy Hook; not property-level surge forecasts |
| [NYC hurricane evacuation zones](https://www.nyc.gov/site/em/ready/hurricane-evacuation-zones.page) | Official coastal emergency planning context | Zones are not real-time inundation predictions |
| [OpenFEMA NFIP claims v3](https://www.fema.gov/openfema-data-page/nfip-redacted-claims-v3) and [other OpenFEMA sets](https://www.fema.gov/about/openfema/data-sets) | Historical insurance claims, policies, declarations | Aggregate with privacy considerations; no unsupported claims about individual households |
| [USGS Water Data APIs](https://api.waterdata.usgs.gov/) | Selected US stream gauges | Availability and measurements depend on site |
| [Census ACS](https://www.census.gov/data/developers.html) | Optional neighborhood socioeconomic context | Aggregate statistical estimates, not identity or individual financial status |

**Data handling rules:**

- Prefer documented APIs to scraping. Decodo scraping is exploratory and **not required** if authoritative APIs work.
- Separate `observedAt`, `forecastIssuedAt`, `validFrom`, `validTo`, and `fetchedAt` as appropriate.
- Include provider name, original record ID/link, units, coordinate system, and provider-specific quality flags.
- Respect API restrictions and attribution; do not bulk-download all global forecasts to the database.
- Never infer insurance coverage or household income about an individual from neighborhood-level statistics.

## 7. Proposed architecture (not yet a claim of deployed infrastructure)

The team has chosen to pursue **Supabase** for the API and database, with **Decong** responsible for that backend and `.xyz` domain coordination. The public frontend is **GitHub Pages at [https://watermark.works](https://watermark.works)**, built by [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml). An earlier plan used AWS Amplify for hosting. Cloudflare is not part of the current MVP stack.

```text
Browser (React + TypeScript + Vite + 2D MapLibre map)
  |
  | location selection, layer toggle, charts, area circle
  v
Supabase Edge Functions (planned integration and risk API)
  |                     \
  |                      \__ Public APIs: NWS, NOAA, Open-Meteo, NYC, FEMA
  v
Supabase PostgreSQL + PostGIS
  | selected stations, bounded historical records, geospatial overlays,
  | provenance metadata, optional cached results
  v
Structured responses to the frontend (source, timestamp, quality, scope)

GitHub Pages (https://watermark.works): the Vite build from .github/workflows/deploy-pages.yml.
.xyz domain: optional custom domain pointed at that Pages site.
```

**Why this split:** The frontend is a static Vite build on GitHub Pages. Supabase Edge Functions integrate APIs and protect secrets; PostgreSQL/PostGIS stores selected structured and geospatial information. Domain registration and DNS are separate from web application hosting. Avoid introducing Lambda, API Gateway, Cloudflare Workers, or additional databases unless a documented requirement justifies them.

### Proposed implementation technologies

- Frontend: React, TypeScript, Vite, Tailwind CSS.
- 2D mapping: **MapLibre GL JS** (proposed selection; team also considered Leaflet).
- Spatial interaction: Turf.js for circles/intersections; PostGIS for database-side spatial queries.
- Charts: Recharts or a similarly lightweight React charting library.
- Backend: Supabase Edge Functions (TypeScript/Deno runtime as supported by Supabase).
- Database: Supabase PostgreSQL with PostGIS enabled.
- Deployment: GitHub Pages at `https://watermark.works` via `.github/workflows/deploy-pages.yml`.
- CI: typecheck, lint, unit tests, and smoke test on pull requests.

### Proposed API response contract

**These endpoints and types are design proposals and must be implemented or adjusted together. They do not yet exist.**

```text
GET /location-summary?lat=...&lon=...
GET /rainfall?lat=...&lon=...
GET /alerts?lat=...&lon=...
GET /flood-exposure?lat=...&lon=...
POST /area-summary { "geometry": <GeoJSON Polygon>, "layers": [...] }
```

Every result should contain at least:

```json
{
  "status": "available",
  "location": { "lat": 40.58, "lon": -73.99 },
  "kind": "forecast_rainfall",
  "source": { "name": "PROVIDER_NAME", "url": "https://provider.example/resource" },
  "observedAt": null,
  "forecastIssuedAt": "ISO_8601_OR_NULL",
  "validFrom": "ISO_8601_OR_NULL",
  "validTo": "ISO_8601_OR_NULL",
  "fetchedAt": "ISO_8601_TIMESTAMP",
  "units": "mm",
  "data": {},
  "qualityFlags": [],
  "limitations": []
}
```

The values above illustrate the **shape** only, not live or verified observations. Coordinates are examples, and implementers should use a consistent longitude/latitude convention across GeoJSON and APIs.

### Database guidance

Prefer small, focused tables such as `monitoring_stations`, `datasets`, `observations`, `historical_events`, and `risk_assessments`, adding columns only when an implemented feature needs them. Store raw/normalized geometry with a defined CRS and spatial index; ensure publicly exposed tables have properly scoped Row Level Security and least-privilege grants. Large public geometry datasets can be distributed as static tiles/GeoJSON rather than loading every polygon into PostgreSQL.

## 8. Feature priorities and acceptance criteria

| Priority | Feature | Evidence required to mark complete |
| --- | --- | --- |
| **P0** | Public, responsive 2D map | Pan/zoom, location selection/search, working desktop/mobile layout |
| **P0** | Rainfall conditions and forecast | Real provider response, correct units, issuance time, and chart |
| **P0** | Official alerts | Correct NWS response for supported US point; alert area/time/source; no-warning is not interpreted as no flood risk |
| **P0** | Flood context | At least one working NYC stormwater/flood exposure layer and one validated flood-oriented observation or forecast source |
| **P0** | Location panel | Distinguishes current, forecast, historical, mapped exposure; source/last-updated/limits visible |
| **P0** | Error and uncertainty handling | Meaningful no-data, stale, and unavailable states; no fabricated risk values |
| **P0** | Public deployment | GitHub Pages demo at watermark.works loads without local services; source code and setup instructions accessible to judges |
| **P1** | Draw-circle summary | Spatially valid metrics with coverage, units, and area selection feedback |
| **P1** | Historical events and insurance context | Historical years, aggregation, spatial limits, and source clearly labeled |
| **P1** | Agentboxd alert digests | Clearly supplementary summaries; official alert record remains source of truth |
| **P1** | Plain-language or multilingual assistant | Answers cite the browser lookup they were given and are labeled as unverified; no invented forecasts or emergency orders |
| **P2** | ElevenLabs voice, multiple role views, MojoAuth/SSOJet | Only after P0 passes and privacy/accessibility are reviewed |
| **P2** | SMS alerts / expanded global local layers | Requires consent, rate-limits, source freshness, and operational testing |
| **Research only** | “Move Your Car” | Cannot recommend a guaranteed safe spot/route from modeled exposure alone; requires verified current road, parking, closures, and flood conditions before any actionable recommendation |

### Minimum viable demo scenario

1. Open WaterMark and select an NYC coastal neighborhood (e.g., Coney Island or Rockaway).
2. View the relevant stormwater or mapped flood-exposure layer **labeled as a scenario**, not as a live flood.
3. View actual rainfall forecast data and active NWS alerts (or explicitly show no active alerts at query time).
4. Inspect one supporting coastal or street-flood observation **with its original timestamp**, or select a supported river location to inspect GloFAS discharge forecast.
5. Explain what each source adds, what it cannot predict, and a legitimate preparedness link.

Record a deterministic fixture-based replay if live conditions are uneventful. Label replay as historical, never as current.

## 9. AI integrations and sponsor services

The team plan mentions Gemini or an OpenRouter-hosted model, ElevenLabs, Agentboxd, MojoAuth/SSOJet, and Decodo. **These are ideas under evaluation, not confirmed production integrations.**

- **AI chat (Ryan B):** Optional assistant. The browser runs the lookups and sends the results to a Gemini proxy. Those results are untrusted user-supplied data: the proxy does not re-fetch or verify them, and the chat is not a server-verified flood report. It must cite the lookup's source, time window, and limits, and it must never manufacture a risk probability.
- **Voice / languages (Ryan B voice pipeline; Decong multilingual integration):** Accessibility enhancements considered for Chinese, Russian, Spanish, and Indian languages. Specify actual languages and dialects before implementation ("Indian" is not a single language).
- **Agentboxd (Decong):** Optional ingestion/summarization of official alert emails; use authoritative API alerts for time-sensitive status. Email summaries can be late, duplicated, or stale.
- **MojoAuth/SSOJet (Decong, coordinated with Ryan L demo page):** Optional authentication, not required to view public flood data. Avoid a login bottleneck for the demo.
- **Decodo (Ryan B):** Scraping only if documented sources do not meet requirements and terms permit collection.

**Hackathon rule:** AI assistance is allowed, but AI must not create the entire project. Human teammates must make substantive contributions, understand their code, and explain AI use in the submission/video.

## 10. Verified team task ownership (from the colored highlights)

The team Google Doc's **Assignments** tab uses background colors as an ownership key. This is the authoritative interpretation of those colors **as currently highlighted**, rather than an AI-suggested repartition of work. A colored assignment means **ownership**, not completion or automatic approval to ship.

| Highlight in Google Doc | Owner | Assigned scope | Proposed branch names (not existing-branch claims) |
| --- | --- | --- | --- |
| **Green** (`#D9EAD3`) | **Ryan Bergman (Ryan B)** | Frontend design and **landing-page shell**; Gemini/OpenRouter chatbot and primary ElevenLabs voice integration; **AWS automatic deployment**; optional Decodo scraping investigation | `feat/ryan-b-landing`, `feat/ryan-b-ai-assistant`, `infra/ryan-b-amplify` |
| **Effervescent Yellow** (`yellow`) | **Daniel Manita (Daniel M)** | Audience role views, **Move Your Car**, finer zoom detail, flood-assistant request limits, and map selection navigation | `cursor/role-views-0985`, `cursor/assistant-abuse-limits-8c5f`, `cursor/map-selection-back-bdab` |
| **Pink** (`#EAD1DC`) | **Ryan Lin (Ryan L)** | **Application/demo page**, interactive **2D map**, collapsible/draggable data panel, **circle selection and area-statistics UI**, forecasting/data charts, **landing-page resources/bibliography content**, exploratory **Move Your Car** UI | `feat/ryan-l-map`, `feat/ryan-l-data-panel`, `feat/ryan-l-area-analysis` |
| **Blue** (`#C9DAF8`) | **Decong** | **Supabase PostgreSQL/PostGIS and Edge Functions**; **Agentboxd** email reading/summaries and optional sending; **MojoAuth/login integration**; multilingual support and localization/ElevenLabs languages; **.xyz domain/DNS coordination**; investigate SMS | `feat/decong-data-api`, `feat/decong-agentboxd`, `infra/decong-domain` |
| **Yellow note** (`#FFF2CC`) | **Joint / conditional** | Tailored views for homeowners, schools, CERT, and firefighters, **only if time remains** and the data actually supports the audience-specific claims | Joint ticket after P0 |

### Contributions

[Daniel Manita](https://github.com/Danx3mer) (@Danx3mer). Checked on 22 November 2026 against the pull request authors, descriptions, and merge commits.

- [PR #24](https://github.com/LeviaLabs/WaterMark/pull/24): role views. School shows a flood approach direction, Homeowner shows insurance-claim context, and Fire & CERT shows the most probable flood areas. Also the Move your car feature, and finer map detail when zoomed in.
- [PR #26](https://github.com/LeviaLabs/WaterMark/pull/26): flood assistant hardening. Per-client and global rate limits, a kill switch, bounded requests, browser and grounding data handled as untrusted, and the Pages deploy workflow variable. He merged the Gemini assistant in [PR #23](https://github.com/LeviaLabs/WaterMark/pull/23); this pull request is the follow-up.
- [PR #27](https://github.com/LeviaLabs/WaterMark/pull/27): an explicit Back button, a breadcrumb, and Escape to leave a selection, plus a fix so World clears the selection.
- Merge-conflict resolution for [PR #21](https://github.com/LeviaLabs/WaterMark/pull/21), [PR #24](https://github.com/LeviaLabs/WaterMark/pull/24), and [PR #28](https://github.com/LeviaLabs/WaterMark/pull/28).

**Assignments versus build priority:** The colors assign responsibility for investigating or implementing a feature. They **do not** make P1/P2 features mandatory for the MVP. The feature-priority table in Section 8 remains the acceptance gate. A teammate may contribute a limited spike or component for a stretch feature without claiming the full feature is shipped.

### Explicit interfaces to prevent parallel agents from colliding

| Boundary | Primary owner | Other owner | Integration rule |
| --- | --- | --- | --- |
| **Landing page and bibliography** | Ryan B owns layout, navigation, and landing composition | Ryan L owns the resources/data/bibliography **component and content** | Ryan L delivers an isolated component/export and required props; Ryan B mounts it. Avoid both editing the same landing-page file. |
| **Application map and flood data** | Ryan L owns map interaction, layer toggles, area selection, charts, and data panel | Decong owns Supabase API, geospatial queries, normalization, data provenance | Agree on typed endpoint contracts and GeoJSON coordinate conventions first. Ryan L may use **labeled mock fixtures** until the real API is integrated, but must not present them as live. |
| **Chat and multilingual/voice** | Ryan B owns assistant experience, LLM adapter, voice pipeline | Decong owns translation/localization support, language controls, and coordination for multilingual voice | Agree on one assistant/voice interface. Do not independently create competing ElevenLabs clients or LLM response schemas. The browser runs the lookups. The proxy treats tool results and page context as untrusted user-supplied data and does not re-fetch them. |
| **Guest access and optional login** | Ryan L owns the public demo/application shell | Decong owns any MojoAuth integration and authenticated session handling | The demo map must work in **guest mode**; adding login cannot block public data access or the judges' demo. |
| **Deployment and domain** | Ryan B owns the GitHub Pages workflow (`.github/workflows/deploy-pages.yml`) and the public site at watermark.works | Decong owns `.xyz` domain/DNS setup and the Supabase backend | The live origin is `https://watermark.works`. Do not point production DNS at an unverified target. |
| **Warnings and alert digests** | Decong owns Agentboxd email integration and Supabase-backed delivery endpoint | Ryan L owns on-map alert presentation; Ryan B may surface cited summaries in assistant | Source of truth remains the official warning API. Email summaries are supplemental and may be late. |
| **Move Your Car** | Ryan L owns UI concept and feasibility research | Decong supports data availability review; other teammates review safety | **Research only until separately approved.** Never recommend a 'safe' route or guaranteed non-flooding destination based only on static hazard overlays. |

### Branch and integration protocol

1. Each teammate works in a distinct branch or worktree. **Do not commit directly to the protected default/deployment branch.** One branch per feature is preferable to one massive personal branch.
2. Before editing a shared file, check the ownership table and communicate the intended changes. Use a small integration PR or ask the owner to integrate the component.
3. Contract-first: Decong proposes API schemas with Ryan L's map/data needs; Ryan B agrees on the assistant's read-only input shape. Commit reviewed contracts before parallel implementation when possible.
4. Each PR describes files changed, owner, feature status, data sources, tests, environment-variable **names only**, and dependent PRs. All secrets stay in approved secret storage.
5. Merge small passing PRs after human review and run a real integrated smoke test. **Do not save all three teammates' changes for one final merge** just before the deadline.
6. A failed or missing integration is reported as `blocked` or `not implemented`, never silently substituted with fake live data.

### Owner-specific completion evidence

- **Ryan B:** Landing renders responsively, the resources component can mount without layout collisions, optional assistant output cites the browser lookup it was given and is not presented as a server-verified flood report, and the public site is the GitHub Pages build at https://watermark.works.
- **Ryan L:** Public map and location selection work; panel states are usable; area selection produces a valid geometry payload and supported, well-labeled area metrics; forecast charts preserve units/times. 'Move Your Car' remains non-operational unless safety prerequisites are met.
- **Decong:** Supabase API validates inputs and returns provenance and status; spatial queries have bounds; database permissions/RLS are reviewed; Agentboxd summaries clearly reference official warnings and times; guest access is preserved even if optional authentication is added.

See [AGENTS.md](./AGENTS.md) for more detailed AI-agent instructions and integration safeguards.

## 11. Suggested repository layout

**This is a proposed structure. Adapt to the actual repository instead of creating duplicate projects.**

```text
WaterMark/
├── README.md
├── AGENTS.md
├── apps/
│   └── web/                  # React/Vite app: map, panels, charts
├── supabase/
│   ├── functions/            # Provider adapters and server-side API logic
│   └── migrations/           # Reviewed PostGIS/schema migrations
├── packages/
│   └── shared/               # DTOs, severity labels, source/time metadata
├── public/
│   └── data/                 # Small permitted, versioned demo layers only
├── docs/
│   ├── DATA_SOURCES.md       # Validated endpoints, licensing, freshness
│   ├── API_CONTRACTS.md      # Agreed request/response contracts
│   └── DEMO.md               # Demo steps and replay provenance
└── .github/
    └── workflows/           # CI as needed
```

Do not create this tree unless the team approves the structure. A simpler single-app repo is also acceptable for the hackathon.

## 12. Local setup and deployment

**Setup commands must be filled in after the repository scaffold is verified.** Do not assume a package manager, app path, or environment-variable names from this planning document alone.

1. Clone the repository and inspect the lockfile, package scripts, and workspace layout.
2. Install dependencies using the repo's chosen, pinned package manager.
3. Configure a local `.env` from a committed **placeholder-only** `.env.example`; never commit real secrets.
4. Set up a Supabase project and apply the reviewed schema/PostGIS migrations.
5. Configure required secret values in Supabase Edge Function secrets, not README or screenshots. Frontend build values for GitHub Pages are repository variables (`VITE_MOJOAUTH_API_KEY`, `VITE_WATERMARK_AUTH_VERIFY_URL`, `VITE_WATERMARK_ASSISTANT_URL`).
6. Run typecheck, tests, build, and local application smoke test.
7. Push to `main`. `.github/workflows/deploy-pages.yml` publishes the Vite build to GitHub Pages. The workflow copies `index.html` to `dist/404.html` so `/map`, `/login`, and `/signup` work on refresh. The public origin is `https://watermark.works`.

### Frontend app (`WaterMark/`)

The web app is a Vite + React + TypeScript project in [`WaterMark/`](./WaterMark). Its file structure and frontend rules are in [AGENTS.md › Frontend conventions](./AGENTS.md#frontend-conventions-set-by-ryan-b-landing-page-and-frontend-owner).

```bash
cd WaterMark
npm ci          # install the locked dependencies
npm run dev     # local dev server
npm test        # Vitest unit tests (tests/)
npm run lint    # ESLint
npm run build   # typecheck + production build into dist/
```

Routes (React Router, declared in `WaterMark/src/App.tsx`): `/` landing page, `/map`, `/login` and `/signup`, and a 404 page for anything else. Refresh on those paths works because the Pages workflow copies `index.html` to `dist/404.html`.

**The team reports $200 in AWS credits**, but account eligibility and balance are not independently verified. Set spending alerts and avoid adding unnecessary services.

## 13. Security, reliability, and privacy

**Immediate credential action:** The team planning document contains a credential-like string in the Assignments tab. Treat it as exposed: confirm provider, revoke/rotate as applicable, remove plaintext copies from shared documents/prompts, and audit repo/history. Do not reproduce the value in docs, tests, or chat.

- **Never put keys, tokens, private URLs, or connection strings in code, markdown, commit history, screenshots, or agent prompts.** Rotate exposed secrets and review previous copies if any exist.
- Validate/sanitize location inputs, bounding boxes, polygon size, and request rates before external queries.
- Restrict CORS; protect write operations; use proper RLS for any Supabase Data API tables exposed to browser roles.
- Cache upstream requests carefully and show timestamps; on upstream failure, display **unavailable/stale**, not a fabricated answer.
- Keep raw user location ephemeral unless explicitly needed and consented to. Avoid publishing exact personal locations.
- Do not infer insurance coverage, poverty, disability, or vulnerability of an individual from aggregate datasets.
- Do not represent simulated alert emails, test fixtures, or historical replay as current emergency guidance.
- Public attribution for third-party data, maps, libraries, and AI assistance is mandatory.

## 14. Definition of done

The hackathon MVP is done only when:

- A public, responsive 2D map can be opened by judges.
- A selected location displays authentic rainfall forecasts and appropriately sourced flood information.
- Every displayed value has a provider, units, an appropriate data timestamp, and a clear observed/forecast/historical/scenario designation.
- Severity wording is derived from documented source categories or explicitly supported thresholds; missing information is labeled unknown.
- Error, stale-data, and no-coverage states behave correctly.
- No exposed secrets or privileged database permissions are present.
- Humans can explain the important code paths, map layers, analytics, and integrations.
- Repository documentation, working demo, and a **maximum three-minute** demonstration video are prepared for Devpost.

## 15. Source-of-truth and decision process

The current scope in this README supersedes older brainstorming comments about drought and depletion. The [shared planning document](https://docs.google.com/document/d/1VLHw8AHFrXIV64P9YD5abx2CkHGvjEz97zxK9glnjhw/edit) remains the record of ideas and tasks, but new functionality is committed only after the team agrees on scope and a corresponding issue/PR makes the acceptance criteria explicit.

**Unresolved decisions:** final map library (MapLibre versus Leaflet), exact AI provider, authentication priority (but public guest access is required), verified FloodNet feed availability, and whether the assigned circle-selection feature meets the P0 integration cutoff. The frontend host is GitHub Pages at `https://watermark.works`. **Color-coded ownership is known** from the Assignments tab; completion status still requires evidence. Mark unresolved items `TBD`.

## References

- [EvoHacks 2.0 official Devpost](https://evohacks2.devpost.com/)
- [Team planning document](https://docs.google.com/document/d/1VLHw8AHFrXIV64P9YD5abx2CkHGvjEz97zxK9glnjhw/edit)
- [National Weather Service API](https://www.weather.gov/documentation/services-web-api)
- [Open-Meteo forecast and flood documentation](https://open-meteo.com/en/docs)
- [NYC Stormwater Flood Maps](https://data.cityofnewyork.us/d/9i7c-xyvv)
- [FloodNet NYC](https://dataviz.floodnet.nyc/)
- [FEMA National Flood Hazard Layer](https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer)
- [Supabase PostGIS](https://supabase.com/docs/guides/database/extensions/postgis)
- [GitHub Pages](https://docs.github.com/en/pages) (frontend host: https://watermark.works)

*WaterMark is a prototype, not an emergency alert authority. Confirm all time-sensitive conditions with official sources.*
