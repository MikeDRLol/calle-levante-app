-- =========================================================
-- KIT -> BUNDLE RESOLUTION — TESTS DE VALIDACIÓN v0.1
-- Ejecutar después de core-schema.sql, events-schema.sql y
-- kit-bundle-resolution.sql, contra el proyecto Supabase real.
-- =========================================================

-- =========================================================
-- 1. SETUP: organización, evento, kit de 2 líneas (material + vehículo),
--    y recursos donde una línea se resuelve completa y la otra solo
--    parcialmente (para probar el caso "falta 1 Subgrave", ADR-002/ADR-010)
-- =========================================================

do $$
declare
  v_org uuid;
  v_client uuid;
  v_event uuid;
  v_kit uuid;
  v_item_material uuid;
  v_item_vehicle uuid;
  v_material_ok uuid;
  v_material_repair uuid;
  v_vehicle_ok uuid;
begin
  insert into organizations (name, slug) values ('Calle Levante Test Kits', 'cl-test-kits')
    returning id into v_org;

  insert into clients (organization_id, name) values (v_org, 'Cliente Test Kits')
    returning id into v_client;

  insert into events (organization_id, client_id, event_type, name, start_at, end_at)
    values (v_org, v_client, 'concierto', 'Concierto Test Kits', '2026-12-01 10:00+01', '2026-12-01 18:00+01')
    returning id into v_event;

  insert into kits (organization_id, name, event_type) values (v_org, 'Kit Test', 'concierto')
    returning id into v_kit;

  insert into kit_items (kit_id, resource_category, resource_type, quantity)
    values (v_kit, 'Subgraves', 'material', 2)
    returning id into v_item_material;

  insert into kit_items (kit_id, resource_category, resource_type, quantity)
    values (v_kit, null, 'vehicle', 1)
    returning id into v_item_vehicle;

  -- Un Subgrave disponible...
  insert into resources (organization_id, resource_type, name, status)
    values (v_org, 'material', 'Subgrave A', 'available')
    returning id into v_material_ok;
  insert into materials_details (resource_id, category) values (v_material_ok, 'Subgraves');

  -- ...y otro que NO debe poder resolverse (en reparación) — así el kit_item
  -- pide 2 pero solo hay 1 disponible: debe resolver 1, no fallar ni bloquear el resto.
  insert into resources (organization_id, resource_type, name, status)
    values (v_org, 'material', 'Subgrave B (avería)', 'in_repair')
    returning id into v_material_repair;
  insert into materials_details (resource_id, category) values (v_material_repair, 'Subgraves');

  -- Un vehículo disponible, único candidato, para probar la línea que SÍ se resuelve al 100%.
  insert into resources (organization_id, resource_type, name, status)
    values (v_org, 'vehicle', 'Furgón Test Kits', 'available')
    returning id into v_vehicle_ok;
  insert into vehicles_details (resource_id, plate) values (v_vehicle_ok, 'KIT-001');

  perform set_config('test.org', v_org::text, false);
  perform set_config('test.event', v_event::text, false);
  perform set_config('test.kit', v_kit::text, false);
  perform set_config('test.item_material', v_item_material::text, false);
  perform set_config('test.item_vehicle', v_item_vehicle::text, false);
  perform set_config('test.material_ok', v_material_ok::text, false);
  perform set_config('test.vehicle_ok', v_vehicle_ok::text, false);

  raise notice 'SETUP OK: organización, evento, kit de 2 líneas y recursos de prueba creados.';
end $$;

-- =========================================================
-- 2. TEST: aplicar el Kit resuelve la línea de material PARCIALMENTE
--    (pide 2, solo 1 disponible) y la de vehículo COMPLETA (pide 1, hay 1)
-- =========================================================

do $$
declare
  v_event uuid := current_setting('test.event')::uuid;
  v_kit uuid := current_setting('test.kit')::uuid;
  v_material_ok uuid := current_setting('test.material_ok')::uuid;
  v_vehicle_ok uuid := current_setting('test.vehicle_ok')::uuid;
  v_row record;
  v_material_resolved int;
  v_vehicle_resolved int;
