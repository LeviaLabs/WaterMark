# WaterMark: instructions for coding agents

> Read [`README.md`](./README.md) and this file **before making changes**. This is the active project brief for EvoHacks 2.0. The team retains final authority for project decisions and merges.

## Mission and immutable scope

Build an accessible **2D interactive flood and extreme-rainfall map** with global baseline data and richer NYC/coastal datasets. It must help residents, schools, CERT volunteers, and community responders inspect official warnings, rainfall forecasts, mapped exposure, selected measurements, and historical evidence.

**Do not add** drought, lake/reservoir depletion, groundwater depletion, 3D globe, or a new hosting provider. Do not imply such features are part of the MVP even if they appear in older Google Docs comments. No fabricated forecasts, probabilities, or official warnings.

## Color-coded assignments are the real task ownership map

**Read the Google Doc's `Assignments` tab before accepting work. The highlight colors identify owners:**

| Background highlight | Owner | Assigned responsibilities |
| --- | --- | --- |
| **Green `#D9EAD3`** | **Ryan Bergman (Ryan B)** | Landing-page shell/frontend visual design; AI chatbot (Gemini / OpenRouter under evaluation) and primary ElevenLabs voice assistant; AWS automatic deployments; exploratory Decodo scraping |
| **Pink `#EAD1DC`** | **Ryan Lin (Ryan L)** | Application/demo page, 2D world map, draggable/collapsible data panel, circle-area selection, statistics and forecast visualizations, bibliography/resources component on landing page, exploratory Move Your Car concept |
| **Blue `#C9DAF8`** | **Decong** | Supabase Postgres/PostGIS and Edge Functions, multilingual/localization integration, optional MojoAuth login, Agentboxd alert emails/summaries and optional sending, `.xyz` domain/DNS setup, SMS investigation |
| **Yellow `#FFF2CC`** | **Joint, conditional** | Audience-specific tailored views only after higher-priority functionality works |

The document also repeats each owner's tasks under their name. Use color and named sections as **assignment** evidence. If your human operator assigns a narrower task, work only on that task. **Color does not mean a feature has been built, tested, or approved for release.** Some assigned features remain P1/P2 or research-only. See `README.md` Sections 8 and 10.

### Integration boundaries for AI coding agents

1. **Ryan B + Ryan L, landing page:** Ryan B owns landing-page layout and routing. Ryan L delivers the resources/data/bibliography component as a separately exported module or content configuration. Do not concurrently rewrite the landing-page entry file.
2. **Ryan L + Decong, map/API:** Ryan L owns map UI, circle geometry, data panel, and charts. Decong owns API normalization, PostGIS/geospatial queries, Supabase schema, RLS, and secrets. Jointly agree on API endpoint names, units, errors, data provenance, and a GeoJSON geometry contract **before** integration. No fabricated "live" values.
3. **Ryan B + Decong, voice/language:** Ryan B owns the primary assistant and ElevenLabs integration. Decong owns translation/localization and multilingual voice behavior. Agree on a single assistant/voice contract so neither creates incompatible clients. A language selection is not evidence of correct spoken-language support until tested.
4. **Ryan L + Decong, login:** Ryan L owns the public demo-page shell; Decong owns optional auth integration. **Unauthenticated flood-map exploration remains functional.** Login never blocks the hackathon demonstration.
5. **Ryan B + Decong, deployment:** Ryan B configures/verifies AWS Amplify build and auto-deploy. Decong handles custom `.xyz` DNS/domain and Supabase backend. Agree on production base URLs and environment-variable **names**, not secret values. Do not change each other's provider configuration without review.
6. **Ryan L, Move Your Car:** UI exploration belongs to Ryan L; the feature is **not approved as operational routing advice**. Without validated current flood, road-closure, parking, and route data, show only non-actionable research/mock UI and do not imply safety.
7. **Audience-specific dashboards:** The yellow note says **joint work if time remains**. None of the agents should start independent school/firefighter routing or predicted building-side inundation models by default.

### Agent startup and handoff contract

