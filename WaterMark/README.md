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

- **Landing page** (`/`): interactive WebGL sea in the hero (move to stir it, tap for ripples), a scroll-driven parallax "evidence stack", the data principles and source list, planned features, team credits and a footer thanking EvoHacks II and its sponsors.
- **Light and dark mode**: `src/context/ThemeProvider.tsx`, remembered in `localStorage`, defaulting to the system setting.
- **Routing**: React Router in `src/App.tsx`. `/map` is reserved for the map page (Ryan Lin); `/login` and `/signup` are a shell until MojoAuth sign-in (Decong Huang) is connected.
- **Astryx design system**: the custom `watermark` theme (`themes/watermark/`, generated into `src/themes/`) styles Astryx controls such as `Button`, `TextInput` and `Avatar`. Page layout and visuals are plain CSS in `src/styling/`.

## Folder map

```text
public/            icons and web manifest only
src/
  App.tsx          providers + routes
  components/      layout/, hero/, landing/, common/, pages/
  styling/         CSS files (tokens.css holds the theme colors)
  scripting/       pure logic: theme rules, WebGL renderer + GLSL shaders, page content
  context/         React contexts and providers
  hooks/           custom hooks
  services/        integrations with outside tools (none yet)
  assets/          images imported by code
  themes/          generated Astryx theme (do not edit by hand)
tests/             Vitest tests
```