begin
  for v_row in select * from fn_apply_kit_to_event(v_kit, v_event) loop
    if v_row.resource_type = 'material' then
      v_material_resolved := v_row.quantity_resolved;
      if v_row.quantity_requested != 2 or v_row.quantity_resolved != 1 then
        raise exception 'TEST 2 FALLIDO: línea de material esperaba requested=2/resolved=1, obtuvo requested=%/resolved=%', v_row.quantity_requested, v_row.quantity_resolved;
      end if;
      if not (v_material_ok = any(v_row.resolved_resource_ids)) then
        raise exception 'TEST 2 FALLIDO: el recurso disponible (Subgrave A) no está entre los resueltos.';
      end if;
    elsif v_row.resource_type = 'vehicle' then
      v_vehicle_resolved := v_row.quantity_resolved;
      if v_row.quantity_requested != 1 or v_row.quantity_resolved != 1 then
        raise exception 'TEST 2 FALLIDO: línea de vehículo esperaba requested=1/resolved=1, obtuvo requested=%/resolved=%', v_row.quantity_requested, v_row.quantity_resolved;
      end if;
      if v_row.resolved_resource_ids != array[v_vehicle_ok] then
        raise exception 'TEST 2 FALLIDO: el vehículo resuelto no es el esperado.';
      end if;
    end if;
  end loop;

  if v_material_resolved is null or v_vehicle_resolved is null then
    raise exception 'TEST 2 FALLIDO: no se recibieron las 2 filas esperadas (una por kit_item).';
  end if;

  raise notice 'TEST 2 OK: resolución parcial de material (1/2) y completa de vehículo (1/1), tal como se esperaba — no aplicó "a medias en silencio", devolvió el hueco explícitamente.';
end $$;

-- =========================================================
-- 3. TEST: efectos colaterales — bundle_items, resource_bookings y
--    checklist (source='kit') coinciden con lo resuelto (1 + 1 = 2)
-- =========================================================

do $$
declare
  v_event uuid := current_setting('test.event')::uuid;
  v_bundle_items_count int;
  v_bookings_count int;
  v_checklist_count int;
begin
  select count(*) into v_bundle_items_count
  from bundle_items bi
  join bundles b on b.id = bi.bundle_id
  where b.event_id = v_event;

  select count(*) into v_bookings_count
  from resource_bookings where event_id = v_event;

  select count(*) into v_checklist_count
  from event_checklist_items where event_id = v_event and source = 'kit';

  if v_bundle_items_count != 2 then
    raise exception 'TEST 3 FALLIDO: se esperaban 2 bundle_items, hay %', v_bundle_items_count;
  end if;

  if v_bookings_count != 2 then
    raise exception 'TEST 3 FALLIDO: se esperaban 2 resource_bookings, hay %', v_bookings_count;
  end if;

  if v_checklist_count != 2 then
    raise exception 'TEST 3 FALLIDO: se esperaban 2 event_checklist_items con source=kit, hay %', v_checklist_count;
  end if;

  raise notice 'TEST 3 OK: bundle_items, resource_bookings y checklist (source=kit) generados correctamente (2 cada uno).';
end $$;

-- =========================================================
-- 4. TEST: el recurso en reparación NUNCA se reserva, aunque hiciera
--    falta para completar la cantidad pedida
-- =========================================================

do $$
declare
  v_material_repair_count int;
begin
  select count(*) into v_material_repair_count
  from resource_bookings rb
  join resources r on r.id = rb.resource_id
  where r.name = 'Subgrave B (avería)';

  if v_material_repair_count != 0 then
    raise exception 'TEST 4 FALLIDO: se reservó un recurso en reparación (status=in_repair).';
  end if;

  raise notice 'TEST 4 OK: el recurso en reparación nunca se consideró candidato.';
end $$;

-- =========================================================
-- 5. LIMPIEZA
-- =========================================================
-- bundle_items.resource_id NO tiene ON DELETE CASCADE (a propósito: protege
-- el historial de qué recurso se usó en qué bundle si alguien intenta borrar
-- un recurso con historial — la vía correcta para "retirar" un recurso es
-- status='retired', no un DELETE físico). Por eso hay que borrar bundle_items
-- explícitamente antes de que la cascada de organizations intente borrar
-- resources; si no, la FK bloquea el borrado. Se descubrió al ejecutar este
-- test contra la base real — ver Registro de validación de ADR-010.

do $$
declare
  v_org uuid := current_setting('test.org')::uuid;
begin
  delete from bundle_items where bundle_id in (select id from bundles where organization_id = v_org);
end $$;

delete from organizations where slug = 'cl-test-kits';

do $$
begin
  raise notice '=== TODOS LOS TESTS DE KIT -> BUNDLE PASARON ===';
end $$;
