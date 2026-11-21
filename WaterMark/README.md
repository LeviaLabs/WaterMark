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

- **Landing page** (`/`): a living tide chart in the hero (a made-up topographic island that the tide floods and drains on its own) under a title whose last letters decrypt. Then a scroll story ("How it works"): a 2D SVG city (lit windows at night, sun and clouds by day) whose curved water rises continuously with the scroll, while each step shows a working feature panel (place search, NWS alerts, rainfall chart, stormwater scenarios, sensor and tide readings, circle-an-area, assistant, alert digest). Every panel uses clearly labeled example data until it is wired to the data API. Then the data principles, the kinds of evidence as falling raindrops you can open, the source list, who it is for, team credits with build status, and a footer thanking EvoHacks II and its sponsors. No WebGL, so it works without hardware graphics.
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
  services/        integrations with outside tools (none yet)
  assets/          images imported by code
  themes/          generated Astryx theme (do not edit by hand)
tests/             Vitest tests
```
