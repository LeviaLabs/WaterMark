# outlook-summary

`POST /functions/v1/outlook-summary`, body `{ "facts": { ... } }` (at most 8,000 characters of JSON).
Returns `{ "text", "model" }`, or `{ "code" }` with `NOT_CONFIGURED` (503), `INVALID_REQUEST` (400),
`RATE_LIMITED` (429, with `retry-after` when the provider gives one) or `MODEL_UNAVAILABLE` (502).

A short summary of a selected place's flood outlook, written by a cheap open-weight model. The outlook
itself (official NWS flood alerts, forecast rain and river against this place's history, and when floods
have come here) is worked out in the browser in `WaterMark/src/scripting/outlook.ts`. The model only
puts those figures into two or three sentences. The browser shows the summary only if every number in
it appears in the figures it sent (`isGrounded`) and it gives no all-clear such as "no flooding expected" (`isCautious`); the figures stay on screen either way.

## Configuration (names only)

| Variable | |
| --- | --- |
| `WATERMARK_SUMMARY_API_KEY` | Provider key. Required; without it the function answers `NOT_CONFIGURED` and the panel shows no summary. |
| `WATERMARK_SUMMARY_BASE_URL` | Any OpenAI-compatible API. Default `https://openrouter.ai/api/v1`. |
| `WATERMARK_SUMMARY_MODELS` | Comma-separated model ids tried in order. Default `google/gemma-3-12b-it`, `meta-llama/llama-3.1-8b-instruct`, `mistralai/mistral-small-3.2-24b-instruct` (about $0.05 per 1,000 summaries with Gemma). |
| `WATERMARK_ALLOWED_ORIGINS` | Shared with the other functions: exact frontend origins allowed by CORS. |

Frontend: `VITE_WATERMARK_SUMMARY_URL` (the deployed function URL). In `npm run dev` the Vite server serves
the same code at `/api/outlook-summary`, reading the `WATERMARK_SUMMARY_*` values from `WaterMark/.env.local`.

Deploy: `supabase secrets set WATERMARK_SUMMARY_API_KEY=...` then `supabase functions deploy outlook-summary`.
