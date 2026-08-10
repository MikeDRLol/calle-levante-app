-- =========================================================
-- EVENTS MODULE — TESTS DE VALIDACIÓN v0.1
-- Ejecutar DESPUÉS de core-schema.sql y events-schema.sql, contra el mismo
-- proyecto Supabase real usado para validar el Core (ver ADR-001, "Registro
-- de validación", para el patrón de ejecución: no usar `supabase db query -f`
-- en ficheros multi-sentencia, usar un cliente que mande el fichero completo
-- como una sola query de protocolo simple).
--
-- Lecciones ya aprendidas de la validación del Core, aplicadas aquí desde
-- el principio:
--   - Los RAISE NOTICE/EXCEPTION van siempre dentro de un DO $$ ... $$.
--   - Los tests de RLS necesitan `set role authenticated;` de verdad, no
--     solo simular el JWT — conectado como 'postgres' se salta RLS por
--     BYPASSRLS=true.
-- =========================================================

-- =========================================================
-- 1. SETUP: dos organizaciones, un usuario en cada una, un cliente y un
--    evento en la organización A
-- =========================================================

do $$
declare
  v_org_a uuid;
  v_org_b uuid;
  v_user_a uuid;
  v_user_b uuid;
  v_client uuid;
  v_event uuid;
  v_resource_furgon uuid;
begin
  insert into organizations (name, slug) values ('Calle Levante Test Events', 'cl-test-events')
    returning id into v_org_a;
  insert into organizations (name, slug) values ('Otra Empresa Test Events', 'otra-test-events')
    returning id into v_org_b;

  insert into auth.users (id, email) values (uuid_generate_v4(), 'tecnico-events@calle-levante.test')
    returning id into v_user_a;
  insert into auth.users (id, email) values (uuid_generate_v4(), 'tecnico-events@otra-empresa.test')
    returning id into v_user_b;

  insert into organization_members (organization_id, user_id, role) values (v_org_a, v_user_a, 'technician');
  insert into organization_members (organization_id, user_id, role) values (v_org_b, v_user_b, 'technician');

  insert into clients (organization_id, name) values (v_org_a, 'Familia García')
    returning id into v_client;

  insert into events (organization_id, client_id, event_type, name, start_at, end_at)
    values (v_org_a, v_client, 'boda', 'Boda García', '2026-10-10 12:00+02', '2026-10-10 23:00+02')
    returning id into v_event;

  insert into resources (organization_id, resource_type, name)
    values (v_org_a, 'vehicle', 'Furgón Test Events')
    returning id into v_resource_furgon;
  insert into vehicles_details (resource_id, plate) values (v_resource_furgon, 'EVT-001');

  perform set_config('test.org_a', v_org_a::text, false);
  perform set_config('test.org_b', v_org_b::text, false);
  perform set_config('test.user_a', v_user_a::text, false);
  perform set_config('test.user_b', v_user_b::text, false);
  perform set_config('test.client', v_client::text, false);
  perform set_config('test.event', v_event::text, false);
  perform set_config('test.resource_furgon', v_resource_furgon::text, false);

  raise notice 'SETUP OK: organizaciones, cliente, evento y recurso de prueba creados.';
end $$;

-- =========================================================
-- 2. TEST: un resource_booking no puede referenciar un event_id inexistente
--    (la FK diferida del Core que esta ADR cierra — ADR-009)
-- =========================================================

do $$
declare
  v_org uuid := current_setting('test.org_a')::uuid;
  v_resource uuid := current_setting('test.resource_furgon')::uuid;
  v_failed boolean := false;
begin
  begin
    insert into resource_bookings (organization_id, resource_id, event_id, start_at, end_at)
      values (v_org, v_resource, uuid_generate_v4(), '2026-11-01 10:00+02', '2026-11-01 18:00+02');
  exception when foreign_key_violation then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'TEST 2 FALLIDO: se permitió un booking con event_id inexistente — la FK diferida no está activa.';
  end if;

  raise notice 'TEST 2 OK: booking con event_id inexistente rechazado por la FK real (ADR-009).';
