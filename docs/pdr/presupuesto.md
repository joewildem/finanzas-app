---
modulo: "Presupuesto"
status: en progreso
---

# Requerimientos — Presupuesto

## Resumen del módulo

El módulo de Presupuesto permite a cada usuario planear, mes a mes, cuánto espera gastar o recibir
por categoría, en una sola vista de configuración estilo YNAB: todas las categorías con sus grupos,
más un renglón presupuestable por cada meta de ahorro activa de [[ahorros-y-metas]] y por cada deuda
activa de [[creditos-deudas]]. No redefine `categories` ni `transactions` — únicamente agrega los
montos planeados por categoría/meta/deuda/mes y, de forma calculada, el porcentaje que cada grupo
representa del ingreso presupuestado. El presupuesto vive exclusivamente a nivel categoría, meta o
deuda: el grupo solo se muestra como la suma de sus categorías. Ninguna categoría es de captura
obligatoria. Pasarse del presupuesto no bloquea el registro de gastos en [[transacciones]]; es una
señal informativa, no una restricción operativa.

> **Revisado (2026-08-22, cierre de [[ahorros-y-metas]]):** Ahorros dejó de ser un monto genérico
> sin desglose. Ya existe como su propio módulo, con metas reales — cada meta activa ahora es su
> propio renglón presupuestable, igual que una categoría real, con "real"/"disponible" calculados a
> partir de sus aportaciones y retiros del mes. El campo `categoria_reservada` (pseudo-registro
> único que representaba Ahorros antes de que el módulo existiera) se retiró junto con `RN-070` y
> `VALIDATION_019`, reemplazado por `budgets.meta_id`. Ver "Cambios en otros documentos" de
> [[ahorros-y-metas]] y el historial de cambios de este documento.

