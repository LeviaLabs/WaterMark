-- A summary can make two Open-Meteo requests. At 40 requests/minute the
-- upper bound is 4,800 Open-Meteo requests/hour; 4,000 API requests/day bounds
-- that provider to 8,000/day. Other apps sharing an egress IP can still use quota.
create or replace function public.watermark_take_budget() returns boolean
language plpgsql security invoker set search_path='' as $$
declare
  v_now timestamptz := statement_timestamp();
  v_ok boolean;
begin
  delete from watermark_private.request_budgets where expires_at < v_now;
  insert into watermark_private.request_budgets(bucket,requests,expires_at)
  values ('minute:' || date_trunc('minute',v_now)::text,1,v_now+interval '2 minutes')
  on conflict(bucket) do update set requests=request_budgets.requests+1
  where request_budgets.requests<40 returning true into v_ok;
  if not coalesce(v_ok,false) then return false; end if;
  v_ok := false;
  insert into watermark_private.request_budgets(bucket,requests,expires_at)
  values ('day:' || (v_now at time zone 'UTC')::date::text,1,v_now+interval '2 days')
  on conflict(bucket) do update set requests=request_budgets.requests+1
  where request_budgets.requests<4000 returning true into v_ok;
  return coalesce(v_ok,false);
end;
$$;
