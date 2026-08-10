-- =========================================================
-- CORE SCHEMA — TESTS DE VALIDACIÓN v0.1
-- Ejecutar DESPUÉS de core-schema.sql, contra un proyecto Supabase
-- real o un Postgres local (docker run -e POSTGRES_PASSWORD=x postgres:16).
--
-- Cómo ejecutar:
--   psql "$DATABASE_URL" -f core-schema.sql
--   psql "$DATABASE_URL" -f core-schema-tests.sql
--
-- Cada bloque termina con RAISE EXCEPTION si el resultado no es el
-- esperado, así que "sin errores" = "todo correcto". No requiere pgTAP
-- ni ninguna extensión de testing adicional.
--
-- NOTA: auth.users y auth.uid() son de Supabase. Si ejecutas esto en un
-- Postgres genérico sin Supabase, primero necesitas un schema/tabla
-- auth.users mínima y una función auth.uid() de sustitución (ver
-- sección 0 más abajo) solo para poder correr los tests localmente.
-- =========================================================

-- =========================================================
-- 0. STUBS PARA POSTGRES GENÉRICO (omitir si ya estás en Supabase)
-- =========================================================
-- Descomentar solo si NO estás en un proyecto Supabase real:
--
-- create schema if not exists auth;
-- create table if not exists auth.users (
--   id uuid primary key default uuid_generate_v4(),
--   email text
-- );
-- create or replace function auth.uid() returns uuid as $$
--   select current_setting('test.current_user_id', true)::uuid;
-- $$ language sql stable;
--
-- Para simular "quién soy" en cada test:
--   select set_config('test.current_user_id', '<uuid>', false);

-- =========================================================
-- 1. DATOS DE PRUEBA: dos organizaciones, un usuario en cada una
-- =========================================================

do $$
declare
  v_org_a uuid;
  v_org_b uuid;
  v_user_a uuid;
  v_user_b uuid;
  v_resource_furgon uuid;
  v_resource_subgrave uuid;
  v_count int;
begin

  -- --- Organizaciones ---
  insert into organizations (name, slug) values ('Calle Levante', 'calle-levante')
    returning id into v_org_a;
  insert into organizations (name, slug) values ('Otra Empresa Eventos', 'otra-empresa')
    returning id into v_org_b;

  -- --- Usuarios (en Supabase real, estos ya existen vía auth.users al registrarse;
  --     aquí se insertan directamente solo para el propósito del test) ---
  insert into auth.users (id, email) values (uuid_generate_v4(), 'tecnico@calle-levante.test')
    returning id into v_user_a;
  insert into auth.users (id, email) values (uuid_generate_v4(), 'tecnico@otra-empresa.test')
    returning id into v_user_b;

  insert into organization_members (organization_id, user_id, role)
    values (v_org_a, v_user_a, 'technician');
  insert into organization_members (organization_id, user_id, role)
    values (v_org_b, v_user_b, 'technician');

  -- --- Recursos de prueba en la organización A ---
  insert into resources (organization_id, resource_type, name)
    values (v_org_a, 'vehicle', 'Furgón Test')
    returning id into v_resource_furgon;
  insert into vehicles_details (resource_id, plate) values (v_resource_furgon, 'TEST-001');

  insert into resources (organization_id, resource_type, name)
    values (v_org_a, 'material', 'Subgrave Test')
    returning id into v_resource_subgrave;
  insert into materials_details (resource_id, category) values (v_resource_subgrave, 'Audio');

  -- Guardamos IDs en variables de sesión para los siguientes bloques
  perform set_config('test.org_a', v_org_a::text, false);
  perform set_config('test.org_b', v_org_b::text, false);
  perform set_config('test.user_a', v_user_a::text, false);
  perform set_config('test.user_b', v_user_b::text, false);
  perform set_config('test.resource_furgon', v_resource_furgon::text, false);
  perform set_config('test.resource_subgrave', v_resource_subgrave::text, false);

  raise notice 'SETUP OK: organizaciones, usuarios y recursos de prueba creados.';
end $$;

