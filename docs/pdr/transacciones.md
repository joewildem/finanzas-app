---
modulo: "Transacciones"
status: en progreso
---
## Resumen del módulo

El módulo de Transacciones permite al usuario registrar los movimientos de dinero de su día a día:
gastos, ingresos, transferencias entre cuentas propias y pagos a tarjeta de crédito, además de
consultar, editar y eliminar dichos movimientos. Es el módulo que da uso real a la infraestructura
construida en [[cuentas]] (colección `transactions`, contrato mínimo) y en [[categorias]] (grupos y
categorías). Todo movimiento que involucra dos cuentas propias (transferencia, pago a tarjeta) se
modela como **dos documentos enlazados** — uno por cuenta — de modo que el historial de cada cuenta
muestre su propio lado del movimiento de forma nativa. El pago a deudas externas (créditos
automotrices, hipotecarios, préstamos personales) queda fuera de alcance de este módulo — se
resuelve como una entidad propia en [[creditos-deudas]], separada de `accounts`, ya que no
representan cuentas bancarias del usuario. El ajuste manual de saldo (CU-006 de [[cuentas]]) no se
gestiona desde este módulo — solo se refleja como una transacción más, de solo lectura, dentro del
historial general.

> **Revisado (2026-08-24, cierre de [[creditos-deudas]]):** el pago a una deuda externa, anotado
> arriba como fuera de alcance, ya está resuelto — se registra como una fila única de
> `tipo = pago_deuda` (mismo patrón de documento único que `aportacion_meta`/`retiro_meta`, no el de
> dos documentos enlazados), vía los nuevos campos `deuda_id`, `monto_capital` y `monto_interes`.

> **Revisado (2026-08-22, cierre de [[ahorros-y-metas]]):** el tipo `aportacion_meta`, reservado
> desde este documento sin flujo de captura, ya está habilitado — junto con el nuevo tipo simétrico
> `retiro_meta` — desde CU-047/CU-048 de [[ahorros-y-metas]]. A diferencia de lo que este resumen
> decía originalmente, una aportación o retiro de meta **no** sigue el patrón de dos documentos
> enlazados: se registra como una **fila única**, referenciando la meta mediante el nuevo campo
> `transactions.meta_id` — una meta no es una cuenta, no existe un segundo lado real que requiera su
> propia fila.

## Casos de uso

### CU-013 — Registrar gasto o ingreso

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario registrar un gasto o un ingreso, según el tipo de movimiento
que seleccione. Para ello será necesario capturar el monto, la categoría (obligatoria, filtrada
según el tipo elegido) y la cuenta afectada; opcionalmente puede modificar la fecha (por defecto el
día de hoy) y capturar una nota. El sistema determina internamente el signo con el que el monto
afecta el saldo de la cuenta: negativo para gasto, positivo para ingreso — el usuario siempre
captura el monto en positivo. El chip "Investment" no es un tipo de movimiento distinto: es un
atajo visual que filtra las categorías mostradas al grupo "Investment", pero genera una transacción
de `tipo = gasto` igual que cualquier otra.

**Flujo principal**

1. El usuario accede a "Registrar movimiento" y captura el monto (con calculadora integrada al
   teclado numérico, ver nota de diseño).
2. El usuario selecciona el tipo de movimiento: "Gasto" o "Ingreso" (los chips "Gasto" e
   "Investment" producen ambos `tipo = gasto`, filtrando distinto grupo de categorías).
3. El sistema muestra las categorías disponibles: si el tipo es gasto, las de los grupos Bills,
   Needs, Wants e Investment; si es ingreso, únicamente las del grupo Ingresos.
4. El usuario selecciona la categoría y la cuenta afectada.
5. El usuario, opcionalmente, ajusta la fecha (por defecto hoy) y captura una nota.
6. El usuario confirma el registro.
7. El sistema valida los datos ingresados.
8. El sistema crea el documento en `transactions` con el signo correspondiente al tipo, y actualiza
   `saldo_actual` de la cuenta de forma atómica junto con la creación del registro.
9. El sistema muestra el movimiento recién creado en el historial.

**Flujos alternativos / casos borde**

- Si la cuenta seleccionada está archivada, el sistema rechaza el registro.
- Si la categoría seleccionada no corresponde al grupo permitido para el tipo elegido (ej. una
  categoría de Ingresos en un movimiento de gasto), el sistema rechaza el registro.
- Si la categoría está oculta (archivada), el sistema la excluye del selector — no se puede
  seleccionar una categoría archivada al registrar un movimiento nuevo.

**Precondiciones**

- El usuario debe estar autenticado.
- La cuenta debe existir, pertenecer al usuario y encontrarse en `status = active`.
- La categoría debe existir, pertenecer al usuario, ser `tipo = categoria`, encontrarse en
  `status = active`, y pertenecer a un grupo válido para el tipo de movimiento seleccionado.

**Postcondiciones**

- Se crea un documento en `transactions` con `tipo = gasto` o `tipo = ingreso`, `category_id` y
  `account_id` correspondientes, y `monto` con el signo aplicado (negativo o positivo).
- `saldo_actual` de la cuenta se actualiza sumando el `monto` con signo.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `tipo` | Selección única (chip) | Sí | N/A | Enum: `gasto`, `ingreso` | Determina el grupo de categorías disponible | — | RN-039 |
| `monto` | Numérico (con calculadora integrada) | Sí | — | Decimal > 0 | El signo se aplica internamente según `tipo` | — | RN-038, RN-040 |
| `category_id` | Selección (categoría existente del usuario) | Sí | N/A | ObjectId válido; debe pertenecer al grupo permitido para `tipo` | Filtrado por `tipo` | — | RN-039, RN-041 |
| `account_id` | Selección (cuenta existente del usuario) | Sí | N/A | ObjectId válido; debe estar activa | — | — | RN-042 |
| `fecha` | Selector de fecha (calendario) | No | N/A | Fecha válida | — | Fecha actual | — |
| `nota` | Texto libre | No | 0–140 caracteres | — | — | — | — |

**Reglas de negocio**

- RN-038: El usuario siempre captura el monto en positivo; el sistema aplica el signo
  internamente al persistir (`gasto` → negativo, `ingreso` → positivo) y al afectar `saldo_actual`.
- RN-039: Si `tipo = gasto`, `category_id` debe referenciar una categoría cuyo grupo tenga
  `flujo = outflow`. Si `tipo = ingreso`, `category_id` debe referenciar exclusivamente una
  categoría cuyo grupo tenga `flujo = inflow` (campo `flujo` de `categories`, ver RN-118 en
  [[categorias]]). *Revisado 2026-08-11: hasta entonces el grupo permitido se identificaba por
  nombre exacto (Bills/Needs/Wants/Investment para gasto, Income para ingreso) — un grupo renombrado
  quedaba sin categorías válidas para su tipo de movimiento. El campo `flujo` reemplaza esa
  comparación por nombre; el resultado de la regla no cambia para el catálogo semilla actual. El
  chip "Investment" del formulario sigue acotando el selector de categoría a ese grupo específico
  por nombre — es un subconjunto de Outflow, no una tercera opción de flujo, y queda fuera de este
  cambio.*
- RN-040: Registrar un gasto o ingreso actualiza `saldo_actual` de la cuenta asociada sumando el
  monto con signo, de forma atómica junto con la creación del documento en `transactions`.
- RN-041: La categoría debe existir, pertenecer al usuario, estar en `status = active`, y ser
  `tipo = categoria` (no grupo) — mismo patrón IDOR que BIZ-005 de [[categorias]].
