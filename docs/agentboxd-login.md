# Sign in with Agentboxd (WM-CLAUDE-005)

## WM-CODEX-007 verification (2026-11-22)

WaterMark is registered in the owner's existing Shakehand workspace as an enabled **public**
app with **pairwise** subjects, `openid profile`, homepage `https://watermark.works`, and only
`https://watermark.works/agentboxd-callback.html` as redirect. There is no client secret.
The GitHub variable `VITE_AGENTBOXD_AUTH_URL` is configured. With explicit owner approval,
the authentication migration and two Agentboxd settings are applied, and **agentboxd-auth v1**
is ACTIVE at `https://gcfcpmqeegywnddusgfl.supabase.co/functions/v1/agentboxd-auth`.
The deployed source is security commit `87351370dc44b0c1871acbfc6eb3736a24036733`.
Registration and backend activation do not establish a successful browser sign-in.

Hosted checks passed **14/14** in the existing suite and **15/15** in the bounded supplementary
suite: PKCE mismatch, state replay, unknown sessions, malformed/oversized requests, exact CORS,
the shared start limit (ten admitted, then HTTP 429), an anonymous RPC denial, and preservation
of existing endpoints. One forged-IP-header probe was denied with HTTP 403; that sample is not
proof of every gateway trust property. A harness initially required 429 for that denial; its
expectation was corrected to accept either rejection status, with initial evidence retained.
The hosted catalog verifies RLS on all three new tables, browser CRUD/EXECUTE denial and six
service-only security-invoker RPCs. Security advisors report no warnings/errors. Migration dry
run is now up to date; PR #21's migration remains absent.

Existing `auth-verify` and `watermark-v1` code hashes, entrypoints, deployment timestamps and JWT
settings are unchanged. Their metadata version counters advanced during secret updates; no
deployment of either function was performed. The Gemini key is configured on a separate Free
tier Google project and verified using model listing only. PR #26 subsequently added assistant
abuse controls; its eight guard tests pass locally. Its separate budget migration and public
function remain undeployed pending their own hosted verification and authorization.

PR #20 remains unmerged; independent review and the frontend release findings below remain
pending. Production callback routing, real consent, session restoration, logout, valid human
OTP and guest map browser behavior are still UNVERIFIED in this task.

Security corrections in this revision:

- Request bodies are streamed with a **4096-byte / 5-second** limit, including absent or false
  Content-Length; malformed UTF-8 is rejected. Cancellation cannot extend the deadline.
- Provider responses are streamed with a **65536-byte** limit within the remaining **8-second**
  fetch deadline; RPC responses have **16384-byte / 4-second** bounds. Errors never echo bodies.
- Consuming an attempt marks it used atomically, retaining its start for rate accounting until
  expiry. Serialized database admission enforces the shared 10 starts/client/minute and 10000-row
  cap under concurrency. Rate accounting also applies when discovery fails.
- Supplemental ingress limits apply before body/provider work: 60 requests/client/minute and
  600 requests/minute **per function instance**, with a bounded client map. These are not a global
  gateway limit. Client-IP enforcement depends on the gateway supplying a trustworthy address;
  that behavior remains a hosted verification item. CORS is not authorization.
- Consumed ID-token identifiers remain through `exp + 30 seconds` (at least one minute), covering
  the verifier's clock tolerance. Session and attempt replay rules remain server enforced.

