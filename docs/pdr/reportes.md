---
modulo: "Reportes"
status: en progreso
---

# Requerimientos — Reportes

## Resumen del módulo

El módulo de Reportes es de **solo lectura y agregación**: no introduce colecciones ni campos
nuevos, únicamente consulta `accounts`, `categories`, `transactions` y `budgets` para construir
dos vistas — **Cuentas** y **Reporte Mensual** — accesibles sin configuración previa. La vista
Cuentas concentra el balance de todas las cuentas del usuario (incluyendo tarjetas de crédito) y su
evolución mensual, junto con el seguimiento de gasto por tarjeta. La vista Reporte Mensual
concentra el estado real (no presupuestado) del dinero por grupo de categoría en un periodo
flexible (semana, mes, año o rango personalizado), incluyendo el pseudo-grupo Ahorros ya definido
en [[presupuesto]] (`categoria_reservada`). El reporte detallado de metas de ahorro individuales
(seguimiento por meta, evolución de aportaciones) **no se construye en este módulo** — depende de
entidades que no existen todavía (`savings_goals`, aportaciones ligadas a una meta específica) y se
retoma como extensión de Reportes cuando se documente el módulo Ahorros y metas (v1.1). El módulo
Créditos y deudas (v1.1, deudas externas) tampoco tiene representación aquí, por diseño.

