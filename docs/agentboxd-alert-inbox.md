# Agentboxd alert inbox

WaterMark runs one shared Agentboxd inbox that receives **USGS WaterAlert** emails, which USGS sends when a stream gauge crosses a threshold. Agentboxd screens each message for prompt injection and phishing. A WaterMark Edge Function applies its own rules on top, and the screened alerts then appear at `/alerts` as observed evidence.

Agentboxd sources, read on 2026-11-22:
- [webhooks](https://agentboxd.com/docs/webhooks)
- [categories and risk flags](https://agentboxd.com/docs/api#categories-and-risk-flags)
- [AI processing](https://agentboxd.com/docs/ai-processing)
- [plans](https://agentboxd.com/docs/plans)
- the live event catalog at `GET https://api.agentboxd.com/v1/webhooks/events`

## Trust model

The email is untrusted input and only ever triggers a lookup.

- An accepted email contributes one thing: a USGS monitoring-location id.
- The site name, coordinates, gage height and streamflow all come from the [USGS Water Services instantaneous-values API](https://waterservices.usgs.gov/nwis/iv/), never from the email.
- No language model reads the email in WaterMark.
- Neither the body nor the subject is stored.
- The public feed never includes the sender or subject.

So the worst a forged or injected email that slipped through could do is make WaterMark show real USGS data for a real site.

```mermaid
sequenceDiagram
    participant U as USGS WaterAlert
    participant A as Agentboxd inbox
    participant F as alert-inbox (Supabase)
    participant DB as Postgres (service_role)
    participant G as USGS Water Services
    participant B as Browser /alerts
    U->>A: email (gauge over threshold)
    A->>A: JEV injection + phishing scores, SPF/DKIM/DMARC, local checks
    A->>F: POST /webhook message.enriched (HMAC-SHA256 signed)
    F->>F: signature + timestamp ±300 s
    F->>F: gate: completed check, risk < 0.5, no risk labels, allowed sender, USGS site id
    F->>DB: record(message_id, status, reason, scores, site_id)  (once per message)
    F-->>A: 204
    F->>G: latest 00065 gage height, 00060 streamflow (after responding)
    F->>DB: set_reading (accepted rows only)
    B->>F: GET /alerts
    F-->>B: accepted alerts with USGS readings; held-back alerts with reason + scores only
```

## Gate (`supabase/functions/alert-inbox/gate.ts`)

| Check | Result if it fails |
|---|---|
| Event is `message.enriched` or `message.released` | ignored |
| `message.withheld` (not screened yet; a later event brings the content) | ignored |
| Inbound, full payload (not envelope) | ignored |
| Agentboxd check finished (`analysis.state = completed`, scores present) | `not-checked` / `check-failed` |
| `risk.injection < 0.5`, no `ai:injection-risk` / `local:injection-risk` | `injection-risk` |
| `risk.phishing < 0.5`, no `ai:phishing` | `phishing-risk` |
| no `blocked` label | `blocked` |
| No `spf-fail` / `dmarc-fail` label (Agentboxd's reserved sender-authentication labels; the From header alone is forgeable, and usgs.gov publishes DMARC `p=reject`) | `sender-auth-failed` |
| Sender address or domain on `ALERT_SENDER_ALLOWLIST` (exact domain or subdomain; lookalikes fail) | `sender-not-allowed` |
| A USGS site id (8–15 digits) appears in an unambiguous form (`monitoring-location/…`, `USGS 0164…`, `site_no=…`, `Site number: …`) in the subject or the first 3,000 characters of the new text | `no-usgs-site` |

Messages that fail any of these checks are stored as `quarantined`, with only the reason and the scores. The decision is final: a database trigger rejects any update to a row's status, reason, site or scores, so a retry or a later `message.released` can never turn a quarantined row into an accepted one.

Readings are USGS gauge **observations** (provisional data may be revised), not National Weather Service watches or warnings; the feed says so in `kind`/`notice` and the page shows the same notice. The `/alerts` page lists them under **Held back** so people can see the screening working.

USGS doesn't publish the WaterAlert email layout, so nothing depends on it beyond finding the site id.

## Files

```text
supabase/functions/alert-inbox/{index,handler,gate,usgs,store}.ts
supabase/migrations/20261122183000_agentboxd_alert_inbox.sql   new table + 3 RPCs (service_role only)
supabase/tests/alert-inbox/inbox.test.ts                        26 tests
WaterMark/src/services/emailAlerts.ts                           validated client; map can plot site lat/lon
WaterMark/src/components/pages/AlertsPage.tsx                   /alerts
WaterMark/tests/emailAlerts.test.ts                             6 tests
```

## Configuration

Supabase secrets:

| Name | Value |
|---|---|
| `AGENTBOXD_WEBHOOK_SECRET` | the signing secret Agentboxd shows once when the webhook is created |
| `ALERT_SENDER_ALLOWLIST` | `usgs.gov` (add an exact address such as `you@example.com` for a forwarding demo) |
| `WATERMARK_ALLOWED_ORIGINS` | already set; unchanged |

GitHub repository variable: `VITE_WATERMARK_ALERTS_URL=https://gcfcpmqeegywnddusgfl.supabase.co/functions/v1/alert-inbox/alerts`.

## Owner setup

1. **Agentboxd workspace:** leave AI processing on `categorize`, the default. With it `off`, there are no injection or phishing scores and every message is held as `not-checked`.
   - `categorize` sends the sender, the subject and up to about 3,000 characters to JEV (TypeSafe AI, US).
2. **Create the inbox:** `POST /v1/inboxes` with `{ "username": "watermark-alerts", "display_name": "WaterMark flood alerts" }`, or use the dashboard. The Free plan allows 10 inboxes.
3. **Create the webhook:**
   - URL: `https://gcfcpmqeegywnddusgfl.supabase.co/functions/v1/alert-inbox/webhook`
   - events: `message.enriched` and `message.released`
   - limit it to that inbox and choose the full payload, which needs a key with `messages:read`, or the dashboard.
   - Copy the signing secret into `AGENTBOXD_WEBHOOK_SECRET`.
4. **USGS WaterAlert:** at <https://accounts.waterdata.usgs.gov/wateralert/>, subscribe the inbox address to gage height at the demo gauges, using National Weather Service flood stages as thresholds.
5. **Deploy, with approval:** run `supabase db push`, then `supabase functions deploy alert-inbox --no-verify-jwt`. Then set the repository variable.

## Verified

- **Tests:** `node --test supabase/tests/alert-inbox/inbox.test.ts` passes 26/26:
  - signature;
  - every gate rule;
  - injection text can't change the decision;
  - dedupe across `enriched` and `released`;
  - USGS outage and timeout;
  - store outage → 503 so Agentboxd retries;
  - limits, CORS and parsing.
- **Frontend tests:** `npx vitest run` passes, including 6 alert-client tests.
- **Migration:** applied to PGlite, which confirmed:
  - dedupe;
  - readings are attached only to accepted rows;
  - no sender in the feed;
  - constraints;
  - 90-day retention;
  - permission denied for anon and authenticated.
- **USGS from Deno:** the real API returned `POTOMAC RIVER NEAR WASH, DC LITTLE FALLS PUMP STA`, gage height 2.71 ft and streamflow 1520 ft³/s, both provisional, in about 4.4 s.
- **Local end-to-end run:** the real handler, an in-memory store and the real USGS API, with three signed webhooks and one forged one.
  - The USGS alert was accepted, with its reading attached.
  - The injection email (97%) and the phishing email (93%) were held back.
  - The forged webhook got 401.
  - `/alerts` rendered correctly on desktop and at 375 px.

## Limitations

- No real Agentboxd delivery has run yet; that needs the inbox and webhook above.
- Readings are a snapshot taken when the alert arrives, not live values.
- USGS responses take about 4–5 s. The fetch runs after the webhook replies (`EdgeRuntime.waitUntil`), with a 12 s timeout.
- The map layer itself belongs to Ryan Lin's map (PR #6). `loadEmailAlerts()` gives it each site's coordinates.
- Only USGS WaterAlert is parsed. Other official senders would each need their own trigger rule.