Verified locally: **67/67** Node authentication tests (50 Agentboxd, 17 MojoAuth), the existing
**80/80** backend Deno tests (including eight newly merged assistant guard tests), **181/181** frontend tests, Edge typecheck/lint and frontend
TypeScript/ESLint/build. An isolated PostgreSQL 17 container verified the migration, RLS/grants,
expiry, revocation, replay retention, and concurrent admission/single-use callbacks.
Astryx doctor reports an existing generated-theme mismatch; npm's production dependency audit
reports [MapLibre XSS advisory GHSA-jrc7-96c5-q579](https://github.com/advisories/GHSA-jrc7-96c5-q579).
These are separate frontend release findings, not resolved or waived by passing auth tests.

**Deployment guard:** the hosted project also has migration `20261122064904_watermark_fema_source`
from WM-CODEX-003, which this branch does not contain. Do not repair history or run an unguarded
push from this checkout. The prepared deployment directory contains the exact six applied
migrations plus `20261122150000_agentboxd_auth.sql`, and only `agentboxd-auth` and its required
shared configuration module. A dry run against `gcfcpmqeegywnddusgfl` lists only the Agentboxd
migration. PR #21's `20261122170000_agentboxd_alert_inbox.sql` is absent. Recheck immediately
before approved deployment; stop if the pending set changes.

Hosted checks before deployment: homepage 200; callback 404 (missing, expected until PR #20 is
released); Agentboxd function 404; existing `watermark-v1/health` 200. `/map` answers the existing
GitHub Pages 404 SPA fallback; that HTTP result alone does not verify browser map behavior.
Do not claim production sign-in, restoration, logout or human-login regression passed yet.

AI agents sign in to WaterMark with their Agentboxd identity. People keep MojoAuth email codes
(see [mojoauth-login.md](mojoauth-login.md)). Guests keep every map and data layer.

Agentboxd is an OpenID Connect provider (issuer `https://id.agentboxd.com`). Its product for
this is called Shakehand. Sources, read on 2026-11-22:
[agent identity docs](https://agentboxd.com/docs/agent-identity),
[sign-in guide](https://agentboxd.com/guides/sign-in-with-agentboxd),
[Shakehand](https://agentboxd.com/shakehand), and the live
[discovery document](https://id.agentboxd.com/.well-known/openid-configuration).

## Choices

| Question | Choice | Why |
|---|---|---|
| Flow | Authorization code + PKCE (S256), `state`, `nonce` | Agentboxd requires all three for browser sign-in. Implicit and hybrid flows are not supported. |
| Client type | **Public** client, registered in the Shakehand dashboard | WaterMark's frontend is a static site on GitHub Pages. Agentboxd: "Browsers and mobile apps get a public client." There is no client secret anywhere. |
| Who exchanges the code | The `agentboxd-auth` Supabase Edge Function | The token endpoint does allow CORS (`*`) and `none` auth, so a browser could exchange the code itself. Doing it server-side instead lets the function own `state` and `nonce`, verify the ID token against the JWKS, record the `jti` in a shared store, and issue WaterMark's own session. |
| Identity key | `agentboxd:<sub>`, with a pairwise `sub` | `sub` is stable for WaterMark and different at every other app. The `email` scope is not requested. |
| Scopes | `openid profile` | Only `profile` is needed, for a display name. |
| Session | Opaque 256-bit token, 60 minutes, stored as a SHA-256 hash in Postgres | Agentboxd ID tokens live at most 5 minutes, work once, and come with no refresh token, so WaterMark has to keep its own session. |

## Flow

```mermaid
sequenceDiagram
    participant B as Browser (watermark.works)
    participant F as agentboxd-auth (Supabase)
    participant DB as Postgres (service_role)
    participant A as id.agentboxd.com
    B->>B: PKCE verifier (sessionStorage)
    B->>F: POST /start {codeChallenge}
    F->>A: discovery (cached 1 h)
    F->>DB: begin(state, nonce, challenge, redirect) + rate limit
    F-->>B: {authorizeUrl, state}
    B->>B: check URL is id.agentboxd.com/authorize with our state + challenge
    B->>A: GET /authorize (owner approves, picks an agent)
    A-->>B: 302 /agentboxd-callback.html?code&state&iss
    B->>B: static page saves query, location.replace('./login')
    B->>B: /login: state must equal this tab's attempt
    B->>F: POST /finish {state, code, codeVerifier, iss}
    F->>DB: take_attempt(state)  (atomic consumed marker: single use)
    F->>F: iss == issuer (RFC 9207), S256(verifier) == challenge
    F->>A: POST /token (authorization_code, client_id, code_verifier)
    A-->>F: id_token
    F->>A: JWKS (cached; re-fetched on unknown kid)
    F->>F: ES256 signature, iss, aud, iat/exp ±30 s, exp-iat ≤ 300, nonce, agent claim
    F->>DB: consume_jti(jti)  (primary key: replay = rejected)
    F->>DB: create_session(sha256(token))
    F-->>B: {session, account: {id: agentboxd:<sub>, displayName, kind: agent}}
    B->>F: POST /session on reload, POST /logout on sign-out
```

## Files

```text
WaterMark/
├── public/agentboxd-callback.html     # exact redirect URI; a real file, so Pages serves 200
├── src/services/auth/agentboxd.ts     # PKCE, start, callback check, adapter, env config
├── src/services/auth/session.ts       # provider 'agentboxd', combineAdapters, agents: public features only
├── src/services/auth/appAuth.ts       # MojoAuth + Agentboxd adapters combined
├── src/components/pages/AuthPage.tsx  # Human sign-in / Agent sign-in / Guest
├── src/components/layout/NavBar.tsx   # "Agent · <name>", aria "AI agent account: …"
└── tests/agentboxd.test.ts            # 17 browser-side tests
supabase/
├── functions/agentboxd-auth/{index,flow,oidc,store}.ts
├── migrations/20261122150000_agentboxd_auth.sql   # new tables + RPCs only
├── tests/agentboxd-auth/flow.test.ts  # 39 server tests (real ES256 keys)
└── tests/agentboxd-auth/hosted.ts     # opt-in checks against a deployment
```

## Security controls

- **No secret in the browser.** It's a public client: the frontend holds only the function URL, and the client_id and redirect URIs are Supabase secrets.
- **PKCE S256.** The verifier is 32 random bytes and never leaves the tab until `/finish`. The function also checks it locally, so a wrong verifier never reaches Agentboxd.
- **`state` and `nonce`** are 256-bit random values from the server, stored server-side.
  - The browser also compares `state` with the attempt this tab started.
  - Any callback started elsewhere, or with no attempt in this tab, is refused before any network call.
- **Bound to the attempt.** An attempt row is consumed atomically once and expires after 10 minutes. Its redirect URI must match the calling origin. Consumed rows remain until expiry for rate-limit accounting.
- **ID-token checks.** Only an ES256 signature from Agentboxd's JWKS is accepted.
  - `alg: none`, HS256, `crit`, an unknown `kid` and malformed tokens are rejected.
  - `iss` must match exactly and `aud` must equal the client_id.
  - `exp`, `iat` and `nbf` are checked with ±30 s tolerance, and `exp - iat` must be ≤ 300 s.
  - The `nonce` must match, `sub` and `jti` must be present, `https://agentboxd.com/claims/agent === true`, and `actor_type` must be `agent` if present.
- **Replay.** The `jti` is kept through `exp + 30 seconds` (at least one minute), and that table is shared by every function instance.
- **No open redirect.** The browser never supplies the redirect URI: the function picks the registered one for the request's `Origin`.
  - The browser follows `authorizeUrl` only if it is `https://id.agentboxd.com/authorize` with this attempt's state and challenge.
  - After sign-in the browser always lands on `/login`.
- **CORS and origin.** Every call needs an `Origin` listed in `WATERMARK_ALLOWED_ORIGINS`; anything else gets 403.
  - Request bodies are capped while streaming at 4096 bytes and five seconds.
  - Provider calls time out after 8 s, with no redirects and a 64 KB response cap.
  - Store calls time out after 4 s.
- **Rate limits.** `/start` allows 10 attempts per client IP hash per minute, with at most 10,000 pending attempts overall.
  - Agentboxd also rate-limits `/authorize` and codes.
  - `/finish` needs a live attempt.
- **Logs** contain only the HTTP status and an error code: never a code, token, verifier, nonce, session or claim.
- **Least privilege.** The new tables live in `watermark_private` with RLS and `service_role`-only policies and grants. Anon and authenticated roles can neither call the RPCs nor read the tables.
- **Agents get minimum access.** `canUse()` gives agents the public features only; `savedPlaces` and `notificationPrefs` stay for people. No admin, database or personal-data access, and no privileged scopes.
- **Session.** The browser keeps an opaque token in `sessionStorage`, not `localStorage`. The server stores only its SHA-256 hash. Logout deletes the row.

## GitHub Pages

- `/agentboxd-callback.html` is a static file, so GitHub Pages answers 200 at the exact redirect URI. It doesn't depend on the `404.html` SPA fallback.
- Its inline script copies the query to this tab's `sessionStorage` and calls `location.replace('./login')`. That keeps the code out of history and referrers (`<meta name="referrer" content="no-referrer">`).
- `./login` is relative, so it resolves to `/login` on `watermark.works` and to `/WaterMark/login` on `levialabs.github.io`.
- `/login`, `/signup` and `/map` keep using the existing `404.html` fallback from `deploy-pages.yml`.
- Register the exact URL `https://watermark.works/agentboxd-callback.html`. The `levialabs.github.io/WaterMark/...` URL would need its own registration and origin, so it isn't enabled.

## Configuration

Frontend (GitHub repository **variable**, a public value):

| Name | Value |
|---|---|
| `VITE_AGENTBOXD_AUTH_URL` | `https://gcfcpmqeegywnddusgfl.supabase.co/functions/v1/agentboxd-auth` |

`deploy-pages.yml` passes it to the build. A production build ignores an http or localhost URL.

Supabase secrets:

| Name | Value |
|---|---|
| `AGENTBOXD_CLIENT_ID` | client_id from Shakehand (public, but kept out of code) |
| `AGENTBOXD_REDIRECT_URIS` | `https://watermark.works/agentboxd-callback.html` (plus `http://localhost:5173/agentboxd-callback.html` for development) |
| `WATERMARK_ALLOWED_ORIGINS` | already set and shared with `watermark-v1` and `auth-verify`; unchanged |

`SUPABASE_URL` and the server credential are injected by Supabase. No `AGENTBOXD_CLIENT_SECRET` exists, because the client is public.

## Owner setup (Agentboxd dashboard)

1. Go to agentboxd.com → Shakehand → Register an app.
2. Choose type **Public app**. You can't change the type after registration.
3. Set the name to `WaterMark` and the homepage to `https://watermark.works`.
4. Add these redirect URIs, which must match exactly:
   - `https://watermark.works/agentboxd-callback.html`
   - `http://localhost:5173/agentboxd-callback.html` (development only)
5. Set allowed scopes to `openid profile`. Untick `email` and `workspace`.
6. Leave the subject type on **pairwise**. You can't change it after registration.
7. Copy the client_id and set it as `AGENTBOXD_CLIENT_ID`.
8. For testing, create a test inbox or identity and an API key with the **Sign in only** preset, limited to that inbox. Don't give the key whole-workspace access.

## Reproduce or update the deployment (explicit approval required)

```sh
npx supabase@3.2.0 db push --remote=gcfcpmqeegywnddusgfl --workdir <reviewed-deployment-directory> --dry-run --skip-vault
# Only after explicit approval and a dry run naming exactly 20261122150000_agentboxd_auth.sql:
npx supabase@3.2.0 db push --remote=gcfcpmqeegywnddusgfl --workdir <reviewed-deployment-directory> --skip-vault --yes
npx supabase@3.2.0 secrets set --remote=gcfcpmqeegywnddusgfl --env-file <file with AGENTBOXD_CLIENT_ID and AGENTBOXD_REDIRECT_URIS> --yes
npx supabase@3.2.0 functions deploy agentboxd-auth --remote=gcfcpmqeegywnddusgfl --workdir <reviewed-deployment-directory> --no-verify-jwt --use-api --yes
AGENTBOXD_AUTH_URL=https://gcfcpmqeegywnddusgfl.supabase.co/functions/v1/agentboxd-auth AGENTBOXD_AUTH_ORIGIN=https://watermark.works \
  npx --yes deno@2.9.6 run --allow-env=AGENTBOXD_AUTH_URL,AGENTBOXD_AUTH_ORIGIN --allow-net=gcfcpmqeegywnddusgfl.supabase.co supabase/tests/agentboxd-auth/hosted.ts
```

Before running `db push`, check `supabase migration list --remote=...` so that only this migration is pending.

## Tests

```sh
node --test supabase/tests/agentboxd-auth/flow.test.ts    # 39 server tests
cd WaterMark && npx vitest run                             # includes 17 Agentboxd browser tests
```

The migration was also applied to an in-memory Postgres (PGlite), which confirmed:
- the rate limit;
- single-use attempts;
- expiry;
- `jti` replay rejection;
- the session lifecycle;
- that anon and authenticated get permission denied.

## Known limitations

- A real hosted sign-in has not run. It needs the Shakehand registration above, which only the owner can do.
  - A local smoke test did reach the real `id.agentboxd.com/authorize`, which refused the unregistered test client as expected.
  - The same test reached the real `/token`, which refused a fake code. The UI showed an error and stored no session.
- One identity at a time: signing in as an agent signs the person out, and vice versa.
- Sessions last 60 minutes and don't renew. The agent signs in again, as Agentboxd intends.
- Agentboxd's per-inbox "turn sign-in off" stops new sign-ins but doesn't end a WaterMark session that already exists, which lasts up to 60 minutes. Calling `/introspect` would need a confidential client.
- Headless agent sign-in, where an agent posts its own token, isn't built. Only the browser button is.