When receiving a task, identify your **named human owner, feature branch, assigned feature, allowed files, expected public interface, and integration dependency**. If the owner or branch is unknown, do not guess it from an agent's name. You may inspect and propose a bounded plan, but ask the human to select a branch before changing shared files.

Every handoff/PR must report:

- `Human owner` and `feature branch`.
- `Scope implemented` versus `not implemented / research only`.
- `Files touched` and whether they cross another owner's boundary.
- `API contract changes` including schemas, units, timestamps, geometry, failure codes, and mock/live status.
- `Environment variable names`, never secret values.
- `Tests actually run` with observed results; incomplete tests clearly stated.
- `Integration request` naming who must mount or consume the component, plus merge order and rollback concerns.

Prefer isolated pull requests merged after verification. Do not tell teammates to merge all branches at the end. For cross-team changes, obtain human approval rather than overwriting the other owner.

## Authoritative reference order

1. Current user/team decision and task assignment in the active issue or PR.
2. Root `README.md` and this `AGENTS.md` for product scope, safety, and integration boundaries.
3. Reviewed shared contracts in `docs/API_CONTRACTS.md` / `packages/shared` if those files exist.
4. Current repository code and tests for verified implementation details.
5. Team Google Doc for history, candidate datasets, and ideas (not all brainstorming is approved).
6. Provider documentation for API behavior, schema, restrictions, and attribution.

If two sources conflict, do not silently choose. Report the conflict and propose a narrow resolution. Never use a comment from an older project scope to override the current flood/rainfall focus.

## Status discipline: proposed is not implemented

- Do **not** claim a route, library, schema, provider, dataset, or deployment exists until you inspect it.
- Do not invent endpoint success, test results, deployment URLs, model accuracy, or data update frequency.
- Label all examples, fixtures, and replay results clearly. The absence of active warnings is not proof that an area is safe.
- If access to private repo infrastructure or an API is missing, report what could and could not be tested.

## Data provenance is non-negotiable

Every displayed assessment needs the provider, source reference or URL, location and spatial coverage, units, observed/forecast/scenario/historical data type, relevant timestamps, and quality/limitation fields. Differentiate:

- Official **NWS warning** versus predicted precipitation.
- **Open-Meteo/GloFAS river flow** versus flood depth, coastal surge, or urban rainfall flooding.
- **NYC Stormwater Map** scenario versus actual flooding today.
- **FEMA flood zone** versus current warning.
- **FloodNet sensor record** versus a neighborhood-wide measurement.
- **Historical 311 or claims count** versus present conditions.

No universal 0–100% flood probability unless scientifically validated and calibrated. Unknown must never be displayed as low risk.

## Safety-sensitive capabilities

- **Move Your Car:** Research only. Do not say any destination or route *will not flood*. Static flood maps cannot establish real-time roadway safety, open parking, or evacuation suitability. Require an independently validated safety design and authoritative road/parking/closure data before implementing actionable recommendations.
- **School risk:** Do not forecast which side of a building a flood will strike from broad rainfall or coarse polygons.
- **Emergency information:** Present official guidance and citation links, not fabricated directions or original evacuation orders.
- **LLM/voice:** Optional presentation layer. The LLM may summarize cited structured outputs, never generate ungrounded numbers or override official warnings.
- **Alerts by email/SMS:** Supplemental and potentially delayed. Do not treat email summary arrival as proof of a current alert. Respect consent and rate limits.

## Architecture boundaries

Current planned stack: React/TypeScript/Vite, 2D MapLibre or Leaflet, Turf.js, AWS Amplify for frontend hosting, Supabase Edge Functions for backend calls, and Supabase PostgreSQL/PostGIS for selected persisted/geospatial data. Do not add Cloudflare, Lambda/API Gateway, another database, or a proxy without a demonstrated necessity and team approval.

Use source adapters to normalize provider payloads. Keep `observedAt`, `forecastIssuedAt`, `validFrom`, `validTo`, and `fetchedAt` separate as applicable. Preserve upstream schema links and units. The frontend should consume stable typed results and never rely on unvalidated API response shapes.