> **Nota de alcance:** este módulo tuvo una versión previa que incluía una gráfica de presupuesto
> vs. real por grupo (CU-029). Se retiró del alcance porque el filtro de periodo de Reportes es
> libre (semana, año, rango personalizado) y el presupuesto solo existe a nivel mes calendario en
> [[presupuesto]] — comparar ambos bajo un rango arbitrario rompía la correspondencia entre
> presupuestado y real. Ese seguimiento ya vive en [[presupuesto]] (CU-022), con su propio
> indicador de avance por categoría/grupo — ver [[#Historial de cambios]].

## Casos de uso

### CU-023 — Consultar resumen de cuentas

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, en la pestaña "Cuentas" del módulo de Reportes,
una tarjeta por cada una de sus cuentas activas (débito, crédito y efectivo) junto con el balance
total. El balance total es la suma de las cuentas que no estén marcadas como excluidas de
estadísticas (`excluir_de_stats`), sin importar su tipo — el mismo criterio ya definido en
[[cuentas]]. Cada tarjeta de cuenta se presenta con un estilo automático según su tipo: las cuentas
de débito y crédito se muestran con apariencia de tarjeta (usando el color configurado en la cuenta
como fondo, con un elemento visual tipo chip, sin logos ni imágenes de fondo), y las de efectivo se
muestran como una tarjeta plana, sin el elemento de tarjeta.

**Flujo principal**

1. El usuario accede a la pestaña "Cuentas" dentro de Reportes.
2. El sistema consulta todas las cuentas activas del usuario.
3. El sistema calcula el balance total sumando `saldo_actual` de las cuentas con
   `excluir_de_stats = false`.
4. El sistema muestra una tarjeta por cuenta (nombre, `saldo_actual`, tipo, color) y una tarjeta de
   resumen con el balance total.

**Flujos alternativos / casos borde**

- Si el usuario no tiene cuentas activas, se muestra un estado vacío con invitación a crear una
  cuenta (ver [[cuentas]]).
- Las cuentas archivadas no se incluyen ni en las tarjetas individuales ni en el balance total.
- Una cuenta con `excluir_de_stats = true` sí aparece como tarjeta individual, pero no participa en
  la suma del balance total (mismo comportamiento que en Cuentas, RN-016/017).

**Precondiciones**

- El usuario debe estar autenticado con una sesión activa.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

_No aplica — este CU no captura datos, solo consulta información existente._

**Reglas de negocio**

- RN-076: El balance total suma `saldo_actual` únicamente de cuentas con
  `excluir_de_stats = false` y `status = active`, sin distinguir tipo (débito, crédito, efectivo) —
  reafirma RN-016/RN-017 de [[cuentas]].
- RN-077: El estilo de tarjeta (chip visual, color de fondo, sin logos) para cuentas de tipo
  `debito` y `credito`, y el estilo plano para `efectivo`, es una decisión de presentación en
  frontend basada en `tipo` y `color`; no tiene impacto en el modelo de datos ni en este backend
  más allá de exponer ambos campos en la respuesta.

**Casos de uso derivados identificados**

- Ninguno — el volumen de cuentas por usuario es bajo (ya evaluado y descartado en [[cuentas]] y
  [[categorias]] por el mismo motivo).

**Validaciones**

_No aplica — sin parámetros de entrada._

**Mensajes de error**

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/reports/accounts-summary` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)*
```json
{
  "balance_total": 2064.74,
  "cuentas": [
    { "account_id": "665f...a01", "nombre": "Cash", "tipo": "efectivo", "saldo_actual": -134.00, "color": "#22C55E", "excluir_de_stats": false },
    { "account_id": "665f...a02", "nombre": "MiCuenta Banamex", "tipo": "debito", "saldo_actual": 2198.74, "color": "#2563EB", "excluir_de_stats": false },
    { "account_id": "665f...a03", "nombre": "Nu Débito", "tipo": "debito", "saldo_actual": 0.00, "color": "#A855F7", "excluir_de_stats": false },
    { "account_id": "665f...a04", "nombre": "TDCs", "tipo": "credito", "saldo_actual": -11173.46, "color": "#6B7280", "excluir_de_stats": true }
  ]
}
```

*Modelo de información*

No introduce colección nueva — consulta agregada sobre `accounts`.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Agregación en tiempo de consulta | Cálculo derivado, no persistido | El balance total nunca se guarda; se recalcula al vuelo igual que `disponible` en [[cuentas]] |

*Índices*

Reutiliza `{ user_id: 1, status: 1 }` de `accounts` (definido en [[cuentas]]).

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Usuario con cuentas activas de distintos tipos | — | Tarjetas por cuenta + balance total correcto | 200 |
| 2 | Flujo exitoso | Usuario sin cuentas activas | — | Estado vacío, `balance_total = 0` | 200 |
| 3 | Lógica de negocio | Cuenta con `excluir_de_stats = true` | — | Aparece como tarjeta, no suma al total | 200 |
| 4 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 5 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-reportes-cuentas]]

---

### CU-024 — Consultar evolución de balance mensual por cuenta

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, dentro de la pestaña "Cuentas", una gráfica de
la evolución de su balance mes a mes a lo largo de un año seleccionado, mostrando cómo se distribuye
su dinero entre sus cuentas de **débito y efectivo únicamente** — las cuentas de crédito quedan
fuera de esta gráfica en particular, ya que representan deuda, no disponibilidad de fondos. El
usuario puede navegar entre años; no existe ninguna otra configuración.

**Flujo principal**

1. El usuario, dentro de la pestaña "Cuentas", selecciona el año a consultar (por defecto, el año
   en curso).
2. El sistema identifica las cuentas activas de tipo `debito` y `efectivo` del usuario.
3. Para cada mes del año seleccionado, el sistema calcula el balance de cada cuenta al cierre de
   ese mes.
4. El sistema devuelve la serie mensual (12 puntos) por cuenta, lista para graficarse de forma
   apilada.

**Flujos alternativos / casos borde**

- Si una cuenta fue creada a mitad de año, los meses anteriores a su creación se devuelven en `0`
  (la cuenta no existía, no arrastra saldo).
- Si el usuario no tuvo movimientos en un mes mostrado, el balance de ese mes se arrastra del último
  balance calculado conocido (no se muestra en `0` salvo que el saldo real sea cero) — RN-080.
- Si el año seleccionado es futuro respecto al mes actual, los meses aún no transcurridos se
  devuelven en `0` o `null` (sin datos).

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `anio` (query param) | Selector de año | No | 4 dígitos | Entero entre 2000 y 2100 | — | Año en curso | RN-078 |

**Reglas de negocio**

- RN-078: La gráfica de evolución mensual solo considera cuentas `tipo = debito` y
  `tipo = efectivo`, `status = active` — las cuentas `tipo = credito` quedan fuera de este cálculo.
- RN-079: El balance de una cuenta al cierre de un mes se calcula como
  `saldo_inicial + Σ(transactions.monto con signo, fecha ≤ último día del mes)` — cálculo derivado
  en tiempo de consulta, no persistido, mismo patrón que `disponible` en [[cuentas]] y el resumen de
  [[presupuesto]].
- RN-080: Si una cuenta no tiene movimientos en un mes dado, su balance para ese mes es el último
  balance calculado (arrastre hacia adelante), reflejando el saldo real a esa fecha — no se muestra
  como cero salvo que el saldo real sea efectivamente cero.

**Casos de uso derivados identificados**

- Ninguno adicional.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `anio` | integer | Opcional; si se envía, entero entre 2000 y 2100 | A03 — Validar tipo y rango numérico |

**Mensajes de error**

*Validación*
- `VALIDATION_020`: "El año debe ser un valor numérico válido."

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/reports/accounts-monthly-balance?anio={anio}` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)*
```json
{
  "anio": 2026,
  "meses": [
    {
      "mes": "2026-01",
      "cuentas": [
        { "account_id": "665f...a01", "nombre": "Cash", "color": "#22C55E", "balance": 245.00 },
        { "account_id": "665f...a02", "nombre": "MiCuenta Banamex", "color": "#2563EB", "balance": 8316.22 },
        { "account_id": "665f...a03", "nombre": "Nu Débito", "color": "#A855F7", "balance": 3276.13 }
      ]
    }
  ]
}
```

*Modelo de información*

No introduce colección nueva — consulta agregada sobre `accounts` y `transactions`.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Reconstrucción de balance histórico | Cálculo derivado en tiempo de consulta | No existe (ni se necesita) un snapshot mensual persistido; se reconstruye a partir de `saldo_inicial` + movimientos, igual que `disponible` en [[cuentas]] |

*Índices*

Reutiliza `{ account_id: 1, fecha: -1 }` de `transactions` (definido en [[cuentas]] / [[transacciones]]).

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Año con movimientos en varias cuentas débito/efectivo | `anio=2026` | Serie de 12 meses por cuenta, cuentas de crédito excluidas | 200 |
| 2 | Lógica de negocio | Cuenta creada a mitad de año | — | Meses anteriores a la creación en `0` | 200 |
| 3 | Lógica de negocio | Mes sin movimientos | — | Balance arrastrado del mes anterior (RN-080) | 200 |
| 4 | Validación de entrada | `anio` con formato inválido | `anio=abc` | `VALIDATION_020` | 400 |
| 5 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 6 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-reportes-cuentas]]

