# ADR-002 — Kit vs Bundle

**Estado:** Aceptado
**Fecha:** 2026-08-06
**Módulo:** Events (construido sobre Core: Resources, Bookings)
**Depende de:** ADR-001 (Resource unificado)

---

## Contexto

Un evento no reserva recursos uno a uno en la práctica: reserva un "paquete" reconocible por el negocio (ej. "Equipo Boda Premium" = 2 tops + 2 subgraves + 4 micros + mesa + luces). Este paquete tiene dos naturalezas distintas que se confundían en el diseño original:

1. Una **plantilla reutilizable** que define qué categorías y cantidades componen el paquete (independiente de qué unidades físicas concretas se usen cada vez).
2. La **asignación real** de ese paquete a un evento concreto, con instancias físicas concretas (Subgrave 1 y Subgrave 3, no "2 subgraves" en abstracto).

Confundir ambos conceptos en una sola entidad genera un problema real: si "Kit Boda Premium" apuntara directamente a instancias concretas (Subgrave 1, Subgrave 3), y esas unidades estuvieran averiadas o reservadas otro día, el Kit dejaría de ser aplicable sin que hubiera ningún motivo de negocio para ello — el problema es logístico (qué subgrave concreto usar hoy), no conceptual (cuántos subgraves necesita una boda premium).

## Decisión

Se separan dos entidades:

### Kit — plantilla, sin instancias concretas

```sql
kits (id, organization_id, name, event_type)
kit_items (kit_id, resource_category, resource_type, quantity)
```

Un Kit dice **"esto necesita 2 recursos de categoría Subgraves, tipo material"**, nunca "esto necesita el Subgrave 1". Es intercambiable entre eventos y no se ve afectado por el estado de unidades físicas concretas.

### Bundle — agrupación real, instancias concretas, ligada a un evento

```sql
bundles (id, organization_id, event_id, source_kit_id NULL)
bundle_items (bundle_id, resource_id)
```

Un Bundle es el resultado de **resolver** un Kit (o de armar material manualmente) para un evento concreto: sustituye "2 subgraves" por "Subgrave 1, Subgrave 3" reales. `source_kit_id` es nullable porque un Bundle puede crearse sin partir de ningún Kit (montaje ad-hoc).

### Flujo de aplicación de un Kit a un evento

1. Usuario (o el Copiloto de IA) selecciona un Kit para un evento.
2. El sistema crea un `Bundle` con `source_kit_id` apuntando al Kit.
3. Por cada `kit_item`, el sistema busca recursos disponibles de esa categoría/tipo consultando `resource_bookings` (comprobación de solapamiento, ver ADR-001/003) y crea los `bundle_items` correspondientes junto con sus `resource_bookings`.
4. Si no hay suficientes unidades disponibles de una categoría, el sistema lo señala explícitamente (no se aplica el Kit a medias en silencio — coherente con el requisito original de "si falta material que aparezca claramente").
5. Si una unidad del Bundle se avería después de aplicado, se sustituye a nivel de `bundle_items` sin tocar el Kit original.

## Alternativas consideradas

**A. Una sola entidad "Kit" que apunta directamente a instancias concretas.**
Descartada por el problema descrito en el contexto: acopla una decisión de plantilla (qué necesita una boda premium) con una decisión operativa del día (qué subgrave concreto está libre), haciendo que el Kit "se rompa" por motivos ajenos a su definición.

**B. Bundle sin relación con Kit — todo montaje siempre manual.**
Descartada porque pierde exactamente el valor que motivó la idea: poder aplicar "Kit Boda Premium" con una acción y que el sistema resuelva la asignación real. Sin Kit, cada evento requeriría montar el material desde cero.

## Consecuencias

- El Copiloto de IA puede operar sobre Kits sin necesidad de conocer inventario físico concreto: "hazme una boda para 200 personas" selecciona/ajusta cantidades de un Kit; la resolución a instancias reales la hace el motor de Bundles reutilizando la misma lógica de disponibilidad del Core.
- Las estadísticas de "material más usado" pueden calcularse a dos niveles: por Kit (qué plantillas se aplican más) y por recurso físico concreto (qué unidad concreta se usa/desgasta más) — dato valioso para mantenimiento y compras.
- Coste aceptado: un evento con Kit aplicado requiere dos tablas para reconstruir "qué se llevó" (`bundle_items` + histórico de `kit_items` si el Kit cambió después) en vez de una. Se acepta porque separar plantilla de instancia es lo que hace el modelo mantenible a largo plazo.

## Notas de implementación

```sql
create table kits (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  event_type text,          -- referencia libre al tipo de evento del módulo Events (Boda, Concierto, DJ...)
  created_at timestamptz not null default now()
);

create table kit_items (
  id uuid primary key default uuid_generate_v4(),
  kit_id uuid not null references kits(id) on delete cascade,
  resource_category text not null,   -- ej. 'Subgraves', debe existir en el catálogo de categorías del tenant
  resource_type text not null check (resource_type in ('material','vehicle','tool','equipment')),
  quantity integer not null check (quantity > 0)
);

create table bundles (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null,            -- FK real desde el módulo Events
  source_kit_id uuid references kits(id),
  created_at timestamptz not null default now()
);

create table bundle_items (
  id uuid primary key default uuid_generate_v4(),
  bundle_id uuid not null references bundles(id) on delete cascade,
  resource_id uuid not null references resources(id),
  booking_id uuid references resource_bookings(id),  -- reserva real generada al aplicar el Kit
  unique (bundle_id, resource_id)
);
```

Todas estas tablas requieren las mismas políticas RLS por `organization_id` que el resto del Core (ver ADR-001, patrón `fn_user_organization_ids()`).

**Pendiente de validar en ejecución real (mismo aviso que ADR-001):** el caso de "Kit con más unidades solicitadas que disponibles" debe devolver un resultado parcial explícito, no fallar en silencio ni aplicar de menos sin avisar — a definir el contrato exacto de la función/endpoint que resuelve Kit → Bundle antes de implementarlo.
