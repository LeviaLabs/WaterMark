-- Synthetic fixtures only; transaction rollback preserves the local baseline.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into public.source_status(source_id,name,source_url) values('fixture','Synthetic test data','https://fixture.invalid');
insert into public.monitoring_stations(source_id,station_id,name,location) values
 ('fixture','near','Synthetic near station',st_setsrid(st_makepoint(0,0.005),4326)::geography),
 ('fixture','far','Synthetic far station',st_setsrid(st_makepoint(1,0),4326)::geography),
 ('fixture','dateline','Synthetic dateline station',st_setsrid(st_makepoint(-179.999,0),4326)::geography);
insert into public.flood_events(source_id,station_id,started_at,ended_at,max_depth_mm)
 values('fixture','near',now()-interval '1 day',now()-interval '23 hours',25.4);
insert into public.historical_observations(source_id,station_id,observed_at,metric,value,units)
 values('fixture','near',now()-interval '2 days','water_depth',25.4,'mm');

select ok((select relrowsecurity from pg_class where oid='public.monitoring_stations'::regclass),'stations RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.flood_events'::regclass),'events RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.historical_observations'::regclass),'observations RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.source_status'::regclass),'source status RLS enabled');
select ok((select relrowsecurity from pg_class where oid='watermark_private.request_budgets'::regclass),'budget RLS enabled');
select ok(not has_table_privilege('anon','public.monitoring_stations','SELECT'),'anon direct reads not granted');
select ok(not has_table_privilege('authenticated','public.historical_observations','INSERT'),'authenticated writes not granted');
select ok(not has_function_privilege('anon','public.watermark_take_budget()','EXECUTE'),'anon cannot bypass budget through RPC');
select ok(not has_function_privilege('authenticated','public.watermark_cache_floodnet(jsonb,jsonb)','EXECUTE'),'authenticated cannot write public cache');
select ok(not has_function_privilege('anon','public.watermark_event_history(float8,float8)','EXECUTE'),'anon cannot bypass bounded API for historical events');
select ok(not (select prosecdef from pg_proc where oid='public.watermark_area_summary(double precision,double precision,double precision)'::regprocedure),'spatial RPC does not elevate privileges');
select has_index('public','monitoring_stations','monitoring_stations_location_gix','geography has GiST index');

set local role service_role;
select is((public.watermark_area_summary(0,0,1000)->>'stationCount')::int,1,'meter radius includes near station and excludes far station');
select is((public.watermark_area_summary(0,0,1000)->>'cachedEventCount')::int,1,'historical event count refers to cached selected stations');
select is((public.watermark_area_summary(0,179.999,1000)->>'stationCount')::int,1,'geography handles antimeridian distance');
select is((public.watermark_area_summary(0,0,1000)->>'sampledHistoricalMaxDepthMm')::float8,25.4::float8,'historical sensor maximum retains units');
select is(public.watermark_history(0,0)->0->>'stale','true','old observation remains stale');
select is(jsonb_array_length(public.watermark_history(20,20)),0,'no measurements stays empty');
select is(jsonb_array_length(public.watermark_event_history(0,0)),1,'cached event series selects spatial historical evidence');
select is(public.watermark_event_history(0,0)->0->>'units','mm','cached event series exposes normalized units');
select throws_ok($$select public.watermark_area_summary(91,0,1000)$$,'22023','Invalid geographic query','database rejects invalid latitude');
select throws_ok($$select public.watermark_area_summary(0,0,10001)$$,'22023','Invalid geographic query','database rejects excessive radius');
select throws_ok($$select public.watermark_area_summary('NaN'::float8,0,1000)$$,'22023','Invalid geographic query','database rejects NaN');
select throws_ok($$insert into public.historical_observations(source_id,station_id,observed_at,metric,value,units) values('fixture','near',now(),'water_depth',1,'feet')$$,'23514',null,'database rejects incorrect measurement units');
reset role;

-- Even accidental future table GRANTs must not defeat the RLS boundary.
grant select,insert,update,delete on public.monitoring_stations,public.flood_events,public.historical_observations,public.source_status to anon,authenticated;
set local role anon;
select is((select count(*) from public.monitoring_stations),0::bigint,'anon RLS denies environmental table reads');
select is((select count(*) from public.flood_events),0::bigint,'anon RLS denies cached events');
select is((select count(*) from public.historical_observations),0::bigint,'anon RLS denies measurement reads');
select is((select count(*) from public.source_status),0::bigint,'anon RLS denies source records');
select throws_ok($$insert into public.source_status(source_id,name,source_url) values('attacker','fixture','https://fixture.invalid')$$,'42501',null,'anon cannot insert through RLS');
with changed as (update public.monitoring_stations set name='changed' returning station_id)
select is((select count(*) from changed),0::bigint,'anon cannot update records');
with removed as (delete from public.monitoring_stations returning station_id)
select is((select count(*) from removed),0::bigint,'anon cannot delete records');
reset role;
set local role authenticated;
set local request.jwt.claims='{"sub":"00000000-0000-0000-0000-000000000001","user_metadata":{"role":"service_role"}}';
select is((select count(*) from public.monitoring_stations),0::bigint,'forged user metadata cannot elevate table access');
select throws_ok($$insert into public.source_status(source_id,name,source_url) values('attacker','fixture','https://fixture.invalid')$$,'42501',null,'authenticated cannot insert through RLS');
with changed as (update public.source_status set status='available' returning source_id)
select is((select count(*) from changed),0::bigint,'authenticated cannot update source status');
with removed as (delete from public.flood_events returning station_id)
select is((select count(*) from removed),0::bigint,'authenticated cannot delete events');
reset role;

delete from watermark_private.request_budgets;
set local role service_role;
select is((select count(*) filter(where public.watermark_take_budget()) from generate_series(1,41)),40::bigint,'atomic minute budget admits 40 and rejects 41st');
reset role;
delete from watermark_private.request_budgets;
insert into watermark_private.request_budgets values('day:'||(now() at time zone 'UTC')::date::text,4000,now()+interval '2 days');
set local role service_role;
select is(public.watermark_take_budget(),false,'daily cap prevents unlimited upstream usage');
reset role;
select * from finish();
rollback;
