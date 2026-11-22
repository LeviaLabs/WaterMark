-- Agentboxd alert inbox: screened flood-alert email as map evidence.
-- New objects only; no existing table, function or migration is changed.
-- One row per Agentboxd message id. The email body is never stored: an accepted message
-- contributes only a USGS monitoring-location id, and the reading itself is fetched from USGS.
-- Quarantined rows keep the reason and the screening scores, never the sender or subject text.

create table watermark_private.email_alerts (
  message_id text primary key check (length(message_id) between 1 and 100),
  received_at timestamptz not null,
  status text not null check (status in ('accepted', 'quarantined')),
  reason text not null check (length(reason) between 1 and 40),
  sender_domain text check (sender_domain is null or length(sender_domain) <= 253),
  injection real check (injection is null or injection between 0 and 1),
  phishing real check (phishing is null or phishing between 0 and 1),
  screening_state text check (screening_state is null or length(screening_state) <= 40),
  site_id text check (site_id is null or site_id ~ '^[0-9]{8,15}$'),
  site_name text check (site_name is null or length(site_name) <= 200),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  readings jsonb check (readings is null or jsonb_typeof(readings) = 'array'),
  created_at timestamptz not null default now(),
  -- An accepted alert always names a USGS site; a quarantined one never exposes one.
  constraint email_alerts_accepted_has_site check (status = 'quarantined' or site_id is not null)
);
create index email_alerts_recent_idx on watermark_private.email_alerts (received_at desc);

-- The screening decision is final: no update may change a row's identity, status, reason or
-- scores (so a quarantined message can never become accepted, by retry, message.released or a
-- bug in a later RPC). Only the USGS reading columns may be filled in afterwards.
create function watermark_private.email_alerts_decision_is_final() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.message_id is distinct from old.message_id or new.status is distinct from old.status
     or new.reason is distinct from old.reason or new.site_id is distinct from old.site_id
     or new.sender_domain is distinct from old.sender_domain or new.injection is distinct from old.injection
     or new.phishing is distinct from old.phishing or new.screening_state is distinct from old.screening_state
     or new.received_at is distinct from old.received_at then
    raise exception 'email_alerts: screening decision is final' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function watermark_private.email_alerts_decision_is_final() from public, anon, authenticated;
create trigger email_alerts_decision_is_final before update on watermark_private.email_alerts
  for each row execute function watermark_private.email_alerts_decision_is_final();

alter table watermark_private.email_alerts enable row level security;
revoke all on watermark_private.email_alerts from public, anon, authenticated;
grant select, insert, update, delete on watermark_private.email_alerts to service_role;
create policy backend_only on watermark_private.email_alerts for all to service_role using (true) with check (true);

-- Record the screening decision once per message. False when the message id is already known
-- (Agentboxd can deliver one message as message.enriched and again as message.released).
create or replace function public.watermark_email_alert_record(
  p_message_id text, p_received_at timestamptz, p_status text, p_reason text, p_sender_domain text,
  p_injection real, p_phishing real, p_screening_state text, p_site_id text
) returns boolean language plpgsql security invoker set search_path='' as $$
declare inserted integer;
begin
  insert into watermark_private.email_alerts
    (message_id, received_at, status, reason, sender_domain, injection, phishing, screening_state, site_id)
  values (p_message_id, p_received_at, p_status, p_reason, p_sender_domain, p_injection, p_phishing,
          p_screening_state, p_site_id)
  on conflict (message_id) do nothing;
  get diagnostics inserted = row_count;
  -- Keep 90 days; older evidence is not shown.
  delete from watermark_private.email_alerts where received_at < now() - interval '90 days';
  return inserted = 1;
end $$;

-- Attach the official USGS reading to an accepted alert.
create or replace function public.watermark_email_alert_set_reading(
  p_message_id text, p_site_name text, p_latitude double precision, p_longitude double precision, p_readings jsonb
) returns void language plpgsql security invoker set search_path='' as $$
begin
  update watermark_private.email_alerts
  set site_name = p_site_name, latitude = p_latitude, longitude = p_longitude, readings = p_readings
  where message_id = p_message_id and status = 'accepted';
end $$;

-- Public evidence for the last p_days days (newest first). Never sender or subject.
create or replace function public.watermark_email_alerts_recent(p_days integer, p_limit integer)
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.received_at desc), '[]'::jsonb)
  from (
    select message_id, received_at, status, reason, injection, phishing, screening_state,
           site_id, site_name, latitude, longitude, readings
    from watermark_private.email_alerts
    where received_at > now() - make_interval(days => least(greatest(p_days, 1), 30))
    order by received_at desc
    limit least(greatest(p_limit, 1), 200)
  ) r;
$$;

revoke all on function
  public.watermark_email_alert_record(text,timestamptz,text,text,text,real,real,text,text),
  public.watermark_email_alert_set_reading(text,text,double precision,double precision,jsonb),
  public.watermark_email_alerts_recent(integer,integer)
from public, anon, authenticated;
grant execute on function
  public.watermark_email_alert_record(text,timestamptz,text,text,text,real,real,text,text),
  public.watermark_email_alert_set_reading(text,text,double precision,double precision,jsonb),
  public.watermark_email_alerts_recent(integer,integer)
to service_role;
