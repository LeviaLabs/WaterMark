# MojoAuth sign-in (WM-CLAUDE-002)

Owner: Decong. Branch: `feat/decong-mojoauth-login`, stacked on PR #1 (`feat/decong-auth-i18n`).

Sign-in is optional. The map, alerts and forecasts never wait for it.

## Flow

```mermaid
sequenceDiagram
    participant U as User
    participant P as AuthPage /login (browser)
    participant M as api.mojoauth.com
    participant F as Edge Function auth-verify
    U->>P: email
    P->>M: POST /users/emailotp (x-api-key: public key)
    M-->>U: email with one-time code
    M-->>P: state_id
    U->>P: code
    P->>M: POST /users/emailotp/verify (OTP, state_id)
    M-->>P: oauth.access_token
    P->>F: POST { token }
    F->>M: POST /token/verify (x-api-key, Bearer token)
    M-->>F: isValid, user
    F-->>P: { account: { id, displayName, expiresAt } }
    P->>P: signed in; token kept in sessionStorage "wm-auth"
```

Endpoints come from MojoAuth's OpenAPI spec (`https://mojoauth.com/docs/api/mojoauthapi.yaml`, read 2026-11-21).
MojoAuth's API sends `Access-Control-Allow-Origin: *` for these routes (checked with a preflight on 2026-11-21).

## Files

```text
WaterMark/
├── .env.example                       VITE_MOJOAUTH_API_KEY, VITE_WATERMARK_AUTH_VERIFY_URL
├── src/components/pages/AuthPage.tsx  Ryan B's /login + /signup page: email -> code -> signed in / sign out
├── src/components/layout/NavBar.tsx   shows Log in, or the account + Sign out
├── src/services/auth/appAuth.ts       the app's one MojoAuth adapter (from env)
├── src/services/auth/mojoAuth.ts      MojoAuth calls, backend check, AuthAdapter
└── tests/mojoAuth.test.ts
supabase/
├── functions/auth-verify/index.ts     Deno.serve wrapper (reads env)
├── functions/auth-verify/verify.ts    verification + CORS, no Deno globals
└── tests/auth-verify/verify.test.ts
```

Changed from PR #1: `AuthAdapter.signIn(providerToken)` now takes the token; `useAuth().signIn` returns the
verified state; `AuthStatus` links to the login page (`loginHref`, default `/login`) instead of a button.

`AuthPage.tsx` is Ryan B's page; his PR #7 review asked for the flow to live there. Its layout, city scene and
`auth-*` styling are unchanged; only the form logic and the button copy ("Email me a code") changed. `/signup` runs
the same flow because MojoAuth creates the account on first sign-in.

