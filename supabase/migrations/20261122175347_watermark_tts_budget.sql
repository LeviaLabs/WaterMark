-- Additive RPC only. Reuses the existing private, RLS-protected budget table.
-- The Edge Function reserves UTF-16 characters BEFORE every paid call, including failures
-- and cancellations. No refunds/retries: an upstream cancellation can still spend credits.
-- Limits match TTS_LIMITS; CORS/client address hints do not replace the global caps.
create function public.watermark_take_tts_budget(p_client text, p_characters integer)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_minute text := to_char(v_now at time zone 'UTC', 'YYYYMMDDHH24MI');
  v_day text := to_char(v_now at time zone 'UTC', 'YYYYMMDD');
  v_month text := to_char(v_now at time zone 'UTC', 'YYYYMM');
  v_bucket text;
  v_count integer;
begin
  if p_client is null or p_client !~ '^[a-f0-9]{32}$'
     or p_characters is null or p_characters < 1 or p_characters > 1500 then
    return 'limited';
  end if;
  -- One lock orders all admissions, including simultaneous requests from different isolates.
  perform pg_advisory_xact_lock(713706008);
  if exists (select 1 from watermark_private.request_budgets
    where bucket = 'tts:disabled' and expires_at > v_now) then return 'disabled'; end if;
  delete from watermark_private.request_budgets where bucket like 'tts:%'
    and bucket <> 'tts:disabled' and expires_at < v_now;

  for v_bucket, v_count in select * from (values
    ('tts:c:' || p_client || ':m:' || v_minute, 6),
    ('tts:minute:' || v_minute, 30),
    ('tts:c:' || p_client || ':d:' || v_day, 3000 - p_characters + 1),
    ('tts:day:' || v_day, 5000 - p_characters + 1),
    ('tts:month:' || v_month, 10000 - p_characters + 1)
  ) as caps(bucket, ceiling) loop
    if exists (select 1 from watermark_private.request_budgets
      where bucket = v_bucket and requests >= v_count) then return 'limited'; end if;
  end loop;

  insert into watermark_private.request_budgets(bucket, requests, expires_at) values
    ('tts:c:' || p_client || ':m:' || v_minute, 1, v_now + interval '2 minutes'),
    ('tts:minute:' || v_minute, 1, v_now + interval '2 minutes'),
    ('tts:c:' || p_client || ':d:' || v_day, p_characters, v_now + interval '2 days'),
    ('tts:day:' || v_day, p_characters, v_now + interval '2 days'),
    ('tts:month:' || v_month, p_characters, date_trunc('month', v_now at time zone 'UTC') at time zone 'UTC' + interval '32 days')
  on conflict (bucket) do update set requests = request_budgets.requests + excluded.requests;
  return 'ok';
end;
$$;

revoke all on function public.watermark_take_tts_budget(text, integer) from public, anon, authenticated;
grant execute on function public.watermark_take_tts_budget(text, integer) to service_role;
