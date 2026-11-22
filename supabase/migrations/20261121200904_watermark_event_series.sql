create function public.watermark_event_history(p_lat float8,p_lon float8)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
  perform public.watermark_validate_area(p_lat,p_lon,1000);
  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into v_result from (
    select e.source_id,ss.name as source_name,ss.source_url,e.station_id,
      e.started_at,e.ended_at,e.fetched_at,e.max_depth_mm,'mm'::text as units
    from public.flood_events e join public.monitoring_stations s using(source_id,station_id)
      join public.source_status ss using(source_id)
    where extensions.st_dwithin(s.location,extensions.st_setsrid(extensions.st_makepoint(p_lon,p_lat),4326)::extensions.geography,1000)
      and e.started_at >= now()-interval '90 days' and e.started_at <= now()
    order by e.started_at desc,e.station_id limit 101
  ) r;
  return v_result;
end;
$$;
revoke all on function public.watermark_event_history(float8,float8) from public,anon,authenticated;
grant execute on function public.watermark_event_history(float8,float8) to service_role;
