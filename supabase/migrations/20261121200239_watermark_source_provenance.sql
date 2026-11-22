alter table public.source_status add column name text;
alter table public.source_status add column source_url text;
update public.source_status set
  name=case source_id
    when 'nws' then 'US National Weather Service'
    when 'open_meteo_weather' then 'Open-Meteo Weather'
    when 'open_meteo_glofas' then 'Open-Meteo / GloFAS'
    when 'nyc_floodnet' then 'FloodNet / NYC Open Data'
    when 'nyc_stormwater' then 'NYC Stormwater Flood Maps' end,
  source_url=case source_id
    when 'nws' then 'https://www.weather.gov/documentation/services-web-api'
    when 'open_meteo_weather' then 'https://open-meteo.com/en/docs'
    when 'open_meteo_glofas' then 'https://open-meteo.com/en/docs/flood-api'
    when 'nyc_floodnet' then 'https://data.cityofnewyork.us/d/aq7i-eu5q'
    when 'nyc_stormwater' then 'https://data.cityofnewyork.us/d/9i7c-xyvv' end;
alter table public.source_status alter column name set not null;
alter table public.source_status alter column source_url set not null;
alter table public.source_status add constraint source_status_source_url_check check (source_url like 'https://%');

create or replace function public.watermark_history(p_lat float8,p_lon float8)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
  perform public.watermark_validate_area(p_lat,p_lon,1000);
  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into v_result from (
    select o.source_id,ss.name as source_name,ss.source_url,o.station_id,o.observed_at,o.fetched_at,o.metric,o.value,o.units,o.quality_flags,
      o.observed_at+make_interval(secs=>s.freshness_seconds) < now() as stale
    from public.historical_observations o join public.monitoring_stations s using(source_id,station_id)
      join public.source_status ss using(source_id)
    where extensions.st_dwithin(s.location,extensions.st_setsrid(extensions.st_makepoint(p_lon,p_lat),4326)::extensions.geography,1000)
      and o.observed_at >= now()-interval '90 days' and o.observed_at <= now()
    order by o.observed_at desc limit 100
  ) r;
  return v_result;
end;
$$;