- RN-042: La cuenta debe existir, pertenecer al usuario y estar en `status = active` — una cuenta
  archivada no admite nuevos movimientos (símil RN-007 de [[cuentas]]).

**Casos de uso derivados identificados**

- CU-014: Registrar transferencia entre cuentas propias
- CU-015: Registrar pago a tarjeta de crédito
- CU-016: Listar transacciones (historial general)
- CU-017: Editar transacción
- CU-018: Eliminar transacción
- *Nota de diseño (no CU):* se evalúa que la calculadora aritmética del campo `monto` aparezca
  integrada al teclado numérico en lugar de como una acción aparte — decisión de UX/frontend a
  resolver en Figma (ver [[brief-ux]]), sin impacto en el modelo de datos ni en las reglas de
  negocio de este documento.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `tipo` | string | Requerido, enum cerrado (`gasto`, `ingreso`) | A01 — Validar contra whitelist |
| `monto` | number | Requerido, decimal mayor a cero | A03 — Validar tipo y rango numérico |
| `category_id` | ObjectId | Requerido; debe existir, pertenecer al usuario, ser `tipo=categoria`, `status=active`, y pertenecer al grupo permitido para `tipo` | A01 — Control de acceso a nivel de objeto (IDOR) |
| `account_id` | ObjectId | Requerido; debe existir, pertenecer al usuario y estar `status=active` | A01 — Control de acceso a nivel de objeto (IDOR) |
| `nota` | string | Opcional, máx. 140 caracteres | A03 — Sanitizar entrada; A07 — Codificar en salida |

**Mensajes de error**

*Validación*
- `VALIDATION_001`: "El campo {campo} es obligatorio." *(reutilizado)*
- `VALIDATION_012`: "El monto debe ser un número mayor a cero."

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Lógica de negocio*
- `BIZ_009`: "La categoría seleccionada no existe, no te pertenece, está oculta, o no corresponde a este tipo de movimiento."
- `BIZ_010`: "La cuenta seleccionada no existe, no te pertenece, o está archivada."

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| POST | `/api/v1/transactions` | Bearer JWT |

*Request*
```json
{
  "tipo": "string (requerido, enum: gasto|ingreso)",
  "monto": "number (requerido, > 0)",
  "category_id": "ObjectId (requerido)",
  "account_id": "ObjectId (requerido)",
  "fecha": "ISODate (opcional, default: hoy)",
  "nota": "string (opcional, máx 140 caracteres)"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "tipo": "string",
    "monto": "number (con signo aplicado)",
    "category_id": "ObjectId",
    "account_id": "ObjectId",
    "fecha": "ISODate",
    "nota": "string|null",
    "created_at": "ISODate"
  },
  "message": "Movimiento registrado exitosamente."
}
```

*Modelo de información*
```json
// Colección: transactions (esquema definitivo — ver data-model-registry; sintaxis Postgres real
// desde el cierre de [[ahorros-y-metas]], 2026-08-22)
{
  "_id": "ObjectId",
  "user_id": "ObjectId (ref: users)",
  "account_id": "ObjectId (ref: accounts)",
  "tipo": "string (enum: ajuste, gasto, ingreso, transferencia, pago_tarjeta, aportacion_meta, retiro_meta, pago_deuda)",
  "category_id": "ObjectId|null (ref: categories, tipo=categoria; obligatorio solo si tipo=gasto|ingreso)",
  "transaccion_relacionada_id": "ObjectId|null (self-referencia; obligatorio si tipo=transferencia|pago_tarjeta — no aplica a aportacion_meta/retiro_meta/pago_deuda)",
  "meta_id": "ObjectId|null (ref: savings_goals; obligatorio si tipo=aportacion_meta|retiro_meta — ver [[ahorros-y-metas]])",
  "deuda_id": "ObjectId|null (ref: debts; obligatorio si tipo=pago_deuda — ver [[creditos-deudas]])",
  "monto_capital": "number|null (obligatorio si tipo=pago_deuda — ver [[creditos-deudas]])",
  "monto_interes": "number|null (obligatorio si tipo=pago_deuda — ver [[creditos-deudas]])",
  "concepto": "string",
  "monto": "number (con signo: negativo=salida, positivo=entrada)",
  "nota": "string|null",
  "fecha": "ISODate",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```
> Este es el cierre del esquema provisional introducido en CU-006 de [[cuentas]]. Se extiende con
> `category_id`, `transaccion_relacionada_id` y `nota`; se registra en [[data-model-registry]] al
> cerrar el módulo.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| `transactions.category_id` → `categories` | Referenciado | Un movimiento de gasto/ingreso pertenece a una categoría; se consulta con frecuencia para reportes por categoría |

*Índices*

| Colección | Campos | Tipo | Propósito |
|---|---|---|---|
| `transactions` | `{ user_id: 1, category_id: 1, fecha: -1 }` | Compuesto | Consultar movimientos por categoría (reportes) |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Registrar gasto válido | `tipo=gasto`, categoría de Needs, cuenta activa | Transacción creada, `saldo_actual` disminuye | 201 |
| 2 | Flujo exitoso | Registrar ingreso válido | `tipo=ingreso`, categoría de Ingresos, cuenta activa | Transacción creada, `saldo_actual` aumenta | 201 |
| 3 | Flujo exitoso | Registrar gasto con categoría de Investment | `tipo=gasto`, categoría del grupo Investment | Transacción creada normalmente | 201 |
| 4 | Validación de entrada | Monto faltante o inválido | Sin `monto` o `monto=0` | `VALIDATION_012` | 400 |
| 5 | Lógica de negocio | Categoría de Ingresos en un gasto | `tipo=gasto`, `category_id` del grupo Ingresos | `BIZ_009` | 404 |
| 6 | Lógica de negocio | Categoría archivada | `category_id` con `status=archived` | `BIZ_009` | 404 |
| 7 | Lógica de negocio | Cuenta archivada | `account_id` con `status=archived` | `BIZ_010` | 404 |
| 8 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 9 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-transacciones-alta]] · [[user-flow-registrar-gasto]]

---

### CU-014 — Registrar transferencia entre cuentas propias

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario mover dinero entre dos cuentas propias de débito o
efectivo (ej. de una cuenta de débito a efectivo o viceversa), sin que el movimiento se clasifique
en ninguna categoría. Para ello será necesario capturar la cuenta de origen, la cuenta destino y el
monto. El sistema genera dos documentos enlazados en `transactions` — uno por cada cuenta — de modo
que el movimiento aparezca de forma nativa en el historial de ambas.

**Flujo principal**

1. El usuario captura el monto y selecciona el chip "Transferencia".
2. El sistema muestra los selectores de cuenta de origen y cuenta destino (sin selector de
   categoría).
3. El usuario selecciona ambas cuentas (de tipo débito o efectivo).
4. El usuario, opcionalmente, ajusta la fecha y captura una nota.
5. El usuario confirma el registro.
6. El sistema valida los datos ingresados.
7. El sistema crea dos documentos enlazados en `transactions`: uno con `account_id` de la cuenta
   origen y `monto` negativo, otro con `account_id` de la cuenta destino y `monto` positivo, ambos
   con `tipo = transferencia` y el mismo `transaccion_relacionada_id` cruzado.
8. El sistema actualiza `saldo_actual` de ambas cuentas de forma atómica.
9. El sistema muestra el movimiento en el historial de ambas cuentas.

**Flujos alternativos / casos borde**

- Si la cuenta de origen y destino son la misma, el sistema rechaza el registro.
- Si alguna de las dos cuentas es de tipo `credito`, el sistema rechaza el registro — para mover
  dinero hacia una tarjeta de crédito existe un tipo de movimiento dedicado (ver CU-015).
