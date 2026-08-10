-- =========================================================
-- CORE SCHEMA — v0.1
-- Implementa ADR-001 (Resource unificado) y prepara ADR-003 (Bookings), ADR-004 (Digital Twin)
-- Motor genérico: no contiene ningún concepto propio de "eventos musicales".
-- =========================================================

create extension if not exists "uuid-ossp";
create extension if not exists btree_gist; -- necesario para el índice de exclusión de solapamiento

-- =========================================================
-- 1. IDENTITY / ORGANIZATIONS
-- =========================================================

create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,          -- usado para subdominios: {slug}.tuapp.com
  plan text not null default 'starter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- organization_members conecta auth.users (Supabase Auth) con organizaciones.
-- Un usuario puede pertenecer a varias organizaciones (ADR pendiente sobre multi-org por usuario).
create table organization_members (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','commercial','technician','accounting','client')),
  status text not null default 'active' check (status in ('active','invited','suspended')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index idx_org_members_user on organization_members(user_id);
create index idx_org_members_org on organization_members(organization_id);

-- =========================================================
-- 2. LOCATIONS (Digital Twin — ADR-004)
-- Árbol autoreferenciado. Sirve tanto para almacenes como para ubicaciones
-- temporales dentro de un evento (context_type = 'event').
-- =========================================================

create table locations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  parent_location_id uuid references locations(id), -- sin cascade: ver nota de soft-delete más abajo
  context_type text not null default 'warehouse' check (context_type in ('warehouse','event')),
  event_id uuid,  -- FK real añadida en el módulo Events (el Core no conoce "Event")
  name text not null,
  is_active boolean not null default true,  -- soft-delete: preserva el historial del Digital Twin
  created_at timestamptz not null default now()
);

create index idx_locations_org on locations(organization_id);
create index idx_locations_parent on locations(parent_location_id);
create index idx_locations_event on locations(event_id) where context_type = 'event';
create index idx_locations_active on locations(organization_id, is_active);

-- "Eliminar" una ubicación es desactivarla (is_active = false), nunca un DELETE físico:
-- así el historial del Digital Twin ("dónde estuvo esto en marzo") se conserva aunque
-- la estantería física ya no exista. Esta función da además un mensaje de negocio claro
-- en vez de un error crudo de integridad referencial cuando aún queda material dentro.
create or replace function fn_deactivate_location(p_location_id uuid)
returns void as $$
declare
  v_resource_count int;
  v_child_count int;
begin
  select count(*) into v_resource_count
  from resources where current_location_id = p_location_id and status != 'retired';

  select count(*) into v_child_count
  from locations where parent_location_id = p_location_id and is_active = true;

  if v_resource_count > 0 then
    raise exception 'No se puede eliminar esta ubicación: todavía contiene % artículo(s). Muévelos primero.', v_resource_count;
  end if;

  if v_child_count > 0 then
    raise exception 'No se puede eliminar esta ubicación: todavía tiene % sub-ubicación(es) activa(s) dentro.', v_child_count;
  end if;

  update locations set is_active = false where id = p_location_id;
end;
$$ language plpgsql;

-- =========================================================
-- 3. RESOURCES (ADR-001)
-- =========================================================

create table resources (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,

  resource_type text not null check (
    resource_type in ('person','material','vehicle','room','tool','equipment')
  ),
  -- Clasificación derivada de resource_type. Se rellena por trigger (ver más abajo).
  resource_class text not null check (resource_class in ('human','asset','space')),

  name text not null,
  status text not null default 'available' check (
    status in ('available','in_use','in_repair','out_of_service','retired')
  ),

  current_location_id uuid references locations(id),
  qr_code text unique,  -- código corto/uuid embebido en el QR físico

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_resources_org on resources(organization_id);
create index idx_resources_type on resources(organization_id, resource_type);
create index idx_resources_status on resources(organization_id, status);
create index idx_resources_qr on resources(qr_code);

-- Trigger: deriva resource_class a partir de resource_type, para que la aplicación
-- nunca tenga que decidirlo ni pueda dejarlo inconsistente.
create or replace function fn_set_resource_class()
returns trigger as $$
begin
  new.resource_class := case
    when new.resource_type = 'person' then 'human'
    when new.resource_type = 'room' then 'space'
    else 'asset'
  end;
  return new;
end;
$$ language plpgsql;

create trigger trg_set_resource_class
before insert or update of resource_type on resources
for each row execute function fn_set_resource_class();

-- ---- Tablas de detalle (1:1 con resources) ----

create table people_details (
  resource_id uuid primary key references resources(id) on delete cascade,
  phone text,
  email text,
  instruments text[],       -- ej. {'guitarra','voz'}
  functions text[],         -- ej. {'técnico sonido','conductor'}
  photo_url text
);

create table materials_details (
  resource_id uuid primary key references resources(id) on delete cascade,
  category text not null,       -- Audio, Luces, Cableado, Backline, DJ, Vídeo, Escenario, Consumibles, Otros
  subcategory text,
  serial_number text,
  supplier_id uuid,              -- FK real en módulo CRM/Procurement, no forzada aquí
  purchase_value numeric(10,2),
  depreciation_rate numeric(5,2),
  warranty_expiry date,
  manual_url text,
  invoice_url text
);

create table vehicles_details (
  resource_id uuid primary key references resources(id) on delete cascade,
  plate text not null,
  itv_expiry date,
  insurance_expiry date,
  mileage_km integer,
  next_service_km integer
);

create table rooms_details (
  resource_id uuid primary key references resources(id) on delete cascade,
  capacity integer,
  location_id uuid references locations(id)
);

-- =========================================================
-- 4. RESOURCE BOOKINGS (motor único de disponibilidad — ADR-003)
-- =========================================================

create table resource_bookings (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  resource_id uuid not null references resources(id) on delete cascade,

  event_id uuid,  -- FK real añadida en el módulo Events

  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed','tentative','cancelled')),

  -- Intervalo semiabierto [start, end): el instante de fin NO cuenta como
  -- ocupado, para permitir reservas espalda-con-espalda del mismo recurso
  -- (ej. furgón que termina un evento a las 18:00 y empieza otro a las 18:00).
  -- Con '[]' (ambos inclusivos) esas reservas legítimas serían rechazadas
  -- por error por el exclude constraint de más abajo.
  during tstzrange generated always as (tstzrange(start_at, end_at)) stored,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),

  check (end_at > start_at)
);

create index idx_bookings_org on resource_bookings(organization_id);
create index idx_bookings_resource on resource_bookings(resource_id);
create index idx_bookings_event on resource_bookings(event_id);

-- Regla no negociable del sistema: un resource no puede tener dos bookings
-- confirmados que se solapen en el tiempo. Postgres lo garantiza a nivel de
-- base de datos con un índice de exclusión — no depende de que la aplicación
-- lo compruebe correctamente en cada punto de entrada.
alter table resource_bookings
  add constraint no_overlapping_bookings
  exclude using gist (
    resource_id with =,
    during with &&
  )
  where (status = 'confirmed');

-- =========================================================
-- 5. AUDIT LOG (event-sourcing parcial para cambios sensibles)
-- =========================================================

create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid references auth.users(id),
  entity_type text not null,     -- 'resource' | 'booking' | 'settlement' | 'invoice' ...
  entity_id uuid not null,
  action text not null,          -- 'created' | 'updated' | 'status_changed' | 'deleted'
  diff jsonb,                    -- {"field": "amount", "from": 250, "to": 320}
  created_at timestamptz not null default now()
);

