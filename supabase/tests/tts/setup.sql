-- Minimal fixture for a NEW local/CI test database only, never a hosted project.
create schema watermark_private;
revoke all on schema watermark_private from public;
grant usage on schema watermark_private to service_role;
create table watermark_private.request_budgets (
  bucket text primary key,
  requests integer not null check (requests > 0),
  expires_at timestamptz not null
);
alter table watermark_private.request_budgets enable row level security;
revoke all on watermark_private.request_budgets from public, anon, authenticated;
grant select, insert, update, delete on watermark_private.request_budgets to service_role;
create policy backend_only on watermark_private.request_budgets for all to service_role using (true) with check (true);
