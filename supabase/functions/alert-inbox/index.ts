// Supabase Edge Function: Agentboxd alert inbox. See ./handler.ts for routes, ./gate.ts for the rules.
// Deploy with JWT verification off; Agentboxd signs its webhook with HMAC instead (config.toml):
//   supabase functions deploy alert-inbox --no-verify-jwt
// Secrets (names only): AGENTBOXD_WEBHOOK_SECRET, ALERT_SENDER_ALLOWLIST, WATERMARK_ALLOWED_ORIGINS.
// SUPABASE_URL and the server credential are injected by Supabase and never leave this function.
import { serverCredential } from '../_shared/config.ts'
import { createHandler } from './handler.ts'
import { createRpcStore } from './store.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const credential = serverCredential((name) => Deno.env.get(name))

Deno.serve(createHandler({
  webhookSecret: Deno.env.get('AGENTBOXD_WEBHOOK_SECRET') ?? '',
  senderAllowlist: Deno.env.get('ALERT_SENDER_ALLOWLIST') ?? 'usgs.gov',
  allowedOrigins: Deno.env.get('WATERMARK_ALLOWED_ORIGINS') ?? '',
  store: supabaseUrl && credential ? createRpcStore(supabaseUrl, credential) : null,
  // Answer Agentboxd within its 10 s timeout; fetch the USGS reading after responding.
  defer: typeof EdgeRuntime !== 'undefined' ? (work) => EdgeRuntime.waitUntil(work) : undefined,
}))
