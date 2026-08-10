# ADR-001 — Modelo unificado de Resource

**Estado:** Aceptado
**Fecha:** 2026-08-06
**Módulo:** Core
**Depende de:** —
**Del que dependen:** Bookings (ADR-003), Kits/Bundles (ADR-002), Digital Twin / Locations (ADR-004), Inventario, Fleet, People, Events

---

## Contexto

El sistema gestiona cuatro tipos de entidades que, en el dominio de negocio, parecen distintas:

- **Personal** (técnicos, músicos, comerciales)
- **Material** (audio, luces, cableado, backline, DJ, vídeo, escenario)
- **Vehículos** (furgonetas, remolques)
- **Salas / espacios** (almacenes, salas de ensayo — uso futuro)

Sin embargo, las cuatro comparten un conjunto idéntico de comportamientos:

- Tienen **disponibilidad** que debe comprobarse por intervalos de fecha/hora antes de poder asignarse a un evento.
- Se **reservan** para eventos concretos y esa reserva debe poder consultarse en una línea temporal (Timeline/Gantt).
- Tienen **historial** de uso (qué eventos, cuándo, con quién).
- Pueden tener **incidencias** (avería para material/vehículos; no disponibilidad para personas).
- Pueden llevar **QR** para identificación y acciones rápidas desde móvil.
- Requieren **auditoría** de cambios de estado.
- Tienen **ubicación** en un momento dado (Digital Twin, ADR-004).

Construir esta lógica cuatro veces (una por tipo) multiplica el código, multiplica los bugs, y sobre todo **multiplica la complejidad de la regla más crítica del sistema**: "no permitir reservar un recurso si ya está ocupado en otro evento que coincide en fecha y hora". Esta regla debe evaluarse igual sin importar si el recurso es una persona, un subgrave o una furgoneta.

## Decisión

Se modela una entidad base `Resource` que representa **cualquier cosa reservable, con disponibilidad e historial**, y de la que cuelgan tablas de detalle específicas por tipo.

### Estructura

```
Resource (tabla base, columnas comunes)
 ├── resource_type: 'person' | 'material' | 'vehicle' | 'room' | 'tool' | 'equipment'
 ├── resource_class: 'human' | 'asset' | 'space'   (clasificación, no jerarquía de tablas — ver "Alternativas descartadas")
 │
 ├── people_details       (1:1, si resource_type = 'person')
 ├── materials_details     (1:1, si resource_type = 'material' | 'tool' | 'equipment')
 ├── vehicles_details      (1:1, si resource_type = 'vehicle')
 └── rooms_details         (1:1, si resource_type = 'room')
```

`resource_class` es una **columna de clasificación derivada del tipo**, no una tabla ni una entidad con identidad propia. Sirve para poder filtrar "todo lo que es un activo depreciable" (excluyendo personas) sin necesidad de una jerarquía de tablas adicional. Se mantiene como columna explícita (no calculada en cada query) para poder indexarla y para que sea trivial de extender el día que aparezca un nuevo `resource_type` (ej. `drone`, `tablet`) sin tener que decidir de nuevo dónde encaja.

**Supplier (proveedor) queda explícitamente fuera de Resource.** Un proveedor no tiene disponibilidad ni se reserva en `resource_bookings`; vive en el módulo CRM/Procurement, con una relación opcional desde `materials_details.owned_by_supplier_id` cuando el material está subcontratado o alquilado.

## Alternativas consideradas

### A. Cuatro tablas independientes (Material, Vehículos, Personal, Salas)
Es el modelo "natural" al pensar en el negocio. Descartado porque obliga a duplicar la lógica de disponibilidad y bookings cuatro veces, y cualquier funcionalidad transversal (QR, Timeline, auditoría, IA con tool calling) tendría que consultar cuatro tablas distintas con cuatro formas de calcular solapamiento de fechas. Es el origen directo del problema que se quiere resolver.

### B. Resource con tabla ancha (una sola tabla con todas las columnas de todos los tipos)
Descartado por ser el antipatrón clásico de "tabla ancha": columnas como `instruments`, `plate_number`, `warranty_expiry` conviviendo en la misma fila, la mayoría NULL según el tipo. Dificulta la integridad de datos (nada impide poner `plate_number` a una persona) y hace el esquema ilegible a medida que crece.

### C. Resource → Asset como capa intermedia obligatoria con tabla propia
Se consideró introducir `Asset` como tabla con su propia clave primaria entre `Resource` y los detalles de Material/Vehículo/Herramienta/Equipo. Se descarta la tabla propia (se mantiene la distinción conceptual como valor de `resource_class`) porque:
- No aporta comportamiento propio distinto al de `Resource` — hoy es solo una etiqueta semántica ("esto es depreciable y mantenible", "esto no").
- Forzaría que `materials_details`, `vehicles_details`, etc. cuelguen de `asset_id` en vez de `resource_id`, complicando cualquier query que combine QR, bookings o auditoría, que operan sobre `resource_id`.
- Si en el futuro `Asset` desarrolla comportamiento propio real y sustancial (no solo clasificación), se puede promover a tabla propia entonces — es una migración aditiva, no destructiva, porque no rompe `resource_bookings` ni la API de disponibilidad.

