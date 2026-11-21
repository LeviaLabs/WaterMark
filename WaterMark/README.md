# WaterMark frontend

Vite, React 19, and TypeScript app for the EvoHacks II flood and extreme-rainfall map. The landing page is the public front door. The map, login, and sign-up routes are placeholders for Ryan Lin and Decong Huang.

This is a prototype, not an official warning service. It does not invent forecasts, probabilities, or alerts.

## Run it

```bash
cd WaterMark
npm install
npm run dev
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm test` | Vitest, in `tests/` |
| `npm run lint` | ESLint |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Serve the production build |

No environment variables are required for the landing page. Do not commit secrets.

## Routes

Routing lives in `src/App.tsx` (`BrowserRouter` and `Routes`). At this size that file is the right place: four routes, no loaders, and one obvious list. A separate route module, or `createBrowserRouter`, is worth it later if the map adds nested routes or data loaders.

| Path | Page |
| --- | --- |
| `/` | Landing page |
| `/app` | Map placeholder for Ryan Lin |
| `/login` | Sign-in placeholder for Decong |
| `/signup` | Sign-up placeholder for Decong |

## Structure

```text
public/                 icons, favicon, site.webmanifest
src/main.tsx            mounts App and the theme provider
src/App.tsx             router
src/components/         UI, including the exported Bibliography
src/styling/            plain CSS, applied with className
src/scripting/          helpers and content data (sources, features, team)
src/context/            theme context and provider
src/hooks/              useTheme and other hooks
src/services/           reserved for external API clients
src/assets/             bundled static assets
tests/                  Vitest
```

Astryx (`@astryxdesign/core`, theme-neutral) supplies buttons, type, links, lists, and the light/dark theme. Custom visuals — the WebGL water, the coastline illustration, and the glass cards — are CSS and a small WebGL2 shader, not a 3D library. The theme follows the operating system until someone toggles it, then it is stored as `watermark-color-mode`.

`Bibliography` in `src/components/Bibliography.tsx` is Ryan Lin's resources module. The source list is `src/scripting/sources.ts`.

## Honesty

Planned and in-progress work is labeled on the page. Move Your Car is research only and does not recommend a safe route. The hero animation is decorative. Empty evidence lines are empty because this page does not call a data provider.
