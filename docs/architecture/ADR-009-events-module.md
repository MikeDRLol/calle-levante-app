# ADR-009 — Módulo Events: entidad evento, clientes mínimos, checklist dinámico y cierre de las FK diferidas del Core

**Estado:** Aceptado
**Fecha:** 2026-08-10
**Módulo:** Events
**Depende de:** ADR-001 (Resource unificado), ADR-002 (Kit vs Bundle), ADR-003 (disponibilidad), ADR-004 (Digital Twin), ADR-005 (frontera Core/Módulos)

---

## Contexto

Con el Core validado (ADR-001 a ADR-006), toca el primer módulo real construido encima: Events. Es el consumidor más importante del Core (ADR-005) y el que da sentido a piezas que hasta ahora existían "a medias":

- `resource_bookings.event_id` y `locations.event_id` son columnas sin clave foránea real desde que se diseñó el Core, deliberadamente (ADR-005: "el Core no puede depender de un módulo que vive por encima de él"). Ahora que `events` existe, toca cerrar esa integridad referencial.
- ADR-002 (Kit vs Bundle) ya diseñó por completo `kits`, `kit_items`, `bundles`, `bundle_items` en su día, pero nunca se llegaron a crear en SQL porque `bundles.event_id` necesitaba que `events` existiera primero.
- El negocio pide un **checklist dinámico** por evento (no una lista fija) que se pueda marcar automáticamente al escanear el QR del recurso correspondiente durante el montaje — esto no existía en ningún módulo todavía.
- Un evento necesita un cliente. El documento de negocio original describe un módulo CRM completo (presupuestos, historial de comunicación, pipeline). Construirlo entero ahora bloquearía Events sin necesidad — es exactamente el tipo de sobre-alcance que la decisión estratégica de la Parte 1 del proyecto ("V1 optimizada para Calle Levante, generalización después") pide evitar.

## Decisión

### 1. `events` — la entidad evento

Vive fuera del Core (ADR-005), en su propio módulo. Referencia recursos y ubicaciones únicamente a través de las funciones y tablas del Core (`resource_bookings`, `locations`, `fn_check_resource_availability`) — Events no implementa su propia lógica de disponibilidad, según la Regla no negociable 2 de `CLAUDE.md`.

```sql
create table events (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid references clients(id),
  event_type text not null,        -- 'boda' | 'concierto' | 'dj' | 'verbena' | 'comunion' | 'otro' — texto libre, no enum cerrado (mismo criterio que kits.event_type en ADR-002)
  name text not null,
  status text not null default 'draft' check (status in ('draft','confirmed','in_progress','completed','cancelled')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  venue_name text,
  venue_address text,
  venue_lat numeric(9,6),
  venue_lng numeric(9,6),
  responsible_resource_id uuid references resources(id),
  google_calendar_event_id text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);
```

`event_type` se deja como texto libre, igual que en `kits.event_type` (ADR-002) — un catálogo cerrado de tipos de evento por organización es exactamente el tipo de regla configurable que, si hiciera falta, se modelaría como datos (mismo criterio que `role_permissions`, ADR-006), no como un `enum` de base de datos ni como código.

### 2. `clients` — versión mínima, no el CRM completo

```sql
create table clients (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);
```

Deliberadamente mínima: solo lo necesario para que un evento tenga un cliente identificable y se puedan calcular estadísticas básicas por cliente (nº de eventos, facturación asociada, una vez existan Events y Billing). Presupuestos, pipeline de oportunidades, historial de comunicación e integraciones (email, WhatsApp) quedan para el futuro módulo CRM — no se construyen aquí. Esta tabla vive en el mismo espacio que Events porque, a diferencia de Resource (ADR-001), un cliente no tiene disponibilidad ni se reserva — no pertenece al Core.

### 3. Cierre de las FK diferidas del Core

```sql
alter table resource_bookings
  add constraint fk_resource_bookings_event
  foreign key (event_id) references events(id) on delete cascade;

alter table locations
  add constraint fk_locations_event
  foreign key (event_id) references events(id) on delete cascade;
```

A partir de esta migración, un `resource_booking` o una `location` con `context_type = 'event'` ya no pueden apuntar a un `event_id` inexistente — error de aplicación que antes era posible y ahora lo impide la base de datos. Borrar un evento borra en cascada sus bookings y sus ubicaciones temporales asociadas (coherente con que esas ubicaciones son historial *del evento*, no historial general del almacén — ADR-004 solo protege con soft-delete el árbol de `warehouse`, no los nodos `event`, que ya son en sí mismos un snapshot puntual).

### 4. Kits y Bundles, materializados

Se crean tal cual se diseñaron en ADR-002 (`kits`, `kit_items`, `bundles`, `bundle_items`), sin cambios respecto a lo ya documentado allí. `bundles.event_id` ahora sí referencia `events(id)` con FK real.

### 5. `event_checklist_items` — checklist dinámico, no una lista fija

