-- WM-CODEX-001-R1 synthetic fixtures. All writes roll back.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into public.source_status(source_id,name,source_url) values('review_fixture','Synthetic R1','https://fixture.invalid');

set local role service_role;
select is(public.watermark_area_summary(20,20,1000)->'stationCount','null'::jsonb,'M2 no station cache is unknown, not zero');
select is(public.watermark_area_summary(20,20,1000)->'cachedEventCount','null'::jsonb,'M2 no event cache is unknown, not zero');
select is(public.watermark_area_summary(20,20,1000)->>'coverageStatus','incomplete','M2 geographic coverage remains incomplete');
select is(public.watermark_area_summary(20,20,1000)->>'zeroMatchesVerified','false','M2 never asserts verified zero without a source query');
select is(public.watermark_area_summary(20,20,1000)->'cacheNewestFetchedAt','null'::jsonb,'M2 absence never fabricates a cache retrieval time');
reset role;

insert into public.monitoring_stations(source_id,station_id,name,location,metadata_fetched_at)
 values('review_fixture','stale','Synthetic R1 stale station',st_setsrid(st_makepoint(1,1),4326)::geography,now()-interval '3 days');
insert into public.flood_events(source_id,station_id,started_at,ended_at,max_depth_mm,fetched_at)
 values('review_fixture','stale',now()-interval '2 days',now()-interval '1 day',25.4,now()-interval '2 days');
set local role service_role;
select is((public.watermark_area_summary(1,1,1000)->>'cacheNewestFetchedAt')::timestamptz,now()-interval '2 days','M3 newest cache time preserves real stored timestamp');
select is((public.watermark_area_summary(1,1,1000)->>'cacheOldestFetchedAt')::timestamptz,now()-interval '3 days','M3 oldest cache time exposes mixed snapshot ages');
select is((public.watermark_event_history(1,1)->0->>'fetched_at')::timestamptz,now()-interval '2 days','M3 historical read does not replace stored fetch timestamp');
select is(public.watermark_area_summary(1,1,1000)->'stations'->0->'geometry'->>'type','Point','M5 area includes station Point geometry');
select is(public.watermark_area_summary(1,1,1000)->'stations'->0->'geometry'->'coordinates','[1,1]'::jsonb,'M5 point coordinates preserve longitude/latitude');
select is(public.watermark_record_provider_success('review_fixture',now()-interval '1 hour'),true,'M6 records a successful actual contact');
select is(public.watermark_record_provider_success('review_fixture',now()),true,'M6 later contact supersedes earlier one');
select is(public.watermark_record_provider_success('review_fixture',now()-interval '2 hours'),false,'M6 reverse-arriving older write is ignored atomically');
select is((select last_success_at from public.source_status where source_id='review_fixture'),now(),'M6 success timestamp does not move backward');
select is((select checked_at from public.source_status where source_id='review_fixture'),now(),'M6 legacy public check alias remains monotonic');
select is((select status from public.source_status where source_id='review_fixture'),'available','M6 successful contact status remains intact');
select throws_ok($$select public.watermark_record_provider_success('review_fixture',now()+interval '1 day')$$,'22023','Invalid provider check time','M6 future provider check timestamps are rejected');
reset role;
select ok(not has_function_privilege('anon','public.watermark_record_provider_success(text,timestamptz)','EXECUTE'),'M6 browser cannot forge successful provider health');
select ok(not has_function_privilege('authenticated','public.watermark_record_provider_success(text,timestamptz)','EXECUTE'),'M6 authenticated browser cannot forge provider health');
select ok(not (select prosecdef from pg_proc where oid='public.watermark_record_provider_success(text,timestamptz)'::regprocedure),'M6 health RPC does not elevate privileges');
select * from finish();
rollback;