> **Revisado (2026-08-24, cierre de [[creditos-deudas]]):** la nota original de este resumen ("Deudas
> queda fuera de este módulo") queda desactualizada. Cada deuda activa gana su propio renglón
> presupuestable, igual que cada meta de ahorro — vía el nuevo campo `budgets.deuda_id`. Ver "Cambios
> en otros documentos" de [[creditos-deudas]] y el historial de cambios de este documento.

> **Nota de alcance:** este módulo tuvo una versión previa que incluía una herramienta de
> distribución porcentual manual ("Calculator", CU-021). Se retiró del alcance porque el usuario
> prefiere resolver esa distribución de forma personalizada, fuera de la aplicación — ver
> [[#Historial de cambios]].

## Casos de uso

### CU-019 — Configurar presupuesto de una categoría por mes

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario asignar o modificar, en una sola vista, el monto planeado
de cada categoría para un mes determinado — incluyendo las categorías de Ingreso (Salario, Extra,
etc.), un renglón por cada meta de ahorro activa de [[ahorros-y-metas]], y un renglón por cada deuda
activa de [[creditos-deudas]]. Ninguna categoría requiere monto obligatoriamente: las que queden sin
presupuestar simplemente no aparecen en el resumen del mes (CU-022). Cada grupo muestra, además de
la suma en pesos de sus categorías, el porcentaje que esa suma representa del ingreso presupuestado
del mes — calculado automáticamente, de solo lectura.

**Flujo principal**

1. El usuario accede a la sección "Presupuesto" y selecciona el mes a configurar (por defecto, el
   mes en curso).
2. El sistema muestra el listado completo: categorías activas del usuario agrupadas por grupo,
   seguido de un renglón por cada meta de ahorro activa y un renglón por cada deuda activa, cada una
   con un campo de monto editable — vacío si no tiene presupuesto asignado ese mes.
3. El usuario captura o modifica el monto de una o varias categorías, metas y/o deudas.
4. Conforme el usuario captura montos, el sistema recalcula en pantalla, por cada grupo, el total en
   pesos y el % que representa del ingreso presupuestado (`grupo_total ÷ ingreso_presupuestado`).
5. El usuario confirma el guardado.
6. El sistema valida los montos capturados.
7. El sistema crea, actualiza o elimina (según corresponda) el documento de `budgets` de cada
   categoría, meta o deuda modificada para ese mes.

**Flujos alternativos / casos borde**

- Si el usuario deja vacío el campo de monto de una categoría o meta que ya tenían presupuesto, el
  sistema elimina el documento de `budgets` correspondiente (RN-060), en vez de guardar un monto en
  cero.
- Si la categoría está archivada al momento de guardar, el sistema rechaza el monto para esa
  categoría específica, sin afectar el resto del lote. Lo mismo aplica si la meta está archivada.
- El sistema permite configurar presupuesto para cualquier mes (pasado, presente o futuro) sin
  restricción temporal.
- Si el ingreso presupuestado del mes es $0, el % de cada grupo se muestra como no disponible (—)
  en vez de intentar dividir entre cero.

**Precondiciones**

- El usuario debe estar autenticado con una sesión activa.
- Cada `category_id` enviado debe existir, pertenecer al usuario autenticado, ser de
  `tipo = categoria`, y encontrarse en `status = active`. Cada `meta_id` enviado debe existir,
  pertenecer al usuario autenticado, y encontrarse en `status = active` (ver [[ahorros-y-metas]]).

**Postcondiciones**

- Se crea, actualiza o elimina un documento en `budgets` por cada categoría o meta modificada en ese
  mes.
- El monto queda disponible para el resumen mensual (CU-022).

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `category_id` | Selección (categoría existente del usuario) | Sí, salvo que se use `meta_id` o `deuda_id` | N/A | ObjectId válido; debe referenciar una categoría activa propia | Determina a qué categoría aplica el monto | — | RN-058 |
| `meta_id` | Selección (meta de ahorro existente del usuario) | Sí, solo para presupuestar una meta | N/A | ObjectId válido; debe referenciar una meta activa propia (ver [[ahorros-y-metas]]); mutuamente excluyente con `category_id` y `deuda_id` | — | — | RN-070 |
| `deuda_id` | Selección (deuda existente del usuario) | Sí, solo para presupuestar una deuda | N/A | ObjectId válido; debe referenciar una deuda activa propia (ver [[creditos-deudas]]); mutuamente excluyente con `category_id` y `meta_id` | — | — | RN-222 |
| `mes` | Selector de mes | Sí | N/A | Formato `YYYY-MM` | — | mes en curso | — |
| `monto` | Numérico | No (dejar vacío elimina el presupuesto) | N/A | Número ≥ 0 (nunca negativo), hasta 2 decimales — $0 es un valor válido | — | — | RN-057, RN-059, RN-060 |

**Reglas de negocio**

- RN-057: `monto`, cuando se captura, debe ser un número mayor o igual a cero (nunca negativo), con
  hasta 2 decimales — un monto en $0 es un valor válido y distinto de dejar el campo vacío (RN-060,
  que elimina el presupuesto en vez de guardar cero).
- RN-058: `category_id` debe pertenecer al usuario autenticado, ser de `tipo = categoria` y estar
  en `status = active`.
- RN-059: existe un único documento de `budgets` por combinación `{user_id, category_id, mes}` —
  guardar un nuevo monto sobre una categoría y mes ya presupuestados actualiza el documento
  existente (upsert), nunca crea un duplicado. Lo mismo aplica para `{user_id, meta_id, mes}` en el
  caso de una meta.
- RN-060: dejar el campo de monto vacío al guardar elimina el documento de `budgets`
  correspondiente, en lugar de persistir un monto en cero.
- RN-070: `meta_id` referencia una meta de ahorro activa de [[ahorros-y-metas]] en lugar de
  `category_id` — mutuamente excluyente con él (y con `deuda_id`, ver RN-222), mismo patrón que
  `category_id`. *Revisado 2026-08-22: hasta el cierre de [[ahorros-y-metas]], Ahorros se
  representaba como un pseudo-registro único dentro de `budgets` (`categoria_reservada =
  "ahorros"`), ya que el módulo de Ahorros todavía no existía y no había un `category_id` real al
  cual referenciarlo. Con `savings_goals` ya construido, cada meta activa tiene su propio `id` real
  — el pseudo-registro se retira junto con `VALIDATION_019`.* *Revisado 2026-08-24: la mención
  original de que "Deudas no entra a este módulo" queda desactualizada — ver RN-222.*
- RN-071: cada grupo, más un renglón por cada meta activa y por cada deuda activa, muestra un
  porcentaje calculado de forma automática y de solo lectura (`grupo_total ÷ ingreso_presupuestado`)
  — no es un valor que el usuario capture, y no existe validación de que la suma de estos
  porcentajes dé 100%.
- RN-222 (nueva, 2026-08-24, cierre de [[creditos-deudas]]): `budgets.deuda_id` sigue exactamente el
  mismo patrón que `category_id`/`meta_id` — un presupuesto por deuda y mes, upsert al guardar,
  eliminación del documento al dejar el monto vacío (mismo criterio que RN-059/RN-060/RN-150),
  mutuamente excluyente con `category_id` y `meta_id`. Solo se presupuestan deudas en
  `status = active` (mismo criterio que RN-058/RN-070 para categorías y metas).

**Casos de uso derivados identificados**

- No aplica el patrón CRUD+Activar (los documentos de `budgets` no tienen estado archivado, se
  crean, actualizan o eliminan directamente). El listado por mes se resuelve dentro de CU-022.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `monto` | Numérico | No negativo (≥ 0), máx. 2 decimales | Validación de tipo y rango en backend |
| `category_id` | ObjectId | Debe existir, pertenecer al usuario, `tipo=categoria`, `status=active` | Mitigación IDOR — mensaje genérico de "no encontrado" |
| `meta_id` | ObjectId | Debe existir, pertenecer al usuario, `status=active` (ver [[ahorros-y-metas]]) | Mitigación IDOR — mensaje genérico de "no encontrado" |
| `deuda_id` | ObjectId | Debe existir, pertenecer al usuario, `status=active` (ver [[creditos-deudas]]) | Mitigación IDOR — mensaje genérico de "no encontrado" |
| `mes` | String | Formato `YYYY-MM` | Validación de formato en backend |

**Mensajes de error**

*Validación*
- `VALIDATION_016`: "El monto no puede ser negativo."
- `VALIDATION_017`: "El mes debe tener el formato YYYY-MM."

*Autenticación / autorización*
- `AUTH_001`: "Sesión inválida o expirada."

*Lógica de negocio*
- `BIZ_016`: "La categoría no existe, no te pertenece o no está activa."
- `BIZ_023`: "La meta no existe, no te pertenece o no está activa." *(reutilizado de [[ahorros-y-metas]])*
- `BIZ_031`: "La deuda no existe, no te pertenece o no está activa." *(reutilizado de [[creditos-deudas]])*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde."

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| PUT | `/budgets?mes={mes}` (batch de `{category_id \| meta_id, monto}`) | JWT requerido |
| DELETE | `/budgets/{category_id}?mes={mes}` | JWT requerido |

*Request*
```json
{
  "items": [
    { "category_id": "665f1a2b3c4d5e6f7a8b9c01", "monto": 2000.00 },
    { "meta_id": "665f1a2b3c4d5e6f7a8b9c99", "monto": 1500.00 },
    { "deuda_id": "665f1a2b3c4d5e6f7a8b9c77", "monto": 3500.00 }
  ]
}
```

*Response (éxito)*
```json
{
  "mes": "2026-08",
  "ingreso_presupuestado": 10000.00,
  "grupos": [
    { "grupo": "Bills", "total": 2000.00, "porcentaje_ingreso": 0.20 }
  ],
  "metas": [
    { "meta": "Emergency fund", "total": 1500.00, "porcentaje_ingreso": 0.15 }
  ],
  "deudas": [
    { "deuda": "Car loan", "total": 3500.00, "porcentaje_ingreso": 0.35 }
  ]
}
```

*Modelo de información*
```json
// Tabla: budgets (Postgres/Supabase — ver data-model-registry para la sintaxis exacta)
{
  "id": "uuid",
  "user_id": "uuid",
  "category_id": "uuid | null",
  "meta_id": "uuid | null",
  "deuda_id": "uuid | null",
  "mes": "2026-08",
  "monto": 2000.00,
  "created_at": "timestamptz",
  "updated_at": "timestamptz"
}
```
> Registrar en [[data-model-registry]] al cerrar el módulo.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| `budgets.category_id → categories` | Referencia simple, nullable | Un presupuesto de categoría real siempre referencia una categoría existente; nullable porque un presupuesto de meta o deuda usa `meta_id`/`deuda_id` en su lugar |
| `budgets.meta_id → savings_goals` | Referencia simple, nullable | Un presupuesto de meta siempre referencia una meta existente; mutuamente excluyente con `category_id` y `deuda_id` (ver [[ahorros-y-metas]]) |
| `budgets.deuda_id → debts` | Referencia simple, nullable | Un presupuesto de deuda siempre referencia una deuda existente; mutuamente excluyente con `category_id` y `meta_id` (ver [[creditos-deudas]]) |
| % de grupo | Calculado en tiempo de consulta, no persistido | Igual que `disponible` en [[cuentas]] — se deriva de `budgets` e `ingreso_presupuestado` al vuelo, así nunca queda desincronizado |

*Índices*

| Colección | Campos | Tipo | Propósito |
|---|---|---|---|
| `budgets` | `{ user_id: 1, category_id: 1, mes: 1 }` | Único disperso (sparse) | Un solo presupuesto por categoría real y mes; soporta el upsert de RN-059 |
| `budgets` | `{ user_id: 1, meta_id: 1, mes: 1 }` | Único disperso (sparse) | Un solo presupuesto por meta y mes |
| `budgets` | `{ user_id: 1, deuda_id: 1, mes: 1 }` | Único disperso (sparse) | Un solo presupuesto por deuda y mes |
| `budgets` | `{ user_id: 1, mes: 1 }` | Compuesto | Consultar todos los presupuestos de un usuario en un mes (CU-022) |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Asignar monto nuevo a categoría sin presupuesto previo | `category_id` válido, `monto=2000` | Se crea documento en `budgets` | 200 |
| 2 | Flujo exitoso | Modificar monto de categoría ya presupuestada | `category_id` con presupuesto previo, nuevo `monto` | Documento existente se actualiza (upsert) | 200 |
| 3 | Flujo exitoso | Borrar presupuesto de una categoría (monto vacío) | `category_id` con presupuesto previo, `monto=null` | Documento de `budgets` se elimina | 200 |
| 4 | Flujo exitoso | Asignar monto a una meta activa | `meta_id` válido, `monto=1500` | Se crea/actualiza el presupuesto de la meta | 200 |
| 5 | Flujo exitoso | % de grupo se recalcula al vuelo | Ingreso presupuestado $10,000, Bills=$2,000 | `porcentaje_ingreso` de Bills = 0.20 | 200 |
| 6 | Flujo exitoso | Guardar una categoría en $0 explícito | `category_id` válido, `monto=0` | Se crea/actualiza el documento en `budgets` con `monto=0` | 200 |
| 7 | Validación de entrada | Monto negativo | `monto=-100` | `VALIDATION_016` | 400 |
| 8 | Validación de entrada | Mes con formato inválido | `mes="agosto-2026"` | `VALIDATION_017` | 400 |
| 9 | Recurso no encontrado | `meta_id` inexistente, ajena o archivada | `meta_id` inválido | `BIZ_023` | 404 |
| 10 | Recurso no encontrado | `category_id` inexistente, ajeno o archivado | `category_id` inválido | `BIZ_016` | 404 |
| 11 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 12 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-presupuesto-mensual]] (vista única estilo YNAB: categorías por
  grupo + un renglón por cada meta de ahorro activa, monto editable inline, % de grupo de solo
  lectura junto al total)

---

### CU-020 — Copiar presupuesto del mes anterior

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario copiar, como punto de partida, los montos presupuestados de
un mes existente hacia otro mes — incluyendo las metas de ahorro y las deudas que estaban
presupuestadas en el mes de origen. Es siempre una acción manual e intencional del usuario; el
sistema nunca pre-llena el presupuesto de un mes nuevo de forma automática.

**Flujo principal**

1. El usuario accede a "Presupuesto", selecciona el mes destino y elige la opción "Copiar de otro
   mes".
2. El sistema solicita el mes de origen.
3. El usuario selecciona el mes de origen (por defecto, se sugiere el mes calendario anterior).
4. El usuario confirma la copia.
5. El sistema valida que el mes de origen tenga al menos un presupuesto configurado (categoría, meta
   o deuda).
6. El sistema crea, en el mes destino, un documento de `budgets` por cada categoría, meta o deuda
   presupuestada en el mes de origen, replicando su monto.
7. El sistema muestra el presupuesto del mes destino ya poblado, listo para que el usuario lo
   ajuste (CU-019).

**Flujos alternativos / casos borde**

- Si el mes destino ya tiene presupuestos definidos, el sistema advierte al usuario y solicita
  confirmación explícita antes de sobrescribirlos (RN-062).
- Si el mes de origen no tiene ningún presupuesto configurado, el sistema rechaza la copia con un
  mensaje explicativo.
- Las categorías, metas o deudas archivadas en el momento de la copia no se incluyen, aunque hayan
  tenido presupuesto en el mes de origen.

**Precondiciones**

- El usuario debe estar autenticado.
- El mes de origen debe tener al menos un documento de `budgets` asociado al usuario.

**Postcondiciones**

- Se crean (o reemplazan, si hubo confirmación de sobrescritura) los documentos de `budgets` del
  mes destino, uno por cada categoría o meta activa presupuestada en el mes de origen.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `mes_origen` | Selector de mes | Sí | N/A | Formato `YYYY-MM`; debe tener presupuestos existentes | — | mes calendario anterior al destino | RN-061 |
| `mes_destino` | Selector de mes | Sí | N/A | Formato `YYYY-MM` | — | mes en curso | RN-062 |
| `confirmar_sobrescritura` | Booleano | Sí, solo si `mes_destino` ya tiene presupuestos | N/A | — | — | `false` | RN-062 |

**Reglas de negocio**

- RN-061: la copia de presupuesto entre meses es siempre una acción manual iniciada por el
  usuario — el sistema no la ejecuta automáticamente al detectar un mes sin presupuesto.
- RN-062: si el mes destino ya tiene presupuestos definidos, el sistema exige
  `confirmar_sobrescritura = true` antes de reemplazarlos; sin esa confirmación, rechaza la copia.

**Casos de uso derivados identificados**

- No aplica derivado independiente; la copia es una acción puntual sobre CU-019.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `mes_origen` / `mes_destino` | String | Formato `YYYY-MM` | Validación de formato en backend |
| `mes_origen` | String | Debe tener al menos un documento de `budgets` del usuario autenticado | Evita copiar presupuestos de otro usuario |

**Mensajes de error**

*Validación*
- `VALIDATION_017`: "El mes debe tener el formato YYYY-MM."

*Autenticación / autorización*
- `AUTH_001`: "Sesión inválida o expirada."

*Lógica de negocio*
- `BIZ_017`: "El mes destino ya tiene presupuesto configurado. Confirma si deseas sobrescribirlo."
- `BIZ_018`: "El mes de origen no tiene ningún presupuesto configurado para copiar."

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde."

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| POST | `/budgets/copy` | JWT requerido |

*Request*
```json
{
  "mes_origen": "2026-07",
  "mes_destino": "2026-08",
  "confirmar_sobrescritura": false
}
```

*Response (éxito)*
```json
{
  "mes_destino": "2026-08",
  "elementos_copiados": 10
}
```

*Modelo de información*

No introduce colección nueva — reutiliza `budgets` (ver CU-019).

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Copia mes a mes | Operación de escritura en lote sobre `budgets` | Cada mes queda independiente tras la copia; el sobrante no se acarrea automáticamente |

*Índices*

Reutiliza los índices de `budgets` definidos en CU-019.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Copiar a mes destino vacío | Mes origen con 9 categorías + 1 meta presupuestadas | Se crean 10 documentos en el mes destino | 200 |
| 2 | Lógica de negocio | Mes destino ya tiene presupuestos, sin confirmación | `confirmar_sobrescritura=false` | `BIZ_017` | 409 |
| 3 | Flujo exitoso | Mes destino ya tiene presupuestos, con confirmación | `confirmar_sobrescritura=true` | Se sobrescriben los documentos del mes destino | 200 |
| 4 | Lógica de negocio | Mes origen sin presupuestos | Mes origen vacío | `BIZ_018` | 404 |
| 5 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 6 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-presupuesto-mensual]] (acción "Copiar de otro mes", con modal de
  confirmación de sobrescritura cuando aplica)

