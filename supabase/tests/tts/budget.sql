-- Transaction rolls back every fixture row. Run only against the named local/CI test database.
begin;
-- Isolate the assertions from earlier concurrency fixture rows; ROLLBACK restores them.
delete from watermark_private.request_budgets where bucket like 'tts:%';
set local timezone = 'Pacific/Auckland';
do $$
declare v integer; v_day text := to_char(statement_timestamp() at time zone 'UTC', 'YYYYMMDD');
  v_month text := to_char(statement_timestamp() at time zone 'UTC', 'YYYYMM');
begin
  if has_function_privilege('anon', 'public.watermark_take_tts_budget(text,integer)', 'execute')
    or has_function_privilege('authenticated', 'public.watermark_take_tts_budget(text,integer)', 'execute')
    or not has_function_privilege('service_role', 'public.watermark_take_tts_budget(text,integer)', 'execute')
    then raise exception 'RPC credential boundary failed'; end if;
  if has_table_privilege('anon', 'watermark_private.request_budgets', 'select,insert,update,delete')
    or has_table_privilege('authenticated', 'watermark_private.request_budgets', 'select,insert,update,delete')
    then raise exception 'browser table grants'; end if;
  if not (select relrowsecurity from pg_class where oid = 'watermark_private.request_budgets'::regclass)
    then raise exception 'RLS not enabled'; end if;
  if public.watermark_take_tts_budget(null, 1) <> 'limited'
    or public.watermark_take_tts_budget(repeat('a',32), 1501) <> 'limited'
    or public.watermark_take_tts_budget(repeat('a',32), 0) <> 'limited'
    then raise exception 'invalid budget input admitted'; end if;
  for v in 1..6 loop
    if public.watermark_take_tts_budget(repeat('a',32), 1) <> 'ok' then raise exception 'early minute limit'; end if;
  end loop;
  if public.watermark_take_tts_budget(repeat('a',32), 1) <> 'limited' then raise exception 'minute cap exceeded'; end if;
  if public.watermark_take_tts_budget(repeat('b',32), 1500) <> 'ok'
    or public.watermark_take_tts_budget(repeat('b',32), 1500) <> 'ok'
    or public.watermark_take_tts_budget(repeat('b',32), 1) <> 'limited'
    then raise exception 'client character cap failed'; end if;
  if public.watermark_take_tts_budget(repeat('c',32), 1500) <> 'ok'
    or public.watermark_take_tts_budget(repeat('d',32), 494) <> 'ok'
    or public.watermark_take_tts_budget(repeat('e',32), 1) <> 'limited'
    then raise exception 'global daily cap failed'; end if;
  if (select requests from watermark_private.request_budgets where bucket = 'tts:day:' || v_day) <> 5000
    then raise exception 'UTC day accounting failed'; end if;
  update watermark_private.request_budgets set requests = 1 where bucket = 'tts:day:' || v_day;
  update watermark_private.request_budgets set requests = 10000 where bucket = 'tts:month:' || v_month;
  if public.watermark_take_tts_budget(repeat('f',32), 1) <> 'limited' then raise exception 'month cap exceeded'; end if;
  update watermark_private.request_budgets set requests = 1 where bucket = 'tts:month:' || v_month;
  update watermark_private.request_budgets set requests = 30 where bucket like 'tts:minute:%';
  if public.watermark_take_tts_budget(repeat('f',32), 1) <> 'limited' then raise exception 'global minute cap exceeded'; end if;
  if (select prosecdef from pg_proc where oid = 'public.watermark_take_tts_budget(text,integer)'::regprocedure)
    then raise exception 'RPC must remain security invoker'; end if;
  insert into watermark_private.request_budgets values ('tts:disabled', 1, 'infinity');
  if public.watermark_take_tts_budget(repeat('f',32), 1) <> 'disabled' then raise exception 'database kill switch failed'; end if;
end;
$$;
set local role anon;
do $$ begin
  begin perform public.watermark_take_tts_budget(repeat('a',32),1); raise exception 'anon RPC allowed';
    exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  begin perform public.watermark_take_tts_budget(repeat('a',32),1); raise exception 'authenticated RPC allowed';
    exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ begin
  if public.watermark_take_tts_budget(repeat('f',32),1) <> 'disabled' then raise exception 'service RPC unavailable'; end if;
end $$;
rollback;
select 'PASS: input, grants, RLS, client/minute, client/day, global/day, global/month, UTC, kill switch';