**Proposed repository paths. Team ownership is confirmed by highlights; actual paths are unverified:**

- `apps/web/`: UI, map, charts, controls, responsive and accessible behavior. **Actual location: `WaterMark/`** (see Frontend conventions below).
- `supabase/functions/`: external API adapters, request validation, CORS, upstream data quality.
- `supabase/migrations/`: schema, PostGIS, indexes, RLS.
- `packages/shared/`: API types, data-status enums, units, and severity provenance.
- `docs/`: verified data-source catalog, contracts, and demo evidence.

Adapt paths to the existing repository. Do not create this speculative tree unless authorized.

## Frontend conventions (set by Ryan B, landing page and frontend owner)

The web app is the Vite + React + TypeScript project in **`WaterMark/`**. Every path below is relative to that folder. Follow these rules for all frontend work.

### File structure

| Path | Holds |
| --- | --- |
| `public/` | Only files served as-is: the browser icons (`favicon.svg`, `icon-maskable.svg`) and `site.webmanifest`. No Vite or React template assets. |
| `index.html` | Page metadata and the tiny pre-paint script that sets `data-theme` (keep it in sync with `src/scripting/theme/themeStorage.ts`). |
| `src/main.tsx` | Renders `<App />` and nothing else. |
| `src/App.tsx` | Providers, global stylesheet imports and **every React Router route**. A new page is a new `<Route>` here; secondary pages are `lazy()`-loaded. |
| `src/components/` | React components, grouped as `layout/`, `hero/`, `landing/`, `common/` (incl. `SplitText` title animation and `RollText` hover text), `pages/`, `city/` (the SVG flooding city in "How it works"), `hero/` (the tide chart) and `features/` (reusable evidence panels typed against the backend contract). |
| `src/styling/` | All CSS. Imported once in `App.tsx`, applied with `className`. Design tokens (colors per theme, spacing, fonts) live in `tokens.css`. |
| `src/scripting/` | Pure logic with no React and no network: theme rules, city geometry (`city/`), hero tide-chart contours (`tide/`), custom scrollbar math (`scroll/`), frontend mirror of the API contract plus formatting (`evidence/`), title splitting and the decrypt effect (`text/`), landing-page content and clearly labeled example data (`content/`). |
| `src/context/` | React contexts and their providers (e.g. `ThemeContext` + `ThemeProvider`). Keep the context object in a `.ts` file and the provider in a `.tsx` file. |
| `src/hooks/` | Custom hooks (`useTheme`, `useInView`, `useScrollProgress`, `usePointerTilt`, `usePointerParallax`, `useMediaQuery`). |
| `src/services/` | Code that integrates outside tools and providers (Supabase, ElevenLabs, LLMs), one folder per integration. |
| `src/assets/` | Images and SVGs imported by code. |
| `src/themes/` | **Generated** Astryx theme. Do not edit; change it with `npx astryx experimental theme editor set watermark …` (source in `themes/watermark/`). |
| `tests/` | Vitest tests (`npm test`). Experiments and checks go here, not into app code. |

### Styling

- **No Tailwind or other utility-class frameworks.** Write CSS files in `src/styling/` and use class names. Ryan B reviews this code and does not use Tailwind.
- Use the tokens in `tokens.css`; do not hardcode theme colors elsewhere. City colors (sky, buildings, lit windows, water) are tokens too and crossfade between day and night.
- This team rule overrides Astryx's generic agent advice ("no `<div>`, no imported CSS"). Astryx provides the theme and controls (`Button`, `TextInput`, `Avatar`); page layout and the visual design are our own CSS.
- Light and dark mode come from `ThemeProvider`: it sets `data-theme` on `<html>` for our CSS and passes the same `mode` to Astryx's `<Theme>`. Style both modes for anything you add.
- Glass surfaces: `.glass-panel` (real `backdrop-filter` blur, use sparingly) and `.glass-card` (cheap translucent gradient, fine in grids). 3D hover tilt: wrap content in `TiltCard`.

### Performance (desktop and mobile)