create index idx_audit_org on audit_log(organization_id);
create index idx_audit_entity on audit_log(entity_type, entity_id);

-- =========================================================
-- 6. DOMAIN EVENTS (outbox — desacopla módulos)
-- =========================================================

create table domain_events (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_type text not null,      -- 'EVENT_CREATED' | 'RESOURCE_STATUS_CHANGED' | 'SETTLEMENT_UPDATED' ...
  payload jsonb not null,
  processed_at timestamptz,      -- null = pendiente de procesar por el worker
  created_at timestamptz not null default now()
);

create index idx_domain_events_pending on domain_events(organization_id, created_at)
  where processed_at is null;

-- =========================================================
-- 6.5 ROLE PERMISSIONS (ADR-006)
-- Autorización granular por rol y acción, como datos configurables
-- por organización — no hardcodeada en cada política RLS.
-- =========================================================

create table role_permissions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','commercial','technician','accounting','client')),
  permission_key text not null,   -- convención 'modulo.accion', ej. 'locations.edit_structure'
  allowed boolean not null default false,
  unique (organization_id, role, permission_key)
);

create index idx_role_permissions_lookup on role_permissions(organization_id, role, permission_key);

create or replace function fn_user_has_permission(p_organization_id uuid, p_permission_key text)
returns boolean as $$
  select exists (
    select 1
    from organization_members om
    join role_permissions rp
      on rp.organization_id = om.organization_id
     and rp.role = om.role
    where om.user_id = auth.uid()
      and om.organization_id = p_organization_id
      and om.status = 'active'
      and rp.permission_key = p_permission_key
      and rp.allowed = true
  );
$$ language sql stable security definer
set search_path = public, pg_temp;

