alter table public.source_status add column last_success_at timestamptz;

-- Only successful, actual provider contacts are recorded. A location outcome
-- never becomes a global outage, and older completions cannot replace newer checks.
create function public.watermark_record_provider_success(p_source_id text,p_checked_at timestamptz)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_updated boolean;
begin
  if p_checked_at is null or not isfinite(p_checked_at) or p_checked_at > statement_timestamp()+interval '1 minute'
  then raise exception using errcode='22023',message='Invalid provider check time'; end if;
  update public.source_status set last_success_at=p_checked_at,checked_at=p_checked_at,status='available',error_code=null
  where source_id=p_source_id and (last_success_at is null or last_success_at < p_checked_at)
  returning true into v_updated;
  return coalesce(v_updated,false);
end;
$$;
revoke all on function public.watermark_record_provider_success(text,timestamptz) from public,anon,authenticated;
grant execute on function public.watermark_record_provider_success(text,timestamptz) to service_role;

create or replace function public.watermark_area_summary(p_lat float8,p_lon float8,p_radius_m float8)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
  perform public.watermark_validate_area(p_lat,p_lon,p_radius_m);
  with stations as (
    select s.*,ss.name as source_name,ss.source_url from public.monitoring_stations s
    join public.source_status ss using(source_id)
    where extensions.st_dwithin(s.location,extensions.st_setsrid(extensions.st_makepoint(p_lon,p_lat),4326)::extensions.geography,p_radius_m)
  ), events as (
    select e.* from public.flood_events e join stations s using(source_id,station_id)
    where e.started_at >= now()-interval '90 days' and e.started_at <= now()
  ), fetch_times as (
    select metadata_fetched_at as fetched_at from stations union all select fetched_at from events
  ), station_points as (
    select jsonb_build_object('sourceId',source_id,'sourceName',source_name,'sourceUrl',source_url,
      'stationId',station_id,'name',name,'metadataFetchedAt',metadata_fetched_at,
      'geometry',extensions.st_asgeojson(location::extensions.geometry)::jsonb) as point
    from stations order by source_id,station_id limit 100
  )
  select jsonb_build_object('stationCount',nullif((select count(*) from stations),0),
    'cachedEventCount',nullif((select count(*) from events),0),
    'sampledHistoricalMaxDepthMm',(select max(max_depth_mm) from events),
    'windowStart',now()-interval '90 days','windowEnd',now(),
    'cacheNewestFetchedAt',(select max(fetched_at) from fetch_times),
    'cacheOldestFetchedAt',(select min(fetched_at) from fetch_times),
    'coverageStatus','incomplete','zeroMatchesVerified',false,
    'stations',coalesce((select jsonb_agg(point) from station_points),'[]'::jsonb),
    'areaForecastStatus','insufficient_data') into v_result;
  return v_result;
end;
$$;
