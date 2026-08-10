# ADR-010 — Resolución Kit → Bundle: `fn_apply_kit_to_event`

**Estado:** Aceptado
**Fecha:** 2026-08-10
**Módulo:** Events (Kits/Bundles)
**Depende de:** ADR-001, ADR-002, ADR-003, ADR-009

---

## Contexto

ADR-002 diseñó `kits`/`kit_items` (plantilla) y `bundles`/`bundle_items` (asignación real), y ADR-009 las materializó en SQL, pero nunca se implementó el paso que las conecta: la función que, al aplicar un Kit a un evento, resuelve cada `kit_item` ("2 recursos de categoría Subgraves") a instancias físicas concretas y disponibles. Sin esto, `kits`/`bundles` son tablas vacías sin ningún flujo que las use — es el siguiente hueco obvio a cerrar tras validar Events.

Al diseñar la función aparece un problema no anticipado explícitamente en ADR-002: `kit_items.resource_category` se pensó como un campo genérico ("Subgraves", "Micros"...), pero de las tablas de detalle del Core (ADR-001) **solo `materials_details` tiene una columna `category`**. `vehicles_details`, `people_details` y `rooms_details` no tienen ningún concepto de categoría. Esto es coherente con el negocio real: los vehículos no se subdividen en categorías del mismo modo que el material de audio/luces — pero significa que `resource_category` no se puede tratar de forma uniforme para los cuatro tipos.

## Decisión

### `fn_apply_kit_to_event(p_kit_id uuid, p_event_id uuid)`

Aplica un Kit a un evento: crea un `Bundle`, resuelve cada `kit_item` a instancias reales, crea sus `resource_bookings` y `bundle_items`, y añade un ítem de `event_checklist_items` (`source = 'kit'`) por cada recurso resuelto — el checklist del evento se rellena solo al aplicar un Kit, sin paso manual adicional.

**Matching de candidatos por tipo:**
- `resource_type in ('material','tool','equipment')`: candidatos filtrados por `resources.resource_type` **y** `materials_details.category = kit_items.resource_category`.
- `resource_type in ('vehicle','room')`: `resource_category` no se usa para filtrar (no hay columna equivalente en `vehicles_details`/`rooms_details`) — el matching es solo por `resource_type`. Si en el futuro el negocio necesita subcategorías de vehículo (ej. "furgón grande" vs "furgón pequeño"), se añadirá una columna `category` a `vehicles_details` entonces, no se fuerza aquí una solución genérica que nadie ha pedido todavía.

**Disponibilidad: reutiliza `fn_check_resource_availability` en lote**, no candidato a candidato — se junta el conjunto completo de candidatos de una categoría y se le pasa de una vez a la función del Core (exactamente el caso de uso para el que ADR-003 la diseñó: "aplicar un Kit sobre 8 recursos a la vez"). De los disponibles, se toman los primeros N que pida `kit_items.quantity`.

**Resultado parcial explícito, nunca silencioso (regla ya fijada en ADR-002):** la función devuelve una fila por `kit_item` con `quantity_requested` y `quantity_resolved`. Si faltan unidades de una categoría, `quantity_resolved < quantity_requested` — la aplicación que llama a la función es responsable de mostrarlo ("faltan 1 Subgrave"), pero la función en sí **no aborta ni deja de aplicar el resto del Kit** por un solo hueco: reserva lo que sí encuentra y reporta el resto como pendiente, coherente con "nunca aplicar el Kit a medias en silencio" — la clave es que no sea *silencioso*, no que sea *todo o nada*.

**Condición de carrera:** igual que cualquier flujo de escritura sobre `resource_bookings` (ADR-003), entre comprobar disponibilidad en lote y ejecutar el `INSERT` de cada `resource_booking` puede colarse otra reserva. Si eso ocurre, el `INSERT` falla con `exclusion_violation` y toda la llamada a `fn_apply_kit_to_event` se revierte (una única transacción) — la aplicación debe capturar ese error y ofrecer reintentar, no capturarlo dentro de la función para "seguir como si nada", porque eso sí sería aplicar el Kit a medias en silencio.

```sql
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
```

## Alternativas consideradas

