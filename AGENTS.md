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

- `apps/web/`: UI, map, charts, controls, responsive and accessible behavior.
- `supabase/functions/`: external API adapters, request validation, CORS, upstream data quality.
- `supabase/migrations/`: schema, PostGIS, indexes, RLS.
- `packages/shared/`: API types, data-status enums, units, and severity provenance.
- `docs/`: verified data-source catalog, contracts, and demo evidence.

Adapt paths to the existing repository. Do not create this speculative tree unless authorized.

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

## Frontend conventions

All application UI lives in `WaterMark/` (Vite, React 19, TypeScript). Ryan Bergman owns the landing page and frontend shell.

### File structure

- `WaterMark/public/` holds every icon the app uses: favicon, apple-touch icon, manifest icons, and `site.webmanifest`. Do not leave the Vite demo icons in place.
- `WaterMark/src/main.tsx` renders `App` and top-level providers only.
- `WaterMark/src/App.tsx` composes the UI and owns the React Router setup (`BrowserRouter`, `Routes`). Routes are `/` (landing), `/login`, `/signup`, and `/app`.
- `src/components/` for UI, `src/styling/` for plain CSS imported and applied with `className`, `src/scripting/` for helpers and content data, `src/context/` for React context, `src/hooks/` for hooks, `src/services/` for external integrations, and `src/assets/` for bundled assets. Keep an empty folder with `.gitkeep`.
- Theme state is a `ThemeProvider` in `src/context` and `useTheme` in `src/hooks`. Persist the choice in `localStorage`, default to `prefers-color-scheme`, pass the resolved `light` or `dark` mode to Astryx `Theme`, and set the mode in a tiny inline script in `index.html` so the first paint matches.
- The bibliography is a separately exported component. Its source list lives in `src/scripting/sources.ts` so Ryan Lin can take over the content without rewriting the landing page.

### Hard rules

- No Tailwind. Standard controls use Astryx components and tokens. Custom visuals (the WebGL hero, parallax layers, glass surfaces) use CSS files in `src/styling`. Where an Astryx authoring rule conflicts with these conventions, these conventions win.
- Performance first, including on mobile. No console logging, no unnecessary waits or timeouts, and no `setInterval`. Remove every listener on cleanup. Prefer passive listeners, `IntersectionObserver`, and `requestAnimationFrame` throttling. Respect `prefers-reduced-motion`. Pause animation loops when the surface is offscreen or the tab is hidden. Lazy-load heavy below-the-fold UI. Keep the bundle lean: no three.js or similar. Graphics may use raw WebGL2 and GLSL, with `devicePixelRatio` capped around 1.5–2, lower quality on small or low-end screens, and a CSS or SVG fallback when WebGL is unavailable.
- Put dev tests in `WaterMark/tests/` and run them with Vitest (`npm test`). Do not leave debug code behind.
- Hooks and context are fine. Do not invent live forecasts, probabilities, or official warnings in the UI.

### AI integration

When a chat-completions model is called for logic rather than to reply directly to a user, give it function tools and pass the tool results into our own functions. Keep `fetch` calls simple: one URL, an explicit method and headers, and no hidden retry or scraping framework inside the call.

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
