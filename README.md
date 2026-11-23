# WaterMark

**Flood and extreme-rainfall intelligence for communities.**

**Live demo:** [https://watermark.works](https://watermark.works)  
**Status:** EvoHacks 2.0 hackathon build (deployed on GitHub Pages + Supabase)  
**Theme:** Projects for Social Good  
**Planning source:** [EvoHacks2.0 Planning (team Google Doc)](https://docs.google.com/document/d/1VLHw8AHFrXIV64P9YD5abx2CkHGvjEz97zxK9glnjhw/edit)  
**Developer instructions:** [AGENTS.md](./AGENTS.md)

> **Safety and honesty:** WaterMark is a prototype for exploring environmental data, not an official warning service, certified flood model, evacuation system, or guarantee of safe conditions. Follow authoritative government warnings and local emergency instructions. A lack of data is **not** a lack of risk.

## 1. Why WaterMark exists

Flooding and extreme rainfall affect homes, schools, public infrastructure, and emergency response, yet critical context is scattered across weather forecasts, government flood maps, tide gauges, local sensors, and historical incident datasets. Many residents and volunteer responders cannot quickly reconcile those sources for a block they care about.

WaterMark brings that evidence together on a fast, accessible **2D map** (`https://watermark.works/map`) with global baseline coverage and enriched NYC/US layers. A visitor can explore without signing in, search any location or zoom straight down from the globe to a single city block, scrub ten years of historical flood episodes and causes, inspect a deterministic Flood Outlook with a grounded AI block summary, ask questions by text or voice, switch into tailored audience views, and review screened official alert emails.

The initial motivation comes from coastal and flood-prone communities such as **Coney Island, the Rockaways, and Red Hook** in New York City, while keeping the 2D map useful anywhere in the world and clearly disclosing where local datasets are unavailable.

### Intended users (and tailored views on `/map`)

- **Homeowners and residents:** Active NWS warnings, local rainfall forecasts, stormwater exposure, ZIP-level OpenFEMA NFIP insurance claims context, and the **Move Your Car** higher-ground elevation lookup.
- **Schools:** Campus flood exposure, nearest modeled river and elevation approach bearing, and active warnings ahead of arrival or dismissal.
- **Community Emergency Response Teams (CERT):** Priority flood blocks ranked from historical episodes, FloodNet sensors, and 311 calls, plus the screened `/alerts` inbox.
- **Volunteer fire departments:** Check-first streets and blocks, FloodNet street sensors, NOAA tide gauges, and hands-free voice-assisted queries.

## 2. Scope and non-goals

### Shipped in the EvoHacks 2.0 build

1. **Interactive 2D Map (`MapLibre GL JS v6`)**: Light and dark map styles, global NASA GPM IMERG rainfall & 30-day GDACS flood layers, Photon/OpenStreetMap place search, and Back/breadcrumb/Escape/open-water navigation.
2. **Automatic zoom-to-focus selection**: Zooming smoothly steps from **World → Country → State/Province → US County → Grid Block** under your cursor with hysteresis thresholds so exploration requires zero manual clicking.
3. **Flood timeline & NOAA cause analytics**: Play/pause year-by-year timeline slider (`2016–2025` + `All years`) built from deduplicated NOAA Storm Events `EPISODE_ID` records and GDACS history, with flood-cause breakdowns (heavy rain, flash floods, coastal surge, tropical systems, snowmelt, dams/levees, lakes).
4. **Evidence-labeled point & circle-area reports**: Official NWS alerts, Open-Meteo rainfall forecasts and ERA5 rain history, Copernicus GloFAS v4 river discharge, static NYC Stormwater vector tiles (`Limited`, `Moderate`, `Extreme`), FEMA NFHL flood zones, FloodNet NYC street sensors, NOAA tide gauges, USGS stream gauges, NYC 311, and OpenFEMA NFIP v3 claims—queried with Turf.js and Supabase PostGIS.
5. **Flood Outlook & AI block summaries**: Deterministic flood recurrence and busiest-season analysis paired with an AI block/region summary (`outlook-summary` Edge Function) verified to quote only computed figures.
6. **Voice-enabled Flood Assistant**: Grounded Google Gemini assistant (`assistant` Edge Function) using function-calling tools over WaterMark's own data lookups, browser `SpeechRecognition` mic input, budgeted ElevenLabs read-aloud (`watermark-tts`) with browser `speechSynthesis` fallback, plus per-client and global rate-limit safeguards.
7. **Agentboxd alert inbox (`/alerts`) & optional sign-in**: Screened USGS/NWS/FEMA alert email digests with positive sender authentication and quarantine, alongside optional guest-first **MojoAuth** email-code and **Agentboxd OIDC + PKCE** login (`auth-verify`).
8. **Five-language localization**: English, Spanish (`es`), Chinese (`zh-Hans`), Russian (`ru`), and Hindi (`hi`) UI and voice language contract.

### Explicitly out of scope

- Drought, lake/reservoir depletion, and groundwater depletion.
- Predicting an exact home's flood depth, guaranteed safe driving routes, or replacing official NWS, NYC, NOAA, or FEMA warnings.
- Fabricated flood probabilities or hiding missing data as "low risk".

## 3. The product experience

1. **Landing page (`/`):** Interactive glass droplet hero, continuous scroll-driven 2D flooding city parallax (`#how`) with live interactive previews for all 10 capabilities, underwater `EvidenceSea` explaining the 7 evidence types, public dataset catalog (`#data`), tailored audience cards (`#audiences`), team credits (`#team`), and footer.
2. **Flood map (`/map`):** Opens directly in guest mode. Search any place, zoom into a block, draw a circle, scrub the flood timeline, switch audience views (`Homeowner`, `School`, `Fire & CERT`), inspect Flood Outlook + AI summaries, or open the voice-enabled `Ask WaterMark` assistant.
3. **Alert inbox (`/alerts`):** Screened official alert email summaries via Agentboxd with links to the authoritative agency record.
4. **Optional account (`/login`, `/signup`):** Guest-first access never blocks `/map`; sign-in supports MojoAuth email codes and Agentboxd OIDC when configured.

## 4. Hazard interpretation: do not confuse these data types

| Data type | Example | What it can support | What it does **not** prove |
| --- | --- | --- | --- |
| Official active warning | NWS flood warning | An authority issued a warning covering an area | Precise water depth at an individual property |
| Forecast precipitation | Open-Meteo hourly/daily rain | Predicted amount and timing of rain | That a particular street will flood |
| Modeled river discharge | Open-Meteo / Copernicus GloFAS | Expected river flow at supported river points | Coastal storm surge or urban storm-drain flooding |
| Scenario-based exposure | NYC stormwater flood maps | Areas modeled to flood under specified rain scenarios | That flooding is occurring now |
| Regulatory mapped hazard | FEMA NFHL flood zones | Designated mapped flood hazard areas | A live flood observation or deterministic short-term forecast |
| Sensor / satellite observation | FloodNet, NOAA tides, USGS, NASA IMERG | Measurements at the sensor's place/time or satellite granule | Conditions at every nearby street or home |
| Historical record | NOAA Storm Events, GDACS, NYC 311, NFIP claims | Prior episodes, causes, reports, or claims in an area | Current flooding or proof an unreported area is safe |

## 5. Geographic coverage strategy

- **Global baseline:** Map navigation, Photon place search, NASA GPM IMERG rainfall, GDACS global floods, Open-Meteo rainfall forecasts & ERA5 history, Copernicus DEM elevation, and GloFAS river discharge forecasts.
- **US baseline:** NWS active alerts, NOAA Storm Events episodes & flood causes, FEMA NFHL flood zones, NOAA Tides & Currents, USGS stream gauges, US Census TIGERweb ZCTAs, and OpenFEMA NFIP v3 claims.
- **NYC enriched demo:** Static NYC Stormwater Flood Map vector tiles (`public/data/stormwater/`), FloodNet street sensors, NYC 311 street-flooding reports, and NYC hurricane evacuation zones.

## 6. Data sources

| Provider / dataset | Use in WaterMark | Geography / interpretation |
| --- | --- | --- |
| [NWS alerts API](https://www.weather.gov/documentation/services-web-api) | Active official warnings | United States; authoritative agency wording and timestamps |
| [Open-Meteo weather & historical ERA5](https://open-meteo.com/en/docs) | Forecast & historical daily precipitation | Global gridded model/reanalysis, not a rain gauge |
| [Open-Meteo Flood API / GloFAS v4](https://open-meteo.com/en/docs/flood-api) | Modeled river discharge forecasts | Global modeled river cells (~5 km), not coastal surge |
| [Open-Meteo Elevation (Copernicus DEM)](https://open-meteo.com/en/docs/elevation-api) | Ground elevation & Move Your Car / School bearings | Global ~90 m DEM; elevation alone does not set risk |
| [NASA GPM IMERG (via GIBS)](https://www.earthdata.nasa.gov/data/tools/gibs) | Near-real-time global precipitation overlay | Global (~0.1°, fades past native zoom) |
| [GDACS](https://www.gdacs.org/) | 30-day active flood alerts & 2001–2025 country archive | Global international flood events |
| [NOAA Storm Events Database](https://www.ncdc.noaa.gov/stormevents/) | 2016–2025 US flood episodes & causes | US; deduplicated by `EPISODE_ID` per state/county/square |
| [NYC Stormwater Flood Maps](https://data.cityofnewyork.us/d/9i7c-xyvv) | Static vector tiles (`Limited`, `Moderate`, `Extreme`) | NYC scenario/exposure, **not live events** |
| [FloodNet NYC](https://data.cityofnewyork.us/d/aq7i-eu5q) | Street-flooding sensors & depth events | NYC sensor footprint |
| [NYC 311 service requests](https://data.cityofnewyork.us/d/erm2-nwe9) | Historical street-flooding reports | NYC historical public reports |
| [FEMA NFHL](https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer) | Regulatory flood-hazard polygons | US mapped hazard context |
| [OpenFEMA NFIP claims v3](https://www.fema.gov/openfema-data-page/nfip-redacted-claims-v3) | ZIP-level historical flood insurance claims | US; aggregate historical context only |
| [NOAA Tides & Currents](https://api.tidesandcurrents.noaa.gov/api/prod/) | Coastal water-level measurements | US tide stations (e.g. The Battery, Sandy Hook) |
| [USGS Water Data APIs](https://api.waterdata.usgs.gov/) | Stream gauge observations & screened alerts | Selected US stream gauges |
| [NYC Hurricane Evacuation Zones](https://www.nyc.gov/site/em/ready/hurricane-evacuation-zones.page) | Coastal emergency planning zones | NYC reference zones |
| [US Census TIGERweb / ACS](https://tigerweb.geo.census.gov/) | ZCTA lookup & neighborhood context | United States |
| [Photon (komoot) / OpenStreetMap](https://photon.komoot.io) | Global place, ZIP & address search | Global geocoding |

## 7. Architecture

WaterMark runs as a static React + Vite frontend on **GitHub Pages** (`https://watermark.works`, built by [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml) with per-route 200 SPA HTML indexes) backed by **Supabase PostgreSQL + PostGIS** and **Supabase Edge Functions**:

```text
Browser (React 19 + TypeScript + Vite + Astryx + MapLibre GL JS v6 + Turf.js)
  ├── /          Landing page, droplet hero, 2D city parallax, EvidenceSea, team credits
  ├── /map       2D map, zoom-to-focus, flood timeline, role views, voice Gemini assistant, Flood Outlook
  ├── /alerts    Screened Agentboxd official alert email inbox
  └── /login     Optional guest-first MojoAuth / Agentboxd OIDC sign-in
        │
        ├── Public APIs (NWS, Open-Meteo, GloFAS, FloodNet, FEMA, OpenFEMA, NASA GIBS, GDACS, Photon)
        │
        └── Supabase Edge Functions (Deno / TypeScript) + PostgreSQL / PostGIS
              ├── watermark-v1     Normalized flood data API & PostGIS area queries
              ├── assistant        Rate-limited Google Gemini proxy (grounded tool calls)
              ├── outlook-summary  Verified AI block/region summary generator
              ├── watermark-tts    Budgeted ElevenLabs text-to-speech proxy
              ├── alert-inbox      Agentboxd alert email ingestion & sender-auth quarantine
              └── auth-verify      MojoAuth & Agentboxd OIDC + PKCE verification
```

- **Frontend technologies:** React 19, TypeScript, Vite 8, React Router 7, Astryx (`@astryxdesign/core`), MapLibre GL JS v6, Turf.js, Lenis, Vitest, ESLint.
- **Backend technologies:** Supabase Edge Functions, PostgreSQL + PostGIS, Google Gemini API, ElevenLabs TTS API, Agentboxd, MojoAuth.
- **Deployment & CI:** GitHub Pages (`https://watermark.works`), PR frontend quality gates (`.github/workflows/frontend-ci.yml`), TTS CI (`.github/workflows/tts-ci.yml`), and Cloudflare Pages PR previews.

## 8. Feature status

| Priority | Feature | Status | Implementation notes |
| --- | --- | --- | --- |
| **P0** | Public, responsive 2D map & place search | **Built** | MapLibre v6 light/dark styles + Photon geocoding (`PR #6`, `#38`) |
| **P0** | Automatic zoom-to-focus selection | **Built** | Drills World → Country → State → US County → Block under cursor (`PR #39`) |
| **P0** | Flood timeline & NOAA cause breakdown | **Built** | Play/pause 2016–2025 slider, deduplicated `EPISODE_ID` counts, flood causes (`PR #25`) |
| **P0** | Official alerts, rainfall, river & sensor layers | **Built** | NWS, Open-Meteo, GloFAS, FloodNet, NOAA tides, USGS, NASA IMERG, GDACS (`PR #4`, `#6`, `#36`) |
| **P0** | NYC stormwater vector tiles & FEMA zones | **Built** | Static vector tiles (`public/data/stormwater/`) + FEMA NFHL (`PR #6`, `#9`) |
| **P0** | GitHub Pages production deployment | **Built** | Live at `https://watermark.works` with 200 SPA route indexes (`PR #10`, `#11`, `#35`) |
| **P1** | Circle-area report & PostGIS queries | **Built** | Turf.js area report & Supabase PostGIS backend (`PR #4`, `#6`, `#36`) |
| **P1** | Flood Outlook & AI block summaries | **Built** | Recurrence & seasonality + verified AI summary (`PR #28`) |
| **P1** | Voice-enabled Gemini flood assistant | **Built** | Grounded tool calls, mic voice input, rate limits & kill switch (`PR #23`, `#26`) |
| **P1** | Agentboxd alert inbox (`/alerts`) | **Built** | Screened official alert emails with sender-auth quarantine (`PR #21`, `#31`, `#33`) |
| **P2** | Budgeted ElevenLabs voice read-aloud | **Built** | `watermark-tts` Edge Function with character budget & browser fallback (`PR #29`) |
| **P2** | Tailored role views & Move Your Car | **Built** | Homeowner (NFIP + Move Your Car), School, Fire & CERT + Back/Esc (`PR #24`, `#27`) |
| **P2** | 5-language localization & optional login | **Built** | `en`, `es`, `zh-Hans`, `ru`, `hi` + MojoAuth & Agentboxd OIDC (`PR #1`, `#7`, `#20`) |
| **Planned / Unused** | OpenRouter Llama fallback, Decodo scraping, SMS alerts, `.xyz` domain, AWS Amplify | **Not used** | Replaced by Gemini, official public APIs, and GitHub Pages (`watermark.works`) |

## 9. AI integrations and sponsor services

- **Google Gemini (`assistant` & `outlook-summary`):** Powers both the grounded flood chat assistant and block/region Flood Outlook summaries. The browser performs public data lookups and passes tool/figure context to the Edge Function; responses are checked for grounding and rate-limited (`PR #23`, `#26`, `#28`).
- **ElevenLabs (`watermark-tts`):** Budgeted text-to-speech output for assistant replies with automatic browser `speechSynthesis` fallback (`PR #29`).
- **Agentboxd (`alert-inbox` & `auth-verify`):** Ingests and screens official USGS/NWS/FEMA alert emails with sender-auth quarantine (`PR #21`, `#31`, `#33`) and provides optional AI-agent OIDC + PKCE sign-in (`PR #20`).
- **MojoAuth (`auth-verify`):** Optional passwordless email-code authentication without blocking guest map exploration (`PR #7`).

*Note: Earlier planning doc notes evaluated OpenRouter Llama fallback, Decodo web scraping, AWS Amplify, SSOJet, SMS alerts, and a `.xyz` domain; none of those were needed because Gemini, official public APIs, GitHub Pages (`watermark.works`), MojoAuth, and Agentboxd covered the shipped stack.*

## 10. Team task ownership and verified contributions

Cross-referenced against the Google Doc **Assignments** tab and merged pull requests / commits on `main`:

### Ryan Bergman (`@stuyry`) — Frontend, Voice AI & Map Systems
- **Landing page, 2D flooding city parallax & Astryx design system (`PR #9`, `#30`):** Vite + React 19 setup, custom Astryx theme (`themes/watermark/`), interactive droplet hero with title scramble, continuous scroll-driven flooding city parallax (`FloodStory`), `EvidenceSea`, `TeamSection`, `Footer`, Photon place search, and mobile sticky/overlap fixes (`c26127b`, `f949e61`, `9996572`, `6ce43fd`, `4d96a28`, `97626e7`, `688e5e3`).
- **Voice-enabled Gemini flood assistant (`PR #23`):** Built `Assistant.tsx`, `useAssistant.ts`, `scripting/assistant.ts`, `services/assistant/` tool-calling client, browser `SpeechRecognition` mic input & read-aloud controls, and the `supabase/functions/assistant/` Gemini proxy (`1c9900f`).
- **AI summaries for blocks & areas + Flood Outlook (`PR #28`):** Built `FloodOutlook.tsx`, `useFloodOutlook.ts`, `scripting/outlook.ts`, `services/outlook/`, and the `outlook-summary` Edge Function for deterministic recurrence/seasonality plus grounded AI block summaries (`be1fa1b`).
- **Automatic zoom-to-focus selection (`PR #39`):** Built `zoomFocus.ts` and map zoom tracking so zooming drills seamlessly from World → Country → State/Province → US County → Grid Block under the cursor (`6686101`, `e8e03cb`, `4dee83a`).
- **Flood timeline & NOAA episode cause analytics (`PR #25`):** Built the year-by-year play/pause flood slider, deduplicated NOAA Storm Events by `EPISODE_ID`, added Storm Surge/Tide & Seiche records, and added flood-cause bars (`6d4710b`, `74fea57`).
- **Map performance, stormwater vector tiles & GitHub Pages CI/CD (`PR #10`, `#11`, `#38`):** Restyled `/map`, built static NYC stormwater vector tile pipeline (`scripts/stormwater/`), wired live NFIP claims, fixed MapLibre v6 worker loading (`0e0fbd3`), and configured GitHub Pages auto-deployment to `watermark.works` (`f2c90eb`, `0c836db`, `c3a396f`, `26cdbf0`).

### Decong Huang (`@deconghh`) — Backend, Auth, TTS & Localization
- **Supabase PostGIS & Edge Function flood data API (`PR #4`, `#36`):** Built `watermark-v1` with NWS, Open-Meteo, GloFAS, FloodNet, PostGIS spatial queries, provider health, and missing-data safety (`dbd2922`, `820f811`, `06fcddf`, `7f46ac9`).
- **Budgeted ElevenLabs voice read-aloud (`PR #29`):** Built the `watermark-tts` Edge Function with character budgets, concurrency guards, and `services/voice/output.ts` browser fallback (`3b5f9fc`).
- **Agentboxd alert inbox (`PR #21`, `#31`, `#33`):** Built `/alerts` and `alert-inbox` Edge Function for screened USGS/NWS/FEMA alert emails with positive sender authentication and quarantine (`329c1b0`, `5dc739d`, `948bcb0`, `380be18`).
- **Optional guest-first authentication (`PR #7`, `#20`):** Built MojoAuth email-code login, Agentboxd OIDC + PKCE sign-in, and `auth-verify` Edge Function (`f9064c8`, `e3fdef5`, `8735137`).
- **Five-language localization, landing scaffold & CI (`PR #1`, `#3`, `#8`, `#35`):** Built `en`/`es`/`zh-Hans`/`ru`/`hi` localization and voice contract, initial landing/theme scaffold, frontend quality gates, and 200 SPA route HTML indexes (`3a5d3f5`, `b249ef5`, `f456e1e`).

### Ryan Lin (`@ryanmarklin-arch`) — 2D Map, Data Panel & Global Layers
- **Interactive 2D MapLibre flood map (`PR #6`):** Built and ported `/map` with light and dark OpenFreeMap styles and layer re-attachment (`0dce0bd`, `dda6f4d`, `2b89372`).
- **Draggable data panel & Turf.js circle-area report (`PR #6`):** Built `DataPanel.tsx`, `useDraggablePanel.ts`, `AreaReport.tsx`, and `useAreaReport.ts` (`2b89372`).
- **Global hazard layers (`PR #6`):** Added NASA GPM IMERG rainfall overlay and 30-day GDACS global flood events (`133f9e8`, `2b89372`).
- **FloodNet / NFIP starter data & sources bibliography (`PR #6`):** Built starter data pipeline (`scripts/watermark_data.py`) and toggleable `SourcesList` bibliography (`b2d300e`, `2b89372`).
- **Move Your Car concept:** Originated the parking/exposure concept in the planning doc, realized on `/map` as an informational lookup.

### Daniel Manita (`@Danx3mer`) — Audience Views, Safety & Navigation
- **Audience role views & Move Your Car (`PR #24`):** Built Homeowner (insurance claims), School (campus flood approach), and Fire & CERT (priority flood areas) views, Move Your Car elevation/parking lookup, and finer high-zoom detail (`152cf8c`).
- **Flood assistant hardening (`PR #26`):** Added per-client and global rate limits, kill switch, bounded Gemini requests, and untrusted browser-data safeguards (`b117bbe`).
- **Map selection navigation (`PR #27`):** Added Back button, breadcrumb trail, Escape key support, and World reset clearing selection (`997cab0`).
- **Cross-branch merge resolution (`PR #32`):** Resolved merge conflicts for PRs #21, #24, and #28 and reviewed/merged PR #23 (`c340955`).

## 11. Repository layout

```text
WaterMark/
├── README.md                 # Project brief, architecture, sources, credits
├── AGENTS.md                 # Agent rules, ownership boundaries, safety gates
├── .github/workflows/        # deploy-pages.yml, frontend-ci.yml, tts-ci.yml
├── docs/                     # Auth, voice, and alert integration docs
├── supabase/
│   ├── config.toml           # Edge Function configuration (verify_jwt=false)
│   ├── functions/            # watermark-v1, assistant, outlook-summary, watermark-tts, auth-verify, alert-inbox
│   ├── migrations/           # PostGIS & feature schema migrations
│   └── tests/                # Deno/SQL backend unit & concurrency tests
└── WaterMark/                # Vite + React 19 + TypeScript web app
    ├── .env.example          # Public VITE_* placeholder env names
    ├── public/data/          # Static stormwater vector tiles & NOAA/GDACS flood archives
    ├── scripts/              # stormwater/ tile builder, floods/ NOAA+GDACS builder
    ├── src/                  # App.tsx, components/, context/, hooks/, scripting/, services/, styling/, themes/
    └── tests/                # Vitest unit & component tests
```

## 12. Local setup and deployment

```bash
cd WaterMark
npm ci                  # install locked dependencies
cp .env.example .env.local   # optional: configure Supabase function URLs & local dev keys
npm run dev             # local Vite dev server (includes /api/assistant & /api/outlook-summary dev proxies)
npm test                # Vitest unit tests
npm run lint            # ESLint
npm run build           # tsc -b && vite build -> dist/
```

Deployment runs automatically on pushes to `main` via `.github/workflows/deploy-pages.yml`, publishing `WaterMark/dist/` to GitHub Pages at `https://watermark.works`. Never commit secrets; `VITE_*` public endpoints live in GitHub Actions repository variables and server API keys (`WATERMARK_GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, etc.) live in Supabase secrets.

## References

- [Live WaterMark site](https://watermark.works/)
- [EvoHacks 2.0 official Devpost](https://evohacks2.devpost.com/)
- [Team planning document](https://docs.google.com/document/d/1VLHw8AHFrXIV64P9YD5abx2CkHGvjEz97zxK9glnjhw/edit)

*WaterMark is a prototype, not an emergency alert authority. Confirm all time-sensitive conditions with official sources.*