end $$;

-- =========================================================
-- 3. TEST: reservar el recurso para el evento real SÍ funciona, y borrar el
--    evento borra en cascada su booking
-- =========================================================

do $$
declare
  v_org uuid := current_setting('test.org_a')::uuid;
  v_resource uuid := current_setting('test.resource_furgon')::uuid;
  v_event uuid := current_setting('test.event')::uuid;
  v_booking uuid;
  v_booking_count int;
begin
  insert into resource_bookings (organization_id, resource_id, event_id, start_at, end_at)
    values (v_org, v_resource, v_event, '2026-10-10 08:00+02', '2026-10-10 23:00+02')
    returning id into v_booking;

  delete from events where id = v_event;

  select count(*) into v_booking_count from resource_bookings where id = v_booking;

  if v_booking_count != 0 then
    raise exception 'TEST 3 FALLIDO: el booking sobrevivió al borrado del evento (debería borrarse en cascada).';
  end if;

  -- Recreamos el evento para el resto de tests (se borró a propósito arriba)
  insert into events (id, organization_id, client_id, event_type, name, start_at, end_at)
    values (v_event, v_org, current_setting('test.client')::uuid, 'boda', 'Boda García', '2026-10-10 12:00+02', '2026-10-10 23:00+02');

  raise notice 'TEST 3 OK: reserva contra evento real permitida, y el borrado en cascada del evento funciona.';
end $$;

-- =========================================================
-- 4. TEST: aislamiento RLS — organización B no ve eventos ni clientes de la
--    organización A (mismo patrón que TEST 5/7 de core-schema-tests.sql:
--    hay que cambiar de rol de verdad)
-- =========================================================

set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_b'), false);

do $$
declare
  v_event_count int;
  v_client_count int;
begin
  select count(*) into v_event_count from events where id = current_setting('test.event')::uuid;
  select count(*) into v_client_count from clients where id = current_setting('test.client')::uuid;

  if v_event_count != 0 or v_client_count != 0 then
    raise exception 'TEST 4 FALLIDO: la organización B pudo ver el evento o el cliente de la organización A.';
  end if;

  raise notice 'TEST 4 OK: aislamiento RLS correcto en events y clients.';
end $$;

reset role;

-- =========================================================
-- 5. TEST: checklist dinámico — marcar un ítem ligado a un recurso
-- =========================================================

do $$
declare
  v_org uuid := current_setting('test.org_a')::uuid;
  v_event uuid := current_setting('test.event')::uuid;
  v_resource uuid := current_setting('test.resource_furgon')::uuid;
  v_item uuid;
  v_is_checked boolean;
begin
  insert into event_checklist_items (organization_id, event_id, label, resource_id, source)
    values (v_org, v_event, 'Cargar Furgón Test Events', v_resource, 'manual')
    returning id into v_item;

  -- Simula lo que hace "Modo Carga" al escanear el QR del recurso
  update event_checklist_items
    set is_checked = true, checked_at = now()
    where event_id = v_event and resource_id = v_resource;

  select is_checked into v_is_checked from event_checklist_items where id = v_item;

  if not v_is_checked then
    raise exception 'TEST 5 FALLIDO: el ítem del checklist no se marcó al simular el escaneo del QR.';
  end if;

  raise notice 'TEST 5 OK: checklist dinámico — marcado por resource_id funciona.';
end $$;

-- =========================================================
-- 6. LIMPIEZA
-- =========================================================

delete from organizations where slug in ('cl-test-events', 'otra-test-events');
delete from auth.users where email in ('tecnico-events@calle-levante.test', 'tecnico-events@otra-empresa.test');

do $$
begin
  raise notice '=== TODOS LOS TESTS DE EVENTS PASARON ===';
end $$;
