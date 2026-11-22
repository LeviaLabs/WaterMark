# Sign in with Agentboxd (WM-CLAUDE-005)

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
    F->>DB: take_attempt(state)  (DELETE ... RETURNING: single use)
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
- **Bound to the attempt.** An attempt row is single use (`DELETE … RETURNING`) and expires after 10 minutes. Its redirect URI must match the calling origin.
- **ID-token checks.** Only an ES256 signature from Agentboxd's JWKS is accepted.
  - `alg: none`, HS256, `crit`, an unknown `kid` and malformed tokens are rejected.
  - `iss` must match exactly and `aud` must equal the client_id.
  - `exp`, `iat` and `nbf` are checked with ±30 s tolerance, and `exp - iat` must be ≤ 300 s.
  - The `nonce` must match, `sub` and `jti` must be present, `https://agentboxd.com/claims/agent === true`, and `actor_type` must be `agent` if present.
- **Replay.** The `jti` is kept in a Postgres table until `exp`, and that table is shared by every function instance.
- **No open redirect.** The browser never supplies the redirect URI: the function picks the registered one for the request's `Origin`.
  - The browser follows `authorizeUrl` only if it is `https://id.agentboxd.com/authorize` with this attempt's state and challenge.
  - After sign-in the browser always lands on `/login`.
- **CORS and origin.** Every call needs an `Origin` listed in `WATERMARK_ALLOWED_ORIGINS`; anything else gets 403.
  - Request bodies are capped at 4 KB.
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

## Deploy (needs approval; not done)

```sh
npx supabase@3.2.0 db push --remote=gcfcpmqeegywnddusgfl   # applies 20261122150000_agentboxd_auth.sql only if it is the one pending migration
npx supabase@3.2.0 secrets set --remote=gcfcpmqeegywnddusgfl --env-file <file with AGENTBOXD_CLIENT_ID and AGENTBOXD_REDIRECT_URIS> --yes
npx supabase@3.2.0 functions deploy agentboxd-auth --remote=gcfcpmqeegywnddusgfl --no-verify-jwt --use-api --yes
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