---

### CU-025 — Consultar resumen de tarjetas de crédito

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, dentro de la pestaña "Cuentas", una tarjeta por
cada cuenta de tipo crédito con su balance actual, porcentaje de línea de crédito utilizado, línea
de crédito y disponible. Adicionalmente, si la cuenta tiene configurado un `gasto_minimo_mensual`,
se muestra el avance del gasto del mes en curso contra ese mínimo, para ayudar al usuario a decidir
si ya exentó la comisión o si aún necesita gastar con esa tarjeta. Igual que en el resumen de
cuentas, las tarjetas se presentan únicamente con el color configurado, sin logos ni imágenes de
fondo.

**Flujo principal**

1. El usuario, dentro de la pestaña "Cuentas", visualiza la sección de tarjetas de crédito.
2. El sistema identifica las cuentas activas de tipo `credito` del usuario.
3. Para cada una, el sistema calcula el porcentaje utilizado (`abs(saldo_actual) ÷ linea_credito`)
   y el disponible (ya definido en [[cuentas]], RN-013).
4. El sistema calcula el gasto del mes en curso de cada tarjeta (suma de `transactions`
   `tipo = gasto` de esa cuenta, mes actual) y lo compara contra `gasto_minimo_mensual`.

**Flujos alternativos / casos borde**

- Si el usuario no tiene cuentas de tipo crédito, la sección no se muestra.
- Si `gasto_minimo_mensual` es `0` o no está configurado, no se muestra el indicador de avance para
  esa tarjeta.
- Si el gasto del mes ya superó `gasto_minimo_mensual`, el indicador se muestra al 100% (sin
  sobrepasar visualmente la barra), señalando que la comisión ya fue exentada.

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

_No aplica — este CU no captura datos, solo consulta información existente._

**Reglas de negocio**

- RN-081: El resumen solo incluye cuentas `tipo = credito` y `status = active`.
- RN-082: El porcentaje utilizado se calcula como `abs(saldo_actual) ÷ linea_credito`; el
  disponible reutiliza el cálculo ya definido en [[cuentas]] (RN-013).
- RN-083: El gasto del mes de una tarjeta es la suma, en valor absoluto, de los montos de
  `transactions` con `tipo = gasto` de esa cuenta dentro del mes calendario en curso; se compara
  contra `gasto_minimo_mensual` para mostrar el avance.
- RN-084: Si `gasto_minimo_mensual` es `0` o no está configurado para la cuenta, no se muestra el
  indicador de avance para esa tarjeta.

**Casos de uso derivados identificados**

- Ninguno adicional.

**Validaciones**

_No aplica — sin parámetros de entrada._

