-- =========================================================
-- EVENT PAYMENTS — TESTS DE VALIDACIÓN v0.1
-- =========================================================

do $$
declare
  v_org uuid;
  v_event uuid;
begin
  insert into organizations (name, slug) values ('Calle Levante Test Payments', 'cl-test-payments')
    returning id into v_org;

  insert into events (organization_id, event_type, name, start_at, end_at, total_amount)
    values (v_org, 'boda', 'Boda Test Payments', '2026-12-01 10:00+01', '2026-12-01 18:00+01', 1200.00)
    returning id into v_event;

  insert into event_payments (organization_id, event_id, amount, method, paid_at, notes)
    values (v_org, v_event, 500.00, 'bizum', '2026-09-10', 'Señal');
  insert into event_payments (organization_id, event_id, amount, method, paid_at, notes)
    values (v_org, v_event, 700.00, 'transfer', '2026-11-30', 'Resto');

  perform set_config('test.org', v_org::text, false);
  perform set_config('test.event', v_event::text, false);

  raise notice 'SETUP OK: evento con total_amount=1200 y 2 pagos (500+700) creados.';
end $$;

do $$
declare
  v_event uuid := current_setting('test.event')::uuid;
  v_total numeric;
  v_paid numeric;
begin
  select total_amount into v_total from events where id = v_event;
  select coalesce(sum(amount), 0) into v_paid from event_payments where event_id = v_event;

  if v_total != 1200.00 or v_paid != 1200.00 then
    raise exception 'TEST 1 FALLIDO: total=% pagado=% (esperado 1200/1200)', v_total, v_paid;
  end if;

  raise notice 'TEST 1 OK: total y suma de pagos coinciden (1200/1200, pendiente 0).';
end $$;

do $$
declare
  v_event uuid := current_setting('test.event')::uuid;
  v_failed boolean := false;
begin
  begin
    insert into event_payments (organization_id, event_id, amount, method, paid_at)
      values (current_setting('test.org')::uuid, v_event, -50.00, 'cash', '2026-09-10');
  exception when check_violation then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'TEST 2 FALLIDO: se permitió un pago con importe negativo.';
  end if;

  raise notice 'TEST 2 OK: importe negativo rechazado por el check constraint.';
end $$;

delete from organizations where slug = 'cl-test-payments';

do $$
begin
  raise notice '=== TODOS LOS TESTS DE EVENT PAYMENTS PASARON ===';
end $$;
