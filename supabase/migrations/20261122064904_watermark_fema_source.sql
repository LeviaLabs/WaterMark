-- Add only source provenance; no schema, privilege, existing data or auth changes.
-- Already applied on the hosted project (version 20261122064904); this file records it in the repo.
insert into public.source_status(source_id,name,source_url)
values ('fema_nfhl','FEMA National Flood Hazard Layer',
        'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28')
on conflict (source_id) do nothing;