`App.tsx` mounts `<AuthProvider adapter={authAdapter}>` around the router (Ryan approved on PR #7).
`src/services/auth/appAuth.ts` builds the one adapter from the Vite env (guest-only without it).
`NavBar` reads `useAuth()`: Log in / Sign up for guests, the account name (email before "@") and
Sign out when signed in, and neither while a stored session is being re-checked, so it never flashes "Log in".

No new npm dependencies. Nothing in `main.tsx`, the map or Codex's `supabase/` files changed.

### Sign-in methods

MojoAuth's REST API (browser-safe, public key only) offers email OTP, magic link and phone (SMS) OTP. Only email OTP
is built and tested. Magic link needs a redirect URL in the dashboard; SMS must be enabled and may cost money.
Passkeys are not in the REST API: they need MojoAuth's hosted OIDC page and the API secret on a server, so there is
no passkey button.

## What you must configure by hand

### MojoAuth dashboard

Exact menu labels could not be checked without a signed-in dashboard; these follow MojoAuth's docs.

1. Create a project (dashboard: `https://mojoauth.com`, sign in). Website URL: `http://localhost:5173` for testing.
2. Authentication methods: turn on **Email OTP** (one-time passcode). Magic link, phone OTP and passkeys are not used.
3. Allowed domains / whitelist, if the dashboard has it: add `http://localhost:5173` and `https://watermark.works`.
   The live test worked; MojoAuth's API answers browser requests from any origin.
4. **Overview -> API Credentials**: copy the **API Key / Client ID** value. The same value goes in both env files.
   The API Secret and the Authorization Endpoints are not used by this code. Do not share the key or secret in chat or commits.
5. Optional: email template branding and languages. The page asks MojoAuth for `en`, `es`, `zh`, `ru` or `hi`; whether each is supported is unverified.

Free tier per MojoAuth's docs: 25,000 monthly active users. Documented rate limits: OTP APIs 50 requests/minute, token APIs 200/minute.

### Local development env

Git-ignored files (values never in git):

```text
WaterMark/.env.local         VITE_MOJOAUTH_API_KEY=<api key>
                             VITE_WATERMARK_AUTH_VERIFY_URL=http://127.0.0.1:8000
supabase/functions/.env      MOJOAUTH_API_KEY=<same api key>
                             WATERMARK_ALLOWED_ORIGINS=http://localhost:5173
```

Without both frontend values the page shows "Sign-in is not set up" and the app stays guest-only.

## Production deployment (`watermark-dev`)

Codex owns the Supabase project setup. `auth-verify` deploys into the same project as `watermark-v1`.

**Deployed 2026-11-22** to `watermark-dev` (ref `gcfcpmqeegywnddusgfl`, us-east-1), commit `83223c5`, version 1:
`https://gcfcpmqeegywnddusgfl.supabase.co/functions/v1/auth-verify`. Only `auth-verify` was deployed; `watermark-v1`,
the database and migrations were not touched. The frontend production deploy has not happened.

### What is already in the repo

- `supabase/config.toml`: `[functions.auth-verify] verify_jwt = false`. The caller sends a MojoAuth token, not a
  Supabase JWT; the function verifies it itself. (One added stanza in Codex's file; please review.)
- `supabase/.env.example`: adds the names `MOJOAUTH_API_KEY`, `MOJOAUTH_ISSUER`.
- `auth-verify` imports nothing, uses no database and no Supabase key. It needs only the secrets below.

### Function secrets (Supabase project)

| Name | Value | Notes |
|---|---|---|
| `MOJOAUTH_API_KEY` | MojoAuth "API Key / Client ID" | The same public key the browser uses. Also the required token `aud`. |
| `WATERMARK_ALLOWED_ORIGINS` | on `watermark-dev`: `http://localhost:5173`, `https://watermark.works`, `https://www.watermark.works` | **Shared with `watermark-v1`; set by Codex, not changed here.** Exact origins only, no wildcards. A real production project should drop localhost. |
| `MOJOAUTH_ISSUER` | `https://api.mojoauth.com` | Optional; set on `watermark-dev`. |

Never set: the MojoAuth **API Secret**, or any Supabase service-role / secret key for this function.

Set only the MojoAuth names, from a git-ignored file holding just those two lines, so values stay out of shell
history and chat and the shared `WATERMARK_ALLOWED_ORIGINS` is not overwritten (Supabase CLI 3.2.0 syntax):

```powershell
npx supabase@3.2.0 secrets set --remote=gcfcpmqeegywnddusgfl --env-file <path to the 2-line file> --yes
```

### Deploy (needs approval)

```powershell
npx supabase@3.2.0 functions deploy auth-verify --remote=gcfcpmqeegywnddusgfl --no-verify-jwt --use-api --yes
```

Always name the function. Without a name the CLI deploys every function, and `--prune` would delete others.
`config.toml` also turns off the Supabase JWT check for `auth-verify`. The function verifies MojoAuth tokens itself.
Its only success path requires MojoAuth `isValid: true`, an unexpired token, a valid `nbf`, and `aud` = `MOJOAUTH_API_KEY`.

### Frontend build env (to confirm with Ryan B)

Cloudflare Pages (`*.watermark-a4q.pages.dev`) builds every PR. No Amplify config is in the repo. On 2026-11-22,
`watermark.works` had no A record (DNS at name.com) and `www.watermark.works` did not exist, so neither host
served the production domain yet. Set these in whichever host Ryan confirms, for Production builds:

```text
VITE_MOJOAUTH_API_KEY=<api key>
VITE_WATERMARK_AUTH_VERIFY_URL=https://gcfcpmqeegywnddusgfl.supabase.co/functions/v1/auth-verify
```

Cloudflare preview URLs (`https://<branch>.watermark-a4q.pages.dev`) are not in `WATERMARK_ALLOWED_ORIGINS`, so
sign-in fails there by design unless Codex and the team agree to add an exact preview origin.

These are baked in at build time. A production build ignores an `http://` or localhost verify URL and stays
guest-only, so the deployed site can never depend on a developer machine.

### MojoAuth dashboard

Add `https://watermark.works` (and any other production origin) to the allowed domains, if the dashboard has that setting.

### Hosted end-to-end check

```powershell
$env:AUTH_VERIFY_URL = 'https://gcfcpmqeegywnddusgfl.supabase.co/functions/v1/auth-verify'
$env:AUTH_VERIFY_ORIGIN = 'https://watermark.works'
$env:AUTH_VERIFY_LOCALHOST_ALLOWED = '1'   # watermark-dev keeps localhost; omit for a production project
npx --yes deno@2.9.6 run --allow-env=AUTH_VERIFY_URL,AUTH_VERIFY_ORIGIN,WATERMARK_TEST_TOKEN,AUTH_VERIFY_ALLOW_HTTP,AUTH_VERIFY_LOCALHOST_ALLOWED --allow-net=gcfcpmqeegywnddusgfl.supabase.co supabase/tests/auth-verify/hosted.ts
```

It checks:
- the URL and origin are HTTPS and not localhost;
- the site origin gets CORS (and localhost, as configured), while other sites and `Origin: null` get 403;
- a POST from another site gets 403;
- GET returns 405;
- a malformed body, a missing token, a non-JWT and an over-long token return 400;
- forged, expired, not-yet-valid and wrong-audience tokens return 401;
- responses carry `no-store`.

Result on 2026-11-22 against `watermark-dev`: 18 of 18 passed.

Then sign in on the deployed site. Optionally, copy `sessionStorage["wm-auth"]` into
`$env:WATERMARK_TEST_TOKEN` and rerun: it checks that a real token returns only `id`, `displayName` and
`expiresAt`. Clear the variable afterwards.

### Backend authorization (checked in the repo, 2026-11-22)

- `watermark-v1` is a public, read-only data API (`verify_jwt = false`, GET routes plus POST `/area-summary`).
  It uses the Supabase secret key only on the server.
- Every table has RLS with a `service_role`-only policy, and `anon`/`authenticated` grants are revoked.
  `watermark_private` and the RPCs are `service_role` only. So the browser cannot read or write the database directly.
- No backend endpoint needs a signed-in user yet. When one does (saved places, alert preferences), it must verify
  the MojoAuth token server-side the same way (`verifyMojoAuthToken` in `auth-verify/verify.ts`), never trust a
  user id sent by the browser, and store rows under RLS.

## How to test

Unit tests (no network):

```powershell
cd WaterMark; npm test
node --test supabase/tests/auth-verify/verify.test.ts
```

Live, locally: run the function with Deno on port 8000, then the app.

```powershell
$env:MOJOAUTH_API_KEY = '<api key>'; $env:WATERMARK_ALLOWED_ORIGINS = 'http://localhost:5173'
npx --yes deno@2.9.6 run --allow-env=MOJOAUTH_API_KEY,WATERMARK_ALLOWED_ORIGINS,MOJOAUTH_ISSUER --allow-net=0.0.0.0:8000,api.mojoauth.com supabase/functions/auth-verify/index.ts
```

```powershell
cd WaterMark; npm run dev   # with .env.local: VITE_WATERMARK_AUTH_VERIFY_URL=http://127.0.0.1:8000
```

Open `http://localhost:5173/login` (or `/signup`), enter your email, type the code from the email. Expect "You are signed in as ...".
Reload: still signed in (the token is re-verified). Close the tab: signed out. "Sign out" clears it at once.

## Security notes

- The browser holds only MojoAuth's public API key. That key lets anyone request codes for any email from an allowed domain;
  MojoAuth's domain whitelist and rate limits are the protection.
- The app treats a user as signed in only after `auth-verify` gets `isValid: true` from MojoAuth, the token is not expired,
  and its `aud` claim equals the function's `MOJOAUTH_API_KEY`. MojoAuth sets `aud` to the project's API key, so a token
  from a different MojoAuth project is rejected even if MojoAuth calls it valid.
- The function never logs or returns the token or email beyond `{ id, displayName, expiresAt }` to the same caller.
  CORS allows only `WATERMARK_ALLOWED_ORIGINS`; an empty list rejects every browser origin.
- The token sits in `sessionStorage` (tab-scoped). Any XSS on the page could read it, as with any SPA token.
  The refresh token is discarded, so a session lasts until the access token expires.
- Sign-out is local: MojoAuth's REST spec has no token revocation endpoint.

## Open items

- Live sign-in was completed locally on 2026-11-21 (Deno-served `auth-verify`, Vite dev), first on the old dev page and
  again on `/login` after the move. On 2026-11-22 a real sign-in ran against the hosted `watermark-dev` function, from
  local Vite.
- A live token showed `iss` = `https://api.mojoauth.com`, `aud` = the project API key, a 60-minute lifetime, and claims
  `identifier, email, user_id, auth_type, token_type, aud, exp, jti, iat, iss, nbf, sub`. Setting `MOJOAUTH_ISSUER` to that
  issuer is optional; the `aud` check already ties tokens to this project.
- **Remaining before a public launch:**
  - Ryan has to confirm the frontend host and set the two `VITE_*` production variables there.
  - `watermark.works` DNS has to point at that host.
  - `https://watermark.works` has to be added in MojoAuth, if the dashboard has an allowed-domains setting.
  - A sign-in has to be run on the deployed site itself.
- No profile table: saving places needs a migration with RLS, coordinated with Codex.
- Nothing in the app needs an account yet (`savedPlaces`, `notificationPrefs` are planned).
