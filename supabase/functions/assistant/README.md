# Flood assistant function

`POST /functions/v1/assistant` proxies the map chat to Google Gemini (AI Studio API). The browser
sends the conversation. This function adds the system instructions and the tool declarations
(`core.mts`), calls Gemini with the server-held key, and returns the model's next turn. Tools run
in the browser (`WaterMark/src/services/assistant/tools.ts`). Their results come back on the next
request.

Those results, and the page-context string, are **untrusted user-supplied data**. A modified
client can fabricate them. They are size-capped, labeled, and sent as conversation data. They are
not copied into the system instruction. This function does not re-fetch the sources and is not a
server-verified flood report. The map says that in the chat panel.

**This function is not deployed.** Do not deploy it from this change. Applying the migration and
setting the secret are separate, reviewed steps. Rotate `WATERMARK_GEMINI_API_KEY` before the
endpoint is made public if that key has been shared outside the secret store.

## Environment variable names (values never go in the repo)

| Name | Where | Purpose |
| --- | --- | --- |
| `WATERMARK_GEMINI_API_KEY` | Supabase function secret; `WaterMark/.env.local` for `npm run dev` | Google AI Studio key |
| `WATERMARK_ALLOWED_ORIGINS` | Supabase function secret (shared with `watermark-v1`) | Exact frontend origins allowed by CORS |
| `WATERMARK_ASSISTANT_DISABLED` | Supabase function secret, or `WaterMark/.env.local` for dev | `1`, `true`, `yes`, or `on` makes every POST return 503 `DISABLED` and does not call Gemini |
| `SUPABASE_URL`, service-role key | Injected into the Edge Function | Calls `watermark_take_assistant_budget`. Names only; the function reads `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_SECRET_KEYS`, or `WATERMARK_SUPABASE_SECRET_KEY` |
| `VITE_WATERMARK_ASSISTANT_URL` | GitHub Actions repository **variable** on the Pages build | `https://<project-ref>.supabase.co/functions/v1/assistant` |

Production hosting is **GitHub Pages** at `https://watermark.works`, built by
`.github/workflows/deploy-pages.yml`. That workflow passes `VITE_WATERMARK_ASSISTANT_URL` into
`npm run build`. When the variable is empty, a production build does not call the function. The
panel says the assistant is not set up yet.

`npm run dev` serves the same guard at `/api/assistant` and does not need
`VITE_WATERMARK_ASSISTANT_URL`. Its budget is in-memory for that one process. The public function
uses Postgres and **does not call Gemini** when `SUPABASE_URL` or the service-role key is missing,
or when the budget RPC fails.

## Abuse controls

CORS and `verify_jwt = false` do not stop a script or a direct HTTP client. The public map stays
usable without a login, so the function does not require a Supabase JWT. The controls that do
stop a client are:

- **Per client and global caps**, in `watermark_take_assistant_budget` (migration
  `20261122181132_watermark_assistant_budget.sql`). Same table and atomic upsert as
  `watermark_take_budget`, with `assistant:` bucket names so the two counters do not spend each
  other. The argument is a 32-character hex digest of the UTC day and the gateway client address
  (`x-forwarded-for`, then `cf-connecting-ip`, then `x-real-ip`). The raw address is not stored.
  Limits: **12 / minute** and **80 / UTC day** for that digest, and **400 / UTC day** for every
  caller. Over the cap the function returns 429 `RATE_LIMITED` and does not call Gemini.
- **Emergency stop.** `WATERMARK_ASSISTANT_DISABLED` as above, or a row
  `bucket = 'assistant:disabled'` with a future `expires_at` (use `infinity`). Both return 503
  `DISABLED` and do not call Gemini. Delete the row to turn the database switch off.
- **Bounded body.** At most 160 000 bytes, and the read gives up after 5 seconds. Larger or slower
  bodies return 400 `INVALID_REQUEST`.
- **Bounded Gemini call.** One 45 second deadline covers every model attempt and reading the
  response body (at most 1 000 000 bytes). A 429 or a quota / `RESOURCE_EXHAUSTED` error stops the
  model list instead of trying the rest.

A client or day cap is 429. The kill switch is 503. A budget check that cannot run is 503
`NOT_CONFIGURED` (fail closed).

The address hash is only as trustworthy as the platform's client-IP header. It slows the client
the gateway identifies. It is not an account id.

## Run locally

`npm run dev` in `WaterMark/` reads `WATERMARK_GEMINI_API_KEY` from the git-ignored
`WaterMark/.env.local`. Set `WATERMARK_ASSISTANT_DISABLED=1` there to make the dev route return
503. Nothing is deployed by running the dev server.

## Behavior and limits

- Models, tried in order when one is busy (503) or retired (404): see `MODELS` in `core.mts`.
  Quota errors do not move on to the next model.
- Conversations are capped (40 turns, 120 000 characters, 4 000 characters of page context,
  12 000 characters per tool result). Unknown tools and part types are dropped.
- Logs carry the upstream status and a short error message only, never the key, the conversation,
  or the client address.
