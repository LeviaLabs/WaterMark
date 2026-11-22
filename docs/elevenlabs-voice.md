# ElevenLabs read-aloud integration

Human owner: Decong. Branch: `feat/decong-elevenlabs-tts`.
Ryan Bergman reviews the focused change to `WaterMark/src/components/map/Assistant.tsx`.
Gemini reasoning, its function tools, browser microphone recognition, map and authentication are unchanged.

## Contract and behavior

`POST /functions/v1/watermark-tts`, JSON `{ "text": "Check official warnings." }`.
Only `text` is accepted: 1–1,500 UTF-16 characters after trimming; request body at most 12,000 bytes.
Success is `200 audio/mpeg` (maximum 2 MB), `Cache-Control: no-store`.
No audio or answer text is stored by WaterMark's backend.
The fixed provider URL, server-selected voice, `eleven_flash_v2_5` model and `mp3_44100_128` output cannot be overridden by callers.

Errors contain only `{ "code": "..." }`: 400 `INVALID_REQUEST`, 403 `ORIGIN_NOT_ALLOWED`,
405 `METHOD_NOT_ALLOWED`, 429 `RATE_LIMITED`/`PROVIDER_LIMITED`, 502 `PROVIDER_UNAVAILABLE`/`INVALID_AUDIO`,
503 `NOT_CONFIGURED`/`DISABLED`/`BUDGET_UNAVAILABLE`, 504 `PROVIDER_TIMEOUT`, 499 `CANCELLED`.
Origin checks are exact; no wildcard or credentialed CORS. Direct clients can spoof Origin;
the database budget is the cost boundary, not CORS or client IP.

