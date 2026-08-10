# Arquitectura — Calle Levante ERP

Esta carpeta contiene las decisiones de arquitectura (ADRs) y el esquema de base de datos del Core. Vive versionada junto al código: si el Core cambia, este directorio cambia en el mismo PR.

## Cómo leer esto

1. Empieza por los ADRs en orden numérico — cada uno explica el contexto, la decisión, las alternativas descartadas y las consecuencias. No son documentación de referencia genérica: son el motivo por el que el código es como es.
2. `core-schema.sql` es la fuente de verdad ejecutable. Si un ADR y el esquema no coinciden, el esquema manda y el ADR está desactualizado — hay que corregirlo.
3. `core-schema-tests.sql` valida las garantías descritas en los ADRs contra una base de datos real. No es opcional: cualquier cambio al Core debe pasar estos tests antes de mergear.

## Estado de los ADRs

| ADR | Título | Estado | Depende de |
|---|---|---|---|
| [ADR-001](./ADR-001-resource-unificado.md) | Modelo unificado de Resource | Aceptado | — |
| [ADR-002](./ADR-002-kit-bundle.md) | Kit vs Bundle | Aceptado | ADR-001 |
| [ADR-003](./ADR-003-availability-function.md) | Motor de disponibilidad: función + constraint | Aceptado | ADR-001 |
| [ADR-004](./ADR-004-digital-twin-locations.md) | Digital Twin: locations único (almacén + evento), soft-delete | Aceptado | ADR-001 |
| [ADR-005](./ADR-005-core-vs-modulos.md) | Frontera Core vs Módulos | Aceptado | ADR-001, ADR-002, ADR-003, ADR-004 |
| [ADR-006](./ADR-006-permisos-por-rol.md) | Permisos por rol y acción (autorización granular) | Aceptado | ADR-001 |
| [ADR-007](./ADR-007-settlements.md) | Liquidaciones: gastos, saldos por participante, algoritmo de mínimas transferencias | Aceptado | ADR-001, ADR-006, ADR-009 |
| ADR-008 | Facturación: integración con proveedor Verifactu homologado, no motor propio | Pendiente | ADR-005 |
| [ADR-009](./ADR-009-events-module.md) | Módulo Events: entidad evento, clientes mínimos, checklist dinámico, cierre de FK diferidas | Aceptado | ADR-001, ADR-002, ADR-005 |
| [ADR-010](./ADR-010-kit-bundle-resolution.md) | Resolución Kit → Bundle: `fn_apply_kit_to_event` | Aceptado | ADR-001, ADR-002, ADR-003, ADR-009 |
| [ADR-011](./ADR-011-event-payments.md) | Cobros de evento: `total_amount` + `event_payments` (pagos parciales) | Aceptado | ADR-009 |

## Pendientes de validación (no dar el Core por cerrado sin esto)

- [x] Ejecutar `core-schema.sql` + `core-schema-tests.sql` contra un proyecto Supabase real (2026-08-10, proyecto remoto de Calle Levante — no local, por no haber Docker disponible en el entorno de trabajo). Los 8 bloques de test pasan. Ver "Registro de validación" en ADR-001 para el detalle de los 3 bugs encontrados y corregidos en el script de tests (el esquema en sí no necesitó cambios).
- [x] Confirmar TEST 5 y TEST 7 (aislamiento y permisos RLS) con autenticación real de Supabase — confirmado el 2026-08-10. La simulación original fallaba porque conectar como `postgres` (BYPASSRLS=true) ignora RLS sin importar el JWT simulado; corregido con `SET ROLE authenticated` explícito. Ver ADR-001.
- [ ] Añadir test de `fn_check_resource_availability` (ADR-003) — sigue pendiente de un `event_id` real del módulo Events.
- [ ] Confirmar con asesoría fiscal las fechas vigentes de obligatoriedad de Verifactu antes de fijar el calendario del módulo Billing — la normativa ha cambiado de fecha una vez ya.

## Estado de los módulos

| Módulo | Estado |
|---|---|
| Core | Diseñado, con esquema SQL y validado en ejecución real (2026-08-10). Incluye `fn_check_resource_availability` (ADR-003), añadida el 2026-08-10 tras detectar que faltaba en el esquema aplicado. |
| Events | Diseñado, con esquema SQL y validado en ejecución real (2026-08-10) — ver ADR-009 |
| Kits/Bundles | Tablas + flujo de resolución completo (`fn_apply_kit_to_event`, ADR-010), validado en ejecución real (2026-08-10) |
| Settlements | Esquema + algoritmo de mínimas transferencias (ADR-007), validado en ejecución real (2026-08-10). **Sin UI todavía.** La fórmula real de reparto (cuánto le corresponde a cada persona) sigue siendo entrada manual — deuda conocida, ver ADR-007. |
| CRM completo | Sin diseñar — `clients` existe en versión mínima (ADR-009) |
| Billing, Riders, Calendar sync, Estadísticas, Mantenimiento, AI Copilot | Sin diseñar |

## Próximo paso

Con el esquema de Settlements validado, falta la UI (`/liquidaciones` y `/bizums`, hoy placeholders) para: añadir gastos y participantes a un evento, disparar el recálculo, y marcar transferencias como pagadas. También sigue pendiente **Documents**, que ADR-005 sitúa en el Core pero que ADR-009 dejó registrado como deuda explícita sin tabla propia todavía.
