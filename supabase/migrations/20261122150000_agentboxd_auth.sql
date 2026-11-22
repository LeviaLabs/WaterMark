-- WM-CLAUDE-005: shared, server-only state for Sign in with Agentboxd.
-- New objects only; no existing table, function or migration is changed.
-- Every Edge Function instance sees the same rows, so single use holds across instances.
--   agentboxd_auth_attempts   one row per browser sign-in attempt (state, nonce, PKCE challenge);
--                             marked consumed by a callback, retaining rate-limit accounting.
--   agentboxd_consumed_tokens jti of every accepted ID token until it expires (replay cache).
--   agentboxd_sessions        WaterMark's own agent session; only a SHA-256 hash of the token.
-- Only service_role (the Edge Function) can touch them; anon and authenticated cannot.

create table watermark_private.agentboxd_auth_attempts (
  state text primary key check (state ~ '^[A-Za-z0-9_-]{43}$'),
  nonce text not null check (nonce ~ '^[A-Za-z0-9_-]{43}$'),
  code_challenge text not null check (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  redirect_uri text not null check (length(redirect_uri) between 1 and 512),
  client_key text not null check (client_key ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  expires_at timestamptz not null
);
create index agentboxd_auth_attempts_client_idx
  on watermark_private.agentboxd_auth_attempts (client_key, created_at);
create index agentboxd_auth_attempts_expiry_idx
  on watermark_private.agentboxd_auth_attempts (expires_at);

create table watermark_private.agentboxd_consumed_tokens (
  jti text primary key check (length(jti) between 1 and 255),
  expires_at timestamptz not null
);
create index agentboxd_consumed_tokens_expiry_idx
  on watermark_private.agentboxd_consumed_tokens (expires_at);

create table watermark_private.agentboxd_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  subject text not null check (length(subject) between 1 and 255),
  display_name text check (display_name is null or length(display_name) <= 80),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index agentboxd_sessions_expiry_idx on watermark_private.agentboxd_sessions (expires_at);

alter table watermark_private.agentboxd_auth_attempts enable row level security;
alter table watermark_private.agentboxd_consumed_tokens enable row level security;
alter table watermark_private.agentboxd_sessions enable row level security;
revoke all on watermark_private.agentboxd_auth_attempts, watermark_private.agentboxd_consumed_tokens,
  watermark_private.agentboxd_sessions from public, anon, authenticated;
grant select, insert, update, delete on watermark_private.agentboxd_auth_attempts,
  watermark_private.agentboxd_consumed_tokens, watermark_private.agentboxd_sessions to service_role;
create policy backend_only on watermark_private.agentboxd_auth_attempts for all to service_role using (true) with check (true);
create policy backend_only on watermark_private.agentboxd_consumed_tokens for all to service_role using (true) with check (true);
create policy backend_only on watermark_private.agentboxd_sessions for all to service_role using (true) with check (true);

-- Record a new attempt. Returns false (and stores nothing) when this client already started
-- p_per_minute attempts in the last minute, or too many attempts are pending overall.
create or replace function public.watermark_agentboxd_begin(
  p_state text, p_nonce text, p_code_challenge text, p_redirect_uri text, p_client_key text,
  p_ttl_seconds integer, p_per_minute integer
) returns boolean language plpgsql security invoker set search_path='' as $$
begin
  if p_ttl_seconds not between 60 and 900 or p_per_minute not between 1 and 60 then
    raise exception 'invalid limits';
  end if;
  -- Serialize check-and-insert across instances, including the global pending-row cap.
  perform pg_catalog.pg_advisory_xact_lock(713706007::bigint);
  -- Housekeeping: expired rows are never valid, so removing them changes no outcome.
  delete from watermark_private.agentboxd_auth_attempts where expires_at <= now();
  delete from watermark_private.agentboxd_consumed_tokens where expires_at <= now();
  delete from watermark_private.agentboxd_sessions where expires_at <= now();
  if (select count(*) from watermark_private.agentboxd_auth_attempts
      where client_key = p_client_key and created_at > now() - interval '1 minute') >= p_per_minute
     or (select count(*) from watermark_private.agentboxd_auth_attempts) >= 10000 then
    return false;
  end if;
  insert into watermark_private.agentboxd_auth_attempts
    (state, nonce, code_challenge, redirect_uri, client_key, expires_at)
  values (p_state, p_nonce, p_code_challenge, p_redirect_uri, p_client_key,
          now() + make_interval(secs => p_ttl_seconds));
  return true;
end $$;

-- The atomic UPDATE returns a state once. Retain consumed rows until expiry so failed/finished
-- callbacks cannot reset the rolling-minute start limit. Unknown, used or expired: null.
create or replace function public.watermark_agentboxd_take_attempt(p_state text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  update watermark_private.agentboxd_auth_attempts a set consumed_at = now()
  where a.state = p_state and a.consumed_at is null
  returning case when a.expires_at > now() then jsonb_build_object(
    'nonce', a.nonce, 'code_challenge', a.code_challenge, 'redirect_uri', a.redirect_uri) end
  into result;
  return result;
end $$;

-- Record an ID token's jti. True the first time, false for a replay (primary key conflict).
create or replace function public.watermark_agentboxd_consume_jti(p_jti text, p_expires_at timestamptz)
returns boolean language plpgsql security invoker set search_path='' as $$
declare inserted integer;
begin
  insert into watermark_private.agentboxd_consumed_tokens (jti, expires_at)
  values (p_jti, greatest(p_expires_at + interval '30 seconds', now() + interval '1 minute'))
  on conflict (jti) do nothing;
  get diagnostics inserted = row_count;
  return inserted = 1;
end $$;

create or replace function public.watermark_agentboxd_create_session(
  p_token_hash text, p_subject text, p_display_name text, p_expires_at timestamptz
) returns void language plpgsql security invoker set search_path='' as $$
begin
  insert into watermark_private.agentboxd_sessions (token_hash, subject, display_name, expires_at)
  values (p_token_hash, p_subject, p_display_name, p_expires_at);
end $$;

-- Live session or null. Expired sessions are never returned.
create or replace function public.watermark_agentboxd_get_session(p_token_hash text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('subject', s.subject, 'display_name', s.display_name,
    'expires_at', (extract(epoch from s.expires_at) * 1000)::bigint)
  from watermark_private.agentboxd_sessions s
  where s.token_hash = p_token_hash and s.expires_at > now();
$$;

create or replace function public.watermark_agentboxd_end_session(p_token_hash text)
returns void language sql security invoker set search_path='' as $$
  delete from watermark_private.agentboxd_sessions where token_hash = p_token_hash;
$$;

revoke all on function
  public.watermark_agentboxd_begin(text,text,text,text,text,integer,integer),
  public.watermark_agentboxd_take_attempt(text),
  public.watermark_agentboxd_consume_jti(text,timestamptz),
  public.watermark_agentboxd_create_session(text,text,text,timestamptz),
  public.watermark_agentboxd_get_session(text),
  public.watermark_agentboxd_end_session(text)
from public, anon, authenticated;
grant execute on function
  public.watermark_agentboxd_begin(text,text,text,text,text,integer,integer),
  public.watermark_agentboxd_take_attempt(text),
  public.watermark_agentboxd_consume_jti(text,timestamptz),
  public.watermark_agentboxd_create_session(text,text,text,timestamptz),
  public.watermark_agentboxd_get_session(text),
  public.watermark_agentboxd_end_session(text)
to service_role;