- Si alguna cuenta está archivada, el sistema rechaza el registro.

**Precondiciones**

- El usuario debe estar autenticado.
- Ambas cuentas deben existir, pertenecer al usuario, encontrarse en `status = active`, y ser de
  `tipo = debito` o `tipo = efectivo`.

**Postcondiciones**

- Se crean dos documentos en `transactions` con `tipo = transferencia`, enlazados entre sí por
  `transaccion_relacionada_id`, sin `category_id`.
- `saldo_actual` de la cuenta origen disminuye y el de la cuenta destino aumenta, en el mismo monto.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `cuenta_origen_id` | Selección (cuenta propia) | Sí | N/A | ObjectId válido; `tipo` debito o efectivo; activa | Distinta de `cuenta_destino_id` | — | RN-043, RN-044 |
| `cuenta_destino_id` | Selección (cuenta propia) | Sí | N/A | ObjectId válido; `tipo` debito o efectivo; activa | Distinta de `cuenta_origen_id` | — | RN-043, RN-044 |
| `monto` | Numérico | Sí | — | Decimal > 0 | Se aplica negativo en origen, positivo en destino | — | RN-038 (mismo criterio que CU-013) |
| `fecha` | Selector de fecha | No | N/A | Fecha válida | — | Fecha actual | — |
| `nota` | Texto libre | No | 0–140 caracteres | — | — | — | — |

**Reglas de negocio**

- RN-043: Tanto `cuenta_origen_id` como `cuenta_destino_id` deben ser cuentas de `tipo = debito` o
  `tipo = efectivo`. No se permite `tipo = credito` en ninguna de las dos posiciones — el pago a
  tarjeta se resuelve mediante un tipo de movimiento dedicado (CU-015).
- RN-044: `cuenta_origen_id` y `cuenta_destino_id` deben ser distintas.
- RN-045: Se generan dos documentos en `transactions` enlazados por `transaccion_relacionada_id`:
  uno con `account_id = cuenta_origen_id` y `monto` negativo, otro con `account_id = cuenta_destino_id`
  y `monto` positivo; ambos comparten `tipo = transferencia`, `fecha` y `nota`.
- RN-046: La creación de ambos documentos y la actualización de `saldo_actual` en ambas cuentas se
  ejecuta de forma atómica.
- RN-047: `tipo = transferencia` no lleva `category_id`; si el frontend envía uno, el backend lo
  ignora.

**Casos de uso derivados identificados**

- Ninguno adicional a los ya identificados en CU-013.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `cuenta_origen_id` | ObjectId | Requerido; debe existir, pertenecer al usuario, ser débito/efectivo, `status=active` | A01 — Control de acceso a nivel de objeto (IDOR) |
| `cuenta_destino_id` | ObjectId | Requerido; mismas reglas que origen; distinta de `cuenta_origen_id` | A01 — Control de acceso a nivel de objeto (IDOR) |
| `monto` | number | Requerido, decimal mayor a cero | A03 — Validar tipo y rango numérico |

**Mensajes de error**

*Validación*
- `VALIDATION_001`: "El campo {campo} es obligatorio." *(reutilizado)*
- `VALIDATION_012`: "El monto debe ser un número mayor a cero." *(reutilizado)*
- `VALIDATION_014`: "La cuenta de origen y destino deben ser distintas."

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Lógica de negocio*
- `BIZ_011`: "La cuenta de origen o destino no existe, no te pertenece, o está archivada."
- `BIZ_012`: "Solo se permite transferir entre cuentas de débito o efectivo."

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| POST | `/api/v1/transfers` | Bearer JWT |

*Request*
```json
{
  "cuenta_origen_id": "ObjectId (requerido)",
  "cuenta_destino_id": "ObjectId (requerido)",
  "monto": "number (requerido, > 0)",
  "fecha": "ISODate (opcional, default: hoy)",
  "nota": "string (opcional, máx 140 caracteres)"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "transaccion_origen": { "id": "ObjectId", "account_id": "ObjectId", "monto": "number (negativo)" },
    "transaccion_destino": { "id": "ObjectId", "account_id": "ObjectId", "monto": "number (positivo)" },
    "fecha": "ISODate"
  },
  "message": "Transferencia registrada exitosamente."
}
```

*Modelo de información*

Reutiliza la colección `transactions` definida en CU-013. No se agregan campos nuevos.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| `transactions.transaccion_relacionada_id` → `transactions` (self-referencia) | Referenciado | Un movimiento entre dos cuentas propias se modela como dos documentos independientes enlazados, en vez de un array embebido, para que cada cuenta consulte su propio historial sin lógica especial (reutiliza el índice `{ account_id: 1, fecha: -1 }` de CU-006 de [[cuentas]] en ambos documentos) |

*Índices*

| Colección | Campos | Tipo | Propósito |
|---|---|---|---|
| `transactions` | `{ transaccion_relacionada_id: 1 }` | Disperso (sparse) | Localizar el documento enlazado de un movimiento de dos cuentas |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Transferir de débito a efectivo | Cuentas válidas, monto > 0 | Dos documentos creados, saldos actualizados | 201 |
| 2 | Validación de entrada | Monto inválido | `monto=0` | `VALIDATION_012` | 400 |
| 3 | Validación de entrada | Cuenta origen igual a destino | Mismo `id` en ambos campos | `VALIDATION_014` | 400 |
| 4 | Lógica de negocio | Cuenta origen o destino de tipo crédito | `cuenta_destino_id` de una tarjeta | `BIZ_012` | 400 |
| 5 | Lógica de negocio | Cuenta inexistente, ajena o archivada | `cuenta_origen_id` inválida | `BIZ_011` | 404 |
| 6 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 7 | Error del sistema | Falla de base de datos a medio proceso | Simulado | `SYS_001`, ningún documento parcial persiste | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-transacciones-alta]] (variante sin categoría, con dos selectores de cuenta)

---

### CU-015 — Registrar pago a tarjeta de crédito

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario registrar el pago (abono) de una tarjeta de crédito propia
desde una cuenta de débito o efectivo. A diferencia de una transferencia genérica (CU-014), este
movimiento tiene un tipo dedicado porque su destino siempre es una cuenta de tipo crédito, y el
efecto es reducir la deuda de la tarjeta. No lleva categoría, igual que la transferencia.

**Flujo principal**

1. El usuario captura el monto y selecciona el chip correspondiente a pago de tarjeta.
2. El sistema muestra el selector de cuenta de origen (débito o efectivo) y el selector de tarjeta
   de crédito destino (solo cuentas propias de `tipo = credito`, activas).
3. El usuario selecciona ambas cuentas.
4. El usuario, opcionalmente, ajusta la fecha y captura una nota.
5. El usuario confirma el registro.
6. El sistema valida los datos ingresados.
7. El sistema crea dos documentos enlazados en `transactions`: uno con `account_id` de la cuenta
   origen y `monto` negativo, otro con `account_id` de la tarjeta y `monto` positivo, ambos con
   `tipo = pago_tarjeta`.
8. El sistema actualiza `saldo_actual` de ambas cuentas de forma atómica — el `saldo_actual` de la
   tarjeta (almacenado en negativo, ver [[cuentas]]) se acerca a cero conforme se abona.
9. El sistema muestra el movimiento en el historial de ambas cuentas.

**Flujos alternativos / casos borde**

- Si la cuenta destino no es de `tipo = credito`, el sistema rechaza el registro — para mover
  dinero entre cuentas de débito/efectivo existe CU-014.