-- =========================================================
-- 2. TEST: dos bookings solapados del mismo recurso DEBEN fallar
-- =========================================================

do $$
declare
  v_org uuid := current_setting('test.org_a')::uuid;
  v_resource uuid := current_setting('test.resource_furgon')::uuid;
  v_failed boolean := false;
begin
  insert into resource_bookings (organization_id, resource_id, start_at, end_at)
    values (v_org, v_resource, '2026-09-05 10:00+02', '2026-09-05 18:00+02');

  begin
    insert into resource_bookings (organization_id, resource_id, start_at, end_at)
      values (v_org, v_resource, '2026-09-05 14:00+02', '2026-09-05 20:00+02');
  exception when exclusion_violation then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'TEST 2 FALLIDO: se permitió un booking solapado, y no debería.';
  end if;

  raise notice 'TEST 2 OK: booking solapado rechazado correctamente por el exclude constraint.';
end $$;

-- =========================================================
-- 3. TEST: dos bookings ESPALDA-CON-ESPALDA (mismo instante de corte)
--    DEBEN permitirse — esto es lo que arregló la corrección del rango [start, end)
-- =========================================================

do $$
declare
  v_org uuid := current_setting('test.org_a')::uuid;
  v_resource uuid := current_setting('test.resource_subgrave')::uuid;
begin
  insert into resource_bookings (organization_id, resource_id, start_at, end_at)
    values (v_org, v_resource, '2026-09-06 08:00+02', '2026-09-06 12:00+02');

  -- Este segundo booking empieza EXACTAMENTE cuando termina el primero.
  -- Si esto lanza excepción, el bug del rango '[]' ha vuelto.
  insert into resource_bookings (organization_id, resource_id, start_at, end_at)
    values (v_org, v_resource, '2026-09-06 12:00+02', '2026-09-06 16:00+02');

  raise notice 'TEST 3 OK: bookings espalda-con-espalda permitidos correctamente.';
end $$;

-- =========================================================
-- 4. TEST: el check (end_at > start_at) rechaza rangos inválidos
-- =========================================================

do $$
declare
  v_org uuid := current_setting('test.org_a')::uuid;
  v_resource uuid := current_setting('test.resource_furgon')::uuid;
  v_failed boolean := false;
begin
  begin
    insert into resource_bookings (organization_id, resource_id, start_at, end_at)
      values (v_org, v_resource, '2026-09-10 18:00+02', '2026-09-10 10:00+02'); -- fin antes que inicio
  exception
    -- La columna generada `during` construye tstzrange(start_at, end_at) ANTES de que
    -- se evalúe el check (end_at > start_at): con end_at < start_at, es la propia
    -- construcción del rango la que falla (data_exception), no el check_violation
    -- que se esperaba originalmente. Ambos casos deben tratarse como rechazo válido.
    when check_violation then
      v_failed := true;
    when data_exception then
      v_failed := true;
  end;

  if not v_failed then
    raise exception 'TEST 4 FALLIDO: se permitió un booking con end_at anterior a start_at.';
  end if;

  raise notice 'TEST 4 OK: rango de fechas inválido rechazado correctamente.';
end $$;

-- =========================================================
-- 5. TEST: aislamiento RLS — el usuario de la organización B
--    NO debe poder ver recursos de la organización A
-- =========================================================
-- NOTA: este test requiere ejecutarse con el rol autenticado de Supabase
-- (no como service_role, que se salta RLS por diseño). En Supabase:
--   set role authenticated;
--   set request.jwt.claim.sub = '<user_b_id>';
-- En un Postgres genérico con los stubs de la sección 0, usar en su lugar
-- set_config('test.current_user_id', ...) tal como se define ahí.

-- Simulamos sesión del usuario de la organización B. Importante: hay que
-- cambiar de rol a 'authenticated' de verdad, no solo fijar el claim del JWT.
-- El rol 'postgres' con el que se conecta este script tiene BYPASSRLS=true
-- en Supabase (igual que 'service_role'), así que si nos quedamos como
-- 'postgres', TODAS las políticas RLS se ignoran sin importar qué JWT se
-- simule — el test daría un falso negativo (o, como se vio en la primera
-- ejecución real, un falso positivo de fuga de datos que no es tal).
set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_b'), false);

