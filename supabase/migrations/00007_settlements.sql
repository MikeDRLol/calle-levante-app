-- =========================================================
-- SETTLEMENTS MODULE SCHEMA — v0.1
-- Implementa ADR-007. Requiere core-schema.sql y events-schema.sql aplicados.
-- =========================================================

-- =========================================================
-- 1. GASTOS DEL EVENTO
-- =========================================================

create table event_expenses (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null check (amount > 0),
  paid_by_resource_id uuid references resources(id),
  expense_date date not null,
  created_at timestamptz not null default now()
);

create index idx_event_expenses_event on event_expenses(event_id);
create index idx_event_expenses_org on event_expenses(organization_id);

-- =========================================================
-- 2. PARTICIPANTES DE LA LIQUIDACIÓN (importe manual en v1 — ver ADR-007)
-- =========================================================

create table event_settlement_participants (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  resource_id uuid not null references resources(id),
  amount_owed numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, resource_id)
);

create index idx_settlement_participants_event on event_settlement_participants(event_id);
create index idx_settlement_participants_org on event_settlement_participants(organization_id);

-- =========================================================
-- 3. TRANSFERENCIAS (= Bizums a enviar)
-- =========================================================

create table settlement_transfers (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  from_resource_id uuid not null references resources(id),
  to_resource_id uuid not null references resources(id),
  amount numeric(10,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (from_resource_id != to_resource_id)
);

create index idx_settlement_transfers_event on settlement_transfers(event_id);
create index idx_settlement_transfers_org on settlement_transfers(organization_id);
create index idx_settlement_transfers_status on settlement_transfers(organization_id, status);

-- =========================================================
-- 4. ALGORITMO DE MÍNIMAS TRANSFERENCIAS
-- =========================================================

create or replace function fn_calculate_event_settlement(p_event_id uuid)
returns table (
  from_resource_id uuid,
  to_resource_id uuid,
  amount numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_balances jsonb := '{}'::jsonb;
  v_resource_id uuid;
  v_balance numeric;
  v_creditor uuid;
  v_creditor_balance numeric;
  v_debtor uuid;
  v_debtor_balance numeric;
  v_transfer_amount numeric;
  r record;
begin
  select organization_id into v_org from events where id = p_event_id;
  if v_org is null then
    raise exception 'Evento % no encontrado', p_event_id;
  end if;

  -- Las transferencias 'paid' son historial y no se tocan; solo se
  -- recalculan las 'pending' — "cada cambio en una liquidación debe
  -- recalcular automáticamente" (ADR-007), pero sin perder lo ya pagado.
  delete from settlement_transfers where event_id = p_event_id and status = 'pending';

  -- Saldo = lo que se le debe por trabajar + gastos que adelantó
  --         - lo ya cobrado (transfer 'paid' a su favor)
  --         + lo ya pagado por él (transfer 'paid' en su contra, si el
  --           saldo inicial fuera negativo — no aplica en v1 porque
  --           amount_owed siempre es >= 0, se deja el término por si
  --           en el futuro un participante puede quedar en negativo).
  for r in
    select
      sp.resource_id,
      sp.amount_owed
        + coalesce((select sum(e.amount) from event_expenses e
                    where e.event_id = p_event_id and e.paid_by_resource_id = sp.resource_id), 0)
        - coalesce((select sum(t.amount) from settlement_transfers t
                    where t.event_id = p_event_id and t.status = 'paid' and t.to_resource_id = sp.resource_id), 0)
        + coalesce((select sum(t.amount) from settlement_transfers t
                    where t.event_id = p_event_id and t.status = 'paid' and t.from_resource_id = sp.resource_id), 0)
        as balance
    from event_settlement_participants sp
    where sp.event_id = p_event_id
  loop
    if r.balance != 0 then
      v_balances := v_balances || jsonb_build_object(r.resource_id::text, r.balance);
    end if;
  end loop;

  -- Algoritmo voraz: empareja siempre el mayor acreedor con el mayor
  -- deudor hasta que no queden saldos pendientes (ver ADR-007, alternativa C).
  loop
    v_creditor := null;
    v_creditor_balance := 0;
    v_debtor := null;
    v_debtor_balance := 0;

    for v_resource_id, v_balance in
      select key::uuid, value::numeric from jsonb_each_text(v_balances)
    loop
      if v_balance > v_creditor_balance then
        v_creditor := v_resource_id;
        v_creditor_balance := v_balance;
      end if;
      if v_balance < v_debtor_balance then
        v_debtor := v_resource_id;
        v_debtor_balance := v_balance;
      end if;
    end loop;

    exit when v_creditor is null or v_debtor is null;

    v_transfer_amount := least(v_creditor_balance, abs(v_debtor_balance));

    insert into settlement_transfers (organization_id, event_id, from_resource_id, to_resource_id, amount)
      values (v_org, p_event_id, v_debtor, v_creditor, v_transfer_amount);

    v_balances := jsonb_set(v_balances, array[v_creditor::text], to_jsonb(v_creditor_balance - v_transfer_amount));
    v_balances := jsonb_set(v_balances, array[v_debtor::text], to_jsonb(v_debtor_balance + v_transfer_amount));

    if (v_balances ->> v_creditor::text)::numeric = 0 then
      v_balances := v_balances - v_creditor::text;
    end if;
    if (v_balances ->> v_debtor::text)::numeric = 0 then
      v_balances := v_balances - v_debtor::text;
    end if;
  end loop;

  return query
    select st.from_resource_id, st.to_resource_id, st.amount
    from settlement_transfers st
    where st.event_id = p_event_id and st.status = 'pending';
end;
$$;

-- =========================================================
-- 5. RLS
-- =========================================================

alter table event_expenses enable row level security;
alter table event_settlement_participants enable row level security;
alter table settlement_transfers enable row level security;

create policy event_expenses_isolation on event_expenses
  for all using (organization_id in (select fn_user_organization_ids()));

create policy settlement_participants_isolation on event_settlement_participants
  for all using (organization_id in (select fn_user_organization_ids()));

create policy settlement_transfers_isolation on settlement_transfers
  for all using (organization_id in (select fn_user_organization_ids()));
