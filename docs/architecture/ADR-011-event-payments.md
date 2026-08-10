# ADR-011 — Cobros de evento: `events.total_amount` + `event_payments`

**Estado:** Aceptado
**Fecha:** 2026-08-10
**Módulo:** Events
**Depende de:** ADR-009

---

## Contexto

El negocio necesita saber, por evento, cuánto se ha acordado cobrar y qué se ha cobrado ya (señales, pagos parciales, saldo pendiente) — sin esperar al módulo Billing completo (presupuestos, facturas homologadas, vencimientos), que sigue fuera de alcance por la Regla 7 de `CLAUDE.md` (no se construye un motor de facturación propio homologado; eso se delega a un proveedor Verifactu externo cuando se diseñe Billing).

Es importante separar explícitamente dos cosas que se parecen pero no son lo mismo:

- **Lo que este ADR resuelve**: registro operativo de "cuánto cobra este evento y qué se ha ingresado ya" — información interna, sin ningún requisito fiscal.
- **Lo que este ADR NO resuelve**: facturas con validez fiscal, series numeradas, IVA, hash encadenado Verifactu, ni nada que dependa de un proveedor homologado. Eso sigue siendo Billing (ADR-008, pendiente).

## Decisión

`events` gana una columna `total_amount` (importe acordado con el cliente, nullable — no todos los eventos tienen precio cerrado desde el principio). Los pagos recibidos son eventos discretos, no un único campo `paid_amount`, porque el negocio cobra en varias veces (señal + resto, por ejemplo) y necesita ver cada pago por separado:

```sql
alter table events add column total_amount numeric(10,2);

create table event_payments (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  method text not null check (method in ('cash','transfer','bizum','card','other')),
  paid_at date not null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
```

El importe pendiente (`total_amount - sum(event_payments.amount)`) se calcula en la aplicación, no se guarda como columna — es un dato derivado y guardarlo abriría la puerta a que se desincronice del real (mismo criterio que ya se aplicó implícitamente al no guardar contadores derivados en ningún otro sitio del esquema).

`method` es un `check` cerrado (no texto libre como `event_type` o `resource_category`) porque, a diferencia de esos campos, el método de pago sí es un catálogo pequeño y estable que no varía por organización — no hay necesidad de negocio real de que cada organización invente sus propios métodos de pago.

## Alternativas consideradas

**A. Un único campo `events.paid_amount` en vez de una tabla de pagos.**
Descartada: pierde el historial de cuándo y cómo se cobró cada parte, que es justo lo que el negocio pidió explícitamente (pagos parciales, no solo un total cobrado).

**B. Meter esto directamente en el futuro módulo Settlements (ADR-007).**
Descartada: Settlements reparte *beneficios* entre técnicos/músicos a partir de ingresos y gastos ya conocidos — es un consumidor de esta información, no el sitio donde se registra el cobro del cliente. Mezclarlos acoplaría el registro de un cobro simple a un motor de reparto que todavía no existe.

## Consecuencias

- Cuando se diseñe Billing (ADR-008), `event_payments` es candidato natural a fuente de datos para generar la factura real via el proveedor homologado — no se duplica el registro de cobros, se reutiliza.
- RLS sigue el mismo patrón de aislamiento por `organization_id` que el resto del esquema, sin ningún permiso especial por rol en esta primera versión (cualquier miembro de la organización puede registrar un cobro) — si el negocio pide restringirlo a `accounting`/`owner` más adelante, se añade una `permission_key` a `role_permissions` (ADR-006), no un mecanismo nuevo.

## Registro de validación

**2026-08-10 — Ejecución real contra el proyecto Supabase de Calle Levante.** `event-payments.sql` se aplicó como migración `00006_event_payments.sql` sin ningún error. Los 2 tests de `event-payments-tests.sql` pasaron a la primera: la suma de pagos coincide con `total_amount` (1200 = 500 + 700, pendiente 0), y el `check (amount > 0)` rechaza correctamente un importe negativo. Datos de prueba limpiados al final del propio script.
