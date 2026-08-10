-- =========================================================
-- SETTLEMENTS — TESTS DE VALIDACIÓN v0.1
-- =========================================================

-- =========================================================
-- 1. SETUP: organización, evento, 3 personas.
--    Alice y Carol tienen saldo positivo (se les debe), Bob tiene saldo
--    negativo (cobró de más / tiene que repartir) — exactamente el caso
--    "cada persona queda con saldo positivo o negativo" del documento
--    original. Los saldos suman 0 a propósito para poder comprobar que
--    el algoritmo salda todo con el mínimo de transferencias.
-- =========================================================

do $$
declare
  v_org uuid;
  v_event uuid;
  v_alice uuid;
  v_bob uuid;
  v_carol uuid;
begin
  insert into organizations (name, slug) values ('Calle Levante Test Settlements', 'cl-test-settlements')
    returning id into v_org;

  insert into events (organization_id, event_type, name, start_at, end_at)
    values (v_org, 'boda', 'Boda Test Settlements', '2026-12-05 12:00+01', '2026-12-05 23:00+01')
    returning id into v_event;

  insert into resources (organization_id, resource_type, name, status)
    values (v_org, 'person', 'Alice Test', 'available') returning id into v_alice;
  insert into resources (organization_id, resource_type, name, status)
    values (v_org, 'person', 'Bob Test', 'available') returning id into v_bob;
  insert into resources (organization_id, resource_type, name, status)
    values (v_org, 'person', 'Carol Test', 'available') returning id into v_carol;

  insert into event_settlement_participants (organization_id, event_id, resource_id, amount_owed)
    values
      (v_org, v_event, v_alice, 100.00),
      (v_org, v_event, v_bob, -150.00),
      (v_org, v_event, v_carol, 50.00);

  perform set_config('test.org', v_org::text, false);
  perform set_config('test.event', v_event::text, false);
  perform set_config('test.alice', v_alice::text, false);
  perform set_config('test.bob', v_bob::text, false);
  perform set_config('test.carol', v_carol::text, false);

  raise notice 'SETUP OK: evento con 3 participantes (Alice +100, Bob -150, Carol +50).';
end $$;

-- =========================================================
-- 2. TEST: el algoritmo genera el mínimo de transferencias (2, no 3) y
--    Bob (el único deudor) es quien paga a los dos acreedores
-- =========================================================

do $$
declare
  v_event uuid := current_setting('test.event')::uuid;
  v_alice uuid := current_setting('test.alice')::uuid;
  v_bob uuid := current_setting('test.bob')::uuid;
  v_carol uuid := current_setting('test.carol')::uuid;
  v_transfer_count int;
  v_bob_to_alice numeric;
  v_bob_to_carol numeric;
begin
  perform fn_calculate_event_settlement(v_event);

  select count(*) into v_transfer_count
  from settlement_transfers where event_id = v_event and status = 'pending';

  if v_transfer_count != 2 then
    raise exception 'TEST 2 FALLIDO: se esperaban 2 transferencias, hay %', v_transfer_count;
  end if;

  select amount into v_bob_to_alice from settlement_transfers
    where event_id = v_event and from_resource_id = v_bob and to_resource_id = v_alice;
  select amount into v_bob_to_carol from settlement_transfers
    where event_id = v_event and from_resource_id = v_bob and to_resource_id = v_carol;

  if v_bob_to_alice != 100.00 or v_bob_to_carol != 50.00 then
    raise exception 'TEST 2 FALLIDO: importes incorrectos (Bob->Alice=%, Bob->Carol=%)', v_bob_to_alice, v_bob_to_carol;
  end if;

  raise notice 'TEST 2 OK: 2 transferencias (mínimo posible para 3 participantes), Bob paga 100 a Alice y 50 a Carol.';
end $$;

-- =========================================================
-- 3. TEST: un gasto adelantado por Carol sube su saldo (50 -> 70), pero
--    Bob solo tenía -150 que repartir (ya asignados: 100 a Alice + 50 a
--    Carol). Los 20 extra de Carol NO tienen ya ningún deudor entre los
--    participantes que los cubra — es dinero que debe poner el evento/
--    la empresa, no otro participante. El algoritmo debe reflejar esto
--    con transparencia (no inventarse un tercer deudor, no fallar):
--    Bob->Carol se queda en 50, y el resto queda sin cubrir por diseño
--    (ver ADR-007, limitación conocida de v1).
-- =========================================================

do $$
declare
  v_event uuid := current_setting('test.event')::uuid;
  v_org uuid := current_setting('test.org')::uuid;
  v_bob uuid := current_setting('test.bob')::uuid;
  v_carol uuid := current_setting('test.carol')::uuid;
  v_bob_to_carol numeric;
  v_total_pending numeric;
begin
  insert into event_expenses (organization_id, event_id, description, amount, paid_by_resource_id, expense_date)
    values (v_org, v_event, 'Gasolina', 20.00, v_carol, '2026-12-05');

  perform fn_calculate_event_settlement(v_event);

  select amount into v_bob_to_carol from settlement_transfers
    where event_id = v_event and from_resource_id = v_bob and to_resource_id = v_carol;

  if v_bob_to_carol != 50.00 then
    raise exception 'TEST 3 FALLIDO: se esperaba que Bob siguiera debiendo 50 a Carol (no 70), es %', v_bob_to_carol;
  end if;

  select coalesce(sum(amount), 0) into v_total_pending
  from settlement_transfers where event_id = v_event and status = 'pending';

  if v_total_pending != 150.00 then
    raise exception 'TEST 3 FALLIDO: el total repartido entre participantes debería seguir siendo 150 (lo que Bob tenía), es %', v_total_pending;
  end if;

  raise notice 'TEST 3 OK: el gasto de Carol (20) no generó un tercer deudor inexistente — el algoritmo reparte solo lo que hay entre participantes (150) y deja el resto como deuda del evento, tal como documenta ADR-007.';
end $$;

-- =========================================================
-- 4. TEST: marcar una transferencia como pagada y recalcular NO la
--    borra ni la duplica — el historial de lo ya pagado se conserva
-- =========================================================

do $$
declare
  v_event uuid := current_setting('test.event')::uuid;
  v_bob uuid := current_setting('test.bob')::uuid;
  v_alice uuid := current_setting('test.alice')::uuid;
  v_paid_count int;
  v_pending_bob_to_alice numeric;
begin
  update settlement_transfers
    set status = 'paid', paid_at = now()
    where event_id = v_event and from_resource_id = v_bob and to_resource_id = v_alice;

  perform fn_calculate_event_settlement(v_event);

  select count(*) into v_paid_count
  from settlement_transfers where event_id = v_event and status = 'paid';

  if v_paid_count != 1 then
    raise exception 'TEST 4 FALLIDO: se esperaba conservar 1 transferencia pagada, hay %', v_paid_count;
  end if;

  select amount into v_pending_bob_to_alice from settlement_transfers
    where event_id = v_event and status = 'pending' and from_resource_id = v_bob and to_resource_id = v_alice;

  if v_pending_bob_to_alice is not null then
    raise exception 'TEST 4 FALLIDO: no debería regenerarse una transferencia pendiente Bob->Alice, ya está pagada.';
  end if;

  raise notice 'TEST 4 OK: la transferencia pagada se conserva como historial y no se regenera al recalcular.';
end $$;

-- =========================================================
-- 5. LIMPIEZA
-- =========================================================

delete from organizations where slug = 'cl-test-settlements';

do $$
begin
  raise notice '=== TODOS LOS TESTS DE SETTLEMENTS PASARON ===';
end $$;
