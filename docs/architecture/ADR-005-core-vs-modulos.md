# ADR-005 — Frontera Core vs Módulos

**Estado:** Aceptado
**Fecha:** 2026-08-10
**Módulo:** — (decisión transversal)
**Depende de:** ADR-001, ADR-002, ADR-003, ADR-004

---

## Contexto

Durante el diseño surgió la propuesta de tratar el Core como "intocable" y todo lo demás como módulos que pueden cambiar. Es una buena intuición pero necesita un criterio objetivo — de lo contrario, cualquier cosa que "parezca importante" acaba metida en el Core, y el Core deja de ser genérico y mantenible.

## Decisión

Se define un único test para decidir si algo pertenece al Core:

> **¿Lo necesitarían dos módulos de negocio distintos, sin conocerse entre sí?**

Si la respuesta es sí, va en el Core. Si depende de conocimiento específico del negocio de eventos musicales (riders, checklist de carga, tipos de boda), va en un módulo, aunque sea el módulo más importante del producto.

### Core (motor genérico, sin conocimiento de "eventos musicales")

| Pieza | Por qué es Core |
|---|---|
| `organizations`, `organization_members` | Toda organización, sea cual sea su vertical, necesita identidad y aislamiento multi-tenant |
| `resources` + tablas de detalle | Cualquier vertical que gestione recursos reservables (alquiler de maquinaria, salas, flotas) los necesita — ADR-001 |
| `resource_bookings` + `fn_check_resource_availability` | El motor de disponibilidad no sabe qué es un "evento", solo sabe de solapamiento de intervalos — ADR-003 |
| `locations` | El Digital Twin es útil para cualquier negocio con inventario físico, no solo eventos — ADR-004 |
| `audit_log` | Cualquier módulo financiero o de recursos necesita trazabilidad |
| `domain_events` (outbox) | El bus de eventos desacopla módulos entre sí; no pertenece a ninguno en particular |
| `role_permissions` | El control de acceso por acción es necesario en cualquier módulo — ADR-006 |

**Documents** se incluye en el Core como *infraestructura de almacenamiento* (subir/asociar un archivo a cualquier entidad), pero **no** incluye lógica de qué tipo de documento es obligatorio para qué (eso — "todo evento necesita un Rider antes de aplicar Kit" — es conocimiento del módulo Events).

### Módulos (conocen el negocio, se construyen sobre el Core)

```
Events        — el primero y más importante; usa Resources+Bookings+Locations
Kits/Bundles  — ADR-002, construido sobre Events + Resources
CRM           — pipeline de oportunidades, historial de comunicación
Inventario    — categorías, QR, checklist dinámico (usa Resources+Locations del Core)
Settlements   — motor de liquidaciones y reparto (reglas como datos, no genéricas)
Billing       — facturación, integración Verifactu homologada
Calendar sync — Google Calendar, bidireccional
AI Copilot    — tool calling sobre las APIs de los demás módulos
Estadísticas  — lectura agregada de todos los módulos
Riders        — específico de grupos musicales
Mantenimiento — revisiones/ITV/calibraciones, opera sobre Resource pero con reglas de negocio propias
```

### Consecuencia práctica de la frontera: Events NO está en el Core

Aunque Events es el corazón del producto, no cumple el test: ningún otro módulo necesitaría "Event" si mañana esta arquitectura se reutilizara para, por ejemplo, alquiler de maquinaria de construcción sin eventos musicales de por medio. Events es el consumidor más importante del Core, no parte de él. Esto es intencional y ya se aplicó implícitamente en ADR-002 y ADR-004 (`event_id` aparece en `resource_bookings` y `locations` como columna sin FK real, precisamente porque el Core no puede depender de un módulo).

## Alternativas consideradas

**A. Core = "todo lo que ya está construido", Módulos = "todo lo que se construya después".**
Es la formulación original, descartada por ser una definición temporal, no arquitectónica — no da ningún criterio para decidir dónde va algo nuevo, solo para clasificar lo que ya existe.

**B. Core = todo lo compartido por al menos dos tablas existentes hoy.**
Descartada por ser retrospectiva y no predictiva: no ayuda a decidir si algo nuevo (ej. "Mantenimiento") debería ser Core o módulo antes de que exista un segundo consumidor real.

## Consecuencias

- Cualquier PR que añada una tabla o función al Core debe justificar, en su descripción, qué segundo módulo (real o razonablemente previsible) la necesitaría. Si no hay respuesta clara, va en un módulo.
- El Core sigue pudiendo cambiar — "intocable" no significa inmutable, significa que cambia con más disciplina de migración que un módulo, porque romperlo rompe todo lo construido encima (ver nota en discusión previa a este ADR).
