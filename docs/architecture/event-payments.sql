-- =========================================================
-- EVENT PAYMENTS — v0.1
-- Implementa ADR-011. Requiere core-schema.sql y events-schema.sql aplicados.
-- =========================================================

alter table events add column total_amount numeric(10,2);

create table event_payments (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  method text not null check (method in ('cash','transfer','bizum','card','other')),
  paid_at date not null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_event_payments_event on event_payments(event_id);
create index idx_event_payments_org on event_payments(organization_id);

alter table event_payments enable row level security;

create policy event_payments_isolation on event_payments
  for all using (organization_id in (select fn_user_organization_ids()));
