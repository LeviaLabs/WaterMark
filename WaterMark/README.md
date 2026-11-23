# WaterMark web app

Vite + React 19 + TypeScript frontend for **WaterMark**, live at [https://watermark.works](https://watermark.works). The full project brief and team credits live in the [root README](../README.md); coding conventions live in [AGENTS.md](./AGENTS.md).

## Commands

```bash
npm ci               # install locked dependencies
npm run dev          # local dev server (with /api/assistant & /api/outlook-summary dev middleware)
npm test             # Vitest unit & component tests in tests/
npm run lint         # ESLint
npm run build        # tsc -b && vite build into dist/
npm run data:floods  # rebuild static NOAA/GDACS flood summaries (python)
npm run tiles:stormwater # rebuild static NYC stormwater vector tiles
```

## Routes and what is here

- **Landing page (`/`):** Interactive glass droplet hero with pointer water slosh and title scramble; a continuous scroll-driven 2D flooding city parallax (`FloodStory`, `#how`) featuring interactive previews for place search, automatic zoom-to-focus & flood timeline, NWS alerts, rainfall forecasts, stormwater scenarios, sensors & tides, circle area + Flood Outlook & AI block summaries, voice-enabled Gemini assistant, tailored audience role views, and Agentboxd alert digests in 5 languages; underwater `EvidenceSea` (`#data`) + 17-dataset source catalog; role cards (`#audiences`); team credits (`#team`); and footer.
- **Interactive 2D flood map (`/map`):** Guest-first MapLibre GL JS v6 map with light/dark styles, Photon place search, NASA GPM IMERG rainfall & GDACS global layers, automatic zoom-to-focus selection (World → Country → State/Province → US County → Grid Block), play/pause 2016–2025 NOAA flood timeline & flood causes, static NYC stormwater vector tiles, Turf.js/PostGIS circle area report, Flood Outlook + verified AI block summaries, voice-enabled Gemini assistant (`SpeechRecognition` mic + budgeted ElevenLabs/browser read-aloud), and Homeowner (`Move Your Car`), School, and Fire & CERT role views.
- **Alert inbox (`/alerts`):** Screened official USGS/NWS/FEMA alert email digests ingested via Agentboxd with sender-authentication checks.
- **Optional sign-in (`/login`, `/signup`):** Guest-first auth supporting MojoAuth email codes and Agentboxd OIDC + PKCE when configured.
- **Localization & theme:** Five UI/voice languages (`en`, `es`, `zh-Hans`, `ru`, `hi`) in `src/context/LocalizationProvider.tsx` and light/dark themes in `src/context/ThemeProvider.tsx`.
- **Astryx design system:** Custom `watermark` theme (`themes/watermark/`, generated into `src/themes/`) paired with plain CSS modules in `src/styling/`.

## Folder map

```text
public/
  data/floods/       pre-aggregated NOAA Storm Events & GDACS country/state/county/cell JSON
  data/stormwater/   static NYC stormwater vector tiles (.pbf)
scripts/             Python/Node data & vector-tile build scripts
src/
  App.tsx            providers + React Router routes (/, /map, /alerts, /login, /signup)
  components/
    city/            2D SVG flooding city for the landing parallax
    common/          SplitText, RollText, TiltCard, Reveal, EvidenceTag, Icon, ErrorBoundary
    features/        Reusable evidence panels (PlaceSearch, AlertList, RainfallChart, AreaSummary, AssistantThread, AlertDigest)
    hero/            Droplet hero
    landing/         FloodStory, FeaturePreview, ZoomTimelinePreview, AreaOutlookPreview, AudiencesPreview, DataSection, EvidenceSea, FeaturesSection, TeamSection, CtaSection
    layout/          NavBar, Footer, ScrollGlow, ThemeToggle, SiteLayout
    map/             FloodMap, MapPage, MapSearch, FloodOutlook, Assistant, AreaReport, RegionSummary, Charts, MapLegend, audiences/ (HomeownerView, SchoolView, ResponderView, MoveCar, RolePicker)
    pages/           LandingPage, AlertsPage, AuthPage, NotFoundPage
    sources/         SourcesList bibliography
  context/           ThemeProvider, AuthProvider, LocalizationProvider
  hooks/             useAreaReport, useAssistant, useFloodOutlook, useFloodHistory, useGlobalLayers, useScrollProgress, etc.
  scripting/         Pure logic: zoomFocus, outlook, assistant, causes, cells, choropleth, audiences/, content/, evidence/, localization/
  services/          API clients: assistant/, outlook/, voice/, auth/, geocoding/, floodHistory, stormwater, floodnet, gdacs, openMeteo, claims, emailAlerts
  styling/           Plain CSS modules (tokens.css, story.css, features.css, assistant.css, outlook.css, map-premium.css, etc.)
  themes/            Generated Astryx theme (do not edit by hand)
tests/               Vitest tests
```
