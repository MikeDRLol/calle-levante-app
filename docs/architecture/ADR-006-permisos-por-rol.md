# ADR-006 — Permisos por rol y acción (autorización granular)

**Estado:** Aceptado
**Fecha:** 2026-08-10
**Módulo:** Core
**Depende de:** ADR-001

---

## Contexto

Hasta ahora, RLS solo resuelve **aislamiento** (un usuario de la organización A no ve datos de la organización B), pero no **autorización dentro de la organización** (¿puede un técnico editar la estructura del almacén, o solo un manager?). El disparador concreto fue la pregunta: "¿quién puede reorganizar estanterías?" — pero es un problema general: lo mismo aplica a quién puede anular una factura, marcar una avería, o modificar una liquidación ya cerrada.

## Decisión

Se introduce una tabla de permisos **como datos configurables por organización**, no como lógica hardcodeada por rol en cada política RLS. Esto es deliberadamente coherente con la misma filosofía ya aplicada en `settlement_rules` (discutida en la conversación de arquitectura, aún no formalizada en ADR propio): las reglas que varían entre organizaciones no se escriben en código, se escriben en tablas.

```sql
role_permissions (
  organization_id, role, permission_key, allowed
)
```

`permission_key` es un string libre por convención `modulo.accion` (ej. `locations.edit_structure`, `resources.mark_damaged`, `settlements.reopen`). No se modela como enum cerrado a propósito: cada módulo nuevo añade sus propias claves sin tocar el Core.

Una función `fn_user_has_permission(organization_id, permission_key)` centraliza la comprobación, reutilizable tanto desde políticas RLS como desde la capa de aplicación (para, por ejemplo, ocultar un botón en la UI antes incluso de intentar la acción).

### Aplicación concreta a `locations` (la pregunta que originó este ADR)

Se sustituye la política única `locations_isolation` (aislamiento sin distinción de rol) por tres políticas separadas: lectura abierta a todo miembro de la organización, escritura restringida por permiso.

### Valores por defecto al crear una organización

Un trigger siembra permisos razonables por defecto (editables después desde ajustes de organización, sin tocar código):

| Rol | `locations.edit_structure` |
|---|---|
| owner, admin, manager | ✅ |
| technician, commercial, accounting, client | ❌ |

## Alternativas consideradas

**A. Codificar la comprobación de rol directamente en cada política RLS** (`using (role in ('owner','admin','manager'))`).
Descartada: cualquier cambio de "qué rol puede hacer qué" requeriría una migración de esquema. Con el volumen de acciones sensibles que va a tener el sistema (facturación, liquidaciones, inventario, mantenimiento...), esto se vuelve inmanejable y además impide que cada organización cliente ajuste sus propios permisos — relevante si el proyecto evoluciona hacia SaaS (discutido en la primera parte de esta conversación).

**B. Un sistema de roles jerárquico con niveles numéricos** (owner=100, admin=80, manager=60...) y comprobación `>=`.
Más simple de implementar, pero no modela bien la realidad: un `accounting` puede necesitar permisos que un `technician` no tiene y viceversa, sin que uno sea estrictamente "superior" al otro. Una matriz explícita rol×acción es más honesta con el dominio, al coste de más filas de configuración.

## Consecuencias

- Cada módulo nuevo que necesite control de acceso granular reutiliza `role_permissions` y `fn_user_has_permission` sin diseñar su propio mecanismo — es infraestructura del Core, coherente con el test de ADR-005.
- Añade una tabla más a auditar en RLS (`role_permissions` en sí debe estar protegida por aislamiento de organización, y su edición debería requerir un permiso propio, ej. `organization.manage_permissions`, para que un `manager` no pueda auto-concederse permisos de `owner`).
- Riesgo aceptado: si el trigger de valores por defecto falla o no se ejecuta al crear una organización, todos los permisos quedan denegados por defecto (`allowed` no tiene default `true`) — es un fallo seguro (nadie puede hacer nada) en vez de inseguro (todos pueden hacer todo), pero puede confundir en desarrollo si no se detecta rápido. Se cubre con un test específico (ver `core-schema-tests.sql`).

## Notas de implementación

Ver bloque `ROLE PERMISSIONS` en `core-schema.sql` para el SQL completo: tabla, función `fn_user_has_permission`, trigger de siembra de valores por defecto, y las políticas RLS granulares de `locations` como caso de referencia para futuros módulos.
