-- Synthetic fixtures only. Rolls back. Does not call Gemini.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

select ok(
  not has_function_privilege('anon', 'public.watermark_take_assistant_budget(text)', 'EXECUTE'),
  'anon cannot spend the assistant budget'
);
select ok(
  not has_function_privilege('authenticated', 'public.watermark_take_assistant_budget(text)', 'EXECUTE'),
  'authenticated cannot spend the assistant budget'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.watermark_take_assistant_budget(text)'::regprocedure),
  'assistant budget RPC does not elevate privileges'
);

set local role service_role;
select is(
  public.watermark_take_assistant_budget('not-a-hash'),
  'client_limited',
  'a raw client address is rejected and not stored'
);
select is(
  (select count(*) from watermark_private.request_budgets where bucket like 'assistant:%'),
  0::bigint,
  'rejected client keys do not create buckets'
);

select is(
  (select count(*) filter (where public.watermark_take_assistant_budget('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') = 'ok') from generate_series(1, 12)),
  12::bigint,
  'per-client minute budget admits 12'
);
select is(
  public.watermark_take_assistant_budget('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
  'client_limited',
  'per-client minute budget rejects the 13th'
);
select is(
  public.watermark_take_assistant_budget('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
  'ok',
  'a second client still has its own minute budget'
);
reset role;

delete from watermark_private.request_budgets where bucket like 'assistant:%';
insert into watermark_private.request_budgets(bucket, requests, expires_at)
values (
  'assistant:c:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:d:' || (statement_timestamp() at time zone 'UTC')::date::text,
  80,
  statement_timestamp() + interval '2 days'
);
set local role service_role;
select is(
  public.watermark_take_assistant_budget('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
  'client_limited',
  'per-client daily cap rejects the next request'
);
reset role;

delete from watermark_private.request_budgets where bucket like 'assistant:%';
insert into watermark_private.request_budgets(bucket, requests, expires_at)
values (
  'assistant:day:' || (statement_timestamp() at time zone 'UTC')::date::text,
  400,
  statement_timestamp() + interval '2 days'
);
set local role service_role;
select is(
  public.watermark_take_assistant_budget('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
  'daily_limited',
  'global daily cap rejects the next request'
);
reset role;

delete from watermark_private.request_budgets where bucket like 'assistant:%';
insert into watermark_private.request_budgets(bucket, requests, expires_at)
values ('assistant:disabled', 1, 'infinity');
set local role service_role;
select is(
  public.watermark_take_assistant_budget('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
  'disabled',
  'assistant:disabled row stops the function'
);
select is(
  (select count(*) from watermark_private.request_budgets where bucket like 'assistant:c:%' or bucket like 'assistant:day:%'),
  0::bigint,
  'the kill switch does not count the request'
);
reset role;

select * from finish();
rollback;