**Mensajes de error**

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/reports/credit-cards-summary` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)*
```json
{
  "tarjetas": [
    {
      "account_id": "665f...c01",
      "nombre": "HSBC 2Now",
      "color": "#DC2626",
      "saldo_actual": -11134.97,
      "linea_credito": 32500.00,
      "porcentaje_utilizado": 0.3426,
      "disponible": 21365.03,
      "gasto_minimo_mensual": 3500.00,
      "gasto_mes_actual": 6134.97,
      "porcentaje_avance_minimo": 1.0
    }
  ]
}
```

*Modelo de información*

No introduce colección nueva — consulta agregada sobre `accounts` y `transactions`.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Agregación en tiempo de consulta | Cálculo derivado, no persistido | Mismo patrón que `disponible` (CU-003 de [[cuentas]]) |

*Índices*

Reutiliza `{ account_id: 1, fecha: -1 }` de `transactions`.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Usuario con tarjetas de crédito activas | — | Tarjetas con % utilizado, disponible y avance de gasto mínimo | 200 |
| 2 | Flujo exitoso | Usuario sin cuentas de crédito | — | Sección vacía | 200 |
| 3 | Lógica de negocio | `gasto_minimo_mensual = 0` | — | Sin indicador de avance para esa tarjeta (RN-084) | 200 |
| 4 | Lógica de negocio | Gasto del mes supera el mínimo | — | Indicador al 100%, sin sobrepasar | 200 |
| 5 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 6 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-reportes-cuentas]]

---

### CU-026 — Consultar detalle de gasto por tarjeta de crédito

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario, dentro de la sección de tarjetas de crédito, seleccionar
una tarjeta específica (o todas) y un periodo de tiempo, para consultar una gráfica de área con el
gasto de esa(s) tarjeta(s) a lo largo del periodo, junto con el top de categorías donde más gastó
con la tarjeta seleccionada en ese periodo.

**Flujo principal**

1. El usuario selecciona una tarjeta de crédito (o "todas") y un periodo (semana, mes, año o rango
   personalizado).
2. El sistema filtra `transactions` de `tipo = gasto` de la(s) cuenta(s) seleccionada(s) dentro del
   periodo.
3. El sistema devuelve la serie temporal de gasto (para la gráfica de área) y el top de categorías
   por monto gastado.

**Flujos alternativos / casos borde**

- Si se selecciona "todas", el sistema devuelve una serie por tarjeta (para comparar entre ellas en
  la misma gráfica) en lugar de una sola serie agregada.
- Si no hay gasto registrado en el periodo, se devuelve una serie vacía y un top de transacciones
  vacío, no un error.

**Precondiciones**

- El usuario debe estar autenticado.
- Si se especifica `account_id`, la cuenta debe existir, pertenecer al usuario y ser
  `tipo = credito`.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `account_id` (query param) | Selector | No | — | ObjectId válido, debe ser cuenta tipo crédito del usuario | — | "todas" | RN-085 |
| `periodo` (query param) | Selector | Sí | — | Enum: `semana`, `mes`, `anio`, `personalizado` | — | — | RN-088 |
| `desde`, `hasta` (query param) | Selector de fecha | Sí, solo si `periodo=personalizado` | — | ISODate, `desde ≤ hasta` | — | — | RN-088 |

**Reglas de negocio**

- RN-085: El filtro admite seleccionar una tarjeta específica o todas; cuando se seleccionan todas,
  la respuesta separa la serie temporal por tarjeta en lugar de agregarla en una sola línea.
- RN-086: El top de transacciones por categoría solo considera movimientos `tipo = gasto` de la(s)
  cuenta(s) seleccionada(s) dentro del periodo — pagos a tarjeta (`tipo = pago_tarjeta`) no cuentan
  como gasto en esta vista.

**Casos de uso derivados identificados**

- Ninguno adicional.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `account_id` | ObjectId | Opcional; si se envía, debe existir, pertenecer al usuario y ser `tipo=credito` | A01 — Control de acceso a nivel de objeto (IDOR) |
| `periodo` | string | Requerido, enum cerrado | A01 — Validar contra whitelist |
| `desde` / `hasta` | ISODate | Requeridos si `periodo=personalizado`; `desde ≤ hasta` | A03 — Validar formato y rango de fecha |

**Mensajes de error**

*Validación*
- `VALIDATION_021`: "El periodo debe ser semana, mes, año o un rango personalizado válido."
- `VALIDATION_022`: "La fecha de inicio no puede ser posterior a la fecha de fin."

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Lógica de negocio*
- `BIZ_021`: "La cuenta seleccionada no existe, no te pertenece, o no es una tarjeta de crédito."

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/reports/credit-card-detail?account_id={id}&periodo={periodo}&desde={desde}&hasta={hasta}` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)*
```json
{
  "periodo": { "desde": "2026-01-01", "hasta": "2026-07-31" },
  "serie": [
    { "cuenta": "HSBC 2Now", "puntos": [ { "fecha": "2026-01", "monto": 22000.00 } ] },
    { "cuenta": "Banamex", "puntos": [ { "fecha": "2026-01", "monto": 3200.00 } ] }
  ],
  "top_transacciones": [
    { "categoria": "Food", "monto": 7905.55 },
    { "categoria": "Clothes", "monto": 4561.10 }
  ]
}
```

*Modelo de información*

No introduce colección nueva — consulta agregada sobre `transactions` y `categories`.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Agregación en tiempo de consulta | Cálculo derivado, no persistido | Igual que el resto de los reportes de este módulo |

*Índices*

Reutiliza `{ account_id: 1, fecha: -1 }` de `transactions`.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Tarjeta específica, periodo mes | `account_id`, `periodo=mes` | Serie de gasto + top de categorías | 200 |
| 2 | Flujo exitoso | Todas las tarjetas, periodo año | Sin `account_id`, `periodo=anio` | Serie separada por tarjeta | 200 |
| 3 | Flujo exitoso | Sin gasto en el periodo | — | Serie y top vacíos, sin error | 200 |
| 4 | Validación de entrada | `periodo` inválido | `periodo=trimestre` | `VALIDATION_021` | 400 |
| 5 | Validación de entrada | `desde` posterior a `hasta` | `desde=2026-08-01&hasta=2026-01-01` | `VALIDATION_022` | 400 |
| 6 | Recurso no encontrado | `account_id` ajeno o no es tarjeta | `account_id` de otro usuario o de cuenta débito | `BIZ_021` | 404 |
| 7 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 8 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-reportes-cuentas]]

---

### CU-027 — Consultar resumen mensual por grupo

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, en la pestaña "Reporte Mensual", el estado real
(no presupuestado) de su dinero agrupado por grupo: una card por cada grupo activo de
[[categorias]] (dinámico por `flujo`, cualquier cantidad/nombre) más Ahorros, tomado del monto
presupuestado agregado ya definido en [[presupuesto]]. El usuario puede elegir el periodo a
consultar: semana, mes, año o un rango de fechas personalizado.

**Flujo principal**

1. El usuario accede a la pestaña "Reporte Mensual" y selecciona el periodo (por defecto, el mes en
   curso).
2. El sistema calcula, para cada grupo activo, la suma de `transactions` de tipo `ingreso` o `gasto`
   cuya categoría pertenezca a ese grupo, dentro del periodo.
