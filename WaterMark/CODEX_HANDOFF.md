# Codex handoff: Watermark map page (Ryan L)

Read the repo's root `README.md` and `AGENTS.md` first. This file covers one feature: the **/map page** (2D flood map, circle-an-area statistics, draggable data panel, sources list), ported from the old plain-HTML prototype into the Vite + React app in `WaterMark/`.

- **Human owner:** Ryan Lin (Ryan L, pink in the Assignments tab)
- **Branch to use:** `ryan-l/map-page` (not created yet, see "What's left")
- **Status:** code is written, typechecks, lints, builds and passes unit tests. It has **not** been run against live data inside the React app yet (see "What's left", step 3).

## Rules this code follows (from Ryan B's frontend instructions)

- No Tailwind. Styles are plain CSS files in `src/styling/`, imported by components and applied with `className`.
- Folders in `src/`: `components/`, `styling/`, `scripting/` (pure logic), `context/` (React contexts), `hooks/` (custom hooks), `services/` (one adapter per data provider), `assets/`.
- React Router routes live in `App.tsx`; `main.tsx` only renders `<App />`.
- Light/dark mode uses a context and provider (`ColorSchemeProvider`).
- Performance: no `setInterval`, no `console.log`, no polling. Every fetch is aborted when it's no longer needed. MapLibre (about 1.2 MB) is lazy-loaded, so only `/map` downloads it.
- Tests use Vitest in `WaterMark/test/`.
- Astryx (Meta's design system, already installed) supplies the buttons, switches, tabs and segmented control.

## Run it

```bash
cd WaterMark
npm install
npm run dev        # open http://localhost:5173/map
npm test           # vitest: 10 tests
npx tsc -b         # typecheck
npm run lint
npm run build
```

Open a place directly: `/map?lat=40.68&lon=-74.01&z=14&label=Red%20Hook`. Ryan B's landing page can link to that.

## What was done

### New dependencies (`package.json`)

- `react-router` 7 (routing)
- `maplibre-gl` 4.7.1 (map)
- `@turf/circle`, `@turf/distance`, `@turf/area`, `@turf/intersect`, `@turf/boolean-point-in-polygon`, `@turf/helpers` (geometry)
- `@fontsource/barlow-semi-condensed` (self-hosted heading font, so no Google Fonts request)
- Dev: `vitest`, `@types/geojson`
- New script: `"test": "vitest run"`

### Shared files changed (Ryan B owns these, so flag them in the PR)

- `src/App.tsx`: now holds `ColorSchemeProvider`, `BrowserRouter`, and two routes:
  - `/` shows the old Vite starter page, moved unchanged to `components/landing/StarterLanding.tsx`. **Ryan B replaces this with his landing page.**
  - `/map` shows `MapPage`, lazy-loaded.
- `src/main.tsx`: only renders `<App />`. The Astryx `<Theme>` moved into `ColorSchemeProvider`, so Astryx follows light/dark too.
- `index.css` and `App.css` were **not** touched. The map page is `position: fixed`, so the starter `#root` styles don't affect it.

### New files

| Path | What it does |
|---|---|
| `context/colorSchemeContext.ts` | The context object and its type |
| `context/ColorSchemeProvider.tsx` | Light/dark state. Remembers the choice in localStorage (`wm-color-scheme`), defaults to the OS setting, sets `<html data-theme>`, wraps Astryx `<Theme mode>` |
| `hooks/useColorScheme.ts` | `const { scheme, setScheme } = useColorScheme()` |
| `hooks/useGlobalLayers.ts` | Loads once per visit: FloodNet sensors, GDACS floods, the claims summary |
| `hooks/useAreaReport.ts` | Runs the per-area lookups in parallel when the selection changes. Aborts stale requests |
| `hooks/useDraggablePanel.ts` | Panel position and mode (open, stowed, closed). Pointer and arrow-key drag, double-click resets, saved in localStorage (`wm-panel`) |
| `hooks/useFreshness.ts` | `useSyncExternalStore` over `scripting/freshness.ts` (when each source was last fetched) |
| `services/endpoints.ts` | Every upstream URL in one place. Point these at Supabase Edge Functions later (Decong) |
| `services/http.ts` | `getJSON` (throws on HTTP errors), `isAbort` |
| `services/floodnet.ts` | NYC Open Data `kb2e-tjy3` sensors joined with `aq7i-eu5q` flood stats |
| `services/gdacs.ts` | GDACS floods, past 30 days. The `alertlevel=red;orange;green` parameter is required |
| `services/stormwater.ts` | NYC Stormwater Flood Map FeatureServer, by map view and by drawn circle (POST) |
| `services/pointLookups.ts` | Open-Meteo rain, GloFAS river, NWS alerts, FEMA NFHL zone (layer 28), Nominatim search and reverse geocoding |
| `services/claims.ts` | Optional `public/data/summary.json` from `scripts/watermark_data.py` |
| `scripting/types.ts` | Typed results for every adapter (`Loadable<T>` = `null` while loading, `'error'`, or the value) |
| `scripting/geo.ts` | Circle, distance, sensors in the circle, nearest flood, share of the circle under the stormwater model |
| `scripting/format.ts` | Dates, miles and feet, percentages, weekdays |
| `scripting/mapTheme.ts` | Map colors per scheme, FEMA zone explanations |
| `scripting/sources.ts` | The 11 data sources and citations |
| `scripting/freshness.ts` | Tiny store of fetch times |
| `components/map/MapPage.tsx` | The page: state, circle tool, search, hints |
| `components/map/FloodMap.tsx` | The one MapLibre instance. Props sync in through small effects. Popups are built from DOM nodes, never HTML strings |
| `components/map/TopBar.tsx` | Logo, search, "Circle an area", Light/Dark switch, "Show data panel" |
| `components/map/LayersCard.tsx` | Five layer switches and the rain scale. A `<details>` so it folds on phones |
| `components/map/DataPanel.tsx` | Yellow staff-gauge header, Area/Alerts/Sources tabs, `StowTab` |
| `components/map/AreaReport.tsx` | The Area tab. Every number names its source and fetch time. Every empty or failed state says what it means |
| `components/map/AlertsList.tsx` | NWS alerts |
| `components/map/icons.tsx` | Stroke icons |
| `components/brand/Logo.tsx` | `LogoMark` and `Wordmark` (the staff-gauge logo) |
| `components/sources/SourcesList.tsx` | Toggleable sources list. **For Ryan B:** `import { SourcesList } from './components/sources/SourcesList'` then `<SourcesList />` on the landing page |
| `styling/tokens.css` | Brand colors (light and dark), radii, fonts |
| `styling/brand.css`, `map-page.css`, `data-panel.css`, `sources.css` | Component styles |
| `test/format.test.ts`, `test/geo.test.ts` | 10 Vitest tests, all passing |

### Map layers

1. NASA IMERG rain right now (worldwide)
2. GDACS floods worldwide
3. FloodNet sensors (NYC)
4. NYC heavy-rain flood model (loads only at zoom 13 or closer)
5. FEMA flood zones (off by default)

### Area tab sections

1. Street flooding measured by sensors
2. Nearest reported flood
3. Heavy-rain flood model share (labeled as a scenario, not flooding today)
4. FEMA zone at the center
5. 3-day rain
6. Nearest river, 7 days
7. Past insurance claims
8. What to do (links to FloodSmart and FloodHelpNY)

### Verified

- `npx tsc -b`: clean
- `npm run lint`: clean
- `npm test`: 10 of 10 pass
- `npm run build`: succeeds. `MapPage` is its own chunk.
- Headless Chrome, with the network blocked:
  - The page renders at 1440×900 light, 1440×900 dark and 390×844 phone, with no page errors.
  - Every failed-source message shows correctly.
  - These all worked: the label from the URL, drawing a circle (the panel title becomes "Your selected area"), dragging the panel, stow, close, "Show data panel", and the Light/Dark switch (`data-theme` changes).

## What's left (do these in order)

1. **Restore `src/assets/hero.png`.** The working copy has a blank stand-in image so the build would run. Don't commit it; keep the original from `main` (`git checkout main -- WaterMark/src/assets/hero.png`).
2. **Create the branch and commit:** `git checkout -b ryan-l/map-page`, commit, push, open a PR to `main`.
   - Credit only Ryan. No co-author or AI attribution lines in commits.
   - In the PR body, credit AI assistance (the hackathon rule) and flag that `App.tsx` and `main.tsx` cross into Ryan B's area.
3. **Run it with live data** (`npm run dev`, then `/map`) and check:
   - Coney Island loads sensors (about 3 in the default circle), the stormwater share, zone AE, rain, NWS alerts and a GDACS nearest flood.
   - Search "11224" and "Red Hook".
   - Draw a circle.
   - Dark mode: the basemap swaps and the overlays reappear.
   - Phone width: the panel becomes a bottom sheet and the layers card folds.
   - Data panel tabs: Astryx tabs render as `button` elements, not `role="tab"`. Check that the Sources tab opens the list.
4. **Optional:** copy `scripts/watermark_data.py` output `summary.json` to `WaterMark/public/data/summary.json` to fill the claims section.
5. **Coordinate with Ryan B:**
   - He may write his own color-scheme context. If so, keep one of the two: the map only needs `useColorScheme()` returning `{ scheme, setScheme }`.
   - He replaces the `/` route with his landing page and can mount `<SourcesList />`.
6. **Coordinate with Decong:** when the Supabase Edge Functions exist, change only `services/endpoints.ts` and the adapters. Components consume the types in `scripting/types.ts`.
7. **Ryan B's prompt also asked for an `AGENTS.md` update** with his frontend practices, plus a note that chat-completion models used for logic get function tools. That's his file, so it isn't done here.

## Known limits (be honest about these in the demo)

- The NWS API covers the US only.
- FloodNet sensors cover parts of NYC only.
- The stormwater model is NYC only.
- GDACS lists only large floods.
- IMERG rain is a few hours behind real time.
- No sensor or no alert is never shown as "safe".
- `npm run build` warns that the `MapPage` chunk is over 500 kB. It's lazy-loaded, so the landing page isn't affected.