---

### ~~CU-021 — Configurar distribución porcentual del mes (Calculator)~~ — RETIRADO

> Este caso de uso fue documentado y luego retirado del alcance antes de cerrar el módulo. El
> usuario decidió resolver la distribución porcentual del ingreso de forma manual, fuera de la
> aplicación, para mantener el módulo simple y libre de fricción para el resto de los usuarios. El
> número **CU-021** queda retirado y no se reutiliza — ver [[#Historial de cambios]]. Las reglas
> `RN-063` a `RN-069`, el error `VALIDATION_018` y los errores `BIZ_019`/`BIZ_020`, todos
   originalmente definidos para este caso de uso, quedan retirados por el mismo motivo.

---

### CU-022 — Consultar resumen de presupuesto mensual

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, para un mes determinado, el presupuesto por
categoría, por meta de ahorro y por deuda, junto con el gasto/ingreso/aportación/pago real
registrado en [[transacciones]], mostrando — tanto por categoría/meta/deuda como por grupo, estilo
YNAB — el monto presupuestado, el real, el porcentaje ya consumido y lo que queda disponible.
También calcula el monto total del mes que aún no ha sido asignado a ninguna categoría de gasto, a
ninguna meta ni a ninguna deuda.

**Flujo principal**

1. El usuario accede a la sección "Presupuesto" y selecciona el mes a consultar.
2. El sistema obtiene todas las categorías, metas y deudas con presupuesto asignado ese mes
   (`budgets`).
3. El sistema calcula, para cada categoría presupuestada, el monto real correspondiente sumando los
   movimientos de tipo `gasto` o `ingreso` de esa categoría y mes en `transactions`, y a partir de
   ahí el % consumido (`real ÷ presupuestado`) y lo disponible (`presupuestado − real`). Para cada
   meta presupuestada, el real se calcula igual, pero sumando sus movimientos `aportacion_meta`/
   `retiro_meta` con signo invertido del mes (RN-151 de [[ahorros-y-metas]]). Para cada deuda
   presupuestada, el real se calcula sumando el monto total (`monto_capital + monto_interes`) de sus
   movimientos `pago_deuda` del mes (RN-223 de [[creditos-deudas]]).
4. El sistema agrupa las categorías por su grupo, mostrando el total presupuestado, el total real,
   el % consumido y lo disponible de cada grupo (suma de sus categorías). Las metas se muestran
   agrupadas aparte, bajo su propio encabezado "Goals"; las deudas, bajo su propio encabezado
   "Debts".
5. El sistema calcula el "Total por asignar" del mes: ingreso presupuestado (grupos con
   `flujo = inflow`, ver RN-118 en [[categorias]]) menos la suma del presupuesto de los grupos con
   `flujo = outflow`, de los grupos con `flujo = investment`, de todas las metas activas y de todas
   las deudas activas.
6. El sistema muestra el resumen completo al usuario.

**Flujos alternativos / casos borde**

- Las categorías o metas sin presupuesto asignado ese mes no aparecen en el resumen, aunque tengan
  movimientos reales registrados en [[transacciones]].
- Si el mes consultado no tiene ningún presupuesto configurado, el sistema muestra un resumen vacío
  (sin error), invitando al usuario a configurar el presupuesto (CU-019) o copiarlo de otro mes
  (CU-020).
- Si una categoría o meta no tiene movimientos reales ese mes, su % consumido es 0% y su disponible
  es igual a su presupuestado.
- Si el real supera al presupuestado, el % consumido puede superar 100% y lo disponible se muestra
  en negativo, como señal visual de que se pasó del presupuesto.

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — es una operación de solo lectura.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `mes` | Selector de mes | Sí | N/A | Formato `YYYY-MM` | — | mes en curso | RN-072 a RN-075 |

**Reglas de negocio**

- RN-072: por cada categoría presupuestada, el resumen calcula `% consumido = real ÷ presupuestado`
  y `disponible = presupuestado − real`; `disponible` puede ser negativo si el usuario se pasó del
  presupuesto.
- RN-073: por cada grupo, el resumen calcula el mismo % consumido y disponible, usando la suma del
  presupuestado y del real de sus categorías.
- RN-074: **Retirada (2026-08-22, cierre de [[ahorros-y-metas]]).** Ya no es cierto que Ahorros
  nunca calcule "real" — cada meta activa tiene su propio "real" mensual, igual que una categoría
  (RN-151 de [[ahorros-y-metas]]), calculado a partir de sus movimientos `aportacion_meta`/
  `retiro_meta` del mes. Antes de este cierre, el pseudo-registro único de Ahorros solo mostraba el
  monto presupuestado, sin poder calcular real al no existir movimientos reales ligados a él.
- RN-075: el "Total por asignar" del mes se calcula como el ingreso presupuestado (suma de
  `budgets.monto` de las categorías de grupos con `flujo = inflow`, RN-118 en [[categorias]]) menos
  la suma del presupuesto de las categorías de grupos con `flujo = outflow`, de las categorías de
  grupos con `flujo = investment`, de todas las metas activas presupuestadas y de todas las deudas
  activas presupuestadas. *Revisado 2026-08-24, cierre de [[creditos-deudas]]: se agrega la resta de
  deudas presupuestadas, antes ausente por no existir el módulo.* **Revisado 2026-08-28** (al alinear
  Analytics de [[dashboard]]): `investment` se separa de `outflow` como tercer valor de `flujo` (ver
  RN-118 en [[categorias]]) — la tabla "Investment" de Budget es nueva, paralela a Inflow/Outflow, y
  su presupuesto también se resta del total por asignar. El resultado numérico no cambia para el
  catálogo semilla actual (el grupo Investment ya restaba antes, como parte de Outflow).
- RN-112: El chip visual de "Available" a nivel categoría se llena en proporción a `real ÷ presupuestado` (capado visualmente en 100%), y solo empieza a llenarse una vez que existe algún movimiento real — con `real = $0` el chip no tiene relleno (RN-116).
- RN-113: Si `real > presupuestado` en una categoría de un grupo Outflow o Investment, el chip cambia a color de alerta (rojo) y el número se muestra en negativo (`presupuestado − real`). *Revisado 2026-08-28: Investment sigue el mismo criterio que Outflow — ambas tablas se renderizan con `isIncome=false`.*
- RN-114: Si `real > presupuestado` en una categoría de un grupo Inflow, el chip cambia a color de éxito (verde) — recibir más de lo esperado es una señal positiva, no negativa — y, a diferencia de RN-113, el número también se muestra en positivo: el excedente recibido (`real − presupuestado`), no el cálculo negativo de "disponible".
- RN-115: El chip de relleno aplica a nivel categoría, meta y deuda — las tres tienen "real"
  calculado. A nivel grupo (y en los totales de "Goals" y "Debts"), "Available" se muestra solo como
  número, sumatoria de sus categorías/metas/deudas (RN-073) — sin chip. *Revisado 2026-08-24, cierre
  de [[creditos-deudas]]: el chip de una deuda sigue el mismo criterio que una categoría de un grupo
  Outflow (RN-113) — pagar más de lo presupuestado en el mes es una señal de alerta, no de éxito.*
- RN-116: Mientras una categoría presupuestada no tenga ningún movimiento real ese mes (`real = $0`), su chip de "Available" se muestra en color neutro (gris), sin relleno, con el número igual al presupuestado — distingue visualmente "todavía sin actividad" de "dentro del presupuesto, ya con actividad" (ámbar, RN-112).
- RN-117: Una categoría sin monto asignado (`presupuestado = $0`) pero con movimientos reales ese mes no se trata como "sin datos" — el chip se muestra igual que un sobregasto/sobre-cumplimiento (RN-113/RN-114): rojo con el real en negativo para una categoría de un grupo Outflow o Investment, verde con el real en positivo para una categoría de un grupo Inflow, relleno al 100%. Solo cuando tanto el presupuestado como el real están en $0 el chip no se muestra (`—`, RN-115 a nivel grupo aplica el mismo criterio de fondo).

**Casos de uso derivados identificados**

- Este CU ya es, en sí mismo, la vista de listado/resumen del mes — no se identifica un derivado de
  Búsqueda y Filtrado adicional.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `mes` | String | Formato `YYYY-MM` | Validación de formato en backend |

**Mensajes de error**

*Validación*
- `VALIDATION_017`: "El mes debe tener el formato YYYY-MM."

*Autenticación / autorización*
- `AUTH_001`: "Sesión inválida o expirada."

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde."

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/budgets/summary?mes={mes}` | JWT requerido |

*Request*
```json
{}
```

*Response (éxito)*
```json
{
  "mes": "2026-08",
  "grupos": [
    {
      "grupo": "Bills",
      "presupuestado": 2000.00,
      "real": 1850.00,
      "porcentaje_consumido": 0.925,
      "disponible": 150.00,
      "categorias": [
        { "category_id": "665f...c01", "nombre": "Renta", "presupuestado": 1500.00, "real": 1500.00, "porcentaje_consumido": 1.0, "disponible": 0.00 },
        { "category_id": "665f...c02", "nombre": "Internet", "presupuestado": 500.00, "real": 350.00, "porcentaje_consumido": 0.70, "disponible": 150.00 }
      ]
    }
  ],
  "metas": [
    { "meta_id": "665f...m01", "nombre": "Emergency fund", "presupuestado": 1500.00, "real": 1500.00, "porcentaje_consumido": 1.0, "disponible": 0.00 }
  ],
  "total_por_asignar": 1500.00
}
```

*Modelo de información*

No introduce colección nueva — es una consulta agregada sobre `budgets`, `transactions`,
`categories` y `savings_goals`.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Agregación en tiempo de consulta | Cálculo derivado, no persistido | El "real", "% consumido", "disponible" y "total por asignar" siempre se recalculan al vuelo, igual que `disponible` en [[cuentas]] |

*Índices*

Reutiliza `{ user_id: 1, mes: 1 }` de `budgets` (CU-019), `{ user_id: 1, category_id: 1, fecha: -1 }`
de `transactions` (definido en [[transacciones]]) y `{ meta_id: 1, fecha: -1 }` de `transactions`
(definido en [[ahorros-y-metas]]).

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Mes con presupuesto en varias categorías y grupos | Mes con datos completos | Resumen agrupado con presupuestado, real, % consumido y disponible por categoría y grupo | 200 |
| 2 | Flujo exitoso | Categoría sin presupuesto asignado | Categoría con movimientos reales pero sin `budgets` | La categoría no aparece en el resumen | 200 |
| 3 | Flujo exitoso | Categoría con real mayor al presupuestado | `presupuestado=1000`, `real=1200` | `porcentaje_consumido=1.2`, `disponible=-200.00` | 200 |
| 4 | Flujo exitoso | Meta en el resumen, con aportaciones reales | Meta presupuestada $1,500, aportado real $1,500 | Muestra `presupuestado`, `real`, `porcentaje_consumido` y `disponible` igual que una categoría | 200 |
| 5 | Flujo exitoso | Cálculo de "Total por asignar" | Ingresos $10,000; Bills+Needs+Wants+Investment $7,000 + metas $1,500 | `total_por_asignar = 1500.00` | 200 |
| 6 | Flujo exitoso | Mes sin ningún presupuesto configurado | Mes vacío | Resumen vacío, sin error | 200 |
| 7 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 8 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-presupuesto-mensual]] (tabla estilo YNAB, agrupada y colapsable; chip de relleno en "Available" a nivel categoría según RN-112 a RN-117; gris sin actividad, ámbar dentro de presupuesto, rojo en sobregasto de Outflow, verde con número positivo en sobre-cumplimiento de Inflow — incluye el caso de categoría sin monto asignado pero con real, RN-117). Qué grupo aparece en la tabla Inflow, Outflow o Investment, y en qué orden dentro de cada una, se decide por `categories.flujo`/`categories.orden` (RN-118/RN-119 en [[categorias]]) — ya no por una lista fija de nombres de grupo.

---

## Historial de cambios

| Fecha | Cambio | CU afectado | Impacto en otros documentos |
|---|---|---|---|
| 2026-07-30 | Se crea el módulo Presupuesto: presupuesto manual por categoría y mes (`budgets`), copia manual entre meses, distribución porcentual por grupo (`budget_group_allocations`) y resumen mensual agregado contra `transactions`. Se agregan CU-019 a CU-022. | CU-019 a CU-022 | — |
| 2026-07-31 | Se simplifica el módulo, estilo YNAB: se **retira CU-021** (Calculator) — junto con `RN-063` a `RN-069`, `VALIDATION_018`, `BIZ_019` y `BIZ_020` — porque el usuario prefiere resolver la distribución porcentual de forma manual, fuera de la app. Se elimina la colección `budget_group_allocations`. Se agrega **Ahorros** como pseudo-registro dentro de `budgets` (`categoria_reservada="ahorros"`), presupuestable en la misma vista que las demás categorías. Se agrega el % de grupo calculado automáticamente (de solo lectura) en CU-019 (`RN-070`, `RN-071`). Se enriquece CU-022 con % consumido y disponible por categoría y por grupo, y Ahorros se incorpora al cálculo de "Total por asignar" (`RN-072` a `RN-075`, `VALIDATION_019`). Deudas queda explícitamente fuera de este módulo. | CU-019, CU-021 (retirado), CU-022 | Pendiente: actualizar [[data-model-registry]] — colección `budgets` (con `categoria_reservada`), sin `budget_group_allocations`, e índice de numeración hasta CU-022 / RN-075 / VALIDATION_019 / BIZ_018, con CU-021, RN-063–069, VALIDATION_018, BIZ_019–020 marcados como retirados |
| 2026-08-11 | Rediseño visual de CU-019/CU-022 (ya construido en código el 2026-08-10): de tarjetas agrupadas a dos tablas — "Inflow" (solo grupo Ingresos) y "Outflow" (Bills, Needs, Wants, Investment + fila de Ahorros al final), con grupos colapsables/expandibles. Se agrega el chip de relleno de "Available" a nivel categoría (`RN-112` a `RN-115`): se llena según lo consumido (`real ÷ presupuestado`), ámbar en estado normal, rojo en sobregasto de categorías de gasto, **verde** en sobre-cumplimiento de categorías de Ingresos (mismo número, solo cambia el color). Se relaja **RN-057**: `monto` pasa de "positivo, mayor a cero" a "mayor o igual a cero, nunca negativo" — el usuario debe poder dejar una categoría presupuestada en $0 explícito, distinto de vaciar el campo (que sigue siendo RN-060, elimina el presupuesto); `VALIDATION_016` cambia de mensaje ("El monto no puede ser negativo") y su matriz de pruebas se actualiza (nuevo caso exitoso de `monto=0`, caso de error acotado a negativo). Se retira el guardado manual con botón "Save changes": el guardado ahora es automático conforme el usuario edita cada campo (debounced), sin barra de "cambios sin guardar" — ningún cambio de contrato de `save_budgets`, solo de cuándo se invoca desde el frontend. Las filas de grupo en Outflow llevan un tono de gris distinto al de las filas de categoría, puramente visual. Las columnas de ambas tablas pasan a ancho fijo (`table-fixed`) para que escribir una cifra grande en "Assigned" no las haga crecer/encoger. Bug encontrado y corregido en el camino: `useBudgets`/`useMonthlyActuals` no reiniciaban su estado de forma síncrona al cambiar `mes` — quedaba un render transitorio donde `mes` ya apuntaba al mes nuevo pero los datos todavía eran los del mes anterior, lo que hacía que la vista sembrara sus montos con el mes equivocado (reproducible tras recargar la página y navegar rápido a otro mes) y los dejara pegados ahí. Se corrigió ajustando el estado de ambos hooks durante el render (no vía un efecto posterior), mismo patrón documentado de React. | CU-019, CU-022 | Se actualiza [[data-model-registry]]: `budgets.monto` (`check (monto >= 0)`), descripción de `save_budgets`, índice de numeración hasta `RN-115` / `VALIDATION_016` (mensaje) |
| 2026-08-11 | Se refina el chip de "Available" (`RN-116`): mientras una categoría presupuestada no tenga ningún movimiento real ese mes, el chip se muestra en gris neutro sin relleno (en vez de ámbar desde el primer momento) — distingue "sin actividad todavía" de "dentro de presupuesto, con actividad". Y en el estado de sobregasto/sobre-cumplimiento (`RN-113`/`RN-114`), el número del chip de Ingresos ahora se muestra en positivo (el excedente recibido), no solo el color cambiando a verde manteniendo el cálculo negativo previo. | CU-022 | Se actualiza [[data-model-registry]]: índice de numeración hasta `RN-116` |
| 2026-08-11 | Se agrega **RN-117**: una categoría sin monto asignado (`presupuestado = $0`) pero con movimientos reales ese mes ya no se trataba como "sin datos" (el chip no se mostraba, `assigned <= 0` cortaba antes de evaluar actividad) — ahora se muestra igual que un sobregasto/sobre-cumplimiento normal (rojo/negativo en gasto, verde/positivo en Ingresos, relleno al 100%). Solo cuando presupuestado **y** real están ambos en $0 el chip sigue sin mostrarse (`—`). | CU-022 | Se actualiza [[data-model-registry]]: índice de numeración hasta `RN-117` |
| 2026-08-11 | Cambio cruzado desde [[categorias]] (RN-118, RN-119): las tablas Inflow/Outflow ya no identifican sus grupos por nombre exacto ("Income" para Inflow; Bills/Needs/Wants/Investment para Outflow) sino por el campo estructural `flujo` de `categories` — un grupo renombrado ya no pierde su clasificación (bug reportado que motivó el cambio). El orden de los grupos dentro de cada tabla, antes fijo y hardcodeado para Outflow, ahora sigue `categories.orden` (reordenable desde [[categorias]], CU-009). Se revisan RN-075 (referencia a "grupo Ingresos" → grupos con `flujo = inflow`/`outflow`), RN-113/RN-114 ("categoría de gasto"/"grupo Ingresos" → "categoría de un grupo Outflow"/"Inflow") y RN-117, sin cambio de comportamiento para el catálogo semilla actual. `src/pages/budget/budget-page.tsx` reemplaza `INCOME_GROUP_NAME`/`OUTFLOW_GROUP_ORDER` por un filtro sobre `group.flujo`. | CU-019, CU-022 | Se actualiza [[data-model-registry]]: índice de numeración hasta `RN-119` (origen categorías) |
| 2026-08-22 | Cambio cruzado desde [[ahorros-y-metas]]: se **retira** el pseudo-registro único de Ahorros — `budgets.categoria_reservada`, junto con `RN-070` (revisada, ya no describe un pseudo-registro sino `meta_id`) y `VALIDATION_019` (retirado) — reemplazado por `budgets.meta_id`, un renglón presupuestable por cada meta activa, igual que una categoría real. **`RN-074` queda retirada**: ya no es cierto que Ahorros nunca calcule "real" — cada meta activa ahora tiene su propio "real" mensual (RN-151 de [[ahorros-y-metas]]), calculado a partir de sus movimientos `aportacion_meta`/`retiro_meta` del mes (`monto_inicial` no participa, al ser un acumulado histórico). Se revisan CU-019 (campo `meta_id`, `BIZ_023` reutilizado), CU-020 (la copia incluye metas presupuestadas, excluye las archivadas) y CU-022 (RN-075, RN-115, ejemplo de respuesta) para reflejar el cambio. En frontend, `BudgetTable` reemplaza el antiguo `savingsRow` (objeto único, solo `Assigned`, sin `Current`/`Available`) por un prop `goals` — renderizado como un grupo colapsable más, con `Current`/`Available`/chip reales por meta, vía el nuevo hook `use-monthly-goal-actuals.ts`. | CU-019, CU-020, CU-022 | Se actualiza [[data-model-registry]]: `budgets.meta_id`, retiro de `categoria_reservada`/`RN-070`/`VALIDATION_019`/su índice, índice de numeración sin cambio (los códigos nuevos se acuñaron en [[ahorros-y-metas]]) |
| 2026-08-24 | Cambio cruzado desde [[creditos-deudas]]: la nota original "Deudas queda fuera de este módulo" queda desactualizada — se agrega `budgets.deuda_id` (mutuamente excluyente con `category_id`/`meta_id`), un renglón presupuestable por cada deuda activa, igual que cada meta. Se agrega **RN-222** (patrón de upsert/eliminación de `deuda_id`, mismo criterio que `meta_id`) y **RN-223** (el "real" mensual de una deuda suma capital + interés de sus pagos del mes, a diferencia de `saldo_actual` de la deuda que solo resta capital). Se revisan RN-070, RN-071, RN-075, RN-115 (chip de una deuda sigue el criterio de sobregasto, no de sobre-cumplimiento) y CU-019/CU-020/CU-022 (campo `deuda_id`, `BIZ_031` reutilizado, encabezado "Debts" junto a "Goals") para reflejar el cambio. | CU-019, CU-020, CU-022 | Se actualiza [[data-model-registry]]: `budgets.deuda_id`, su índice único parcial, índice de numeración sin cambio (los códigos nuevos se acuñaron en [[creditos-deudas]]) |
| 2026-08-28 | Cambio cruzado desde [[categorias]] (RN-118 revisada): `investment` se separa de `outflow` como tercer valor de `categories.flujo`, al alinear Analytics de [[dashboard]]. Budget gana una tercera tabla, "Investment", paralela a Inflow/Outflow — mismo componente `BudgetTable` reutilizado (`isIncome=false`, sin `goals`/`debts`), filtrado por `group.flujo === 'investment'`. Se revisan RN-075 (el total por asignar también resta el presupuesto de Investment), RN-113/RN-117 (Investment sigue el criterio de alerta de Outflow, no el de éxito de Inflow). Sin cambio numérico para el catálogo semilla actual — el grupo Investment ya restaba del total por asignar antes, como parte de Outflow. | CU-019, CU-022 | Se actualiza [[data-model-registry]]: enum `category_flow` con `investment` (origen [[categorias]]), sin cambio de numeración |

## Referencias

- [[estrategia]]
- [[brief-ux]]
- [[data-model-registry]]
- [[categorias]]
- [[transacciones]]
- [[ahorros-y-metas]]
- [[creditos-deudas]]
- [[backlog]]