3. El sistema agrega una card adicional de Ahorros con el monto presupuestado de `budgets`
   (`categoria_reservada`) correspondiente al periodo — sin cálculo de "real", igual que RN-074 de
   [[presupuesto]].
4. El sistema muestra todas las cards.

**Flujos alternativos / casos borde**

- Si el periodo seleccionado abarca más de un mes calendario (ej. año o rango personalizado largo),
  el monto de Ahorros suma el presupuestado de `categoria_reservada` de cada mes calendario dentro
  del rango.
- Si no hay presupuesto de Ahorros configurado para algún mes del rango, ese mes aporta `0` a la
  suma, sin bloquear la consulta.

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `periodo` (query param) | Selector | Sí | — | Enum: `semana`, `mes`, `anio`, `personalizado` | — | `mes` | RN-088 |
| `fecha_referencia` (query param) | Selector de fecha | Sí, si `periodo≠personalizado` | — | ISODate dentro del periodo deseado | — | Hoy | RN-088 |
| `desde`, `hasta` (query param) | Selector de fecha | Sí, si `periodo=personalizado` | — | ISODate, `desde ≤ hasta` | — | — | RN-088 |

**Reglas de negocio**

- RN-087: El resumen muestra una card por cada grupo activo de categorías del usuario (dinámico por
  `categories.flujo` — ver RN-118 en [[categorias]] —, cualquier cantidad y cualquier nombre, no una
  lista fija de cinco) más un card adicional de Ahorros tomado del presupuesto
  (`categoria_reservada`) — Ahorros nunca calcula "real" porque no tiene categorías propias
  ligadas a `transactions` (mismo criterio que RN-074 de [[presupuesto]]). *Revisado 2026-08-11: el
  texto original fijaba siempre "Ingresos, Bills, Needs, Wants, Investment" por nombre — se
  generaliza para no perder cards cuando el usuario renombra o crea un grupo nuevo, mismo criterio
  ya aplicado en [[presupuesto]] (tablas Inflow/Outflow).*
- RN-088: El periodo acepta semana, mes, año o rango personalizado; este mismo mecanismo de
  resolución de rango de fechas se reutiliza en CU-027 a CU-031 de este módulo.
- RN-089: El monto de cada grupo real se calcula como la suma de `transactions` `tipo = ingreso` o
  `tipo = gasto` cuya categoría pertenezca a ese grupo, dentro del rango de fechas resuelto.

**Casos de uso derivados identificados**

- Este CU ya es, en sí mismo, la vista resumen del periodo — no se identifica un derivado de
  Búsqueda y Filtrado adicional.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `periodo` | string | Requerido, enum cerrado | A01 — Validar contra whitelist |
| `desde` / `hasta` | ISODate | Requeridos si `periodo=personalizado`; `desde ≤ hasta` | A03 — Validar formato y rango de fecha |

**Mensajes de error**

