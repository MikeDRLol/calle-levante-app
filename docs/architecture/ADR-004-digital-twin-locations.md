# ADR-004 — Digital Twin: Locations como árbol único (almacén + evento)

**Estado:** Aceptado
**Fecha:** 2026-08-10
**Módulo:** Core
**Depende de:** ADR-001 (Resource unificado)

---

## Contexto

El negocio necesita saber en todo momento **dónde está físicamente cada recurso**, con dos granularidades:

1. En el almacén, en reposo: Almacén → Estantería → Balda → Caja.
2. Durante un evento, en uso: Evento → Escenario → Lado izquierdo.

La pregunta de diseño es si estas dos jerarquías son modelos separados o el mismo árbol con un contexto distinto. Se decidió lo segundo en el diseño inicial del Core; este ADR lo formaliza y añade dos decisiones adicionales que surgieron al implementarlo: cómo editar la estructura sin perder historial, y qué impide borrar una ubicación con material dentro.

## Decisión

`locations` es un único árbol autoreferenciado (`parent_location_id`), distinguido por `context_type` (`warehouse` | `event`). Cuando arranca un evento, se crea un nodo raíz `context_type='event'` con sus propios hijos; al terminar, esos nodos no se eliminan — quedan como historial de dónde estuvo cada cosa ese día.

```sql
locations (
  id, organization_id,
  parent_location_id,   -- árbol; NULL = raíz (un almacén, o un evento)
  context_type,          -- 'warehouse' | 'event'
  event_id,               -- solo si context_type = 'event'
  name,
  is_active
)
```

`resources.current_location_id` apunta siempre al nodo actual, sea de almacén o de evento — así "dónde está el Subgrave 2 ahora mismo" es la misma query sin importar si está en la furgoneta, en el escenario o en la balda 3.

### Estructura editable, con dos garantías

Reorganizar el almacén (añadir/renombrar/mover estanterías y baldas) es una operación habitual, no excepcional, así que debe ser barata. Pero dos cosas no pueden pasar nunca:

1. **No se puede perder el historial de dónde estuvo algo** solo porque la estructura física cambió (se quitó una estantería, se renombró un almacén). Por eso `locations` usa **borrado lógico** (`is_active`), nunca `DELETE` físico — un `DELETE` real rompería cualquier consulta futura de auditoría que referencie esa ubicación.
2. **No se puede desactivar una ubicación que todavía contiene material o sub-ubicaciones activas.** Sin esta garantía, borrar una estantería con contenido dejaría material "flotando" sin ubicación válida.

Ambas se implementan en `fn_deactivate_location(location_id)`, que rechaza la operación con un mensaje de negocio claro en vez de dejar que falle como un error de integridad referencial genérico.

## Alternativas consideradas

**A. Dos tablas separadas: `warehouse_locations` y `event_locations`.**
Descartada: duplica la lógica de árbol, duplica los índices, y obliga a que cualquier función que necesite "dónde está X ahora" (QR, Copiloto de IA, Timeline) consulte dos tablas distintas según el estado del recurso. Rompe exactamente la ventaja de tener un `Resource` unificado (ADR-001).

**B. Borrado físico de ubicaciones, con la estructura histórica reconstruida solo desde `audit_log`.**
Técnicamente posible, pero obliga a reconstruir el árbol de ubicaciones pasadas a partir de eventos de auditoría en vez de poder consultarlo directamente. Se descarta por complejidad innecesaria: el soft-delete da lo mismo con una consulta trivial (`where is_active = true` para el árbol vigente, sin filtro para el histórico).

**C. Permitir DELETE físico solo si la ubicación nunca tuvo material asignado.**
Descartada por ser una regla frágil y difícil de razonar ("¿puedo borrar esto? depende de si alguna vez tuvo algo dentro, no de si tiene algo ahora"). El soft-delete es una regla más simple y más segura: nunca se borra físicamente, punto.

## Consecuencias

- El árbol de `locations` crece indefinidamente (nunca se borra nada), incluyendo miles de nodos `context_type='event'` de eventos ya terminados. Esto es aceptable y esperado — es precisamente el historial que da valor al Digital Twin — pero implica que las consultas del árbol **vigente** de almacén deben filtrar siempre por `is_active = true` y `context_type = 'warehouse'`; se recomienda una vista (`active_warehouse_locations`) para no repetir ese filtro en cada query de la aplicación.
- La reorganización del almacén es una operación de datos, no de esquema — no requiere migración ni intervención técnica, coherente con el objetivo de "editable por el propio usuario".

## Pendiente

- Vista `active_warehouse_locations` mencionada arriba — no creada todavía, añadir cuando se implemente la UI del módulo Inventario.
- Política de quién puede ejecutar `fn_deactivate_location` y editar la estructura — resuelto en ADR-006 (Permisos por rol).