- Si la cuenta origen es también una tarjeta de crédito, el sistema rechaza el registro — no se
  permite pagar una tarjeta con otra tarjeta en este módulo.
- Si alguna cuenta está archivada, el sistema rechaza el registro.

**Precondiciones**

- El usuario debe estar autenticado.
- La cuenta origen debe existir, pertenecer al usuario, estar `status = active`, y ser
  `tipo = debito` o `tipo = efectivo`.
- La cuenta destino debe existir, pertenecer al usuario, estar `status = active`, y ser
  `tipo = credito`.

**Postcondiciones**

- Se crean dos documentos en `transactions` con `tipo = pago_tarjeta`, enlazados entre sí, sin
  `category_id`.
- `saldo_actual` de la cuenta origen disminuye; `saldo_actual` de la tarjeta aumenta (se acerca a
  cero, reduciendo la deuda) en el mismo monto.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `cuenta_origen_id` | Selección (cuenta propia) | Sí | N/A | ObjectId válido; `tipo` debito o efectivo; activa | — | — | RN-048 |
| `cuenta_destino_id` | Selección (tarjeta de crédito propia) | Sí | N/A | ObjectId válido; `tipo` credito; activa | — | — | RN-048 |
| `monto` | Numérico | Sí | — | Decimal > 0 | Se aplica negativo en origen, positivo en la tarjeta | — | RN-038, RN-049 |
| `fecha` | Selector de fecha | No | N/A | Fecha válida | — | Fecha actual | — |
| `nota` | Texto libre | No | 0–140 caracteres | — | — | — | — |

**Reglas de negocio**

- RN-048: `cuenta_destino_id` debe ser una cuenta propia de `tipo = credito`; `cuenta_origen_id`
  debe ser una cuenta propia de `tipo = debito` o `tipo = efectivo` — no se permite pagar una
  tarjeta con otra tarjeta desde este caso de uso.
- RN-049: El abono aumenta el `saldo_actual` de la tarjeta (almacenado en negativo como deuda, ver
  [[cuentas]]), acercándolo a cero; nunca lo hace positivo por encima de cero desde este caso de
  uso — un sobrepago se registra igual, la validación de tope queda fuera de alcance del MVP.
- RN-050: Se generan dos documentos en `transactions` enlazados por `transaccion_relacionada_id`,
  con `tipo = pago_tarjeta`, sin `category_id`, siguiendo el mismo patrón de atomicidad que RN-045
  y RN-046 (CU-014).

**Casos de uso derivados identificados**

- Ninguno adicional a los ya identificados en CU-013/CU-014.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `cuenta_origen_id` | ObjectId | Requerido; debe existir, pertenecer al usuario, ser débito/efectivo, `status=active` | A01 — Control de acceso a nivel de objeto (IDOR) |
| `cuenta_destino_id` | ObjectId | Requerido; debe existir, pertenecer al usuario, ser `tipo=credito`, `status=active` | A01 — Control de acceso a nivel de objeto (IDOR) |
| `monto` | number | Requerido, decimal mayor a cero | A03 — Validar tipo y rango numérico |

**Mensajes de error**

*Validación*
- `VALIDATION_001`: "El campo {campo} es obligatorio." *(reutilizado)*
- `VALIDATION_012`: "El monto debe ser un número mayor a cero." *(reutilizado)*

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Lógica de negocio*
- `BIZ_011`: "La cuenta de origen o destino no existe, no te pertenece, o está archivada." *(reutilizado — CU-014)*
- `BIZ_013`: "La cuenta destino debe ser una tarjeta de crédito propia y activa."

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| POST | `/api/v1/credit-card-payments` | Bearer JWT |

*Request*
```json
{
  "cuenta_origen_id": "ObjectId (requerido)",
  "cuenta_destino_id": "ObjectId (requerido, cuenta tipo=credito)",
  "monto": "number (requerido, > 0)",
  "fecha": "ISODate (opcional, default: hoy)",
  "nota": "string (opcional, máx 140 caracteres)"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "transaccion_origen": { "id": "ObjectId", "account_id": "ObjectId", "monto": "number (negativo)" },
    "transaccion_tarjeta": { "id": "ObjectId", "account_id": "ObjectId", "monto": "number (positivo)" },
    "fecha": "ISODate"
  },
  "message": "Pago a tarjeta registrado exitosamente."
}
```

*Modelo de información*

Reutiliza la colección `transactions` definida en CU-013. No se agregan campos nuevos.

*Decisiones de modelado*

Sin cambios respecto a CU-014 — mismo patrón de dos documentos enlazados por
`transaccion_relacionada_id`.

*Índices*

Reutiliza `{ transaccion_relacionada_id: 1 }` definido en CU-014 — no se crean índices nuevos.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Pagar tarjeta desde cuenta de débito | Cuentas válidas, monto > 0 | Dos documentos creados; deuda de la tarjeta disminuye | 201 |
| 2 | Validación de entrada | Monto inválido | `monto=0` | `VALIDATION_012` | 400 |
| 3 | Lógica de negocio | Cuenta destino no es tarjeta de crédito | `cuenta_destino_id` de una cuenta débito | `BIZ_013` | 400 |
| 4 | Lógica de negocio | Cuenta origen es también tarjeta de crédito | `cuenta_origen_id` de tipo credito | `BIZ_013` | 400 |
| 5 | Lógica de negocio | Cuenta inexistente, ajena o archivada | `cuenta_destino_id` inválida | `BIZ_011` | 404 |
| 6 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 7 | Error del sistema | Falla de base de datos a medio proceso | Simulado | `SYS_001`, ningún documento parcial persiste | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-transacciones-alta]] (variante pago a tarjeta, selector de tarjeta destino)

---

### CU-016 — Listar transacciones (historial general)

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar el historial completo de sus movimientos
(gastos, ingresos, transferencias, pagos a tarjeta y ajustes manuales), con filtros por tipo,
cuenta, categoría y rango de fechas. Es la vista central de consulta del módulo; el historial de
movimientos que ya se muestra en el detalle de una cuenta (CU-003 de [[cuentas]]) es un subconjunto
de esta misma consulta, filtrado por `account_id`.

**Flujo principal**

1. El usuario accede a la sección "Transacciones".
2. El sistema recupera los movimientos del usuario, ordenados por fecha descendente.
3. El sistema muestra el listado con tipo, categoría (si aplica), cuenta, monto (con signo) y
   fecha de cada movimiento.
4. El usuario puede aplicar filtros por tipo, cuenta, categoría y/o rango de fechas.

**Flujos alternativos / casos borde**

- Si el usuario no tiene movimientos registrados, se muestra un estado vacío invitando a registrar
  el primero.
- Las transacciones enlazadas (transferencia, pago a tarjeta) aparecen como dos renglones
  independientes en este listado general (uno por cuenta) — a diferencia del detalle de una cuenta
  específica, donde solo se ve el lado correspondiente a esa cuenta.
- Las transacciones de `tipo = ajuste` aparecen en este listado con normalidad, pero no son
  editables ni eliminables desde aquí (ver CU-017, CU-018, RN-056).

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna: es una operación de solo lectura.

**Definición detallada de campos**

