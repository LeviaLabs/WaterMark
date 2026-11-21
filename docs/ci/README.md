# Frontend CI

Quality gates for the Vite + React app in `WaterMark/`. The workflow is `.github/workflows/frontend-ci.yml`. It does not build, test, or deploy the backend.

## What is checked

The workflow runs on every pull request and on every push to `main`. It requests `contents: read` only. A second run for the same ref cancels the in-progress run.

There is no paths filter. The frontend lives in `WaterMark/`, but skipping other changes is not clearly safe: a required check that never starts on a docs-only pull request would stay pending. The job is small, so it runs every time.

| Step | On current `main` | Command |
| --- | --- | --- |
| Install | Runs | `npm ci` against `WaterMark/package-lock.json` |
| Typecheck | Runs | `npx tsc --noEmit -p tsconfig.app.json` and `npx tsc --noEmit -p tsconfig.node.json` |
| Lint | Runs | `npm run lint` (`eslint .`) |
| Build | Runs | `npm run build` (`tsc -b && vite build`) |
| Test | Skipped | `npm test` only when `package.json` has a `test` script |

Node is **22**. The repo has no `.nvmrc` and the app `package.json` has no `engines` field. The lockfile is the hint: `@astryxdesign/cli` requires `node >= 22.13.0`, and ESLint 10 accepts `^22.13.0` or `>= 24`. Node 20 does not satisfy that floor. `actions/setup-node` is set to major version `22`, which installs a current 22.x release (past 22.13). `@types/node` is `^24`; that is a type package, not the runtime the workflow uses. Node 24 also satisfies the lockfile engines if the team later standardizes on it.

The package manager is **npm**. `package-lock.json` is the only lockfile. The setup step caches npm with `cache-dependency-path: WaterMark/package-lock.json`. Install uses `npm ci`, so it fails if the lockfile is missing or out of date.

`actions/checkout` and `actions/setup-node` are pinned to major version 7.

### Typecheck

There is no `typecheck` script. The root `tsconfig.json` is a solution file: `"files": []` plus project references. `npx tsc --noEmit -p tsconfig.json` exits 0 and checks **zero** files, so the workflow does not use it.

At runtime the job reads `package.json` with `node -e`:

1. If `scripts.typecheck` is set, it runs `npm run typecheck`.
2. Otherwise it runs `npx tsc --noEmit -p <file>` for every `tsconfig*.json` that actually includes source. Today those are `tsconfig.app.json` (`src/`) and `tsconfig.node.json` (`vite.config.ts`).
3. If the only config is an empty solution file, it runs `npx tsc -b --pretty false` so the references are still checked.
4. If there is no script and no tsconfig, the step does not pass quietly. It prints `::warning::` and writes `SKIPPED: no typecheck script and no tsconfig` to the job summary.

`npm run build` runs `tsc -b` again before Vite. The separate typecheck step is there so a type error is visible even if the build step is later changed.

### Lint and build

Lint runs because `scripts.lint` exists (`eslint .`) and `eslint.config.js` exists. If the script is removed but an ESLint config remains, the step runs `npx eslint .`. If both are gone, it writes `SKIPPED: no lint script and no eslint config`.

Build runs `npm run build` when that script exists. If it is removed, the step writes `SKIPPED: no build script in package.json`.

The current app does not read `import.meta.env` or any `VITE_*` variable, and there is no `.env.example`. The workflow sets no environment variables and uses no secrets. If a later change needs `VITE_*` names at build time, add obviously fake placeholders in the workflow. Do not put real keys, tokens, or project URLs in the workflow file.

### Test

`WaterMark/package.json` has no `test` script. The test step writes:

```text
::warning::SKIPPED: no test script in package.json
SKIPPED: no test script in package.json
```

The step exits 0 after that warning so a missing script does not fail every pull request. It is not a silent pass: the annotation and the job summary both say `SKIPPED`. When a `test` script is added, the same workflow runs `npm test` on the next push or pull request. No edit to the workflow is required.

## How to run it locally

Use Node 22.13 or newer. These results were recorded with Node v22.23.4 and npm 10.9.9.

```bash
cd WaterMark
npm ci
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.node.json
npm run lint
npm run build
```

There is nothing to run for tests until a `test` script exists. `npm test` today fails with `Missing script: test`.

## Local results on `main`

Recorded on commit `4d020c947cf0160f07ad342376840e1a98f71b84` (the `main` this branch was created from), in `WaterMark/`, before any workflow files were added.

| Step | Result |
| --- | --- |
| `npm ci` | Pass. Added 279 packages, audited 280, found 0 vulnerabilities. |
| `npx tsc --noEmit -p tsconfig.app.json` | Pass. Exit 0. |
| `npx tsc --noEmit -p tsconfig.node.json` | Pass. Exit 0. |
| `npx tsc -b --pretty false` | Pass. Exit 0. This is the typecheck half of `npm run build`. |
| `npx tsc --noEmit -p tsconfig.json` | Exit 0, but `--listFilesOnly` lists 0 files. Not used as a gate. |
| `npm run lint` | Pass. Exit 0, no eslint output. |
| `npm run build` | Pass. `tsc -b` then Vite 8.3.8. A direct run built in 594ms. Replaying the workflow script built in 679ms. |
| `npm test` | Skipped. No `test` script in `package.json`. |

No existing check failed, so no step is marked `continue-on-error`.

## What this workflow does not cover

These are outside the frontend job. None of them have a CI workflow yet.

- **Supabase Edge Functions / Deno.** `main` has no `supabase/functions/` tree and no `deno.json`.
- **PostgreSQL / pgTAP.** `main` has no `supabase/migrations/` tree and no SQL tests.
- **Python.** `scripts/watermark_data.py` is a standard-library data pull (FloodNet and NFIP). It is not installed or run here.
- **End-to-end tests.** No browser runner is configured.
- **Accessibility checks.** No axe or similar step is configured.
- **Deploy.** Amplify, AWS, and Supabase project settings are untouched. This workflow does not deploy.

## Backend CI after WM-CODEX-001

Add backend CI in a **separate** workflow after Codex's WM-CODEX-001 is on `main`. Do not point this frontend workflow at an unmerged branch.

Recommended shape:

- Use the Supabase CLI against a **local** database started in the job. Apply the reviewed migrations from that branch.
- Run **pgTAP** for the SQL tests that land with the schema.
- Run `deno test` and `deno check` for Edge Functions.
- Give that workflow its own `paths` filters (`supabase/**`, and the Deno config files that ship with it) so it does not run on frontend-only changes.
- Keep production secrets out of the workflow. Local Supabase defaults are enough for CI. Do not copy hosted database URLs, service-role keys, or provider tokens into GitHub Actions.

Until that branch merges, there is no backend tree on `main` to test.
