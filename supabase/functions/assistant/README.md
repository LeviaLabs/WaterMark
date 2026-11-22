# Flood assistant function

`POST /functions/v1/assistant`: a fixed proxy from the WaterMark map's chat to Google Gemini
(AI Studio API). The browser sends the conversation; this adds the system instructions and the
tool declarations (`core.mts`), calls Gemini with the server-held key and returns the model's next
turn. Tools run in the browser with the map's own data services
(`WaterMark/src/services/assistant/tools.ts`) and their results come back in the next request.

## Environment variable names (values never go in the repo)

| Name | Where | Purpose |
| --- | --- | --- |
| `WATERMARK_GEMINI_API_KEY` | Supabase function secret; `WaterMark/.env.local` for `npm run dev` | Google AI Studio key |
| `WATERMARK_ALLOWED_ORIGINS` | Supabase function secret (shared with `watermark-v1`) | Exact frontend origins allowed by CORS |
| `VITE_WATERMARK_ASSISTANT_URL` | Frontend build (Amplify) | `https://<project-ref>.supabase.co/functions/v1/assistant` |

## Run locally

`npm run dev` in `WaterMark/` serves the same code at `/api/assistant` (see `vite.config.ts`),
reading `WATERMARK_GEMINI_API_KEY` from the git-ignored `WaterMark/.env.local`. Nothing else is
needed; `VITE_WATERMARK_ASSISTANT_URL` can stay unset in development.

## Deploy (not done yet)

```powershell
./supabase/node_modules/.bin/supabase.cmd secrets set WATERMARK_GEMINI_API_KEY=<key>
./supabase/node_modules/.bin/supabase.cmd functions deploy assistant
```

Then set `VITE_WATERMARK_ASSISTANT_URL` in the Amplify build. Without it, a production build shows
"The assistant isn't set up on this server yet" instead of calling anything.

## Behavior and limits

- Models, tried in order when one is busy (503), out of quota (429) or retired (404): see `MODELS`
  in `core.mts`. The free AI Studio tier has small per-model quotas; one question takes 2 to 4 calls.
- Requests are capped (40 turns, 120 000 characters, 4 000 characters of page context); unknown
  tools and part types are dropped, so a client cannot add tools or system instructions.
- Logs carry the upstream status and Google's error message only, never the key or the conversation.
- `verify_jwt = false` (public map, no login), like `watermark-v1`. There is no per-user rate limit
  yet; a public deployment should add one, or a quota alert on the Google project.