### D. Modelo separado por tipo con tabla de disponibilidad compartida (sin Resource base)
Es decir, mantener `people`, `materials`, `vehicles` como tablas totalmente independientes pero con una tabla `bookings` que referencia mediante `(resource_type, resource_id)` sin clave foránea real. Descartado porque renuncia a la integridad referencial de Postgres (no se puede hacer `FOREIGN KEY` a "una de cuatro tablas posibles"), lo que abre la puerta a bookings huérfanos o inconsistentes — inaceptable en la tabla más crítica del sistema.

## Consecuencias

**Positivas:**
- Un único motor de disponibilidad (`resource_bookings`, ver ADR-003) sirve para las cuatro entidades sin duplicación.
- El Timeline/Gantt, el QR, la auditoría y el futuro Copiloto de IA operan todos sobre `resource_id` de forma genérica.
- Añadir un nuevo tipo de recurso reservable en el futuro (ej. `drone`, `sala de ensayo`) no requiere tocar la lógica de bookings, solo añadir un `resource_type` y opcionalmente una tabla de detalle.

**Negativas / trade-offs aceptados:**
- Cualquier query que necesite datos específicos de tipo (ej. "vehículos con ITV caducada") requiere un JOIN entre `resources` y `vehicles_details`, en vez de una consulta directa a una tabla `vehicles`. Se acepta este coste porque es constante y predecible, frente al coste creciente de mantener cuatro motores de disponibilidad.
- Requiere disciplina: cualquier desarrollador que añada un campo específico de un tipo debe saber que va en la tabla de detalle, no en `resources`. Se mitiga con conventhemes de nombres claras y revisión de PRs.

## Registro de validación

**2026-08-06 — Revisión estática de `core-schema.sql`** (sin ejecución real: entorno sin acceso a Postgres/red disponible en el momento de escribir este ADR; pendiente de ejecutar contra un proyecto Supabase real antes de dar el Core por cerrado).

Incidencia encontrada y corregida: la columna `during` de `resource_bookings` usaba un rango `tstzrange(start_at, end_at, '[]')` con ambos extremos inclusivos. Esto habría hecho que el `exclude constraint` de no-solapamiento rechazara reservas legítimas espalda-con-espalda (ej. un vehículo que termina un evento a las 18:00 y empieza otro exactamente a las 18:00), por tratar el instante de corte como ocupado en ambos bookings simultáneamente. Corregido a intervalo semiabierto `[start, end)`, que es la convención estándar para rangos de tiempo reservables.

**Pendiente antes de cerrar v1 del Core:** ejecutar `core-schema.sql` contra un proyecto Supabase real (o Postgres local con `docker run postgres`) y validar con casos de prueba concretos: (a) dos bookings que se solapan → debe fallar; (b) dos bookings espalda-con-espalda → debe permitirse; (c) un usuario de la organización A no puede leer recursos de la organización B vía RLS.

**2026-08-10 — Ejecución real contra un proyecto Supabase remoto** (`db push` de `core-schema.sql` como migración + `core-schema-tests.sql` vía conexión directa a Postgres). El esquema en sí (`core-schema.sql`) se aplicó sin ningún error — los 12 tablas, funciones, triggers y políticas RLS se crearon tal cual estaban definidos, sin necesidad de ningún cambio. Los problemas encontrados estaban todos en `core-schema-tests.sql` (el arnés de test, no el Core), y ya están corregidos en el fichero:

1. La última línea del script (`raise notice '=== TODOS LOS TESTS...'`) estaba fuera de cualquier bloque PL/pgSQL — `RAISE` no es válido en SQL plano. Corregido envolviéndola en `DO $$ ... $$`.
2. TEST 4 (rango de fechas inválido) solo capturaba `check_violation`, pero con `end_at < start_at` es la propia construcción de la columna generada `during := tstzrange(start_at, end_at)` la que falla primero, con `data_exception`, antes de que el `check (end_at > start_at)` llegue a evaluarse. La protección real funciona igual (el insert se rechaza), pero con otro código de excepción — se amplió el `exception when` para cubrir ambos casos.
3. **El hallazgo más importante**: TEST 5 y TEST 7 fallaban de verdad al ejecutarse contra Supabase real — no por un fallo del aislamiento RLS, sino porque el script nunca hacía el `SET ROLE authenticated` que su propio comentario decía que había que hacer. Conectados como `postgres` (que en Supabase tiene `BYPASSRLS = true`, igual que `service_role`), todas las políticas RLS se ignoran sin importar qué JWT se simule con `set_config`. Esto confirma exactamente la advertencia que ya hacía este ADR: la simulación aproximada de auth "no es la prueba definitiva". Corregido añadiendo `SET ROLE authenticated;` antes de cada comprobación y `RESET ROLE;` después, en TEST 5 y TEST 7.

Con las tres correcciones, los 8 bloques de test (SETUP + TEST 2 a TEST 7) pasan contra el proyecto Supabase real de Calle Levante. Los datos de prueba generados (organizaciones, usuarios y recursos ficticios) se limpiaron tras la validación.

## Notas de implementación

- `resources.id` es la clave que usan `resource_bookings`, `qr_codes`, `audit_log`, `locations` (posición actual) y `documents` (fotos, manuales) para referenciar cualquier recurso sin importar su tipo.
- El QR generado para un recurso codifica únicamente `resource_id` — toda la lógica de qué acciones mostrar (Asignar, Avería, Mover, Checklist...) se resuelve en el cliente a partir de `resource_type`, no en el propio QR.
- `resource_class` se rellena automáticamente por trigger o por lógica de aplicación a partir de `resource_type`, para evitar inconsistencias (ej. que alguien marque una persona como `resource_class = 'asset'`).