**A. Añadir una columna `category` genérica a `resources` (tabla base) en vez de dejarla solo en `materials_details`.**
Descartada: repetiría el error que ADR-001 ya evitó (tabla ancha con columnas que no aplican a todos los tipos) por una necesidad que hoy solo tiene Material. Si vehículos necesitan categorías reales en el futuro, la solución correcta es añadir la columna a `vehicles_details`, igual que se hizo con Material.

**B. Que la función falle por completo (rollback total) si cualquier categoría no se puede resolver al 100%.**
Descartada: contradice directamente la instrucción de negocio original ("si falta material que aparezca claramente" implica que se puede seguir operando sabiendo lo que falta, no que la operación entera se bloquea). Un "todo o nada" además complica innecesariamente el caso más común: aplicar un Kit de 8 líneas donde 7 se resuelven perfectamente y solo falta 1 Subgrave no debería impedir preparar las otras 7.

**C. Resolver la disponibilidad candidato a candidato (un `fn_check_resource_availability` por recurso) en vez de en lote.**
Descartada por ser exactamente el antipatrón que ADR-003 identificó como motivo de ser de la función en lote: N llamadas en vez de 1, sin ninguna ventaja.

## Consecuencias

- El checklist de un evento (ADR-009) se puede rellenar completamente sin ningún paso manual: aplicar un Kit genera sus `event_checklist_items` automáticamente con `source = 'kit'`, distinguibles de los añadidos a mano (`source = 'manual'`).
- Volver a aplicar el mismo Kit al mismo evento dos veces crea un segundo `Bundle` independiente y duplica los `event_checklist_items` — no hay deduplicación ni "reemplazar Bundle existente" en esta versión. Se acepta como limitación conocida de v1: el caso de uso principal (aplicar un Kit una vez al crear el evento) no lo necesita: se deja para cuando aparezca una necesidad real de "reaplicar/ajustar" un Kit ya aplicado.
- `fn_apply_kit_to_event` es `security definer` como el resto de funciones del Core que necesitan operar a través de varias tablas con RLS — sujeta a la misma disciplina de `search_path` fijado explícitamente (ADR-001, "Registro de validación").

## Registro de validación

**2026-08-10 — Ejecución real contra el proyecto Supabase de Calle Levante.** A diferencia de Events (que pasó a la primera), esta migración sí encontró tres problemas reales, todos corregidos:

1. **`kit_items.resource_category` era `NOT NULL`** (definida así en ADR-002), pero esta misma ADR-010 decide que para `resource_type in ('vehicle','room')` esa columna no aplica (no hay `category` en `vehicles_details`/`rooms_details`, ADR-001) y debe poder quedar vacía. Corregido con `alter table kit_items alter column resource_category drop not null` (migración `00004_kit_items_category_nullable.sql`).
2. **`fn_check_resource_availability` no existía en la base de datos real.** Estaba completamente documentada en ADR-003, con su SQL completo en el cuerpo del ADR — pero nunca se incluyó en `core-schema.sql` (00001). La revisión estática original no lo detectó porque revisaba el ADR y el esquema por separado, no verificaba que todo lo documentado estuviera realmente en el fichero de esquema. Corregido añadiéndola como migración de Core (`00005_fn_check_resource_availability.sql`), con el mismo código que ya documentaba ADR-003, sin cambios.
3. **`bundle_items.resource_id` no tiene `on delete cascade`** — al principio pareció un bug al fallar la limpieza del test (`delete from organizations` chocaba con esta FK), pero es comportamiento correcto: protege el historial de qué recurso se usó en qué bundle frente a un `DELETE` físico de `resources` (que nunca debería pasar en producción — un recurso se retira con `status = 'retired'`, ADR-001, no se borra). El fix fue en el propio test (borrar `bundle_items` explícitamente antes de la cascada de `organizations`), no en el esquema.

Los tres bugs eran del arnés/gaps de documentación, no de la lógica de negocio de `fn_apply_kit_to_event` en sí: la función resolvió correctamente el caso de resolución parcial (2 pedidos, 1 disponible → resuelve 1 y lo reporta, sin bloquear el resto del Kit) y el de resolución completa, excluyó correctamente un recurso en reparación, y generó bundle_items/resource_bookings/checklist consistentes entre sí. Datos de prueba limpiados al final del propio script.