*Validación*
- `VALIDATION_021`: "El periodo debe ser semana, mes, año o un rango personalizado válido." *(reutilizado)*
- `VALIDATION_022`: "La fecha de inicio no puede ser posterior a la fecha de fin." *(reutilizado)*

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/reports/monthly-summary?periodo={periodo}&fecha_referencia={fecha}&desde={desde}&hasta={hasta}` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)* — ejemplo con el catálogo semilla; `grupos` tiene tantos elementos como grupos
activos tenga el usuario (RN-087), no un largo fijo:
```json
{
  "periodo": { "desde": "2026-07-01", "hasta": "2026-07-31" },
  "grupos": [
    { "grupo": "Ingresos", "monto": 19665.87 },
    { "grupo": "Bills", "monto": 2200.00 },
    { "grupo": "Needs", "monto": 1850.00 },
    { "grupo": "Wants", "monto": 3557.58 },
    { "grupo": "Investment", "monto": 6138.50 },
    { "grupo": "Ahorros", "monto": 10790.13 }
  ]
}
```

*Modelo de información*

No introduce colección nueva — consulta agregada sobre `transactions`, `categories` y `budgets`.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Agregación en tiempo de consulta | Cálculo derivado, no persistido | Mismo patrón que el resumen de [[presupuesto]] (CU-022) |

*Índices*

Reutiliza `{ user_id: 1, category_id: 1, fecha: -1 }` de `transactions` y `{ user_id: 1, mes: 1 }`
de `budgets`.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Periodo mes con movimientos en todos los grupos | `periodo=mes` | Seis cards con montos correctos | 200 |
| 2 | Flujo exitoso | Periodo personalizado sin presupuesto de Ahorros en algún mes | `periodo=personalizado` | Ahorros suma `0` en los meses sin presupuesto, sin error | 200 |
| 3 | Validación de entrada | `periodo` inválido | `periodo=trimestre` | `VALIDATION_021` | 400 |
| 4 | Validación de entrada | Rango personalizado invertido | `desde > hasta` | `VALIDATION_022` | 400 |
| 5 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 6 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-reportes-mensual]]

---

### CU-028 — Consultar distribución de gasto por categoría

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, dentro del Reporte Mensual, un ranking de las
categorías donde más gastó en el periodo (excluyendo los grupos con `flujo = inflow`, ya que esta
vista es exclusivamente para identificar gasto), junto con una gráfica de pastel por cada grupo
activo del usuario (dinámico, tanto `inflow` como `outflow`) — mostrando, dentro de cada uno, qué
categoría concentra más monto. Ahorros no participa en esta vista porque no tiene categorías propias
todavía.

**Flujo principal**

1. El usuario consulta esta sección con el mismo periodo seleccionado en CU-027.
2. El sistema calcula el ranking de categorías por monto gastado, excluyendo los grupos con
   `flujo = inflow`.
3. El sistema calcula, para cada grupo activo, la distribución por categoría dentro de ese grupo.

**Flujos alternativos / casos borde**

- Si un grupo no tiene movimientos en el periodo, su gráfica de pastel se muestra vacía, sin error.
- Categorías archivadas con movimientos históricos dentro del periodo sí se incluyen (el
  movimiento ya existe, independientemente del estado actual de la categoría).

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

_Reutiliza los mismos parámetros de periodo de CU-027 (`periodo`, `fecha_referencia`, `desde`,
`hasta`)._

**Reglas de negocio**

- RN-090: El ranking de "dónde se fue el dinero" excluye los grupos con `flujo = inflow` (RN-118 en
  [[categorias]]) — es exclusivamente para identificar gasto.
- RN-091: Las gráficas de pastel incluyen todos los grupos activos del usuario, tanto `flujo =
  inflow` como `flujo = outflow` (dinámico, no una lista fija de cinco); Ahorros queda fuera de esta
  vista hasta que exista el módulo Ahorros y metas (v1.1) con categorías propias. *Revisado
  2026-08-11: mismo motivo que RN-087 — el texto original nombraba "Ingresos, Bills, Needs, Wants,
  Investment" fijos por nombre.*

**Casos de uso derivados identificados**

- Ninguno adicional.

**Validaciones**

_Reutiliza las validaciones de periodo de CU-027 (`VALIDATION_021`, `VALIDATION_022`)._

**Mensajes de error**

*Validación*
- `VALIDATION_021`, `VALIDATION_022` *(reutilizados — ver CU-027)*

*Autenticación / autorización*
- `AUTH_001` *(reutilizado)*

*Sistema*
- `SYS_001` *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/reports/category-distribution?periodo={periodo}&fecha_referencia={fecha}&desde={desde}&hasta={hasta}` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)*
```json
{
  "periodo": { "desde": "2026-07-01", "hasta": "2026-07-31" },
  "ranking_gasto": [
    { "categoria": "Renta", "grupo": "Bills", "monto": 1500.00 },
    { "categoria": "Suscripciones", "grupo": "Wants", "monto": 850.00 }
  ],
  "distribucion_por_grupo": [
    { "grupo": "Ingresos", "categorias": [ { "categoria": "Salario", "monto": 18000.00 }, { "categoria": "Extra", "monto": 1665.87 } ] },
    { "grupo": "Bills", "categorias": [ { "categoria": "Renta", "monto": 1500.00 }, { "categoria": "Internet", "monto": 700.00 } ] },
    { "grupo": "Needs", "categorias": [] },
    { "grupo": "Wants", "categorias": [ { "categoria": "Suscripciones", "monto": 850.00 } ] },
    { "grupo": "Investment", "categorias": [ { "categoria": "Gastos en stocks", "monto": 6138.50 } ] }
  ]
}
```

*Modelo de información*

No introduce colección nueva — consulta agregada sobre `transactions` y `categories`.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Agregación en tiempo de consulta | Cálculo derivado, no persistido | Mismo patrón que el resto del módulo |

*Índices*

Reutiliza `{ user_id: 1, category_id: 1, fecha: -1 }` de `transactions`.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Periodo con movimientos en varios grupos | `periodo=mes` | Ranking (sin Ingresos) + 5 gráficas de pastel | 200 |
| 2 | Lógica de negocio | Grupo sin movimientos en el periodo | — | Gráfica de ese grupo vacía, sin error | 200 |
| 3 | Validación de entrada | `periodo` inválido | `periodo=trimestre` | `VALIDATION_021` | 400 |
| 4 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 5 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-reportes-mensual]]

---

### CU-030 — Consultar ingresos vs. gastos

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, dentro del Reporte Mensual, una comparación
simple entre el total de ingresos y el total de gastos del periodo — entendiendo como gasto
únicamente los movimientos de los grupos Bills, Needs y Wants; Investment queda fuera de este
cálculo por decisión del usuario, al igual que transferencias, pagos a tarjeta y ajustes manuales,
que nunca se consideran ni ingreso ni gasto.

**Flujo principal**

1. El usuario consulta esta sección con el mismo periodo seleccionado en CU-027.
2. El sistema suma los montos de `transactions` `tipo = ingreso` del periodo.
3. El sistema suma, en valor absoluto, los montos de `transactions` `tipo = gasto` cuya categoría
   pertenezca a Bills, Needs o Wants dentro del periodo.

**Flujos alternativos / casos borde**

- Si no hay ingresos ni gastos en el periodo, ambos valores se devuelven en `0`, sin error.

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

_Reutiliza los mismos parámetros de periodo de CU-027._

