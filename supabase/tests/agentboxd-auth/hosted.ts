// Checks for a deployed agentboxd-auth function (WM-CLAUDE-005). Explicit opt-in network test.
// It never completes a sign-in (that needs a person approving on agentboxd.com); it checks the
// security edges that must hold on the real deployment.
//
//   AGENTBOXD_AUTH_URL=https://<project-ref>.supabase.co/functions/v1/agentboxd-auth \
//   AGENTBOXD_AUTH_ORIGIN=https://watermark.works \
//   deno run --allow-env=AGENTBOXD_AUTH_URL,AGENTBOXD_AUTH_ORIGIN --allow-net supabase/tests/agentboxd-auth/hosted.ts
//
// /start creates one attempt row per run (expires in 10 minutes; 10 per minute per client).

const url = Deno.env.get('AGENTBOXD_AUTH_URL')?.trim().replace(/\/+$/, '') ?? ''
const origin = Deno.env.get('AGENTBOXD_AUTH_ORIGIN')?.trim() ?? ''
if (!url || !origin) {
  console.error('Set AGENTBOXD_AUTH_URL and AGENTBOXD_AUTH_ORIGIN.')
  Deno.exit(2)
}

let failed = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failed++
}
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const post = (route: string, body: unknown, from = origin) =>
  fetch(`${url}/${route}`, { method: 'POST', headers: { Origin: from, 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'manual' })
const json = async (res: Response) => { try { return await res.json() } catch { return {} } }

check('function URL uses HTTPS', new URL(url).protocol === 'https:')
check('site origin uses HTTPS', new URL(origin).protocol === 'https:')

for (const other of ['https://evil.example', 'null']) {
  const res = await post('start', {}, other)
  check(`POST from ${other} -> 403`, res.status === 403 && !res.headers.get('access-control-allow-origin'), `${res.status}`)
  await res.body?.cancel()
}
{
  const res = await fetch(`${url}/start`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } })
  check('preflight from site origin -> 204', res.status === 204 && res.headers.get('access-control-allow-origin') === origin, `${res.status}`)
  await res.body?.cancel()
}

const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)))
const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
const start = await post('start', { codeChallenge: challenge })
const started = await json(start)
check('start -> 200 with no-store', start.status === 200 && start.headers.get('cache-control') === 'no-store', `${start.status} ${started.error ?? ''}`)
if (start.status === 200) {
  const a = new URL(started.authorizeUrl)
  check('authorize URL is Agentboxd', `${a.origin}${a.pathname}` === 'https://id.agentboxd.com/authorize')
  check('S256 challenge, state and nonce present', a.searchParams.get('code_challenge') === challenge &&
    a.searchParams.get('code_challenge_method') === 'S256' && a.searchParams.get('state') === started.state && !!a.searchParams.get('nonce'))
  check('redirect URI is on the site origin', new URL(a.searchParams.get('redirect_uri') ?? 'x:').origin === origin)
  check('scope is openid profile (no email)', a.searchParams.get('scope') === 'openid profile')

  const wrong = await post('finish', { state: started.state, code: 'not-a-real-code', codeVerifier: b64url(crypto.getRandomValues(new Uint8Array(32))), iss: 'https://id.agentboxd.com' })
  check('finish with wrong PKCE verifier -> 400 pkce-mismatch', wrong.status === 400 && (await json(wrong)).error === 'pkce-mismatch', `${wrong.status}`)
  const again = await post('finish', { state: started.state, code: 'not-a-real-code', codeVerifier: verifier, iss: 'https://id.agentboxd.com' })
  check('the same state again -> 400 invalid-state (single use)', again.status === 400 && (await json(again)).error === 'invalid-state', `${again.status}`)
}
{
  const res = await post('finish', { state: 'A'.repeat(43), code: 'x', codeVerifier: verifier, iss: 'https://id.agentboxd.com' })
  check('unknown state -> 400 invalid-state', res.status === 400 && (await json(res)).error === 'invalid-state', `${res.status}`)
}
{
  const res = await post('session', { session: 'A'.repeat(43) })
  check('unknown session -> 401', res.status === 401, `${res.status}`)
  await res.body?.cancel()
}

console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.')
Deno.exit(failed ? 1 : 0)
