-- Flood-assistant request budget. Separate buckets from watermark_take_budget so a chat
-- does not spend the map API's minute and day counters, and a map request does not spend
-- the assistant's. The client argument is a 32-character hex digest of the UTC day and the
-- gateway-reported client address. The raw address is not stored.
--
-- Limits: 12 requests per minute and 80 per UTC day for that digest, and 400 per UTC day
-- for every caller. Keep these numbers in sync with ASSISTANT_LIMITS in
-- supabase/functions/assistant/handler.mts.
--
-- Emergency stop, without redeploying the function:
--   insert into watermark_private.request_budgets(bucket, requests, expires_at)
--   values ('assistant:disabled', 1, 'infinity')
--   on conflict (bucket) do update set expires_at = excluded.expires_at, requests = 1;
-- Re-enable by deleting that row. WATERMARK_ASSISTANT_DISABLED is a second switch checked
-- in the Edge Function before this RPC runs.

create function public.watermark_take_assistant_budget(p_client text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_minute text;
  v_day text;
  v_ok boolean;
begin
  if exists (
    select 1 from watermark_private.request_budgets
    where bucket = 'assistant:disabled' and expires_at > v_now
  ) then
    return 'disabled';
  end if;

  if p_client is null or p_client !~ '^[a-f0-9]{32}$' then
    return 'client_limited';
  end if;

  delete from watermark_private.request_budgets
  where bucket like 'assistant:%'
    and bucket <> 'assistant:disabled'
    and expires_at < v_now;

  v_minute := to_char(date_trunc('minute', v_now) at time zone 'UTC', 'YYYYMMDDHH24MI');
  v_day := (v_now at time zone 'UTC')::date::text;

  v_ok := false;
  insert into watermark_private.request_budgets(bucket, requests, expires_at)
  values ('assistant:c:' || p_client || ':m:' || v_minute, 1, v_now + interval '2 minutes')
  on conflict (bucket) do update set requests = request_budgets.requests + 1
  where request_budgets.requests < 12
  returning true into v_ok;
  if not coalesce(v_ok, false) then return 'client_limited'; end if;

  v_ok := false;
  insert into watermark_private.request_budgets(bucket, requests, expires_at)
  values ('assistant:c:' || p_client || ':d:' || v_day, 1, v_now + interval '2 days')
  on conflict (bucket) do update set requests = request_budgets.requests + 1
  where request_budgets.requests < 80
  returning true into v_ok;
  if not coalesce(v_ok, false) then return 'client_limited'; end if;

  v_ok := false;
  insert into watermark_private.request_budgets(bucket, requests, expires_at)
  values ('assistant:day:' || v_day, 1, v_now + interval '2 days')
  on conflict (bucket) do update set requests = request_budgets.requests + 1
  where request_budgets.requests < 400
  returning true into v_ok;
  if not coalesce(v_ok, false) then return 'daily_limited'; end if;

  return 'ok';
end;
$$;

revoke all on function public.watermark_take_assistant_budget(text) from public, anon, authenticated;
grant execute on function public.watermark_take_assistant_budget(text) to service_role;