**Reglas de negocio**

- RN-094: El gasto de esta vista suma todas las categorías de grupos con `flujo = outflow` **excepto**
  las del grupo llamado exactamente "Investment" — invertir en sí mismo no se considera "gasto" para
  este comparativo de salud financiera. A diferencia de RN-087/RN-090/RN-091, esta exclusión se
  queda deliberadamente por nombre exacto en vez de generalizarse por un campo estructural (no existe
  uno que distinga "inversión" del resto de Outflow) — mismo precedente ya usado por el chip
  "Investment" del modal de alta de transacciones. Si el usuario no tiene un grupo llamado
  "Investment", no se excluye nada.
- RN-095: Transferencias (`tipo = transferencia`), pagos a tarjeta (`tipo = pago_tarjeta`) y ajustes
  manuales (`tipo = ajuste`) nunca se consideran ingreso ni gasto en esta vista, por diseño del
  enum de `transactions` (ver [[transacciones]]).

**Casos de uso derivados identificados**

- Ninguno adicional.

**Validaciones**

_Reutiliza las validaciones de periodo de CU-027 (`VALIDATION_021`, `VALIDATION_022`)._

**Mensajes de error**

*Validación*
- `VALIDATION_021`, `VALIDATION_022` *(reutilizados)*

*Autenticación / autorización*
- `AUTH_001` *(reutilizado)*

*Sistema*
- `SYS_001` *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/reports/income-vs-expenses?periodo={periodo}&fecha_referencia={fecha}&desde={desde}&hasta={hasta}` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)*
```json
{
  "periodo": { "desde": "2026-07-01", "hasta": "2026-07-31" },
  "ingreso": 19665.87,
  "gasto": 8130.00
}
```

*Modelo de información*

No introduce colección nueva — consulta agregada sobre `transactions` y `categories`.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Agregación en tiempo de consulta | Cálculo derivado, no persistido | Mismo patrón que el resto del módulo |

*Índices*

Reutiliza `{ user_id: 1, category_id: 1, fecha: -1 }` de `transactions`.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Periodo con ingresos y gastos | `periodo=mes` | Totales correctos, Investment excluido del gasto | 200 |
| 2 | Flujo exitoso | Periodo sin movimientos | — | `ingreso=0`, `gasto=0` | 200 |
| 3 | Validación de entrada | `periodo` inválido | `periodo=trimestre` | `VALIDATION_021` | 400 |
| 4 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 5 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-reportes-mensual]] (Radial Chart - Stacked: ingreso y gasto como segmentos comparados, total al centro)

---

### CU-031 — Consultar frecuencia de transacciones

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, dentro del Reporte Mensual, cuántas transacciones
registra en promedio por día y por semana durante el periodo seleccionado, comparado siempre contra
el mes calendario inmediato anterior — independientemente del periodo elegido en el resto del
reporte —, para darle una señal de qué tan activo ha estado registrando sus movimientos.

**Flujo principal**

1. El sistema cuenta las `transactions` de `tipo = ingreso` o `tipo = gasto` del periodo
   seleccionado (excluye ajustes, transferencias y pagos a tarjeta).
2. El sistema calcula el promedio diario y semanal de ese conteo.
3. El sistema calcula el mismo promedio para el mes calendario inmediato anterior y devuelve la
   variación porcentual.

**Flujos alternativos / casos borde**

- Si el mes anterior no tiene transacciones, la variación porcentual no se calcula (se devuelve
  `null`) en lugar de una división por cero.

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

_Reutiliza los mismos parámetros de periodo de CU-027._

**Reglas de negocio**

- RN-096: El conteo de frecuencia solo incluye `transactions` `tipo = ingreso` o `tipo = gasto` —
  ajustes, transferencias y pagos a tarjeta quedan excluidos.
- RN-097: El comparativo de frecuencia siempre se calcula contra el mes calendario inmediato
  anterior, sin importar el periodo seleccionado en el resto del Reporte Mensual (semana, año o
  rango personalizado).

**Casos de uso derivados identificados**

- Ninguno adicional.

**Validaciones**

_Reutiliza las validaciones de periodo de CU-027 (`VALIDATION_021`, `VALIDATION_022`)._

**Mensajes de error**

*Validación*
- `VALIDATION_021`, `VALIDATION_022` *(reutilizados)*

*Autenticación / autorización*
- `AUTH_001` *(reutilizado)*

*Sistema*
- `SYS_001` *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/reports/transaction-frequency?periodo={periodo}&fecha_referencia={fecha}&desde={desde}&hasta={hasta}` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)*
```json
{
  "periodo": { "desde": "2026-07-01", "hasta": "2026-07-31" },
  "frecuencia_diaria": 6.1,
  "frecuencia_semanal": 24.3,
  "variacion_diaria_vs_mes_anterior": -0.79,
  "variacion_semanal_vs_mes_anterior": 1.86
}
```

*Modelo de información*

No introduce colección nueva — consulta agregada sobre `transactions`.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Agregación en tiempo de consulta | Cálculo derivado, no persistido | Mismo patrón que el resto del módulo |

*Índices*

