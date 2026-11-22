create extension if not exists postgis with schema extensions;

create table public.source_status (
  source_id text primary key,
  status text not null default 'unknown' check (status in ('unknown','available','stale','insufficient_data','unsupported','error')),
  checked_at timestamptz,
  error_code text check (length(error_code) <= 100)
);
insert into public.source_status(source_id) values
  ('nws'), ('open_meteo_weather'), ('open_meteo_glofas'), ('nyc_floodnet'), ('nyc_stormwater');

create table public.monitoring_stations (
  source_id text not null references public.source_status(source_id),
  station_id text not null check (length(station_id) between 1 and 120),
  name text not null check (length(name) <= 200),
  location extensions.geography(point,4326) not null,
  freshness_seconds integer not null default 3600 check (freshness_seconds between 60 and 86400),
  metadata_fetched_at timestamptz not null default now(),
  primary key(source_id,station_id)
);
create index monitoring_stations_location_gix on public.monitoring_stations using gist(location);

create table public.flood_events (
  source_id text not null,
  station_id text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  max_depth_mm double precision not null check (max_depth_mm >= 0 and max_depth_mm < 'Infinity'::float8),
  fetched_at timestamptz not null default now(),
  primary key(source_id,station_id,started_at),
  foreign key(source_id,station_id) references public.monitoring_stations(source_id,station_id),
  check (ended_at is null or ended_at >= started_at)
);
create index flood_events_started_at_idx on public.flood_events(started_at desc);

create table public.historical_observations (
  id uuid primary key default gen_random_uuid(),
  source_id text not null,
  station_id text not null,
  observed_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  metric text not null check (metric in ('water_depth','river_discharge')),
  value double precision not null check (value >= 0 and value < 'Infinity'::float8),
  units text not null,
  quality_flags text[] not null default '{}',
  foreign key(source_id,station_id) references public.monitoring_stations(source_id,station_id),
  unique(source_id,station_id,metric,observed_at),
  check ((metric='water_depth' and units='mm') or (metric='river_discharge' and units='m3/s'))
);
create index historical_observations_station_time_idx on public.historical_observations(source_id,station_id,observed_at desc);

create schema watermark_private;
revoke all on schema watermark_private from public, anon, authenticated;
grant usage on schema watermark_private to service_role;
create table watermark_private.request_budgets (
  bucket text primary key,
  requests integer not null check (requests > 0),
  expires_at timestamptz not null
);

alter table public.source_status enable row level security;
alter table public.monitoring_stations enable row level security;
alter table public.flood_events enable row level security;
alter table public.historical_observations enable row level security;
alter table watermark_private.request_budgets enable row level security;

revoke all on public.source_status, public.monitoring_stations, public.flood_events,
  public.historical_observations from public, anon, authenticated;
grant select, insert, update, delete on public.source_status, public.monitoring_stations,
  public.flood_events, public.historical_observations to service_role;
grant select, insert, update, delete on watermark_private.request_budgets to service_role;
create policy backend_only on public.source_status for all to service_role using (true) with check (true);
create policy backend_only on public.monitoring_stations for all to service_role using (true) with check (true);
create policy backend_only on public.flood_events for all to service_role using (true) with check (true);
create policy backend_only on public.historical_observations for all to service_role using (true) with check (true);
create policy backend_only on watermark_private.request_budgets for all to service_role using (true) with check (true);

create function public.watermark_take_budget() returns boolean
language plpgsql security invoker set search_path='' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_ok boolean;
begin
  delete from watermark_private.request_budgets where expires_at < v_now;
  insert into watermark_private.request_budgets(bucket,requests,expires_at)
  values ('minute:' || date_trunc('minute',v_now)::text,1,v_now+interval '2 minutes')
  on conflict(bucket) do update set requests=request_budgets.requests+1
  where request_budgets.requests<60 returning true into v_ok;
  if not coalesce(v_ok,false) then return false; end if;
  v_ok := false;
  insert into watermark_private.request_budgets(bucket,requests,expires_at)
  values ('day:' || (v_now at time zone 'UTC')::date::text,1,v_now+interval '2 days')
  on conflict(bucket) do update set requests=request_budgets.requests+1
  where request_budgets.requests<4000 returning true into v_ok;
  return coalesce(v_ok,false);
end;
$$;

