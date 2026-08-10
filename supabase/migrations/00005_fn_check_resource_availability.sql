-- Corrección encontrada al validar ADR-010 en ejecución real: fn_check_resource_availability
-- estaba completamente documentada en ADR-003 (con el propio código SQL en el cuerpo del ADR),
-- pero nunca se llegó a incluir en core-schema.sql (00001_core_schema.sql) — un hueco real
-- entre la documentación y el esquema aplicado que la revisión estática original no detectó.
-- Pertenece al Core (ADR-003), así que se añade aquí, no en el módulo Events.

create or replace function fn_check_resource_availability(
  p_resource_ids uuid[],
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_exclude_booking_id uuid default null
)
returns table (
  resource_id uuid,
  is_available boolean,
  conflicting_booking_id uuid,
  conflicting_event_id uuid,
  conflicting_start_at timestamptz,
  conflicting_end_at timestamptz
)
language sql stable
as $$
  select
    r.id as resource_id,
    (b.id is null) as is_available,
    b.id as conflicting_booking_id,
    b.event_id as conflicting_event_id,
    b.start_at as conflicting_start_at,
    b.end_at as conflicting_end_at
  from unnest(p_resource_ids) as r(id)
  left join lateral (
    select rb.*
    from resource_bookings rb
    where rb.resource_id = r.id
      and rb.status = 'confirmed'
      and rb.during && tstzrange(p_start_at, p_end_at)
      and (p_exclude_booking_id is null or rb.id != p_exclude_booking_id)
    limit 1
  ) b on true;
$$;