| Campo                  | Tipo de control                                                                                                | Obligatorio | Longitud | Formato / validación                                                                                                                      | Dependencias | Valor por defecto | Regla de negocio |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------- | ---------------- |
| `tipo` (filtro)        | Selección múltiple                                                                                             | No          | N/A      | Enum: `ajuste`, `gasto`, `ingreso`, `transferencia`, `pago_tarjeta`, `all`                                                                | —            | `all`             | —                |
| `account_id` (filtro)  | Selección                                                                                                      | No          | N/A      | ObjectId de una cuenta propia                                                                                                             | —            | Todas             | —                |
| `category_id` (filtro) | Selección                                                                                                      | No          | N/A      | ObjectId de una categoría propia                                                                                                          | —            | Todas             | —                |
| `rango_fecha` (filtro) | Selección con presets (All, This month, Last week, Last 3 months, Last 6 months, Last 12 months, Custom range) | No          | N/A      | Los presets calculan `fecha_desde`/`fecha_hasta` en el cliente; "Custom range" despliega el componente Calendar (shadcn/ui) en modo rango | —            | Sin límite        | —                |

**Reglas de negocio**

- Ninguna nueva — reutiliza los índices `{ account_id: 1, fecha: -1 }` (CU-006 de [[cuentas]]) y
  `{ user_id: 1, category_id: 1, fecha: -1 }` (CU-013) para esta consulta.

**Casos de uso derivados identificados**

- *Patrón Búsqueda y Filtrado:* aplica y ya se resuelve dentro de este mismo CU (filtros de tipo,
  cuenta, categoría y fecha) — no se justifica un CU independiente dado que es la única pantalla de
  consulta agregada del módulo.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `tipo` (query param) | string | Opcional; si se envía, debe ser uno de los valores del enum o `all` | A01 — Validar contra whitelist |
| `account_id`, `category_id` (query param) | ObjectId | Opcional; si se envía, debe pertenecer al usuario | A01 — Control de acceso a nivel de objeto |
| `fecha_desde`, `fecha_hasta` (query param) | ISODate | Opcional; deben ser fechas válidas y `fecha_desde <= fecha_hasta` | A03 — Validar formato y rango |

**Mensajes de error**

