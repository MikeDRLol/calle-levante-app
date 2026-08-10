# ADR-003 — Motor de disponibilidad: función de consulta + constraint como red de seguridad

**Estado:** Aceptado
**Fecha:** 2026-08-06
**Módulo:** Core
**Depende de:** ADR-001 (Resource unificado)

---

## Contexto

El `exclude constraint no_overlapping_bookings` (ADR-001) garantiza a nivel de base de datos que nunca se puede escribir un booking solapado. Es la garantía de integridad definitiva y no debe eliminarse ni debilitarse.

Pero un constraint que falla **no es una buena experiencia de aplicación**. Si el flujo es "el usuario intenta reservar → Postgres lanza `exclusion_violation` → la app muestra un error genérico", se pierden dos cosas que pide el negocio explícitamente en el documento original:

- Saber **con qué otro evento** coincide el recurso, para poder decidir (cambiar hora, usar otro recurso).
- Poder **consultar disponibilidad antes de comprometerse** (ej. al aplicar un Kit sobre 8 recursos a la vez, saber cuáles están libres y cuáles no, en vez de que la operación completa falle en el primer recurso ocupado y haya que reintentar uno a uno).

Se necesita una capa de **consulta de disponibilidad** que se use tanto para informar al usuario antes de escribir, como internamente por el motor de Kits/Bundles (ADR-002) al resolver qué instancias concretas asignar.

## Decisión

Se define una función SQL de solo lectura, `fn_check_resource_availability`, que:

1. Recibe una lista de `resource_id`, un `start_at`/`end_at`, y opcionalmente un `exclude_booking_id` (para permitir comprobar disponibilidad al *editar* un booking existente sin que choque consigo mismo).
2. Devuelve, por cada recurso solicitado, si está disponible y, si no lo está, con qué booking/evento coincide.
3. Se usa como **paso previo obligatorio** en cualquier flujo de escritura (crear booking manual, aplicar un Kit, mover un evento de hora), pero **nunca sustituye al constraint** — el constraint sigue siendo la garantía última ante condiciones de carrera (dos usuarios reservando el mismo recurso en el mismo segundo, donde una consulta previa por sí sola no es suficiente: entre el "SELECT de disponibilidad" y el "INSERT" puede colarse otra transacción).

Esto es el patrón estándar **"check-then-act" con red de seguridad transaccional**: la función de consulta da buena UX; el constraint da consistencia real ante concurrencia.

```sql
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
```

### Uso desde la aplicación

- **Antes de crear un booking manual:** llamar a la función con un único `resource_id`; si `is_available = false`, mostrar directamente "Sergio ya está asignado a [Boda García] de 18:00 a 23:00" en vez de un error genérico.
- **Al aplicar un Kit (ADR-002):** llamar con todos los `resource_id` candidatos de una categoría a la vez, para elegir de un vistazo cuáles están libres, en vez de intentar insertar uno por uno y capturar excepciones.
- **Al editar la hora de un evento ya reservado:** pasar `p_exclude_booking_id` con el booking que se está moviendo, para no comparar el evento consigo mismo.

### Manejo del error de condición de carrera

Aunque se consulte disponibilidad antes de escribir, sigue siendo posible que otro usuario reserve el mismo recurso en el intervalo entre el `SELECT` y el `INSERT`. En ese caso el `INSERT` fallará con `exclusion_violation` **a pesar de haber pasado la comprobación previa**. La capa de aplicación debe capturar específicamente ese código de error de Postgres y traducirlo a un mensaje de negocio ("Este recurso se acaba de reservar para otro evento, actualiza la disponibilidad e inténtalo de nuevo"), no a un error 500 genérico. Este es el único camino por el que la excepción del constraint debe llegar a producción de forma esperada.

## Alternativas consideradas

**A. Comprobar disponibilidad solo en la aplicación (sin constraint en base de datos).**
Descartada de raíz — es la razón de ser del ADR-001. Sin el constraint, cualquier vía de escritura que no pase por el código de aplicación exacto que hace el check (un script, una migración de datos, un futuro endpoint que alguien olvide proteger) puede crear solapamientos. El constraint es la única garantía que no depende de que el equipo humano recuerde llamarlo en todas partes.

**B. Solo el constraint, sin función de consulta previa.**
Es lo que había implícitamente hasta este ADR. Descartada como solución completa porque obliga a la aplicación a "intentar y fallar" para saber si algo está disponible, lo cual es mala UX (no se puede pintar en pantalla qué recursos de un Kit están libres antes de que el usuario confirme nada) y hace más difícil implementar el "modo carga" y el Copiloto de IA, que necesitan poder **preguntar** disponibilidad, no solo intentar reservar.

## Consecuencias

- Dos piezas de lógica que hacen "lo mismo" (la función SQL y el constraint) deben mantenerse consistentes: si cambia la definición de "solapamiento" (ej. se añade un margen de montaje/desmontaje de 30 minutos antes y después del evento como tiempo también ocupado), hay que actualizar ambas. Se documenta aquí explícitamente para que no se actualice una y se olvide la otra.
- La función es `stable`, no `volatile`, lo que permite a Postgres cachearla dentro de la misma sentencia/transacción y usarla con seguridad en contextos de solo lectura (ej. desde una Edge Function que solo consulta).

## Pendiente de validar en ejecución real

Añadir a `core-schema-tests.sql`: un test que compruebe que `fn_check_resource_availability` devuelve `is_available = false` con el `conflicting_event_id` correcto para un recurso ocupado, y `is_available = true` para uno libre en el mismo rango. No se ha incluido todavía en el script de tests entregado porque depende de que exista al menos un `event_id` de ejemplo — se añadirá en la siguiente iteración junto con el primer esquema real del módulo Events.