-- Siembra de valores por defecto al crear una organización.
-- Deliberadamente conservador: si una clave de permiso no se siembra aquí,
-- fn_user_has_permission devuelve false (fallo seguro: nadie puede, no todos pueden).
create or replace function fn_seed_default_permissions()
returns trigger as $$
begin
  insert into role_permissions (organization_id, role, permission_key, allowed) values
    (new.id, 'owner',      'locations.edit_structure', true),
    (new.id, 'admin',      'locations.edit_structure', true),
    (new.id, 'manager',    'locations.edit_structure', true),
    (new.id, 'technician', 'locations.edit_structure', false),
    (new.id, 'commercial', 'locations.edit_structure', false),
    (new.id, 'accounting', 'locations.edit_structure', false),
    (new.id, 'client',     'locations.edit_structure', false),

    -- organization.manage_permissions: quién puede editar la propia tabla de permisos.
    -- Sin esto, un manager con acceso de escritura a role_permissions podría
    -- concederse a sí mismo cualquier permiso.
    (new.id, 'owner', 'organization.manage_permissions', true),
    (new.id, 'admin',  'organization.manage_permissions', true);
  return new;
end;
$$ language plpgsql;

create trigger trg_seed_default_permissions
after insert on organizations
for each row execute function fn_seed_default_permissions();

-- Toda tabla de negocio queda bloqueada por defecto y solo accesible
-- dentro de la organización activa del usuario autenticado.
-- =========================================================

-- Función auxiliar: organizaciones a las que pertenece el usuario autenticado.
create or replace function fn_user_organization_ids()
returns setof uuid as $$
  select organization_id from organization_members
  where user_id = auth.uid() and status = 'active';
$$ language sql stable security definer
set search_path = public, pg_temp;

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table locations enable row level security;
alter table resources enable row level security;
alter table people_details enable row level security;
alter table materials_details enable row level security;
alter table vehicles_details enable row level security;
alter table rooms_details enable row level security;
alter table resource_bookings enable row level security;
alter table audit_log enable row level security;
alter table domain_events enable row level security;

create policy org_isolation on organizations
  for all using (id in (select fn_user_organization_ids()));

create policy org_members_isolation on organization_members
  for all using (organization_id in (select fn_user_organization_ids()));

-- locations: lectura abierta a todo miembro de la organización (necesitan ver
-- dónde está todo aunque no puedan reorganizar), escritura restringida por permiso (ADR-006).
create policy locations_select on locations
  for select using (organization_id in (select fn_user_organization_ids()));

create policy locations_insert on locations
  for insert with check (
    organization_id in (select fn_user_organization_ids())
    and fn_user_has_permission(organization_id, 'locations.edit_structure')
  );

create policy locations_update on locations
  for update using (
    organization_id in (select fn_user_organization_ids())
    and fn_user_has_permission(organization_id, 'locations.edit_structure')
  );

alter table role_permissions enable row level security;

create policy role_permissions_select on role_permissions
  for select using (organization_id in (select fn_user_organization_ids()));

create policy role_permissions_write on role_permissions
  for insert with check (
    organization_id in (select fn_user_organization_ids())
    and fn_user_has_permission(organization_id, 'organization.manage_permissions')
  );

create policy role_permissions_update on role_permissions
  for update using (
    organization_id in (select fn_user_organization_ids())
    and fn_user_has_permission(organization_id, 'organization.manage_permissions')
  );

create policy resources_isolation on resources
  for all using (organization_id in (select fn_user_organization_ids()));

create policy bookings_isolation on resource_bookings
  for all using (organization_id in (select fn_user_organization_ids()));

create policy audit_isolation on audit_log
  for all using (organization_id in (select fn_user_organization_ids()));

create policy domain_events_isolation on domain_events
  for all using (organization_id in (select fn_user_organization_ids()));

-- Las tablas de detalle heredan el aislamiento a través del resource_id
create policy people_details_isolation on people_details
  for all using (
    resource_id in (select id from resources where organization_id in (select fn_user_organization_ids()))
  );

create policy materials_details_isolation on materials_details
  for all using (
    resource_id in (select id from resources where organization_id in (select fn_user_organization_ids()))
  );

create policy vehicles_details_isolation on vehicles_details
  for all using (
    resource_id in (select id from resources where organization_id in (select fn_user_organization_ids()))
  );

create policy rooms_details_isolation on rooms_details
  for all using (
    resource_id in (select id from resources where organization_id in (select fn_user_organization_ids()))
  );

-- =========================================================
-- NOTAS
-- =========================================================
-- 1. El constraint `no_overlapping_bookings` es la implementación real de la
--    regla de negocio "nunca reservar un recurso ocupado" — vive en la base
--    de datos, no solo en código de aplicación, por lo que ninguna vía de
--    escritura (API, script, admin panel) puede saltársela.
-- 2. `event_id` en `locations` y `resource_bookings` se deja sin FK real
--    porque Events pertenece a un módulo, no al Core (ver ADR sobre
--    frontera Core/Módulos). La integridad se refuerza a nivel de aplicación
--    y, si se prefiere más rigidez, con una FK diferida añadida desde el
--    propio módulo Events tras su creación.
-- 3. Este esquema es aditivo por diseño: añadir un nuevo resource_type no
--    rompe nada existente; añadir una tabla `xxx_details` nueva tampoco.