```sql
create table event_checklist_items (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  label text not null,
  resource_id uuid references resources(id),
  source text not null default 'manual' check (source in ('manual','rider','kit','material')),
  is_checked boolean not null default false,
  checked_at timestamptz,
  checked_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
```

Cada fila es un ítem concreto de la lista de carga de un evento concreto — no una plantilla. `resource_id` es nullable a propósito: un ítem del checklist puede no estar ligado a ningún recurso físico (ej. "confirmar acceso al recinto"), en cuyo caso solo se puede marcar manualmente. Cuando sí lo está, el flujo de "Modo Carga" del negocio (escanear el QR del recurso) debe hacer `update event_checklist_items set is_checked = true, checked_at = now(), checked_by = auth.uid() where event_id = ? and resource_id = ?` — es una actualización, no lógica de negocio nueva, así que no requiere ninguna función propia del módulo.

`source` registra de dónde salió el ítem (añadido a mano, por un Rider, por aplicar un Kit, o por un artículo de material suelto) — trazabilidad barata que permite, por ejemplo, regenerar el checklist si se vuelve a aplicar un Rider sin duplicar los ítems manuales.

**Explícitamente fuera de esta ADR** (quedan para cuando se diseñen sus propios módulos, en el orden ya fijado por ADR-005): Riders, sincronización con Google Calendar (aunque `events.google_calendar_event_id` ya reserva el hueco), Documentos (Core, según ADR-005, pero sin tabla creada todavía — se abre como deuda pendiente explícita, no en silencio), Facturación, Liquidaciones.

## Alternativas consideradas

**A. Construir el CRM completo antes que Events, para no tener una tabla `clients` "provisional".**
Descartada: bloquea Events (el módulo de mayor prioridad) por trabajo que el negocio no ha pedido todavía en detalle. Es el mismo error que la decisión estratégica de la Parte 1 del proyecto ya identificó y descartó explícitamente.

**B. `event_id` como columna suelta permanente, sin FK real, incluso después de crear `events`.**
Era razonable *antes* de que `events` existiera (ADR-005), pero mantenerla así ahora renuncia gratuitamente a integridad referencial real sin ningún motivo — el argumento original ("el Core no puede depender de un módulo") no aplica a la migración de Events, que sí puede depender del Core.

**C. Checklist como lista calculada al vuelo (derivada de Kit + Rider + Material) en vez de materializada en tabla.**
Descartada: el negocio pide marcar ítems individualmente y ver el progreso ("100% preparado") de forma persistente durante el montaje, incluso si la app se cierra a media carga. Una lista calculada al vuelo no tiene dónde guardar el estado de "marcado". Se acepta el coste de tener que regenerar filas si cambia el Kit/Rider aplicado (mitigado por la columna `source`).

## Consecuencias

- Las políticas RLS de `events`, `clients`, `kits`, `kit_items`, `bundles`, `bundle_items`, `event_checklist_items` siguen el mismo patrón de aislamiento por `organization_id` que todo el Core (`fn_user_organization_ids()`), sin ningún mecanismo nuevo.
- Queda abierta, explícitamente, la deuda de que **Documents no tiene tabla propia todavía** pese a que ADR-005 lo sitúa en el Core — no se resuelve en esta ADR porque no bloquea el resto de Events, pero se registra aquí para que no se pierda.
- El campo `events.google_calendar_event_id` existe ya en el esquema aunque la sincronización (su propio módulo, según ADR-005) no esté implementada — evita una migración adicional solo para añadir esa columna cuando llegue el momento.

## Registro de validación

**2026-08-10 — Ejecución real contra el proyecto Supabase de Calle Levante**, con las lecciones ya aprendidas durante la validación del Core aplicadas desde el primer intento (RAISE siempre dentro de `DO $$ ... $$`, `SET ROLE authenticated` explícito para el test de RLS). `events-schema.sql` se aplicó como migración `00002_events_module.sql` sin ningún error, y los 5 bloques de `events-schema-tests.sql` (SETUP + TEST 2 a 5) pasaron a la primera ejecución — sin bugs que corregir, a diferencia de la validación del Core. Se comprobó en concreto:

- Que la FK diferida `resource_bookings.event_id → events.id` (el motivo principal de esta ADR) rechaza de verdad un `event_id` inexistente.
- Que borrar un evento borra en cascada sus bookings (TEST 3), coherente con la nota de "Consecuencias" de que ese historial es del evento, no del almacén general.
- Que el aislamiento RLS de `events` y `clients` funciona entre organizaciones (TEST 4).
- Que el patrón de "Modo Carga" (marcar un ítem del checklist por `resource_id`, simulando un escaneo de QR) funciona con una simple `UPDATE`, sin necesidad de ninguna función propia (TEST 5).

Los datos de prueba se limpiaron al final de la propia ejecución del script (a diferencia de `core-schema-tests.sql`, aquí la limpieza no se dejó comentada — ver Parte 8 de ese script frente a la Parte 6 de este).
