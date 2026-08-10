# ADR-007 — Liquidaciones: gastos, saldos por participante y algoritmo de mínimas transferencias

**Estado:** Aceptado
**Fecha:** 2026-08-10
**Módulo:** Settlements
**Depende de:** ADR-001, ADR-006, ADR-009

---

## Contexto

El negocio original describe el módulo de liquidaciones así: "cada evento genera ingresos, se descuentan gastos, y cada persona queda con saldo positivo o negativo. Existe ya un algoritmo (hoy en Google Apps Script) que calcula el reparto y genera el menor número posible de transferencias/Bizums entre los participantes." Este ADR diseña ese módulo.

Hay una pieza que este ADR **no puede resolver por sí sola**: la fórmula exacta de reparto (qué porcentaje o importe le corresponde a cada técnico/músico según su rol, tipo de evento, etc.) vive hoy en el Google Sheets original y no está documentada en ningún sitio accesible desde aquí. Inventar esa fórmula sería adivinar reglas de negocio reales sin base — el mismo error que este proyecto ha evitado sistemáticamente en el resto de decisiones (ver, por ejemplo, cómo ADR-011 dejó explícitamente fuera de alcance la facturación fiscal en vez de improvisarla).

## Decisión

Se separa el módulo en dos piezas con grados de certeza muy distintos:

### 1. Lo que SÍ se puede construir con confianza: el algoritmo de mínimas transferencias

Dado un conjunto de saldos por persona en un evento (positivo = se le debe dinero, negativo = debe dinero), calcular el número mínimo de transferencias que salda todas las deudas es un problema bien definido, independiente de cómo se haya calculado cada saldo. Esto se implementa como función SQL (`fn_calculate_event_settlement`), reutilizable sea cual sea la fórmula de reparto que se use en el futuro.

### 2. Lo que se deja como entrada manual — confirmado, no una limitación temporal

`event_settlement_participants.amount_owed` es un importe que se introduce a mano por evento y participante. Al diseñar este ADR se dejó así porque no se conocía la fórmula real. **Confirmado directamente con el negocio el 2026-08-10: no hay fórmula fija que automatizar.** Ni el importe de Montaje ni el Incentivo comercial son un porcentaje ni una cantidad constante — varían "dependiendo del evento", a criterio del negocio caso por caso. La Gasolina y demás gastos adelantados sí tienen un tratamiento sistemático (`event_expenses`, ya implementado, ver más abajo).

Esto convierte lo que iba a ser una limitación temporal de v1 en la decisión de diseño correcta y definitiva: `amount_owed` manual no es un parche a sustituir cuando "se conozca la fórmula" — es el modelo correcto porque no existe una fórmula que codificar. Automatizarlo igualmente (por ejemplo, fijando un porcentaje "por defecto" editable) añadiría una capa de indirección que nadie pidió y que no ahorra ningún trabajo real: el negocio ya tiene que mirar cada evento para decidir el importe, así que rellenarlo directamente (que es lo que ya permite la sección de Liquidación en la ficha del evento) es el camino más corto, no uno provisional.

### Esquema

```sql
create table event_expenses (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null check (amount > 0),
  paid_by_resource_id uuid references resources(id),  -- null = lo adelantó la empresa, no una persona
  expense_date date not null,
  created_at timestamptz not null default now()
);

create table event_settlement_participants (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  resource_id uuid not null references resources(id),  -- persona (resource_type = 'person')
  amount_owed numeric(10,2) not null default 0,          -- entrada manual en v1, ver "Decisión"
  created_at timestamptz not null default now(),
  unique (event_id, resource_id)
);

create table settlement_transfers (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  from_resource_id uuid not null references resources(id),  -- quién paga
  to_resource_id uuid not null references resources(id),    -- quién cobra
  amount numeric(10,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (from_resource_id != to_resource_id)
);
```

**Saldo neto por participante** = `amount_owed` (lo que se le debe por trabajar el evento) `+` gastos que adelantó de su bolsillo (`event_expenses.paid_by_resource_id = resource_id`) `−` lo que ya se le ha transferido (`settlement_transfers` con `status = 'paid'`, a favor o en contra según sea `to_resource_id`/`from_resource_id`).