Read-aloud starts **off** and requires a new opt-in after switching from browser-only speech.
Only answer text goes to ElevenLabs, with a visible disclosure. Provider processing follows
[ElevenLabs' retention settings](https://elevenlabs.io/docs/api-reference/text-to-speech/convert):
Creator does not provide the enterprise zero-retention option. Avoid sensitive input.
The text answer remains visible. A long answer is spoken completely by the browser rather than cut off.
Microphone input continues to use the browser's existing recognition service.
Language detection remains provider/browser behavior; multilingual pronunciation is UNVERIFIED.

Play/replay, Stop reading, a new question, starting the microphone, turning off read-aloud,
closing the panel and unmounting all cancel/replace the current fetch/audio/speech.
Late results cannot play. Media URLs and handlers are released. No automatic paid retry occurs.
Failure/quota/timeouts/autoplay refusal use browser speech, with a visible fallback state.
Browsers may require clicking Play last answer to grant audio playback permission.

## Secrets and budgets

Supabase Secrets names only:

- `ELEVENLABS_API_KEY`: restricted WaterMark TTS-only key; never `VITE_`. Created with owner approval,
  capped at 10,000 provider credits per refresh period; existing other-project keys were untouched.
- `ELEVENLABS_VOICE_ID`: permitted stock voice ID. The provider's documented example is
  `JBFqnCBsd6RMkjVDRZzb`; availability is verified by a real synthesis after approval.
- `WATERMARK_TTS_DISABLED`: optional immediate kill switch (`1`, `true`, `yes`, `on`).
- Existing `WATERMARK_ALLOWED_ORIGINS`: preserve exact localhost/apex/www configuration.
- Supabase-injected URL and server credential: only used by the private budget RPC.

Frontend/repository variable: `VITE_WATERMARK_TTS_URL` (public function URL only).
Unset/failed voice URL uses browser fallback; it never causes a direct browser request to ElevenLabs.

Additive migration `20261122175347_watermark_tts_budget.sql` creates one service-role-only,
SECURITY INVOKER RPC using the existing private RLS budget table. No authentication changes.
Atomic advisory-lock admission reserves characters **before** each paid request:

| Limit | Cap |
| --- | --- |
| Per caller, fixed UTC minute | 6 requests |
| All callers, fixed UTC minute | 30 requests |
| Per caller, UTC day | 3,000 characters |
| All callers, UTC day | 5,000 characters |
| All callers, calendar UTC month | 10,000 characters |

Caller identifiers are day-scoped hashes of gateway address hints; raw addresses/text are not stored.
Shared addresses may share a limit, and forged hints may evade individual limits. The global caps still apply.
The monthly app window differs from the provider's credit refresh window; retain the provider key cap.
Reservations are not refunded after timeout/cancellation/failure because provider credits may already be spent.
Missing/failing database checks deny synthesis. Request read timeout is 5 seconds, budget RPC 4 seconds,
provider fetch plus streamed audio 20 seconds, browser request 25 seconds.
For a database emergency stop, set the existing budget table's `tts:disabled` row to a positive count
and infinite expiry via an authorized operator; the RPC checks that row before admitting requests.

## Verification and deployment gate

Automated fixtures make no provider requests and spend no credits. Run:

```powershell
# In WaterMark/
npm test
npm run lint
npm run build
# In supabase/
npx deno test --allow-env tests/unit
npx deno check functions/watermark-tts/index.ts
npx deno lint functions/watermark-tts tests/unit/tts_test.ts tests/tts/concurrency_test.ts
```

`supabase/tests/tts/setup.sql`, the voice migration and `budget.sql` run in a NEW local/CI database only.
`concurrency_test.ts` requires explicitly named `TTS_TEST_CONTAINER` and `TTS_TEST_DATABASE`
(`watermark_tts_test`); it tests 20 callers against the same monthly cap. CI creates a network-isolated,
portless PostgreSQL fixture. Never run fixture setup or the concurrency test on the hosted project.

Observed local results after synchronizing main: 231 frontend tests; 88 backend tests; one 20-caller database regression;
SQL input/grant/RLS/UTC/kill-switch and cap assertions; frontend lint/typecheck/build and voice Deno checks.
Existing Astryx doctor theme-module failures remain (theme files unchanged); existing large map bundle warning remains.

Hosted inspection found only `agentboxd-auth`, `auth-verify`, `watermark-v1`; no `assistant` or TTS function.
The assistant budget migration and frontend assistant URL are also absent remotely.
Full production chat therefore needs the existing reviewed Gemini assistant activated as a separate explicit part
of deployment approval. Its implementation/guardrails are unchanged by this PR. Its unapplied budget migration
was renamed, with byte-identical SQL, to `20261122181132_watermark_assistant_budget.sql`: the old
`20261122170000` version collided with the newly merged alert-inbox migration. The inbox migration is untouched.

Before approval: no production function/migration/frontend changes. ElevenLabs key storage is separately approved.
After approval, inspect fresh migration history; apply **only** the approved assistant budget and voice budget migrations
using an isolated migration snapshot that matches remote history. Never blindly push all checkout migrations.
Deploy only the approved `assistant` and `watermark-tts` function names; never deploy all functions or overwrite auth.
Configure the two public URL variables, then release the reviewed frontend only with merge/deploy approval.
No paid infrastructure, upgrades, DNS changes or new hosting providers are required.

Hosted acceptance: real bounded MP3 response and browser playback; valid CORS for apex/www/local;
invalid/foreign-origin/oversize requests rejected; browser RPC grants denied; missing/disabled budget denies spend;
concurrent reservations bounded; cancel/stop/replay do not overlap; browser fallback visible; microphone preserved;
Gemini answer and existing flood tool behavior verified. Scan the production bundle for privileged credentials.
Until executed, all hosted/provider/audio acceptance is **UNVERIFIED**. CI/local fixtures are not production audio evidence.

Provider method and model verified against [official TTS API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)
and [model documentation](https://elevenlabs.io/docs/overview/models). Secret handling follows
[Supabase function secrets](https://supabase.com/docs/guides/functions/secrets).
