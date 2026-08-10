-- =========================================================
-- KIT -> BUNDLE RESOLUTION — v0.1
-- Implementa ADR-010. Requiere core-schema.sql (00001) y
-- events-schema.sql (00002) ya aplicados.
-- =========================================================

create or replace function fn_apply_kit_to_event(p_kit_id uuid, p_event_id uuid)
returns table (
  kit_item_id uuid,
  resource_category text,
  resource_type text,
  quantity_requested integer,
  quantity_resolved integer,
  resolved_resource_ids uuid[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_bundle_id uuid;
  v_item record;
  v_candidate_ids uuid[];
  v_resolved uuid[];
  v_booking_id uuid;
  v_resource_name text;
  i int;
begin
  select organization_id, start_at, end_at into v_org, v_start, v_end
  from events where id = p_event_id;

  if v_org is null then
    raise exception 'Evento % no encontrado', p_event_id;
  end if;

  insert into bundles (organization_id, event_id, source_kit_id)
    values (v_org, p_event_id, p_kit_id)
    returning id into v_bundle_id;

  for v_item in select * from kit_items where kit_id = p_kit_id loop

    -- Candidatos: mismo resource_type y, para material/tool/equipment,
    -- misma categoría (solo materials_details tiene columna category —
    -- ver ADR-010). Vehículos y salas se filtran solo por resource_type.
    select array_agg(r.id) into v_candidate_ids
    from resources r
    left join materials_details md on md.resource_id = r.id
    where r.organization_id = v_org
      and r.resource_type = v_item.resource_type
      and r.status = 'available'
      and (
        v_item.resource_type not in ('material','tool','equipment')
        or md.category = v_item.resource_category
      );

    -- Disponibilidad comprobada en lote contra el Core (ADR-003), no
    -- candidato a candidato.
    select array_agg(a.resource_id) into v_resolved
    from (
      select resource_id
      from fn_check_resource_availability(coalesce(v_candidate_ids, array[]::uuid[]), v_start, v_end)
      where is_available
      limit v_item.quantity
    ) a;

    v_resolved := coalesce(v_resolved, array[]::uuid[]);

    for i in 1..coalesce(array_length(v_resolved, 1), 0) loop
      insert into resource_bookings (organization_id, resource_id, event_id, start_at, end_at)
        values (v_org, v_resolved[i], p_event_id, v_start, v_end)
        returning id into v_booking_id;

      insert into bundle_items (bundle_id, resource_id, booking_id)
        values (v_bundle_id, v_resolved[i], v_booking_id);

      select name into v_resource_name from resources where id = v_resolved[i];

      insert into event_checklist_items (organization_id, event_id, label, resource_id, source)
        values (v_org, p_event_id, 'Cargar ' || v_resource_name, v_resolved[i], 'kit');
    end loop;

    kit_item_id := v_item.id;
    resource_category := v_item.resource_category;
    resource_type := v_item.resource_type;
    quantity_requested := v_item.quantity;
    quantity_resolved := coalesce(array_length(v_resolved, 1), 0);
    resolved_resource_ids := v_resolved;
    return next;
  end loop;
end;
$$;
