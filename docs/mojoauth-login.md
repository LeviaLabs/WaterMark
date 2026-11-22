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

### Supabase

No WaterMark Supabase project is visible to the connected Supabase account (only an inactive, unrelated project).

1. Create or choose the WaterMark project (team decision; Decong owns it per AGENTS.md).
2. Set function secrets yourself (values never in git):
   ```powershell
   supabase secrets set --project-ref <project-ref> MOJOAUTH_API_KEY=<api key> WATERMARK_ALLOWED_ORIGINS=http://localhost:5173
   ```
   Optional: `MOJOAUTH_ISSUER` to require an exact `iss` claim once a real token shows its value.
3. Deploy (needs your go-ahead; it is production infrastructure):
   ```powershell
   supabase functions deploy auth-verify --no-verify-jwt --project-ref <project-ref>
   ```
   `--no-verify-jwt` is required: the caller sends a MojoAuth token, not a Supabase JWT. The function does its own verification.
   After PR #4 merges, add this to `supabase/config.toml` (Codex's file) instead of the flag:
   ```toml
   [functions.auth-verify]
   verify_jwt = false
   ```

### Frontend env

Create the git-ignored `WaterMark/.env.local`:

```text
VITE_MOJOAUTH_API_KEY=<the same API key>
VITE_WATERMARK_AUTH_VERIFY_URL=https://<project-ref>.supabase.co/functions/v1/auth-verify
```

Without both values the page shows "Sign-in is not set up" and the app stays guest-only.

## How to test

Unit tests (no network):

```powershell
cd WaterMark; npm test
node --test supabase/tests/auth-verify/verify.test.ts
```

Live, without a hosted Supabase project: run the function with Deno on port 8000, then the app.

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
  again on `/login` after the move. Not yet run against hosted Supabase.
- A live token showed `iss` = `https://api.mojoauth.com`, `aud` = the project API key, a 60-minute lifetime, and claims
  `identifier, email, user_id, auth_type, token_type, aud, exp, jti, iat, iss, nbf, sub`. Setting `MOJOAUTH_ISSUER` to that
  issuer is optional; the `aud` check already ties tokens to this project.
- No profile table: saving places needs a migration with RLS, coordinated with Codex's PR #4.
- Nothing in the app needs an account yet (`savedPlaces`, `notificationPrefs` are planned).