create function public.watermark_validate_area(p_lat float8,p_lon float8,p_radius_m float8)
returns void language plpgsql immutable security invoker set search_path='' as $$
begin
  if p_lat is null or p_lon is null or p_radius_m is null or
    not (p_lat between -90 and 90 and p_lon between -180 and 180 and p_radius_m between 100 and 10000)
  then raise exception using errcode='22023', message='Invalid geographic query'; end if;
end;
$$;

create function public.watermark_area_summary(p_lat float8,p_lon float8,p_radius_m float8)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
  perform public.watermark_validate_area(p_lat,p_lon,p_radius_m);
  with stations as (
    select source_id,station_id from public.monitoring_stations
    where extensions.st_dwithin(location,extensions.st_setsrid(extensions.st_makepoint(p_lon,p_lat),4326)::extensions.geography,p_radius_m)
  ), events as (
    select e.* from public.flood_events e join stations s using(source_id,station_id)
    where e.started_at >= now()-interval '90 days'
  )
  select jsonb_build_object('stationCount',(select count(*) from stations),
    'cachedEventCount',(select count(*) from events),
    'sampledHistoricalMaxDepthMm',(select max(max_depth_mm) from events),
    'windowStart',now()-interval '90 days','windowEnd',now(),
    'coverage','Only cached public sensor records; incomplete coverage and publication delays apply',
    'areaForecastStatus','insufficient_data') into v_result;
  return v_result;
end;
$$;

create function public.watermark_history(p_lat float8,p_lon float8)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
  perform public.watermark_validate_area(p_lat,p_lon,1000);
  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into v_result from (
    select o.source_id,o.station_id,o.observed_at,o.fetched_at,o.metric,o.value,o.units,o.quality_flags,
      o.observed_at+make_interval(secs=>s.freshness_seconds) < now() as stale
    from public.historical_observations o join public.monitoring_stations s using(source_id,station_id)
    where extensions.st_dwithin(s.location,extensions.st_setsrid(extensions.st_makepoint(p_lon,p_lat),4326)::extensions.geography,1000)
      and o.observed_at >= now()-interval '90 days' and o.observed_at <= now()
    order by o.observed_at desc limit 100
  ) r;
  return v_result;
end;
$$;

create function public.watermark_cache_floodnet(p_stations jsonb,p_events jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare s jsonb; e jsonb; v_lat float8; v_lon float8;
begin
  if jsonb_typeof(p_stations) <> 'array' or jsonb_typeof(p_events) <> 'array' or
    jsonb_array_length(p_stations)>50 or jsonb_array_length(p_events)>100
  then raise exception using errcode='22023',message='Invalid cache batch'; end if;
  for s in select value from jsonb_array_elements(p_stations) loop
    v_lat := (s->'location'->>'lat')::float8; v_lon := (s->'location'->>'lon')::float8;
    perform public.watermark_validate_area(v_lat,v_lon,1000);
    insert into public.monitoring_stations(source_id,station_id,name,location)
    values('nyc_floodnet',s->>'id',s->>'name',extensions.st_setsrid(extensions.st_makepoint(v_lon,v_lat),4326)::extensions.geography)
    on conflict(source_id,station_id) do update set name=excluded.name,location=excluded.location,metadata_fetched_at=now();
  end loop;
  for e in select value from jsonb_array_elements(p_events) loop
    if (e->>'startedAt')::timestamptz > now() or (e->>'startedAt')::timestamptz < now()-interval '91 days'
    then raise exception using errcode='22023',message='Invalid historical event time'; end if;
    insert into public.flood_events(source_id,station_id,started_at,ended_at,max_depth_mm)
    values('nyc_floodnet',e->>'stationId',(e->>'startedAt')::timestamptz,(e->>'endedAt')::timestamptz,(e->>'maxDepthMm')::float8)
    on conflict(source_id,station_id,started_at) do update set ended_at=excluded.ended_at,max_depth_mm=excluded.max_depth_mm,fetched_at=now();
  end loop;
  delete from public.flood_events where started_at < now()-interval '90 days';
  delete from public.historical_observations where observed_at < now()-interval '90 days';
end;
$$;

revoke all on function public.watermark_take_budget(), public.watermark_validate_area(float8,float8,float8),
  public.watermark_area_summary(float8,float8,float8), public.watermark_history(float8,float8),
  public.watermark_cache_floodnet(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.watermark_take_budget(), public.watermark_validate_area(float8,float8,float8),
  public.watermark_area_summary(float8,float8,float8), public.watermark_history(float8,float8),
  public.watermark_cache_floodnet(jsonb,jsonb) to service_role;
