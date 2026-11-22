// Supabase Edge Function: Sign in with Agentboxd (WM-CLAUDE-005). See ./flow.ts for the routes.
// Deploy with JWT verification off; callers are anonymous browsers (config.toml sets it):
//   supabase functions deploy agentboxd-auth --no-verify-jwt
// Secrets (names only): AGENTBOXD_CLIENT_ID, AGENTBOXD_REDIRECT_URIS, WATERMARK_ALLOWED_ORIGINS.
// SUPABASE_URL and the server credential are injected by Supabase and never leave this function.
import { serverCredential } from '../_shared/config.ts'
import { createHandler } from './flow.ts'
import { createRpcStore } from './store.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const credential = serverCredential((name) => Deno.env.get(name))

Deno.serve(createHandler({
  clientId: Deno.env.get('AGENTBOXD_CLIENT_ID')?.trim() ?? '',
  redirectUris: Deno.env.get('AGENTBOXD_REDIRECT_URIS') ?? '',
  allowedOrigins: Deno.env.get('WATERMARK_ALLOWED_ORIGINS') ?? '',
  store: supabaseUrl && credential ? createRpcStore(supabaseUrl, credential) : null,
}))
