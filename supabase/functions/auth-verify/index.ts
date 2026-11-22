// Supabase Edge Function: verifies a MojoAuth token server-side (WM-CLAUDE-002).
// Deploy with JWT verification off, because the caller sends a MojoAuth token, not a Supabase one:
//   supabase functions deploy auth-verify   (config.toml sets verify_jwt = false for it)
// Secrets (names only): MOJOAUTH_API_KEY, WATERMARK_ALLOWED_ORIGINS, optional MOJOAUTH_ISSUER.
import { handleRequest } from './verify.ts'

Deno.serve((request) =>
  handleRequest(request, {
    apiKey: Deno.env.get('MOJOAUTH_API_KEY') ?? '',
    allowedOrigins: Deno.env.get('WATERMARK_ALLOWED_ORIGINS') ?? '',
    expectedIssuer: Deno.env.get('MOJOAUTH_ISSUER') ?? '',
  })
)