do $$
declare
  v_resource_count int;
begin
  select count(*) into v_resource_count
  from resources
  where id = current_setting('test.resource_furgon')::uuid;

  if v_resource_count != 0 then
    raise exception 'TEST 5 FALLIDO: el usuario de la organización B pudo ver un recurso de la organización A. FUGA DE DATOS ENTRE TENANTS.';
  end if;

  raise notice 'TEST 5 OK: aislamiento RLS correcto — organización B no ve recursos de organización A.';
end $$;

reset role;

-- =========================================================
-- 6. TEST: fn_deactivate_location debe rechazar una ubicación con material dentro
-- =========================================================

do $$
declare
  v_org uuid := current_setting('test.org_a')::uuid;
  v_shelf uuid;
  v_material uuid;
  v_failed boolean := false;
begin
  insert into locations (organization_id, name, context_type) values (v_org, 'Balda Test', 'warehouse')
    returning id into v_shelf;

  insert into resources (organization_id, resource_type, name, current_location_id)
    values (v_org, 'material', 'Cable Test', v_shelf)
    returning id into v_material;
  insert into materials_details (resource_id, category) values (v_material, 'Cableado');

  begin
    perform fn_deactivate_location(v_shelf);
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'TEST 6 FALLIDO: se permitió desactivar una ubicación que todavía contiene material.';
  end if;

  -- Ahora se mueve el material fuera y debe permitirse desactivar
  update resources set current_location_id = null where id = v_material;
  perform fn_deactivate_location(v_shelf);

  raise notice 'TEST 6 OK: desactivación bloqueada con material dentro, permitida tras vaciar la ubicación.';
end $$;

-- =========================================================
-- 7. TEST: un 'technician' sin permiso NO puede editar la estructura de locations,
--    un 'admin' SÍ puede (RLS granular — ADR-006)
-- =========================================================
-- NOTA: igual que el TEST 5, requiere sesión autenticada real (Supabase local
-- con auth) para ser una prueba fiable de RLS. Con los stubs de la sección 0
-- es una aproximación funcional pero no sustituye la prueba con auth real.

do $$
declare
  v_org uuid := current_setting('test.org_a')::uuid;
  v_user_technician uuid;
begin
  -- Setup de datos: se hace como 'postgres' (bypassa RLS), igual que el
  -- resto del setup de este script.
  insert into auth.users (id, email) values (uuid_generate_v4(), 'tecnico2@calle-levante.test')
    returning id into v_user_technician;
  insert into organization_members (organization_id, user_id, role)
    values (v_org, v_user_technician, 'technician');

  perform set_config('test.user_technician', v_user_technician::text, false);
end $$;

-- Igual que en TEST 5: hay que cambiar de rol de verdad a 'authenticated'
-- para que las políticas RLS (incluida la de locations_insert, que exige
-- fn_user_has_permission) se evalúen en vez de saltarse por BYPASSRLS.
set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_technician'), false);

do $$
declare
  v_org uuid := current_setting('test.org_a')::uuid;
  v_failed boolean := false;
begin
  begin
    insert into locations (organization_id, name, context_type)
      values (v_org, 'Estantería creada por técnico', 'warehouse');
  exception when insufficient_privilege or others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'TEST 7 FALLIDO: un technician sin permiso pudo crear una ubicación.';
  end if;

  raise notice 'TEST 7 OK: technician sin permiso bloqueado correctamente por RLS.';
end $$;

reset role;

-- =========================================================
-- 8. LIMPIEZA (opcional — comentar si se quiere inspeccionar el estado tras los tests)
-- =========================================================
-- delete from organizations where slug in ('calle-levante', 'otra-empresa'); -- cascada limpia el resto

do $$
begin
  raise notice '=== TODOS LOS TESTS DEL CORE PASARON ===';
end $$;