- No `console.log` left in code, no `setInterval`, no artificial waits or timeouts, and no listeners that are not needed.
- Prefer `IntersectionObserver` to scroll listeners. When scroll position is truly needed, attach a **passive** listener only while the element is on screen and throttle work to `requestAnimationFrame` (see `useScrollProgress`).
- Animate only `transform` and `opacity`. Keep `backdrop-filter` to a handful of elements.
- Graphics are plain SVG and CSS, no WebGL or canvas, so they render without hardware acceleration. The city is generated once from seeded geometry (`scripting/city/`); windows are one SVG `<pattern>` per layer; waves are periodic paths slid with `transform`; the water level is one `--level` CSS variable. In "How it works" the water level follows the scroll through `--progress`. The hero tide chart animates one registered CSS number (`--tide`) with no script per frame. Animations pause off screen (`.city--paused`, `.tide-chart--paused`). Under `prefers-reduced-motion` everything is static. Keep new graphics to the same rules.
- Respect `prefers-reduced-motion` everywhere, and check every change at a phone width (375 px) as well as desktop.
- Keep state local. Use context only for app-wide state (theme now; auth and locale when they are integrated).

### Calling backends and AI models

These are the baseline rules; Ryan B will extend them when backend work starts.

- Keep fetch requests simple: one small typed function per endpoint in `src/services/<integration>/`, plain `fetch`, an `AbortController` for cancellation, and validation of the response shape before use. No polling loops.
- Never put API keys in frontend code. Call LLM and voice providers through Supabase Edge Functions; document environment-variable **names** only.
- When calling a **chat-completions model that is used for logic** (routing, classification, extraction, choosing data to fetch) rather than replying directly to a user, always give it **function tools** (tool/function calling with a JSON schema) and require it to answer through a tool call. Parse and validate the tool-call arguments, then pass them into our own typed functions, and feed those functions' results back into the app or the conversation. Do not parse free text for program logic.
- A model that replies to users may answer in text, but only to summarize cited, structured data it was given (see Safety-sensitive capabilities).

## Git and parallel-agent collaboration

- Work only on your explicitly assigned feature branch. Do not push directly to the deployment/default branch.
- Before touching shared files, check the color-coded assignments above and coordinate with agents working on adjacent modules.
- Define request/response types before separately building the caller and provider.
- Prefer small, independently testable PRs. Merge continuously after review; do not save every integration for the final hour.
- Never delete or overwrite another agent's work to fix a merge conflict. Inspect both sides and preserve intended behavior; escalate unresolved conflicts.
- Do not run destructive DB migrations, force-push, delete environments, or alter authentication policy without explicit human approval.
- Never commit secrets or copy credentials from the planning document. **The current Assignments tab contains a credential-like value**: treat as exposed, request revocation/rotation, remove plaintext copies, and review repository history. Never repeat its value in a prompt, file, or status report.

## Per-task execution protocol

1. **Inspect:** Read the target files, current branch, related contracts, and existing tests.
2. **State the scope:** One feature, files expected to change, dependencies, and acceptance criteria.
3. **Implement:** Minimal working slice; typed data; no invented production metrics or frontend placeholders disguised as live data.
4. **Verify:** Run relevant tests, typecheck, lint, build, and an actual user-flow or provider contract smoke test where possible.
5. **Report:** Files changed, how to run it, observed test results, untested assumptions, source restrictions, and merge dependencies.
6. **Hand off:** Make changes reviewable in a PR with clear ownership and documentation; wait for human approval for merges/deployments.

## Priority order

**P0:** Public 2D map, live/dated rainfall forecast, official warnings, NYC stormwater scenario layer, a validated flood observation/forecast, evidence panel, mobile usability, and deployable build.

**P1:** Circle selection and defensible area statistics (assigned to Ryan L), additional historical datasets, Agentboxd digest (Decong), optional sourced AI explanation (Ryan B). Assigned stretch work is still gated on P0 reliability.

**P2/research:** Multilingual voice AI (Ryan B + Decong), authentication and SMS research (Decong), joint specialized audience dashboards, and Move Your Car safety research (Ryan L).

