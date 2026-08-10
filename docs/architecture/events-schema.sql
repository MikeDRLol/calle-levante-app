-- =========================================================
-- EVENTS MODULE SCHEMA — v0.1
-- Implementa ADR-009. Construido sobre el Core (organizations, resources,
-- resource_bookings, locations, role_permissions) — no duplica ninguna
-- lógica de disponibilidad propia, todo pasa por las funciones del Core.
-- Requiere que core-schema.sql (00001) ya esté aplicado.
-- =========================================================

-- =========================================================
-- 1. CLIENTS (mínimo — no es el CRM completo, ver ADR-009)
-- =========================================================

create table clients (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_clients_org on clients(organization_id);

-- =========================================================
-- 2. EVENTS
-- =========================================================

create table events (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid references clients(id),

  event_type text not null,
  name text not null,
  status text not null default 'draft' check (
    status in ('draft','confirmed','in_progress','completed','cancelled')
  ),

  start_at timestamptz not null,
  end_at timestamptz not null,

  venue_name text,
  venue_address text,
  venue_lat numeric(9,6),
  venue_lng numeric(9,6),

  responsible_resource_id uuid references resources(id),
  google_calendar_event_id text,
  notes text,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (end_at > start_at)
);

create index idx_events_org on events(organization_id);
create index idx_events_client on events(client_id);
create index idx_events_dates on events(organization_id, start_at, end_at);
create index idx_events_status on events(organization_id, status);

-- =========================================================
-- 3. CIERRE DE LAS FK DIFERIDAS DEL CORE (ADR-005 / ADR-009)
-- =========================================================

alter table resource_bookings
  add constraint fk_resource_bookings_event
  foreign key (event_id) references events(id) on delete cascade;

alter table locations
  add constraint fk_locations_event
  foreign key (event_id) references events(id) on delete cascade;

-- =========================================================
-- 4. KITS / BUNDLES (diseñados en ADR-002, materializados aquí porque
--    bundles.event_id necesitaba que events existiera primero)
-- =========================================================

create table kits (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  event_type text,
  created_at timestamptz not null default now()
);

create table kit_items (
  id uuid primary key default uuid_generate_v4(),
  kit_id uuid not null references kits(id) on delete cascade,
  resource_category text not null,
  resource_type text not null check (resource_type in ('material','vehicle','tool','equipment')),
  quantity integer not null check (quantity > 0)
);

create table bundles (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  source_kit_id uuid references kits(id),
  created_at timestamptz not null default now()
);

create table bundle_items (
  id uuid primary key default uuid_generate_v4(),
  bundle_id uuid not null references bundles(id) on delete cascade,
  resource_id uuid not null references resources(id),
  booking_id uuid references resource_bookings(id),
  unique (bundle_id, resource_id)
);

create index idx_kits_org on kits(organization_id);
create index idx_kit_items_kit on kit_items(kit_id);
create index idx_bundles_org on bundles(organization_id);
create index idx_bundles_event on bundles(event_id);
create index idx_bundle_items_bundle on bundle_items(bundle_id);

-- =========================================================
-- 5. CHECKLIST DINÁMICO POR EVENTO
-- =========================================================

create table event_checklist_items (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  label text not null,
  resource_id uuid references resources(id),
  source text not null default 'manual' check (source in ('manual','rider','kit','material')),
  is_checked boolean not null default false,
  checked_at timestamptz,
  checked_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_checklist_event on event_checklist_items(event_id);
create index idx_checklist_org on event_checklist_items(organization_id);

-- =========================================================
-- 6. RLS — mismo patrón de aislamiento del Core (fn_user_organization_ids)
-- =========================================================

alter table clients enable row level security;
alter table events enable row level security;
alter table kits enable row level security;
alter table kit_items enable row level security;
alter table bundles enable row level security;
alter table bundle_items enable row level security;
alter table event_checklist_items enable row level security;

create policy clients_isolation on clients
  for all using (organization_id in (select fn_user_organization_ids()));

create policy events_isolation on events
  for all using (organization_id in (select fn_user_organization_ids()));

create policy kits_isolation on kits
  for all using (organization_id in (select fn_user_organization_ids()));

create policy kit_items_isolation on kit_items
  for all using (
    kit_id in (select id from kits where organization_id in (select fn_user_organization_ids()))
  );

create policy bundles_isolation on bundles
  for all using (organization_id in (select fn_user_organization_ids()));

create policy bundle_items_isolation on bundle_items
  for all using (
    bundle_id in (select id from bundles where organization_id in (select fn_user_organization_ids()))
  );

create policy checklist_isolation on event_checklist_items
  for all using (organization_id in (select fn_user_organization_ids()));

-- =========================================================
-- NOTAS
-- =========================================================
-- 1. Events no implementa disponibilidad propia: crear un resource_booking
--    para un evento sigue pasando por fn_check_resource_availability y por
--    el exclude constraint no_overlapping_bookings del Core (ADR-003).
-- 2. Documents (Core, según ADR-005) sigue sin tabla propia — deuda
--    pendiente explícita, no resuelta en esta migración (ver ADR-009).
-- 3. Borrar un evento borra en cascada sus bookings, sus ubicaciones
--    temporales, sus bundles y su checklist — todo eso es historial
--    *del evento*, no historial general del almacén (que sigue protegido
--    por soft-delete, ADR-004).
