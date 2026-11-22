-- Run after the Agentboxd migration in an isolated PostgreSQL database. Fixtures roll back.
begin;
set local role service_role;
do $$
declare a jsonb; i integer; started boolean;
begin
  for i in 1..10 loop
    started := public.watermark_agentboxd_begin(lpad(i::text,43,'A'), repeat('N',43), repeat('C',43),
      'https://watermark.works/agentboxd-callback.html', repeat('a',64),600,10);
    if not started then raise exception 'start unexpectedly rejected'; end if;
    a := public.watermark_agentboxd_take_attempt(lpad(i::text,43,'A'));
    if a->>'nonce' <> repeat('N',43) then raise exception 'attempt not returned'; end if;
    if public.watermark_agentboxd_take_attempt(lpad(i::text,43,'A')) is not null then
      raise exception 'attempt replay accepted';
    end if;
  end loop;
  if public.watermark_agentboxd_begin(repeat('Z',43),repeat('N',43),repeat('C',43),
      'https://watermark.works/agentboxd-callback.html',repeat('a',64),600,10) then
    raise exception 'consuming attempts reset the rate limit';
  end if;
  if not public.watermark_agentboxd_begin(repeat('B',43),repeat('N',43),repeat('C',43),
      'https://watermark.works/agentboxd-callback.html',repeat('b',64),600,10) then
    raise exception 'another client incorrectly rate limited';
  end if;
  update watermark_private.agentboxd_auth_attempts set expires_at=now()-interval '1 second' where state=repeat('B',43);
  if public.watermark_agentboxd_take_attempt(repeat('B',43)) is not null then raise exception 'expired attempt accepted'; end if;
  if not public.watermark_agentboxd_consume_jti('fixture-jti',now()+interval '2 minutes') then raise exception 'first jti rejected'; end if;
  if public.watermark_agentboxd_consume_jti('fixture-jti',now()+interval '2 minutes') then raise exception 'jti replay accepted'; end if;
  if (select expires_at from watermark_private.agentboxd_consumed_tokens where jti='fixture-jti') < now()+interval '150 seconds' then
    raise exception 'replay retention shorter than token clock tolerance';
  end if;
  perform public.watermark_agentboxd_create_session(repeat('c',64),'fixture-agent',null,now()+interval '1 hour');
  if public.watermark_agentboxd_get_session(repeat('c',64))->>'subject' <> 'fixture-agent' then raise exception 'session missing'; end if;
  perform public.watermark_agentboxd_end_session(repeat('c',64));
  if public.watermark_agentboxd_get_session(repeat('c',64)) is not null then raise exception 'revoked session accepted'; end if;
  perform public.watermark_agentboxd_create_session(repeat('d',64),'fixture-agent',null,now()-interval '1 second');
  if public.watermark_agentboxd_get_session(repeat('d',64)) is not null then raise exception 'expired session accepted'; end if;
  raise notice 'PASS: SQL start limits, consumed/expired attempts, jti retention, sessions and revocation';
end $$;
reset role;
do $$
declare p record; r text; t text; operation text;
begin
  foreach r in array array['anon','authenticated'] loop
    for p in select oid,proname from pg_proc where proname like 'watermark_agentboxd_%' loop
      if has_function_privilege(r,p.oid,'EXECUTE') then raise exception 'browser RPC permission: % %',r,p.proname; end if;
    end loop;
    foreach t in array array['agentboxd_auth_attempts','agentboxd_consumed_tokens','agentboxd_sessions'] loop
      foreach operation in array array['SELECT','INSERT','UPDATE','DELETE'] loop
        if has_table_privilege(r,'watermark_private.'||t,operation) then raise exception 'browser table permission'; end if;
      end loop;
    end loop;
  end loop;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='watermark_private' and c.relname in ('agentboxd_auth_attempts','agentboxd_consumed_tokens','agentboxd_sessions') and c.relrowsecurity) <> 3 then
    raise exception 'RLS absent';
  end if;
  if exists(select 1 from pg_proc where proname like 'watermark_agentboxd_%' and prosecdef) then raise exception 'RPC unexpectedly security definer'; end if;
  raise notice 'PASS: all three tables have RLS, all six RPCs use invoker security, browser CRUD/execute denied';
end $$;
set local role anon;
do $$ begin
  begin perform public.watermark_agentboxd_get_session(repeat('c',64)); raise exception 'anon RPC unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin perform 1 from watermark_private.agentboxd_sessions; raise exception 'anon table unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
do $$ begin
  begin perform public.watermark_agentboxd_get_session(repeat('c',64)); raise exception 'authenticated RPC unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin perform 1 from watermark_private.agentboxd_sessions; raise exception 'authenticated table unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