When blocked or close to submission, complete P0 and **do not** expand scope to make the UI look more impressive.

## Definition of an acceptable PR

- Meets a documented user goal and acceptance criterion.
- Has stable contracts and handles empty, missing, stale, malformed, and rate-limited provider responses.
- Clearly marks real observations, forecasts, modeled scenarios, historical replay, and simulation.
- Includes source/last-updated metadata and no false assurance about safety.
- Is accessible and responsive for UI changes.
- Does not expose a key or privileged Supabase secret; any exposed database table uses reviewed RLS and grants.
- Provides reproducible tests and an honest completion statement.

## Hackathon AI rule

AI may assist, but may **not** create the entire submission. Humans must implement, review, understand, and be able to explain their code in the three-minute Devpost video. Credit AI assistance, data providers, external code, and reused assets.

**Submission deadline:** November 22, 2026, 3:00 PM ET. Do not treat unfinished external integrations as complete merely to meet the deadline. Present clear, labeled limitations and a working narrower demo instead.

<!-- ASTRYX:START -->
Astryx v0.7.17 · 174 components
CLI: run every command as `npx astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — start every page from a template, never from scratch:
1. `astryx build "<idea>"` — names the template to scaffold from and the parts it lacks.
2. `astryx template <name> <path>` — scaffold it; keep its frame, gap and padding; replace the content.
3. `astryx component <Name>` to read props before using one; `astryx template <Block>` prints a block example to read for a part it lacks. Astryx names differ from other libraries: buttons, badges, tokens and tabs take their text in `label` (Text, Heading and Link take children), booleans start with `is` or `has` (`isOpen`, `isDisabled`), and every input takes `value` and `onChange`.
Changing an existing page? Keep it: skip step 2 and add components inside its sections; read a block example when it helps.
Before you deliver a build, run `astryx doctor --built <dir>`; don't deliver it if it fails.

RULES:
- No <div> — components handle all layout and spacing.
- Read `astryx docs layout` before changing a template's frame.
- Dense data = rows (Table, List/Item), not Card-wrapped lists. Badge = counts only.
- Style with component props first, then tokens (var(--color-*|--spacing-*|--radius-*)). No raw hex/px. No StyleX/Tailwind compiler here — don't use xstyle/utility classes directly. Some templates use StyleX and need a compiler plugin; see `astryx docs styling-overview`.
- THEMES: palettes and custom colors go through the theme, never :root overrides; so does a denser or roomier app (`editor set <name> spacing tight`), never gap and padding changes page by page. A change to one kind of part (the sidebar, its selected item, the gaps in a form) is a theme change too, not props on one page: `editor how "<ask>"` names the `set … --on <part>` line. No app yet: `astryx experimental theme preview app <dir>` makes a starter app that shows the theme. To make or change a theme (colors, fonts, corners, spacing, a look from a picture), prefer the experimental theme editor over hand-written theme files: `astryx experimental theme editor new <name> --like neutral`, then `editor set <name> <thing> <value>` or `editor how "<what you want>"`; wire it with `astryx theme add <name>`; after each change look at it with `astryx experimental theme editor show <name> --png` (takes pictures of real components) and open the PNGs it writes; a theme change is not done until you have looked at the pictures. In code, extend an imported theme to customize it; `theme eject <slug>` only forks source. See `astryx docs theme`.
- SELF-CHECK: re-read the file; replace any raw <div>/<span>, imported .css/@apply, or hardcoded #hex/px with the component or a token.

`astryx help` lists every command. Key ones beyond the workflow:
  search "<query>"   find any component / hook / doc / template
  discover <words>   integrations you could add
  docs <topic>       getting-started, principles, tokens, theme … (`astryx docs` lists all)
  docs cli           commands and API reference
  docs authoring     build an integration package, and every field it holds
  upgrade --from <old version> --apply   run after a dependency bump
To remove this block, run `astryx init --remove-agents`, which removes it from the agent files at the project root and in the folder you run it in; from any other file it leaves, delete everything from ASTRYX:START to ASTRYX:END.
<!-- ASTRYX:END -->