**`fn_calculate_event_settlement(p_event_id uuid)`**: recalcula desde cero. Primero borra las transferencias `pending` existentes del evento (las `paid` se conservan como historial), calcula el saldo neto de cada participante con la fórmula de arriba, y aplica un algoritmo voraz (greedy) de liquidación: mientras haya saldos distintos de cero, empareja al mayor acreedor con el mayor deudor, genera una transferencia por el menor de los dos importes, y repite. Esto es lo que garantiza el "menor número posible de transferencias" pedido en el documento original — es un resultado conocido de este algoritmo greedy (nunca genera más de N−1 transferencias para N participantes con saldo no nulo).

Se llama a esta función cada vez que cambia algo relevante (se añade un gasto, se edita `amount_owed`, se marca una transferencia como pagada) — "cada cambio en una liquidación debe recalcular automáticamente", tal como pedía el documento original.

## Alternativas consideradas

**A. Inventar una fórmula de reparto plausible (ej. "reparto igualitario del beneficio neto") en vez de dejarlo manual.**
Descartada explícitamente: sería adivinar una regla de negocio real que ya existe en otro sitio (el Google Sheets), con el riesgo de que no coincida y alguien cobre de menos o de más sin darse cuenta. Mejor dejarlo manual y visible que automatizarlo mal.

**B. Guardar el saldo neto ya calculado en una columna en vez de derivarlo de gastos + transferencias en cada recálculo.**
Descartada por el mismo motivo que ya se aplicó en ADR-011 al decidir no guardar `pending_amount` en `event_payments`: es un dato derivado, y guardarlo abre la puerta a que se desincronice del real.

**C. Un algoritmo óptimo (minimizar transferencias de verdad, no solo "razonablemente pocas") en vez de greedy.**
El problema de minimizar transferencias de forma óptima es NP-difícil en el caso general. El algoritmo greedy (mayor acreedor con mayor deudor) da un resultado muy bueno en la práctica y es trivial de implementar y de auditar a mano — para el volumen de participantes de un evento (unas pocas personas, no cientos), la diferencia con el óptimo teórico es irrelevante. No se complica el algoritmo por una ganancia que nadie va a notar.

## Consecuencias

- **`Bizums` (ya en la navegación como placeholder) es la vista de `settlement_transfers`**: cada fila pendiente es, literalmente, el Bizum que hay que mandar. Marcar un Bizum como enviado es un `update status = 'paid'`.
- **Cerrado, no pendiente**: no hay fórmula de reparto que automatizar (confirmado con el negocio, ver "Decisión" punto 2) — `amount_owed` manual es el diseño final, no un hueco a rellenar más adelante.
- RLS sigue el mismo patrón de aislamiento por `organization_id` que todo el esquema.

## Registro de validación

**2026-08-10 — Ejecución real contra el proyecto Supabase de Calle Levante.** `settlements-schema.sql` se aplicó como migración `00007_settlements.sql` sin ningún error. Los 4 tests de `settlements-schema-tests.sql` pasaron — el segundo intento, no el primero: al diseñar el TEST 3 se cometió un error aritmético propio (se esperaba que un gasto adelantado por un participante aumentara literalmente lo que otro le debía, sin tener en cuenta que ese gasto no tiene por qué tener un deudor correspondiente entre los participantes). Se detectó al razonar el test antes de ejecutarlo, no al fallar contra la base real, y se corrigió el test (no el algoritmo, que ya era correcto) antes de aplicarlo.

Se comprobó en concreto:
- Que el algoritmo greedy genera el mínimo de transferencias (2, no 3, para 3 participantes con saldo no nulo) y las asigna correctamente al único deudor.
- Que un gasto adelantado por un participante se incorpora a su saldo en el recálculo, y que si ese importe extra no tiene un deudor correspondiente entre los participantes, el algoritmo lo deja sin cubrir en vez de inventarse una transferencia — comportamiento correcto y documentado (ver "Consecuencias"), no un bug.
- Que las transferencias ya marcadas `paid` se conservan como historial y no se regeneran ni duplican al recalcular tras un cambio.

Datos de prueba limpiados al final del propio script.