Reutiliza `{ user_id: 1, category_id: 1, fecha: -1 }` de `transactions`.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Periodo con movimientos y mes anterior con movimientos | `periodo=mes` | Frecuencias y variación calculadas | 200 |
| 2 | Lógica de negocio | Mes anterior sin movimientos | — | Variación en `null`, sin división por cero | 200 |
| 3 | Validación de entrada | `periodo` inválido | `periodo=trimestre` | `VALIDATION_021` | 400 |
| 4 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 5 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-reportes-mensual]] (NO es una gráfica — dos stat cards: Daily/Weekly con indicador de tendencia vs. mes anterior)

---

## Historial de cambios

| Fecha | Cambio | CU afectado | Impacto en otros documentos |
|---|---|---|---|
| 2026-07-31 | Se documenta el módulo Reportes: pestaña Cuentas (resumen de cuentas, evolución de balance mensual débito/efectivo, resumen de tarjetas de crédito y su detalle de gasto) y pestaña Reporte Mensual (seis cards por grupo incluyendo Ahorros, distribución de gasto por categoría, ingresos vs. gastos, frecuencia de transacciones). Se agregan CU-023 a CU-031. No se crean colecciones ni campos nuevos — todo el módulo es agregación en tiempo de consulta sobre `accounts`, `categories`, `transactions` y `budgets`. Se deja fuera de alcance el reporte detallado de metas de ahorro individuales (depende del futuro módulo Ahorros y metas, v1.1) y cualquier representación de Créditos y deudas externas (v1.1). **CU-029** (presupuesto vs. real por grupo, con filtro de periodo libre) se documentó y luego se retiró del alcance por decisión del usuario, ya que duplicaba el seguimiento que ya ofrece [[presupuesto]] (CU-022) y el filtro de fecha libre de Reportes rompía la correspondencia con el presupuesto mensual — junto con él se retiran `RN-092` y `RN-093`, y no se crea el endpoint `/api/v1/reports/budget-vs-actual` que originalmente lo hubiera soportado. | CU-023, CU-024, CU-025, CU-026, CU-027, CU-028, CU-030, CU-031 | Se debe actualizar [[data-model-registry]] con el índice de numeración (hasta CU-031 / RN-097 / VALIDATION_022 / BIZ_021 — RN-092 y RN-093 quedan retirados) — sin nuevas colecciones que registrar. |
| 2026-08-11 | Se construye el módulo Reportes completo en código (React + Supabase), cerrando el MVP: dos pestañas (`src/pages/reports/accounts-tab.tsx`, `monthly-tab.tsx`) bajo `src/pages/reports/reports-page.tsx` con `Tabs`, reemplazando el placeholder de `/reports`. 100% lectura — sin RPCs ni cambios de esquema, mismo patrón "Supabase directo + agregación cliente" ya usado en Presupuesto/Categorías (hooks nuevos en `src/hooks/`: `use-accounts-monthly-balance`, `use-credit-card-detail`, `use-credit-cards-monthly-spend`, `use-monthly-summary-by-group`, `use-category-distribution`, `use-income-vs-expenses`, `use-transaction-frequency`; resolución de periodo semana/mes/año/personalizado en `src/lib/reports.ts`, RN-088). Se instala **Recharts** (`npx shadcn@latest add chart`, primera librería de gráficas del proyecto) para las áreas apiladas (CU-024/026) y los pasteles (CU-028); CU-030/031 se resuelven con cards/badges, sin gráfica. Se revisan **RN-087, RN-090, RN-091** — de una lista fija de cinco grupos por nombre (Ingresos/Bills/Needs/Wants/Investment) a dinámico por `categories.flujo` (cualquier cantidad/nombre de grupo activo), mismo criterio ya aplicado a [[presupuesto]] la ronda anterior — verificado con un grupo nuevo ("Cash") creado por el usuario en producción durante esta sesión, que apareció correctamente sin cambios de código. **RN-094** se queda deliberadamente por nombre exacto ("Investment"), sin generalizar — mismo precedente que el chip "Investment" del modal de transacciones. Sin diseño de Figma disponible (los wireframes referenciados en este documento no existen) — construido reutilizando el lenguaje visual ya establecido: `AccountCardTile` de Cuentas adaptado a `ReportAccountCard` (RN-077, variante con chip decorativo para débito/crédito y tarjeta plana para efectivo), `Tabs` ya usado en el Dashboard, y el shell de `DateRangeFilter` de Transacciones adaptado a `PeriodFilter`. Bug encontrado y corregido en el camino: `use-accounts-monthly-balance` marcaba el mes en curso como "futuro" (comparaba el *fin* del mes contra hoy en vez del *inicio*), mostrando balance `null`/`0` incluso para cuentas con saldo real — corregido comparando el inicio del mes. Verificado con Playwright contra la cuenta real (ambas pestañas, cifras cruzadas a mano vía REST) — cero errores de consola. | CU-023 a CU-028, CU-030, CU-031 | Se actualiza [[data-model-registry]] con la entrada de cierre del módulo — sin cambios de esquema que registrar. |

## Referencias

- [[estrategia]]
- [[brief-ux]]
- [[data-model-registry]]
- [[cuentas]]
- [[categorias]]
- [[transacciones]]
- [[presupuesto]]