*Validación*
- `VALIDATION_015`: "El filtro de tipo no es válido."

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/transactions?tipo={..}&account_id={..}&category_id={..}&fecha_desde={..}&fecha_hasta={..}` | Bearer JWT |

*Request*
```
Query params: tipo (opcional, default "all"), account_id (opcional), category_id (opcional),
fecha_desde (opcional), fecha_hasta (opcional)
```

*Response (éxito)*
```json
{
  "success": true,
  "data": [
    {
      "id": "ObjectId",
      "tipo": "string",
      "monto": "number (con signo)",
      "account_id": "ObjectId",
      "category_id": "ObjectId|null",
      "transaccion_relacionada_id": "ObjectId|null",
      "nota": "string|null",
      "fecha": "ISODate"
    }
  ]
}
```

*Modelo de información*

Reutiliza la colección `transactions`. No se agregan campos nuevos.

*Decisiones de modelado*

Sin cambios respecto a CU-013.

*Índices*

Reutiliza `{ account_id: 1, fecha: -1 }` y `{ user_id: 1, category_id: 1, fecha: -1 }` — no se
crean índices nuevos.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Listar todos los movimientos | Sin filtros | Devuelve todos los movimientos del usuario | 200 |
| 2 | Flujo exitoso | Filtrar por tipo | `tipo=gasto` | Solo movimientos de gasto | 200 |
| 3 | Flujo exitoso | Filtrar por rango de fechas | `fecha_desde`, `fecha_hasta` válidos | Movimientos dentro del rango | 200 |
| 4 | Flujo exitoso | Usuario sin movimientos | Usuario nuevo | Arreglo vacío, estado vacío en UI | 200 |
| 5 | Validación de entrada | Filtro de tipo inválido | `tipo=inexistente` | `VALIDATION_015` | 400 |
| 6 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 7 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-transacciones-listado]]

---

### CU-017 — Editar transacción

**Actor:** Usuario autenticado (dueño del movimiento)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario corregir el monto, la categoría (si aplica), la fecha y/o
la nota de una transacción ya registrada. La cuenta y el tipo de movimiento **no son editables**
desde aquí — para corregir cualquiera de los dos, el usuario debe eliminar el movimiento (CU-018) y
registrarlo de nuevo con los datos correctos. Editar el monto recalcula el saldo de la(s) cuenta(s)
afectada(s); si la transacción está enlazada (transferencia o pago a tarjeta), el cambio se refleja
de forma espejada en ambos documentos.

**Flujo principal**

1. El usuario accede al movimiento desde el historial (CU-016) y selecciona "Editar".
2. El sistema muestra el formulario pre-llenado, con cuenta y tipo en modo de solo lectura.
3. El usuario modifica monto, categoría (si el tipo es gasto/ingreso), fecha y/o nota.
4. El usuario confirma los cambios.
5. El sistema valida los datos ingresados.
6. El sistema calcula la diferencia entre el monto anterior y el nuevo, y actualiza `saldo_actual`
   de la(s) cuenta(s) afectada(s) en consecuencia, de forma atómica junto con la actualización del
   documento.
7. Si la transacción está enlazada, el sistema aplica el mismo cambio de monto (con signo opuesto)
   al documento relacionado y a la cuenta correspondiente.
8. El sistema muestra el movimiento actualizado.

**Flujos alternativos / casos borde**

- Si la transacción es de `tipo = ajuste`, el sistema rechaza la edición — se gestiona únicamente
  desde [[cuentas]] (CU-006).
- Si se intenta cambiar la categoría en un movimiento de transferencia o pago a tarjeta, el sistema
  la ignora (estos tipos nunca llevan categoría).
- Si la nueva categoría no corresponde al grupo permitido para el tipo del movimiento (misma regla que RN-039), se rechaza el cambio.
- El formulario de edición reutiliza el mismo modal de alta (CU-013/CU-014), con los campos
  `account_id` y `tipo` en modo de solo lectura — visualmente idéntico al de alta, sin introducir
  un componente aparte.

**Precondiciones**

- El usuario debe estar autenticado.
- La transacción debe existir y pertenecer al usuario.
- La transacción no debe ser de `tipo = ajuste`.

**Postcondiciones**

- Se actualizan `monto`, `category_id` (si aplica), `fecha` y/o `nota` del documento.
- `saldo_actual` de la(s) cuenta(s) involucrada(s) se recalcula reflejando la diferencia entre el
  monto anterior y el nuevo.
- Si la transacción está enlazada, el documento relacionado se actualiza en la misma operación.
- Se actualiza `updated_at`.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `monto` | Numérico | No | — | Decimal > 0 | Recalcula `saldo_actual` de la(s) cuenta(s) afectada(s) | valor actual | RN-052 |
| `category_id` | Selección | No | N/A | Solo válido si `tipo` es gasto o ingreso; mismas reglas de grupo que RN-039 | — | valor actual | RN-053 |
| `meta_id` | Selección | No | N/A | Solo válido si `tipo` es aportación/retiro de meta | — | valor actual | RN-152 de [[ahorros-y-metas]] |
| `deuda_id`, `monto_capital`, `monto_interes` | Selección / Numérico | No | — | Solo válidos si `tipo = pago_deuda`; mismas reglas de propiedad y estado activo que `category_id`/`meta_id` | — | valor actual | RN-224 (ver [[creditos-deudas]]) |
| `fecha` | Selector de fecha | No | N/A | Fecha válida | — | valor actual | — |
| `nota` | Texto libre | No | 0–140 caracteres | — | — | valor actual | — |
| `account_id` | Solo lectura | — | — | — | — | valor actual | RN-051: no editable |
| `tipo` | Solo lectura | — | — | — | — | valor actual | RN-051: no editable |

**Reglas de negocio**

- RN-051: `account_id` y `tipo` no son editables desde este caso de uso; para corregirlos, el
  usuario debe eliminar la transacción (CU-018) y registrarla de nuevo.
- RN-052: Editar el `monto` recalcula `saldo_actual` como la reversión del monto anterior más la
  aplicación del nuevo, de forma atómica. Si la transacción tiene `transaccion_relacionada_id`, el
  monto se actualiza de forma espejada en ambos documentos y en ambas cuentas, en la misma
  operación atómica.
- RN-053: `category_id` solo es editable si `tipo` ∈ {`gasto`, `ingreso`}, sujeto a las mismas
  reglas de pertenencia de grupo que RN-039.
- RN-056: Las transacciones de `tipo = ajuste` no se pueden editar desde este módulo — se
  gestionan exclusivamente desde [[cuentas]] (CU-006).

**Casos de uso derivados identificados**

- Ninguno adicional.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `monto` | number | Opcional; si se envía, decimal mayor a cero | A03 — Validar tipo y rango numérico |
| `category_id` | ObjectId | Opcional; si se envía, solo válido si `tipo` es gasto/ingreso; debe cumplir RN-039 | A01 — Control de acceso a nivel de objeto (IDOR) |
| `id` (path param) | ObjectId | Requerido; debe existir, pertenecer al usuario, y no ser `tipo=ajuste` | A01 — Control de acceso a nivel de objeto |

**Mensajes de error**

*Validación*
- `VALIDATION_012`: "El monto debe ser un número mayor a cero." *(reutilizado)*

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Lógica de negocio*
- `BIZ_009`: "La categoría seleccionada no existe, no te pertenece, está oculta, o no corresponde a este tipo de movimiento." *(reutilizado — CU-013)*
- `BIZ_014`: "La transacción solicitada no existe."
- `BIZ_015`: "Las transacciones de ajuste no se pueden editar ni eliminar desde este módulo."

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| PATCH | `/api/v1/transactions/{id}` | Bearer JWT |

*Request*
```json
{
  "monto": "number (opcional, > 0)",
  "category_id": "ObjectId (opcional, solo si tipo=gasto|ingreso)",
  "fecha": "ISODate (opcional)",
  "nota": "string (opcional, máx 140 caracteres)"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "monto": "number (con signo)",
    "category_id": "ObjectId|null",
    "fecha": "ISODate",
    "nota": "string|null",
    "updated_at": "ISODate"
  },
  "message": "Transacción actualizada exitosamente."
}
```

*Modelo de información*

Reutiliza la colección `transactions`. Se actualizan `monto`, `category_id`, `fecha`, `nota` y
`updated_at`; si aplica, también el documento enlazado.

*Decisiones de modelado*

Sin cambios respecto a CU-013/CU-014.

*Índices*

Sin cambios — reutiliza los índices existentes.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Editar monto de un gasto | Nuevo monto válido | Transacción y `saldo_actual` actualizados | 200 |
| 2 | Flujo exitoso | Editar monto de una transferencia enlazada | Nuevo monto válido | Ambos documentos y ambas cuentas actualizados | 200 |
| 3 | Flujo exitoso | Editar categoría de un ingreso | Nueva categoría del grupo Ingresos | Categoría actualizada | 200 |
| 4 | Validación de entrada | Monto inválido | `monto=0` | `VALIDATION_012` | 400 |
| 5 | Lógica de negocio | Categoría no corresponde al tipo | Categoría de otro grupo | `BIZ_009` | 404 |
| 6 | Lógica de negocio | Editar transacción de ajuste | `id` de una transacción `tipo=ajuste` | `BIZ_015` | 409 |
| 7 | Recurso no encontrado | Transacción inexistente o ajena | `id` inválido o de otro usuario | `BIZ_014` | 404 |
| 8 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 9 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-transacciones-listado]] (acción "Editar" desde el historial)

---

### CU-018 — Eliminar transacción

**Actor:** Usuario autenticado (dueño del movimiento)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario eliminar por completo una transacción registrada por
error, revirtiendo su efecto sobre el saldo de la(s) cuenta(s) involucrada(s). A diferencia de
[[cuentas]] y [[categorias]], aquí no se usa un patrón de archivado — una transacción eliminada
desaparece del historial de forma permanente, ya que corregir un registro erróneo es el motivo
principal de esta acción. Si la transacción está enlazada (transferencia o pago a tarjeta), eliminar
un lado elimina automáticamente el otro.

**Flujo principal**

1. El usuario accede al movimiento desde el historial (CU-016) y selecciona "Eliminar".
2. El sistema muestra un mensaje de confirmación explicando que la acción es permanente y que el
   saldo de la(s) cuenta(s) se ajustará en consecuencia.
3. El usuario confirma la eliminación.
4. El sistema revierte el efecto del `monto` sobre `saldo_actual` de la cuenta asociada.
5. Si la transacción tiene `transaccion_relacionada_id`, el sistema elimina también el documento
   enlazado y revierte el efecto sobre la cuenta correspondiente, en la misma operación.
6. El sistema elimina el/los documento(s) de `transactions`.
7. El sistema retira el movimiento del historial.

**Flujos alternativos / casos borde**

- Si la transacción es de `tipo = ajuste`, el sistema rechaza la eliminación — se gestiona
  únicamente desde [[cuentas]].
- Si la transacción está enlazada, no es posible eliminar solo un lado — la eliminación siempre
  afecta a ambos documentos y ambas cuentas.

**Precondiciones**

- El usuario debe estar autenticado.
- La transacción debe existir y pertenecer al usuario.
- La transacción no debe ser de `tipo = ajuste`.

**Postcondiciones**

- El documento (o los dos documentos enlazados) se eliminan de `transactions`.
- `saldo_actual` de la(s) cuenta(s) involucrada(s) revierte al valor previo al registro del
  movimiento eliminado.

**Definición detallada de campos**

No aplica — este CU no captura datos nuevos, elimina uno o dos registros existentes y ajusta
saldos.

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `id` (path param) | N/A (acción del sistema) | Sí | N/A | ObjectId válido; debe pertenecer al usuario y no ser `tipo=ajuste` | — | — | RN-054, RN-055, RN-056 |

**Reglas de negocio**

- RN-054: Eliminar una transacción revierte su efecto sobre `saldo_actual` de la cuenta asociada,
  de forma atómica junto con la eliminación del documento.
- RN-055: Si la transacción tiene `transaccion_relacionada_id`, eliminar cualquiera de los dos
  documentos elimina automáticamente ambos y revierte el efecto sobre ambas cuentas, en una sola
  operación atómica.
- RN-056: Las transacciones de `tipo = ajuste` no se pueden eliminar desde este módulo — se
  gestionan exclusivamente desde [[cuentas]] (CU-006).

**Casos de uso derivados identificados**

- Ninguno adicional.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `id` (path param) | ObjectId | Requerido; debe existir, pertenecer al usuario, y no ser `tipo=ajuste` | A01 — Control de acceso a nivel de objeto |

**Mensajes de error**

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Lógica de negocio*
- `BIZ_014`: "La transacción solicitada no existe." *(reutilizado — CU-017)*
- `BIZ_015`: "Las transacciones de ajuste no se pueden editar ni eliminar desde este módulo." *(reutilizado — CU-017)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| DELETE | `/api/v1/transactions/{id}` | Bearer JWT |

*Request*
```
(sin body)
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "transaccion_relacionada_eliminada": "ObjectId|null"
  },
  "message": "Transacción eliminada exitosamente."
}
```

*Modelo de información*

Elimina uno o dos documentos de `transactions` y actualiza `saldo_actual` en `accounts` de la(s)
cuenta(s) afectada(s).

> Nota técnica: la eliminación del/los documento(s) y el ajuste de `saldo_actual` deben ejecutarse
> de forma atómica, mismo patrón que la nota técnica de CU-006 de [[cuentas]] y CU-012 de
> [[categorias]].

*Decisiones de modelado*

Sin cambios respecto a CU-013/CU-014.

*Índices*

Sin cambios — reutiliza los índices existentes.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Eliminar un gasto | `id` de un gasto propio | Documento eliminado, `saldo_actual` revertido | 200 |
| 2 | Flujo exitoso | Eliminar una transferencia enlazada | `id` de una de las dos transacciones | Ambos documentos eliminados, ambos saldos revertidos | 200 |
| 3 | Lógica de negocio | Eliminar transacción de ajuste | `id` de una transacción `tipo=ajuste` | `BIZ_015` | 409 |
| 4 | Recurso no encontrado | Transacción inexistente o ajena | `id` inválido o de otro usuario | `BIZ_014` | 404 |
| 5 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 6 | Error del sistema | Falla de base de datos a medio proceso | Simulado | `SYS_001`, ningún documento parcial se elimina | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-transacciones-listado]] (acción "Eliminar" con modal de confirmación)

---

## Historial de cambios

| Fecha      | Cambio                                                                                                                                                                                                                                                                                                                                                                                 | CU afectado     | Impacto en otros documentos                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-30 | Se crea el módulo Transacciones: cierre del esquema definitivo de `transactions` (`category_id`, `transaccion_relacionada_id`, `nota`); catálogo definitivo de tipos (`ajuste`, `gasto`, `ingreso`, `transferencia`, `pago_tarjeta`, `aportacion_meta` reservado para v1.1); patrón de dos documentos enlazados para movimientos entre dos cuentas propias; se agregan CU-013 a CU-018 | CU-013 a CU-018 | Se actualiza [[data-model-registry]] con el esquema definitivo de `transactions`, nuevos índices, relaciones y el índice de numeración. Se actualiza [[categorias]] con el nuevo grupo semilla "Ingresos" (cambio cruzado). Se deja fuera de alcance el pago a deudas externas (automotriz, hipotecario, préstamos personales) — se resolverá en el futuro módulo de Créditos y deudas (v1.1) como entidad propia, no como cuenta. |
| 2026-08-11 | Cambio cruzado desde [[categorias]] (RN-118): se revisa **RN-039** — el grupo permitido para `category_id` según `tipo` ya no se identifica por nombre exacto (Bills/Needs/Wants/Investment para gasto, Income para ingreso), sino por el campo estructural `flujo` de `categories` (`outflow`/`inflow`). `create_transaction` y `update_transaction` se actualizan (`supabase/migrations/20260811110000_add_category_group_flow_and_order.sql`), mismos códigos de error (`BIZ_009`), sin cambio de firma. El chip "Investment" del formulario de alta sigue acotando por nombre de grupo, sin cambio — es un subconjunto de Outflow, no una tercera opción de flujo. No se agregan CU ni RN nuevos en este documento. | CU-013, CU-014, CU-017, CU-035 | Se actualiza [[data-model-registry]]: índice de numeración hasta `RN-119` (origen categorías) |
| 2026-08-22 | Cambio cruzado desde [[ahorros-y-metas]]: se corrige el resumen del módulo (arriba) — una aportación o retiro de meta **no** sigue el patrón de dos documentos enlazados, es una fila única vía el nuevo campo `transactions.meta_id`. El enum `tipo` gana `retiro_meta` (nuevo); `aportacion_meta`, reservado desde el 2026-07-30, queda habilitado. La condición de `transaccion_relacionada_id` se reduce a `tipo = transferencia\|pago_tarjeta` — deja de incluir `aportacion_meta`. `update_transaction` (CU-017) gana el parámetro `p_meta_id` — editable bajo las mismas condiciones que `category_id` (RN-152 de [[ahorros-y-metas]]). `delete_transaction` (CU-018) no requiere cambios — al ser filas únicas, ya revierte correctamente el saldo de la única cuenta involucrada. No se agregan CU ni RN nuevos en este documento. | CU-013, CU-017, CU-018 | Se actualiza [[data-model-registry]]: `transactions.meta_id`, enum `tipo` con `retiro_meta`, condición de `transaccion_relacionada_id` corregida — ver [[ahorros-y-metas]] para el detalle completo |
| 2026-08-24 | Cambio cruzado desde [[creditos-deudas]]: se corrige el resumen del módulo (arriba) — el pago a una deuda externa, antes fuera de alcance, ya está resuelto como una fila única (mismo patrón que `aportacion_meta`/`retiro_meta`). El enum `tipo` gana `pago_deuda` (nuevo); se agregan `deuda_id`, `monto_capital` y `monto_interes` al esquema de `transactions`, mutuamente excluyentes con `category_id`/`meta_id`. `update_transaction` (CU-017) gana los tres como parámetros editables bajo las mismas condiciones que `category_id`/`meta_id` (`RN-224`, nueva). `delete_transaction` (CU-018) no requiere cambios — al ser fila única, ya revierte correctamente el saldo de la única cuenta involucrada. | CU-013, CU-017, CU-018 | Se actualiza [[data-model-registry]]: `transactions.deuda_id`/`monto_capital`/`monto_interes`, enum `tipo` con `pago_deuda` — ver [[creditos-deudas]] para el detalle completo |

### CU-035 — Aplicar acciones en lote sobre transacciones (batch actions)

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario aplicar un mismo cambio a varias transacciones a la vez,
desde el listado general (CU-016), sin editarlas una por una. Para ello el sistema activará un
"modo selección" en el que cada fila del historial muestra un checkbox; el usuario podrá marcar
varias transacciones y aplicarles, en conjunto, uno de cuatro cambios: reasignar cuenta,
sobrescribir fecha, sobrescribir nota, o eliminarlas. A diferencia de la edición individual
(CU-017), donde la cuenta de una transacción no es editable, esta vía sí permite reasignarla — bajo
la restricción de que ninguna transacción seleccionada esté enlazada a otra (transferencia o pago a
tarjeta).

**Flujo principal**

1. El usuario accede al listado de transacciones (CU-016) y activa el modo selección.
2. El sistema muestra un checkbox a la izquierda de cada fila y una barra de acciones con el
   conteo de seleccionadas.
3. El usuario marca una o más transacciones, o usa "Seleccionar todos" / "Deseleccionar todos".
4. El usuario elige una acción: Cambiar cuenta, Cambiar fecha, Editar nota, o Eliminar.
5. El sistema muestra el control correspondiente a la acción elegida (selector de cuenta, selector
   de fecha, campo de texto, o confirmación).
6. El usuario confirma.
7. El sistema aplica el cambio a todas las transacciones seleccionadas, de forma atómica.
8. El sistema actualiza el listado y sale del modo selección.

**Flujos alternativos / casos borde**

- Las transacciones de `tipo = ajuste` no son seleccionables en este modo (checkbox deshabilitado)
  — mismo criterio que CU-017/CU-018 (RN-056, BIZ_015).
- Si la selección incluye alguna transacción enlazada (`transaccion_relacionada_id` ≠ null) y la
  acción elegida es "Cambiar cuenta", el sistema rechaza la operación completa con `BIZ_022` — no
  se aplica un cambio parcial. "Cambiar fecha", "Editar nota" y "Eliminar" sí admiten transacciones
  enlazadas.
- "Cambiar fecha" sobrescribe la fecha de todas las seleccionadas con el mismo valor elegido — no
  es un corrimiento relativo.
- "Editar nota" sobrescribe la nota de todas las seleccionadas con el mismo texto — no concatena
  con la nota existente.
- "Eliminar" en lote replica, por cada transacción seleccionada, el mismo efecto que CU-018
  (revertir `saldo_actual`, eliminar el par enlazado si aplica), como una sola operación atómica
  para todo el lote.
- Si la selección queda vacía al confirmar, el sistema no permite continuar (`VALIDATION_023`).

**Precondiciones**

- El usuario debe estar autenticado.
- Todas las transacciones seleccionadas deben existir y pertenecer al usuario.

**Postcondiciones**

- Cambiar cuenta: se actualiza `account_id` y se recalcula `saldo_actual` de la cuenta de origen y
  de la cuenta destino, por cada transacción movida.
- Cambiar fecha: se actualiza `fecha` en todas las seleccionadas.
- Editar nota: se actualiza `nota` en todas las seleccionadas.
- Eliminar: se eliminan los documentos (y su par enlazado, si aplica) y se recalcula `saldo_actual`
  de las cuentas afectadas.
- Se actualiza `updated_at` en todos los documentos modificados.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `ids` | Selección múltiple (checkboxes en el listado) | Sí | Mín. 1 | Arreglo de ObjectId | — | — | RN-107, VALIDATION_023 |
| `account_id` (acción "Cambiar cuenta") | Selección | Solo si la acción es "Cambiar cuenta" | N/A | ObjectId de cuenta propia y activa | Ninguna seleccionada puede estar enlazada | — | RN-108, BIZ_022 |
| `fecha` (acción "Cambiar fecha") | Selector de fecha (Calendar) | Solo si la acción es "Cambiar fecha" | N/A | Fecha válida | — | — | RN-109 |
| `nota` (acción "Editar nota") | Texto | Solo si la acción es "Editar nota" | Máx. 140 caracteres | — | — | — | RN-110 |

**Reglas de negocio**

- RN-107: Las transacciones de `tipo = ajuste` quedan excluidas de cualquier acción en lote —
  mismo criterio que RN-056 (CU-017/CU-018).
- RN-108: A diferencia de CU-017 (donde `account_id` no es editable individualmente), la acción en
  lote "Cambiar cuenta" sí permite reasignarlo — excepto en transacciones enlazadas
  (`transaccion_relacionada_id` ≠ null), donde reasignar solo un lado del par rompería la relación.
  Si la selección incluye una enlazada, la acción completa se rechaza (`BIZ_022`).
- RN-109: "Cambiar fecha" en lote sobrescribe con el mismo valor en todas las seleccionadas; no es
  un corrimiento relativo de días.
- RN-110: "Editar nota" en lote sobrescribe con el mismo texto en todas las seleccionadas; no
  concatena con la nota existente de cada una.
- RN-111: "Eliminar" en lote aplica, transacción por transacción, el mismo efecto que CU-018
  (RN-054, RN-055), incluyendo el par enlazado cuando aplica, como una sola operación atómica.

**Casos de uso derivados identificados**

- Ninguno adicional — reutiliza la selección y listado ya cubiertos por CU-016.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `ids` | ObjectId[] | Requerido, mínimo 1 elemento; cada id debe existir y pertenecer al usuario | A01 — Control de acceso a nivel de objeto (IDOR) por cada id |
| `account_id` | ObjectId | Requerido solo para "Cambiar cuenta"; debe existir, pertenecer al usuario, `status=active` | A01 — Control de acceso a nivel de objeto |
| `fecha` | ISODate | Requerido solo para "Cambiar fecha"; fecha válida | A03 — Validar formato |
| `nota` | string | Requerido solo para "Editar nota"; máx. 140 caracteres | A03 — Sanitizar entrada; A07 — Codificar en salida |

**Mensajes de error**

*Validación*
- `VALIDATION_023`: "Selecciona al menos una transacción."

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Lógica de negocio*
- `BIZ_014`: "Una o más transacciones seleccionadas no existen o no te pertenecen." *(reutilizado — CU-017)*
- `BIZ_015`: "Las transacciones de ajuste no se pueden editar ni eliminar desde este módulo." *(reutilizado — CU-017/CU-018)*
- `BIZ_022`: "No puedes cambiar la cuenta de una transacción enlazada (transferencia o pago a tarjeta) desde una acción en lote."

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| PATCH | `/api/v1/transactions/batch` | Bearer JWT |
| DELETE | `/api/v1/transactions/batch` | Bearer JWT |

*Request (PATCH — aplica solo el campo presente)*
```json
{
  "ids": ["ObjectId", "..."],
  "account_id": "ObjectId (opcional)",
  "fecha": "ISODate (opcional)",
  "nota": "string (opcional, máx 140 caracteres)"
}
```

*Request (DELETE)*
```json
{
  "ids": ["ObjectId", "..."]
}
```

*Response (éxito, ambos)*
```json
{
  "success": true,
  "data": {
    "afectadas": "number",
    "cuentas_recalculadas": ["ObjectId", "..."]
  },
  "message": "Transacciones actualizadas exitosamente."
}
```

*Modelo de información*

Reutiliza la colección `transactions`. Según la acción, se actualizan `account_id`, `fecha` o
`nota` (más `updated_at`) en todos los documentos de `ids`, o se eliminan junto con su par
enlazado. No se agregan campos nuevos.

> Nota técnica: la actualización/eliminación de todos los documentos del lote y el recálculo de
> `saldo_actual` de cada cuenta afectada deben ejecutarse en una sola transacción de base de datos
> — mismo patrón atómico que CU-006 de [[cuentas]], CU-012 de [[categorias]] y CU-017/CU-018 de
> este módulo. Si falla a medio proceso, ningún documento del lote se modifica.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Sin cambios de esquema | — | Reutiliza `account_id`, `fecha`, `nota` ya existentes en `transactions`; solo cambia quién puede escribirlos y bajo qué condición |

*Índices*

Reutiliza `{ account_id: 1, fecha: -1 }` y `{ user_id: 1, category_id: 1, fecha: -1 }` — no se
crean índices nuevos.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Cambiar cuenta a 3 transacciones no enlazadas | 3 ids válidos, `account_id` propio | `account_id` actualizado en las 3, saldos recalculados | 200 |
| 2 | Flujo exitoso | Cambiar fecha a 5 transacciones | 5 ids válidos, `fecha` válida | `fecha` actualizada en las 5 | 200 |
| 3 | Flujo exitoso | Editar nota en lote | ids válidos, `nota` nueva | `nota` sobrescrita en todas | 200 |
| 4 | Flujo exitoso | Eliminar lote con una transferencia enlazada dentro | ids incluyen una transferencia | Se eliminan ambos lados del par, saldos revertidos | 200 |
| 5 | Validación de entrada | Selección vacía | `ids=[]` | `VALIDATION_023` | 400 |
| 6 | Lógica de negocio | Cambiar cuenta con una enlazada en la selección | ids incluyen una transferencia, acción=cambiar cuenta | `BIZ_022` | 409 |
| 7 | Lógica de negocio | Selección incluye una de tipo ajuste | ids incluyen una de tipo ajuste | `BIZ_015` | 409 |
| 8 | Recurso no encontrado | Algún id inexistente o ajeno | Uno de los ids no pertenece al usuario | `BIZ_014` | 404 |
| 9 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 10 | Error del sistema | Falla de base de datos a medio proceso | Simulado | `SYS_001`, ningún documento del lote se modifica | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-transacciones-listado]] (modo selección, barra de acciones en lote)

## Referencias

- [[estrategia]]
- [[brief-ux]]
- [[data-model-registry]]
- [[cuentas]]
- [[categorias]]
- [[ahorros-y-metas]]
- [[creditos-deudas]]
- [[backlog]]
