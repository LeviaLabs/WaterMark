# WaterMark web app

Vite + React 19 + TypeScript frontend for WaterMark. The project brief is in the [root README](../README.md); the rules for working in this folder are in [AGENTS.md](./AGENTS.md) (Frontend conventions).

## Commands

```bash
npm ci          # install the locked dependencies
npm run dev     # local dev server
npm test        # Vitest unit tests in tests/
npm run lint    # ESLint
npm run build   # typecheck + production build into dist/
```

## What is here

- **Landing page** (`/`): an interactive storm scope in the hero: a radar dial over a field of dots. The sweep turns and each of the seven kinds of evidence blips as it passes (hover or tap a blip to read what it is). The pointer lights the dots and reads out its bearing and range. Clicking drops a rain cell drawn as a halftone radar echo, holding builds it from light rain to extreme, and when you let go it drifts off with the wind. A storm line crosses the dial on its own. It is labeled as an illustration, not live radar. The title's second line decrypts on load and each word re-decrypts on hover. Then a scroll story ("How it works"): a 2D SVG city (lit windows at night, sun and clouds by day) whose curved water rises continuously with the scroll, while each step shows a working feature panel (place search, NWS alerts, rainfall chart, stormwater scenarios, sensor and tide readings, circle-an-area, assistant, alert digest). Every panel uses clearly labeled example data until it is wired to the data API. Then the page sinks under the sea: each kind of evidence is a fish of its own color swimming left to right or right to left (click one to open its card), with the data principles on the seabed, then the source list, who it is for, team credits with build status, and a footer thanking EvoHacks II and its sponsors. Smooth scrolling (Lenis), view-transition theme and page changes, and sections below the first screen (and each story panel) load only as they come on screen, with skeletons until they arrive. No WebGL, so it works without hardware graphics.
- **Light and dark mode**: `src/context/ThemeProvider.tsx`, remembered in `localStorage`, defaulting to the system setting.
- **Routing**: React Router in `src/App.tsx`. `/map` is reserved for the map page (Ryan Lin); `/login` and `/signup` are a shell until MojoAuth sign-in (Decong Huang) is connected.
- **Astryx design system**: the custom `watermark` theme (`themes/watermark/`, generated into `src/themes/`) styles Astryx controls such as `Button`, `TextInput` and `Avatar`. Page layout and visuals are plain CSS in `src/styling/`.

## Folder map

```text
public/            icons and web manifest only
src/
  App.tsx          providers + routes
  components/      layout/, hero/, landing/, common/, pages/, city/ (SVG city), features/ (evidence panels)
  styling/         CSS files (tokens.css holds the theme colors)
  scripting/       pure logic: theme rules, city/ geometry, evidence/ API contract mirror + formatting, text/, content/
  context/         React contexts and providers
  hooks/           custom hooks
  services/        integrations with outside tools: geocoding/photon.ts (place search through Photon,
                   keyless, OpenStreetMap data, credited in the panel)
  assets/          images imported by code
  themes/          generated Astryx theme (do not edit by hand)
tests/             Vitest tests
```
