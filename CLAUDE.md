@AGENTS.md

# calle-levante-app — Contexto de arquitectura

Este proyecto sustituye un Google Sheets por un ERP de eventos musicales, diseñado desde el principio para poder venderse como SaaS más adelante sin rehacer el núcleo. Antes de escribir o modificar cualquier código, lee `docs/architecture/README.md` y los ADR-001 a ADR-006 en `docs/architecture/`. No son documentación opcional: son las decisiones que ya se tomaron y las razones por las que se descartaron las alternativas. Si vas a hacer algo que contradiga un ADR, dilo explícitamente y pregunta antes de proceder — no lo hagas en silencio.

## Stack

- Frontend: Next.js + React + TypeScript + Tailwind + shadcn/ui
- Backend/DB: Supabase (Postgres + Auth + RLS + Storage)
- Hosting: Vercel

## Reglas no negociables (violarlas rompe garantías del sistema, no solo estilo)

1. **Todo dato de negocio lleva `organization_id`, y toda tabla nueva lleva su política RLS de aislamiento.** Sin excepción, incluso si hoy solo existe una organización (Calle Levante). Ver ADR-001.
2. **La disponibilidad de cualquier recurso (persona, material, vehículo, sala) se resuelve únicamente a través de `resource_bookings` y `fn_check_resource_availability`.** No construyas lógica de disponibilidad propia por módulo — es el error que este diseño existe precisamente para evitar. Ver ADR-001 y ADR-003.
3. **`locations` nunca se borra físicamente.** Cualquier "eliminar ubicación" pasa por `fn_deactivate_location`, nunca por un `DELETE`. Ver ADR-004.
4. **Los permisos por rol se consultan con `fn_user_has_permission`, nunca se hardcodean `role in (...)` dentro de una política RLS nueva.** Si un módulo nuevo necesita control de acceso granular, añade sus `permission_key` a `role_permissions`, no inventes un mecanismo paralelo. Ver ADR-006.
5. **Antes de añadir algo al Core** (`docs/architecture/*` describe qué es Core), aplica el test de ADR-005: ¿lo necesitarían dos módulos sin conocerse entre sí? Si la respuesta no es un sí claro, va en un módulo, no en el Core.
6. **Reglas de negocio que varían (liquidaciones, checklist, permisos) se modelan como datos en tablas, no como funciones con valores hardcodeados.** No hace falta un motor de reglas genérico con UI todavía — sí hace falta que el número no esté clavado en TypeScript. Ver discusión en ADR-006 (aplica igual a Settlements cuando se diseñe, ADR-007 pendiente).
7. **No construyas un motor de facturación propio homologado (Verifactu).** El módulo Billing se integra con un proveedor ya homologado (Holded, Billin, FacturaDirecta u otro con API) para la parte fiscal. Construir un SIF propio es responsabilidad legal directa y no aporta ventaja competitiva a este producto. Ver nota en ADR-008 (pendiente de documento propio).

## Estado actual

- **Core diseñado, con esquema SQL completo y validado en ejecución real**: `docs/architecture/core-schema.sql` — organizations, resources (+ people/materials/vehicles/rooms_details), resource_bookings, locations, audit_log, domain_events, role_permissions, todo con RLS. Aplicado el 2026-08-10 como migración (`supabase/migrations/00001_core_schema.sql`) contra el proyecto Supabase remoto de Calle Levante, y validado con los 8 tests de `docs/architecture/core-schema-tests.sql` (todos pasan). El esquema no necesitó ningún cambio; se corrigieron 3 bugs en el propio script de tests — ver "Registro de validación" en ADR-001.
- **Módulo Events: sin diseñar todavía.** Es el siguiente paso ahora que el Core está validado. Kit/Bundle (ADR-002) no se puede probar de extremo a extremo sin él.

## Validación del Core (ya hecha — referencia para futuros cambios de esquema)

Este proyecto no tiene Docker disponible en el entorno de trabajo habitual, así que la validación no se hizo con `supabase start` (Postgres local) sino directamente contra el proyecto Supabase remoto, usando la CLI vía `npx supabase` (no requiere Docker para `db push`/`db query`, solo para el stack local):

1. `npx supabase init`, copiar `docs/architecture/core-schema.sql` a `supabase/migrations/00001_core_schema.sql`.
2. `npx supabase db push --db-url "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.<project-ref>.supabase.co:5432/postgres"` — aplica la migración.
3. Los tests (`core-schema-tests.sql`) no se pueden ejecutar con `supabase db query -f` (falla con "cannot insert multiple commands into a prepared statement" al tener varias sentencias). Se ejecutaron con un script Node + `pg` que manda el fichero completo como una sola query de protocolo simple y escucha el evento `notice` del cliente para capturar los `RAISE NOTICE`.
4. Si vuelves a tocar el esquema, repite este flujo antes de dar el cambio por bueno. Presta especial atención a TEST 5 y TEST 7: solo son una prueba real de RLS si el rol de sesión se cambia explícitamente a `authenticated` (`SET ROLE authenticated`) antes de comprobar — conectado como `postgres` (o `service_role`), Supabase tiene `BYPASSRLS = true` y las políticas se ignoran sin importar qué `request.jwt.claim.sub` se simule.
5. Si algo falla, no lo arregles por tu cuenta sin explicar qué ADR queda afectado por el cambio — actualiza el ADR correspondiente en el mismo PR que el fix, igual que se hizo durante esta validación (ver el "Registro de validación" al final de ADR-001 como ejemplo del formato esperado).

## Después de validar el Core

El siguiente módulo a diseñar e implementar es **Events**, construido sobre `resources` + `resource_bookings` + `locations` del Core, siguiendo la frontera de ADR-005. No dupliques lógica de disponibilidad dentro de Events: todo pasa por las funciones del Core.
