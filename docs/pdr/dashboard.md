---
modulo: "Dashboard"
status: en progreso
---

# Requerimientos — Dashboard

## Resumen del módulo

El módulo de Dashboard es de **solo lectura y agregación** — no introduce colecciones ni campos
nuevos, únicamente consulta `accounts` y `transactions` (en esta primera pestaña) para construir
tres vistas dentro de una sola pantalla con pestañas: **Balance**, **Networth** y **Analytics**. Es
el módulo consolidado que sucede a [[reportes]] — el nav item "Reports" se retiró de la aplicación
sin construirse en su forma original, y su función se absorbe aquí (ver la nota de arquitectura de
`investment_balance_history` en [[data-model-registry]], que ya anticipaba esta consolidación). Las
tres pestañas se documentan y construyen una por una, alineando primero con el usuario en lenguaje
no técnico antes de formalizar cada una — este documento crece con cada pestaña cerrada.

**Balance** informa sobre el dinero disponible: balance total y cards de cuentas de débito/efectivo,
su evolución mensual, y el resumen de tarjetas de crédito (utilización, disponible, y avance de
gasto contra el mínimo mensual por ciclo de corte) junto con su evolución de gasto mensual.

**Networth** informa sobre el patrimonio neto del usuario: un desglose de Cash & Savings,
Investments y Liabilities (columna izquierda), la evolución histórica del Networth total con
selector de periodo (columna derecha), un comparativo Assets vs Liabilities, y una meta de Networth
configurable con su avance.

**Analytics** (esta entrega, la última pestaña del Dashboard) informa sobre el movimiento de dinero
del usuario: cuatro cards de resumen (Income, Expenses, Savings, Investment) con comparativo contra
el periodo anterior equivalente, una gráfica de Cash Flow (Income vs Expenses en el tiempo), y una
card de barras horizontales por cada grupo de categorías del usuario, mostrando su distribución
interna por categoría. Con esta pestaña se completa la fase de construcción en código de todo el
alcance definido del producto (ver `docs/strategy/estrategia.md`).

> **Nota de sucesión:** CU-069 a CU-071 (Analytics) suceden funcionalmente a CU-027, CU-028, CU-030
> y CU-031 de [[reportes]] (pestaña "Reporte Mensual": resumen por grupo, distribución de gasto por
> categoría, ingresos vs. gastos, frecuencia de transacciones) — con una diferencia estructural
> importante: el viejo cálculo de ingresos vs. gastos (RN-094, retirado) excluía el grupo
> "Investment" del gasto por nombre exacto, un hack documentado como frágil en su momento. Analytics
> resuelve esa fragilidad de raíz: `categories.flujo` gana un tercer valor estructural,
> `investment` (ver RN-118 revisada en [[categorias]]), y con eso Investment deja de ser un caso
> especial — es simplemente su propia card, sin traslape con Expenses. La frecuencia de
> transacciones (CU-031 de [[reportes]]) **no** se retoma en Analytics — no estaba en el alcance
> descrito por el usuario para esta pestaña; queda en [[backlog]] como posible extensión futura. Los
> números `CU-023`–`CU-031` y `RN-076`–`RN-097` de [[reportes]] no se reutilizan ni se renumeran —
> quedan como registro histórico; ver [[data-model-registry]].

> **Nota de nomenclatura:** la palabra "Assets" se usa en dos sentidos distintos dentro de esta
> pestaña, y se documenta explícitamente para evitar confusión al leer las reglas de negocio. La
> card de la columna izquierda (CU-065) se llama **"Cash & Savings"** — deliberadamente, no
> "Assets" — y agrupa únicamente metas de ahorro, cuentas de débito y cuentas de efectivo. El
> componente "Networth balance" (CU-067) sí usa el término **"Assets"**, con un alcance más amplio:
> Cash & Savings + Investments. Son dos totales distintos por diseño, no una inconsistencia.

> **Nota de sucesión:** CU-061 a CU-064 (Balance) suceden funcionalmente a CU-023, CU-024 y CU-025
> de [[reportes]] — mismo cálculo base (balance total, evolución mensual débito/efectivo, resumen de
> tarjetas de crédito), con reglas de negocio nuevas o corregidas (orden explícito, carrusel, años
> navegables limitados a los que tienen datos, y el indicador de gasto mínimo mensual recalculado por
> **ciclo de corte** en vez de mes calendario — corrige RN-083/RN-084 de [[reportes]]). Los números de
> CU/RN de [[reportes]] no se reutilizan ni se renumeran — quedan como registro histórico; ver
> [[data-model-registry]].

## Casos de uso

### CU-061 — Consultar balance total y cuentas de débito y efectivo

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, en la pestaña "Balance" del Dashboard, el balance
total disponible en sus cuentas de débito y efectivo, junto con una card individual por cada una de
esas cuentas activas — incluidas las marcadas como excluidas de estadísticas, que sí se muestran
aunque no participen en el total.

**Flujo principal**

1. El usuario accede a la pestaña "Balance" del Dashboard.
2. El sistema consulta las cuentas activas de tipo `debito` y `efectivo` del usuario.
3. El sistema calcula el balance total sumando `saldo_actual` de las cuentas con
   `excluir_de_stats = false`.
4. El sistema ordena las cuentas: primero las no excluidas de mayor a menor `saldo_actual`, después
   las excluidas en el mismo criterio.
5. El sistema muestra el balance total y, debajo, una card por cuenta (imagen configurada al crear
   la cuenta, nombre, balance, tipo) — 4 o 5 visibles según el ancho de pantalla, el resto navegable
   en carrusel.

**Flujos alternativos / casos borde**

- Si el usuario no tiene cuentas de débito/efectivo activas, se muestra un estado vacío.
- Las cuentas archivadas nunca aparecen aquí ni participan en el total (a diferencia del carrusel de
  excluidas, que sí se muestra).
- Una cuenta con `excluir_de_stats = true` aparece como card, en su posición de orden
  correspondiente, pero no participa en la suma del balance total (RN-016/RN-017 de [[cuentas]]).

**Precondiciones**

- El usuario debe estar autenticado con una sesión activa.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

_No aplica — este CU no captura datos, solo consulta información existente._

**Reglas de negocio**

- RN-225: El balance total suma `saldo_actual` únicamente de cuentas `tipo = debito` o
  `tipo = efectivo`, `status = active` y `excluir_de_stats = false`.
- RN-226: Se muestran todas las cuentas `debito`/`efectivo` activas (incluidas las excluidas de
  estadísticas); las archivadas no aparecen en esta vista.
- RN-227: Orden de las cards: primero las no excluidas de mayor a menor `saldo_actual`, luego las
  excluidas en el mismo criterio (mayor a menor).
- RN-228: Se muestran 4 o 5 cards según el ancho disponible de pantalla; el resto es navegable en un
  carrusel horizontal — decisión de presentación en frontend, sin impacto en el modelo de datos
  (mismo criterio que RN-077 de [[reportes]] para el estilo de card).

**Casos de uso derivados identificados**

- Ninguno — mismo motivo ya evaluado en [[cuentas]] y [[categorias]]: volumen bajo de cuentas por
  usuario.

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
| GET | `/api/v1/dashboard/balance-accounts-summary` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)* — `cuentas` ya viene en el orden final (RN-227), sin que el frontend deba
reordenar:
```json
{
  "balance_total": 67931.92,
  "cuentas": [
    { "account_id": "665f...a02", "nombre": "MiCuenta Banamex", "tipo": "debito", "saldo_actual": 25459.00, "imagen_url": "https://...", "color": "#2563EB", "excluir_de_stats": false },
    { "account_id": "665f...a03", "nombre": "Nubank", "tipo": "debito", "saldo_actual": 30258.65, "imagen_url": "https://...", "color": "#A855F7", "excluir_de_stats": false },
    { "account_id": "665f...a04", "nombre": "Nómina", "tipo": "debito", "saldo_actual": 6726.32, "imagen_url": null, "color": "#0EA5E9", "excluir_de_stats": false },
    { "account_id": "665f...a01", "nombre": "Wallet", "tipo": "efectivo", "saldo_actual": 5487.95, "imagen_url": null, "color": "#22C55E", "excluir_de_stats": true }
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

Reutiliza `(user_id, status)` de `accounts` (definido en [[cuentas]]).

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Usuario con cuentas débito/efectivo, mezcla de excluidas y no excluidas | — | Balance total correcto, cards en el orden de RN-227 | 200 |
| 2 | Flujo exitoso | Usuario sin cuentas débito/efectivo | — | Estado vacío, `balance_total = 0` | 200 |
| 3 | Lógica de negocio | Cuenta con `excluir_de_stats = true` | — | Aparece como card en su posición, no suma al total | 200 |
| 4 | Lógica de negocio | Cuenta archivada | — | No aparece ni en cards ni en el total | 200 |
| 5 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 6 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: Figma — [Balance tab](https://www.figma.com/design/McS1WiO2R2Z8sKpJBfkOx6/Finanzas-App---Artes?node-id=62-44)

---

### CU-062 — Consultar evolución de balance mensual (débito y efectivo)

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, dentro de la pestaña "Balance", una gráfica de
barras apiladas con la evolución de su balance mes a mes a lo largo de un año seleccionado,
mostrando cómo se distribuye su dinero entre sus cuentas de **débito y efectivo únicamente** — las
cuentas de crédito quedan fuera de esta gráfica en particular, ya que representan deuda, no
disponibilidad de fondos. El usuario puede navegar entre años, limitado a los años en los que
existen datos.

**Flujo principal**

1. El usuario, dentro de la pestaña "Balance", selecciona el año a consultar (por defecto, el año en
   curso).
2. El sistema identifica las cuentas activas de tipo `debito` y `efectivo` del usuario.
3. Para cada mes del año seleccionado, el sistema calcula el balance de cada cuenta al cierre de ese
   mes.
4. El sistema devuelve la serie mensual (12 puntos) por cuenta, lista para graficarse de forma
   apilada, junto con el rango de años navegable.

**Flujos alternativos / casos borde**

- Si una cuenta fue creada a mitad de año, los meses anteriores a su creación se devuelven en `0` (la
  cuenta no existía, no arrastra saldo).
- Si el usuario no tuvo movimientos en un mes mostrado, el balance de ese mes se arrastra del último
  balance calculado conocido (no se muestra en `0` salvo que el saldo real sea cero) — RN-231.
- Si el usuario no tiene ninguna cuenta débito/efectivo, no hay año navegable — se muestra un estado
  vacío en lugar de la gráfica.

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `anio` (query param) | Selector de año | No | 4 dígitos | Entero entre 2000 y 2100 | — | Año en curso | RN-232 |

**Reglas de negocio**

- RN-229: La gráfica solo considera cuentas `tipo = debito` y `tipo = efectivo`, `status = active` —
  las cuentas `tipo = credito` quedan fuera de este cálculo.
- RN-230: El balance de una cuenta al cierre de un mes se calcula como
  `saldo_inicial + Σ(transactions.monto con signo, fecha ≤ último día del mes)` — cálculo derivado en
  tiempo de consulta, no persistido, mismo patrón que `disponible` en [[cuentas]].
- RN-231: Si una cuenta no tiene movimientos en un mes dado, su balance para ese mes es el último
  balance calculado (arrastre hacia adelante) — no se muestra como cero salvo que el saldo real sea
  efectivamente cero.
- RN-232: El año navegable está limitado al rango `[año de creación de la cuenta débito/efectivo
  activa más antigua del usuario, año en curso]` — no se ofrece navegación hacia años sin datos
  posibles. Si el usuario no tiene cuentas débito/efectivo, no hay rango navegable.

**Casos de uso derivados identificados**

- Ninguno adicional.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `anio` | integer | Opcional; si se envía, entero entre 2000 y 2100 | A03 — Validar tipo y rango numérico |

**Mensajes de error**

*Validación*
- `VALIDATION_020`: "El año debe ser un valor numérico válido." *(reutilizado de [[reportes]])*

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/dashboard/balance-monthly-history?anio={anio}` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)*
```json
{
  "anio": 2026,
  "anio_minimo": 2024,
  "anio_maximo": 2026,
  "meses": [
    {
      "mes": "2026-01",
      "cuentas": [
        { "account_id": "665f...a02", "nombre": "MiCuenta Banamex", "color": "#2563EB", "balance": 8316.22 },
        { "account_id": "665f...a03", "nombre": "Nubank", "color": "#A855F7", "balance": 3276.13 }
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

Reutiliza `(account_id, fecha desc)` de `transactions` (definido en [[transacciones]]).

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Año con movimientos en varias cuentas débito/efectivo | `anio=2026` | Serie de 12 meses por cuenta, cuentas de crédito excluidas | 200 |
| 2 | Lógica de negocio | Cuenta creada a mitad de año | — | Meses anteriores a la creación en `0` | 200 |
| 3 | Lógica de negocio | Mes sin movimientos | — | Balance arrastrado del mes anterior (RN-231) | 200 |
| 4 | Lógica de negocio | Año fuera del rango navegable | `anio=2019` | Se ignora / no se ofrece en el selector (RN-232) | 200 |
| 5 | Validación de entrada | `anio` con formato inválido | `anio=abc` | `VALIDATION_020` | 400 |
| 6 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 7 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: Figma — [Balance tab](https://www.figma.com/design/McS1WiO2R2Z8sKpJBfkOx6/Finanzas-App---Artes?node-id=62-44) (gráfica "Monthly balance")

---

### CU-063 — Consultar resumen de tarjetas de crédito

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, dentro de la pestaña "Balance", una card por cada
cuenta de tipo crédito activa, con su balance actual, porcentaje de línea de crédito utilizado y
disponible. Adicionalmente, si la cuenta tiene configurado un `gasto_minimo_mensual`, se muestra el
avance del gasto del **ciclo de corte en curso** (no el mes calendario) contra ese mínimo, para
ayudar al usuario a decidir si ya exentó la comisión o si aún necesita gastar con esa tarjeta.

**Flujo principal**

1. El usuario, dentro de la pestaña "Balance", visualiza la sección de tarjetas de crédito.
2. El sistema identifica las cuentas activas de tipo `credito` del usuario.
3. Para cada una, el sistema calcula el porcentaje utilizado y el disponible.
4. El sistema ordena las cards de mayor a menor `saldo_actual`.
5. Para cada tarjeta con `gasto_minimo_mensual` configurado, el sistema calcula el ciclo de corte
   actual a partir de `dia_corte` y el gasto acumulado dentro de ese ciclo, comparándolo contra el
   mínimo.
6. El sistema muestra las cards (imagen configurada, nombre, balance, barra de utilización de línea
   de crédito, % y disponible, y el indicador de avance de gasto mínimo si aplica) — 4 o 5 visibles,
   resto en carrusel.

**Flujos alternativos / casos borde**

- Si el usuario no tiene cuentas de tipo crédito, la sección no se muestra.
- Si `gasto_minimo_mensual` es `0` o no está configurado, no se muestra el indicador de avance para
  esa tarjeta.
- Si el gasto del ciclo ya superó `gasto_minimo_mensual`, el indicador se muestra al 100% (sin
  sobrepasar visualmente la barra).
- Si `dia_corte` no existe en el mes correspondiente del cálculo del ciclo (ej. 31 en un mes de 30 o
  menos días), se usa el último día de ese mes como fecha de corte efectiva.

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

_No aplica — este CU no captura datos, solo consulta información existente._

**Reglas de negocio**

- RN-233: El resumen solo incluye cuentas `tipo = credito` y `status = active`.
- RN-234: El porcentaje utilizado se calcula como `abs(saldo_actual) ÷ linea_credito`; el disponible
  reutiliza el cálculo ya definido en [[cuentas]] (RN-013).
- RN-235: Orden de las cards: `saldo_actual` de mayor a menor (mismo campo y criterio numérico que
  RN-227 de débito/efectivo — como el saldo de una tarjeta de crédito es negativo, esto prioriza la
  tarjeta con menor deuda). Mismo criterio de carrusel que RN-228.
- RN-236: El **ciclo de corte actual** de una tarjeta se calcula a partir de `dia_corte`: si el día de
  hoy es mayor o igual a `dia_corte`, el ciclo va de `dia_corte` de este mes (inclusive) a `dia_corte`
  del próximo mes (exclusive); si el día de hoy es menor a `dia_corte`, el ciclo va de `dia_corte` del
  mes anterior a `dia_corte` de este mes. Si `dia_corte` no existe en el mes correspondiente (ej. 31
  en febrero), se recorta al último día de ese mes. **Corrige RN-083 de [[reportes]]**, que usaba mes
  calendario en vez de ciclo de corte.
- RN-237: El gasto del ciclo de una tarjeta es la suma, en valor absoluto, de los montos de
  `transactions` con `tipo = gasto` de esa cuenta dentro del ciclo resuelto por RN-236; se compara
  contra `gasto_minimo_mensual` para mostrar el avance. Si `gasto_minimo_mensual` es `0` o no está
  configurado, no se muestra el indicador. Si el gasto excede el mínimo, se muestra al 100% sin
  sobrepasar visualmente. **Corrige RN-084 de [[reportes]]** en el mismo sentido que RN-236.
- RN-241: Encima de las cards, se muestra "Total credit cards" = suma de `saldo_actual` de todas las
  cuentas `tipo = credito` activas — mismo patrón que el balance total de RN-225, sin concepto de
  exclusión (`excluir_de_stats` no aplica al total de crédito, a diferencia de débito/efectivo).

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
| GET | `/api/v1/dashboard/credit-cards-summary` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)*
```json
{
  "balance_total": -15918.00,
  "tarjetas": [
    {
      "account_id": "665f...c01",
      "nombre": "HSBC 2Now",
      "imagen_url": "https://...",
      "color": "#DC2626",
      "saldo_actual": -5459.00,
      "linea_credito": 32500.00,
      "porcentaje_utilizado": 0.65,
      "disponible": 31500.00,
      "gasto_minimo_mensual": 3500.00,
      "ciclo_desde": "2026-08-16",
      "ciclo_hasta": "2026-09-16",
      "gasto_ciclo_actual": 4134.97,
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
| Ciclo de corte | Calculado a partir de `accounts.dia_corte` existente | No requiere columnas nuevas — `dia_corte` ya existe desde [[cuentas]] (RN-011) |

*Índices*

Reutiliza `(account_id, fecha desc)` de `transactions`.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Usuario con tarjetas de crédito activas | — | Cards ordenadas por RN-235, % utilizado y disponible correctos | 200 |
| 2 | Flujo exitoso | Usuario sin cuentas de crédito | — | Sección vacía | 200 |
| 3 | Lógica de negocio | `gasto_minimo_mensual = 0` | — | Sin indicador de ciclo para esa tarjeta (RN-237) | 200 |
| 4 | Lógica de negocio | Gasto del ciclo supera el mínimo | — | Indicador al 100%, sin sobrepasar | 200 |
| 5 | Lógica de negocio | `dia_corte = 31`, mes en curso de 28/29/30 días | — | Ciclo calculado con el último día del mes (RN-236) | 200 |
| 6 | Lógica de negocio | Hoy es anterior al `dia_corte` del mes | — | Ciclo resuelto hacia el mes anterior (RN-236) | 200 |
| 7 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 8 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: Figma — [Balance tab](https://www.figma.com/design/McS1WiO2R2Z8sKpJBfkOx6/Finanzas-App---Artes?node-id=62-44) (sección "Total credit cards")

---

### CU-064 — Consultar evolución de gasto mensual por tarjeta de crédito

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, dentro de la pestaña "Balance", una gráfica de
barras apiladas con el gasto mes a mes de cada una de sus tarjetas de crédito a lo largo de un año
seleccionado — mismo mecanismo de navegación por año que CU-062, aplicado al gasto en vez de al
balance.

**Flujo principal**

1. El usuario, dentro de la sección de tarjetas de crédito, selecciona el año a consultar (por
   defecto, el año en curso).
2. El sistema identifica las cuentas activas de tipo `credito` del usuario.
3. Para cada mes del año seleccionado, el sistema calcula el gasto total de cada tarjeta.
4. El sistema devuelve la serie mensual (12 puntos) por tarjeta, lista para graficarse de forma
   apilada, junto con el rango de años navegable.

**Flujos alternativos / casos borde**

- Si una tarjeta fue creada a mitad de año, los meses anteriores a su creación se devuelven en `0`.
- Si no hay gasto registrado en un mes, ese mes se devuelve en `0` (a diferencia de CU-062, aquí no
  aplica arrastre — el gasto de un mes sin movimientos es, en efecto, cero, no un balance que se
  mantiene).
- Si el usuario no tiene tarjetas de crédito, no hay año navegable — estado vacío en vez de gráfica.

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `anio` (query param) | Selector de año | No | 4 dígitos | Entero entre 2000 y 2100 | — | Año en curso | RN-240 |

**Reglas de negocio**

- RN-238: La gráfica solo considera cuentas `tipo = credito`, `status = active`.
- RN-239: El gasto de un mes de una tarjeta es la suma, en valor absoluto, de `transactions` con
  `tipo = gasto` de esa cuenta dentro del mes calendario — cálculo derivado en tiempo de consulta, no
  persistido. A diferencia de RN-230 (balance de cierre, acumulado), este es un total del mes en sí,
  sin arrastre.
- RN-240: El año navegable está limitado al rango `[año de creación de la tarjeta de crédito activa
  más antigua del usuario, año en curso]` — mismo mecanismo que RN-232.

**Casos de uso derivados identificados**

- Ninguno adicional.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `anio` | integer | Opcional; si se envía, entero entre 2000 y 2100 | A03 — Validar tipo y rango numérico |

**Mensajes de error**

*Validación*
- `VALIDATION_020`: "El año debe ser un valor numérico válido." *(reutilizado)*

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/dashboard/credit-cards-monthly-spend?anio={anio}` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)*
```json
{
  "anio": 2026,
  "anio_minimo": 2025,
  "anio_maximo": 2026,
  "meses": [
    {
      "mes": "2026-01",
      "tarjetas": [
        { "account_id": "665f...c01", "nombre": "HSBC 2Now", "color": "#DC2626", "gasto": 4200.00 },
        { "account_id": "665f...c02", "nombre": "HSBC Lite", "color": "#991B1B", "gasto": 1100.50 }
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
| Agregación en tiempo de consulta | Cálculo derivado, no persistido | Mismo patrón que CU-062, sin arrastre (RN-239) |

*Índices*

Reutiliza `(account_id, fecha desc)` de `transactions`.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Año con gasto en varias tarjetas | `anio=2026` | Serie de 12 meses por tarjeta | 200 |
| 2 | Lógica de negocio | Tarjeta creada a mitad de año | — | Meses anteriores a la creación en `0` | 200 |
| 3 | Lógica de negocio | Mes sin gasto | — | Mes en `0`, sin arrastre (RN-239) | 200 |
| 4 | Validación de entrada | `anio` con formato inválido | `anio=abc` | `VALIDATION_020` | 400 |
| 5 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 6 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: Figma — [Balance tab](https://www.figma.com/design/McS1WiO2R2Z8sKpJBfkOx6/Finanzas-App---Artes?node-id=62-44) (gráfica "Monthly usage")

---

### CU-065 — Consultar resumen de Cash & Savings, Investments y Liabilities

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, en la columna izquierda de la pestaña "Networth"
del Dashboard, tres cards con el resumen de su patrimonio agrupado en **Cash & Savings** (metas de
ahorro activas, cuentas de débito y cuentas de efectivo), **Investments** (inversiones activas
agrupadas por tipo de instrumento) y **Liabilities** (tarjetas de crédito y deudas activas
agrupadas por tipo de deuda). Cada card muestra su total, una barra segmentada proporcional a los
ítems que la componen, y el detalle de cada ítem.

**Flujo principal**

1. El usuario accede a la pestaña "Networth" del Dashboard.
2. El sistema calcula el total de Cash & Savings sumando `monto_aportado_actual` de las metas de
   ahorro activas del usuario, y `saldo_actual` de sus cuentas de débito y efectivo activas con
   `excluir_de_stats = false`.
3. El sistema calcula el total de Investments sumando `balance_actual` de las inversiones activas
   (`status = activo`) del usuario, agrupado por `tipo_activo`.
4. El sistema calcula el total de Liabilities sumando, en un grupo "Credit Cards", el valor absoluto
   de `saldo_actual` de las cuentas de crédito activas del usuario; y, en un grupo por cada `tipo`
   de deuda con al menos una deuda activa, el saldo calculado (`monto_original` menos capital
   pagado, mismo cálculo que RN-202 de [[creditos-deudas]]) de esas deudas.
5. El sistema muestra las tres cards, cada una con su total, una barra segmentada proporcional a los
   ítems que la componen, y el detalle de cada ítem ordenado de mayor a menor monto.

**Flujos alternativos / casos borde**

- Si un grupo no tiene ningún ítem con datos (ej. el usuario no tiene inversiones), la card muestra
  el total en $0.00 y un estado vacío en lugar de la barra segmentada y el detalle.
- Las metas archivadas, cuentas archivadas, deudas archivadas e inversiones inactivas nunca
  participan en estos totales ni aparecen como ítem.
- Un ítem con monto $0 (ej. una deuda activa ya liquidada pero aún no archivada, RN-204 de
  [[creditos-deudas]]) sí aparece en el detalle, en su posición correspondiente por orden.

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

_No aplica — este CU no captura datos, solo consulta información existente._

**Reglas de negocio**

- RN-242: Cash & Savings = Σ `monto_aportado_actual` de `savings_goals` con `status = active` del
  usuario + Σ `saldo_actual` de `accounts` con `tipo = debito` o `tipo = efectivo`,
  `status = active` y `excluir_de_stats = false` — mismo criterio de exclusión que RN-225 de
  Balance, aplicado también aquí por ser un total de "patrimonio en estadísticas".
- RN-243: Investments = Σ `balance_actual` de `investments` con `status = activo` del usuario,
  agrupado por `tipo_activo`; solo se muestra un ítem por cada tipo que tenga al menos un
  instrumento activo.
- RN-244: Liabilities = ítem "Credit Cards" (Σ `abs(saldo_actual)` de `accounts` con
  `tipo = credito` y `status = active`) + un ítem por cada `tipo` de `debts` con al menos una deuda
  activa (Σ del saldo calculado de esas deudas, RN-202 de [[creditos-deudas]]), etiquetado con
  `DEBT_TYPE_LABELS`.
- RN-245: Orden de los ítems dentro de cada card: de mayor a menor monto.
- RN-246: La barra segmentada de cada card representa, para cada ítem, su proporción
  (`monto_item ÷ total_card`) del ancho total de la barra. Si el total de una card es `0`, no se
  muestra la barra ni el detalle — se muestra un estado vacío dentro de esa card.
- RN-247: Las metas archivadas, cuentas archivadas, deudas archivadas e inversiones inactivas nunca
  participan en estos totales — mismo criterio de "solo activos" ya aplicado en Balance (RN-226,
  RN-233) y en los listados propios de cada módulo.

**Casos de uso derivados identificados**

- Ninguno — mismo motivo ya evaluado en [[cuentas]] y [[categorias]]: volumen bajo de registros por
  usuario.

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
| GET | `/api/v1/dashboard/networth-breakdown` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)* — `items` de cada grupo ya viene ordenado por RN-245:
```json
{
  "cash_and_savings": {
    "total": 53005.57,
    "items": [
      { "id": "savings", "label": "Savings", "monto": 42014.07 },
      { "id": "debit_accounts", "label": "Debit Accounts", "monto": 9916.49 },
      { "id": "cash", "label": "Cash", "monto": 1125.00 }
    ]
  },
  "investments": {
    "total": 53005.57,
    "items": [
      { "id": "ETF", "label": "ETF", "monto": 42014.07 },
      { "id": "PPR", "label": "PPR", "monto": 9916.49 },
      { "id": "Crypto", "label": "Crypto", "monto": 1125.00 }
    ]
  },
  "liabilities": {
    "total": 53005.57,
    "items": [
      { "id": "credit_cards", "label": "Credit Cards", "monto": 42014.07 },
      { "id": "auto", "label": "Auto loan", "monto": 9916.49 },
      { "id": "hipoteca", "label": "Mortgage", "monto": 1125.00 }
    ]
  }
}
```

*Modelo de información*

No introduce colección nueva — consulta agregada sobre `accounts`, `savings_goals`, `transactions`,
`investments` y `debts`.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Agregación en tiempo de consulta | Cálculo derivado, no persistido | Mismo patrón que el resto del Dashboard — ninguno de los tres totales se guarda |

*Índices*

Reutiliza `(user_id, status)` de `accounts`, `savings_goals`, `investments` y `debts`, y
`(meta_id, fecha desc)`/`(deuda_id, fecha desc)` de `transactions` (todos ya definidos en sus
módulos de origen).

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Usuario con datos en las tres fuentes | — | Tres cards con totales e ítems correctos, orden RN-245 | 200 |
| 2 | Lógica de negocio | Usuario sin inversiones | — | Card Investments en $0.00, estado vacío | 200 |
| 3 | Lógica de negocio | Meta de ahorro archivada | — | No participa en Cash & Savings | 200 |
| 4 | Lógica de negocio | Deuda activa con saldo $0 (liquidada, no archivada) | — | Aparece como ítem en $0.00 | 200 |
| 5 | Lógica de negocio | Cuenta débito con `excluir_de_stats = true` | — | No participa en Cash & Savings | 200 |
| 6 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 7 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: Figma — [Networth tab](https://www.figma.com/design/McS1WiO2R2Z8sKpJBfkOx6/Finanzas-App---Artes?node-id=52-192) (columna izquierda)

---

### CU-066 — Consultar evolución histórica del Networth total

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, en la columna derecha de la pestaña "Networth",
una gráfica de línea con la evolución de su Networth total (Cash & Savings + Investments −
Liabilities) a lo largo del tiempo, con un segmentador de periodo: 1M, 6M, YTD, 1Y, All o un rango
personalizado (Custom).

**Flujo principal**

1. El usuario, dentro de la pestaña "Networth", selecciona un periodo (por defecto, "1M").
2. El sistema determina el rango de meses correspondiente al periodo seleccionado.
3. Para cada mes de ese rango, el sistema reconstruye Cash & Savings, Investments y Liabilities **a
   la fecha de cierre de ese mes** (no al momento actual) y calcula el Networth de ese punto.
4. El sistema devuelve la serie mensual del Networth total, lista para graficarse como línea, junto
   con el rango de fechas disponible.

**Flujos alternativos / casos borde**

- La granularidad del histórico es siempre mensual — los periodos más cortos ("1M", "6M") muestran
  menos puntos, no puntos más finos (RN-250).
- Si un instrumento de inversión no tiene ningún registro en `investment_balance_history` anterior o
  igual a la fecha de un punto, se considera que aún no existía en ese punto — su valor para ese mes
  es `0` (mismo criterio que RN-232/RN-240 aplican a cuentas y tarjetas creadas a mitad de año).
- Si el usuario no tiene ningún registro en ninguna de las cuatro fuentes (cuentas, metas,
  inversiones, deudas), no hay periodo navegable — se muestra un estado vacío en vez de la gráfica.
- En el periodo "Custom", si la fecha de inicio es posterior a la fecha de fin, se rechaza con
  `VALIDATION_036` (nuevo — no existe un código previo para rango de fechas inválido; CU-016 de
  [[transacciones]] filtra por rango sin validarlo como error).

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `periodo` (query param) | Segmentador | No | — | Enum: `1m`, `6m`, `ytd`, `1y`, `all`, `custom` | — | `1m` | RN-251 |
| `fecha_inicio` (query param) | Date picker | Sí, solo si `periodo=custom` | — | Fecha válida | `periodo=custom` | — | RN-251 |
| `fecha_fin` (query param) | Date picker | Sí, solo si `periodo=custom` | — | Fecha válida, ≥ `fecha_inicio` | `periodo=custom` | — | RN-251 |

**Reglas de negocio**

- RN-248: El Networth de un punto histórico (fin de mes) = Cash & Savings + Investments −
  Liabilities a esa fecha, con los mismos criterios de agrupación de RN-242 a RN-244, pero
  reconstruidos retroactivamente en vez de al momento actual.
- RN-249: Reconstrucción "a la fecha" por fuente: cuentas débito/efectivo → `saldo_inicial` + Σ
  transacciones con `fecha ≤` fin del punto (mismo cálculo que RN-230 de Balance); cuentas de
  crédito → mismo cálculo, expresado como pasivo; metas de ahorro → `monto_inicial` − Σ
  transacciones de la meta con `fecha ≤` fin del punto; deudas → `monto_original` − Σ
  `monto_capital` pagado con `fecha ≤` fin del punto; inversiones → `balance` de
  `investment_balance_history` con la `fecha` más reciente ≤ fin del punto (si no existe ningún
  registro anterior, el instrumento vale `0` en ese punto).
- RN-250: La granularidad del histórico es siempre mensual, sin importar el periodo seleccionado.
- RN-251: Rango de meses según el periodo: `1m` = últimos 2 meses cerrados; `6m` = últimos 6 meses;
  `ytd` = enero del año en curso al mes en curso; `1y` = últimos 12 meses; `all` = desde el mes de
  creación del registro (cuenta, meta, inversión o deuda) más antiguo del usuario; `custom` = meses
  entre `fecha_inicio` y `fecha_fin`.
- RN-252: Si el usuario no tiene ningún registro en ninguna de las cuatro fuentes, no hay periodo
  navegable — se muestra un estado vacío.

**Casos de uso derivados identificados**

- Ninguno adicional.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `periodo` | enum | Uno de `1m`, `6m`, `ytd`, `1y`, `all`, `custom` | A03 — Validar contra catálogo cerrado |
| `fecha_inicio`, `fecha_fin` | date | Obligatorias si `periodo=custom`; `fecha_fin ≥ fecha_inicio` | A03 — Validar formato y rango de fecha |

**Mensajes de error**

*Validación*
- `VALIDATION_036`: "La fecha final no puede ser anterior a la fecha inicial." *(nuevo)*

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/dashboard/networth-history?periodo={periodo}&fecha_inicio={fecha_inicio}&fecha_fin={fecha_fin}` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)*
```json
{
  "periodo": "1y",
  "fecha_minima": "2024-03-01",
  "fecha_maxima": "2026-08-01",
  "meses": [
    { "mes": "2026-07", "networth_total": 118420.10 },
    { "mes": "2026-08", "networth_total": 124580.45 }
  ]
}
```

*Modelo de información*

No introduce colección nueva — consulta agregada sobre `accounts`, `savings_goals`, `transactions`,
`investments`, `investment_balance_history` y `debts`.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Reconstrucción histórica multi-fuente | Cálculo derivado en tiempo de consulta | Generaliza el mismo mecanismo de RN-230 (Balance) a las cuatro fuentes del patrimonio; no se persiste ningún snapshot nuevo |
| Granularidad mensual fija | Decisión de producto | Evita que Investments (actualizado manualmente, no a diario) se vea con saltos artificiales bajo una resolución más fina que la disponible |

*Índices*

Reutiliza `(account_id, fecha desc)`, `(meta_id, fecha desc)` y `(deuda_id, fecha desc)` de
`transactions`, y `(user_id, fecha)` de `investment_balance_history` (ya definido en [[inversiones]]
específicamente para este consumo futuro).

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Usuario con datos en las cuatro fuentes, periodo `1y` | `periodo=1y` | Serie de 12 meses, Networth correcto por mes | 200 |
| 2 | Lógica de negocio | Inversión creada a mitad de periodo | — | Meses anteriores a su primer snapshot en `0` | 200 |
| 3 | Lógica de negocio | Periodo `custom` válido | `fecha_inicio`, `fecha_fin` | Serie mensual entre ambas fechas | 200 |
| 4 | Lógica de negocio | Usuario sin ningún registro | — | Estado vacío, sin periodo navegable (RN-252) | 200 |
| 5 | Validación de entrada | `custom` con `fecha_fin < fecha_inicio` | — | `VALIDATION_036` | 400 |
| 6 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 7 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: Figma — [Networth tab](https://www.figma.com/design/McS1WiO2R2Z8sKpJBfkOx6/Finanzas-App---Artes?node-id=52-192) (gráfica "Total Networth")

---

### CU-067 — Consultar comparativo Networth balance (Assets vs Liabilities)

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, dentro de la pestaña "Networth", un comparativo
tipo donut entre "Assets" (Cash & Savings + Investments, valor actual) y "Liabilities" (valor
actual) — a diferencia de CU-066, este comparativo es siempre un snapshot del momento presente, sin
selector de periodo.

**Flujo principal**

1. El usuario, dentro de la pestaña "Networth", visualiza la card "Networth balance".
2. El sistema toma los totales actuales de Cash & Savings, Investments y Liabilities ya calculados
   en CU-065.
3. El sistema suma Cash & Savings + Investments en un único total "Assets", y muestra "Assets" y
   "Liabilities" como los dos segmentos del donut, junto con su monto.

**Flujos alternativos / casos borde**

- Si tanto Assets como Liabilities son $0, se muestra un estado vacío en lugar del donut.

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

_No aplica — este CU no captura datos, solo consulta información existente._

**Reglas de negocio**

- RN-253: Para este componente, "Assets" = Cash & Savings (RN-242) + Investments (RN-243), ambos en
  su valor actual. "Liabilities" reutiliza el mismo total de RN-244. Este uso de "Assets" es
  exclusivo de este componente — no debe confundirse con la card "Cash & Savings" de CU-065, que
  solo cubre una parte de este total (ver nota de nomenclatura al inicio del documento).

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

No requiere endpoint propio — se deriva en el cliente a partir de la respuesta de CU-065
(`networth-breakdown`), sumando `cash_and_savings.total + investments.total` para "Assets" y
reutilizando `liabilities.total` para "Liabilities".

*Modelo de información*

No introduce colección nueva.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Composición en frontend | Sin consulta adicional | Los tres totales que necesita ya vienen en la respuesta de CU-065; pedirlos de nuevo duplicaría la consulta |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Usuario con Assets y Liabilities | — | Donut con ambos segmentos y montos correctos | — |
| 2 | Lógica de negocio | Assets = 0 y Liabilities = 0 | — | Estado vacío | — |

**Referencia de diseño**

- Pantalla / flujo: Figma — [Networth tab](https://www.figma.com/design/McS1WiO2R2Z8sKpJBfkOx6/Finanzas-App---Artes?node-id=52-192) (card "Networth balance")

---

### CU-068 — Configurar y consultar avance hacia la meta de Networth

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario configurar un monto objetivo de Networth desde un modal
("Change goal") y consultar, dentro de la pestaña "Networth", su avance actual hacia esa meta
mediante un gauge con el porcentaje alcanzado.

**Flujo principal**

1. El usuario, dentro de la pestaña "Networth", presiona "Change goal".
2. El sistema muestra un modal con un único campo: monto objetivo.
3. El usuario captura el monto y confirma.
4. El sistema guarda el monto objetivo (un único registro por usuario, se sobreescribe si ya
   existía uno).
5. El sistema calcula el Networth actual (mismo cálculo de CU-067: Cash & Savings + Investments −
   Liabilities, valor actual) y el porcentaje de avance respecto al monto objetivo, y actualiza el
   gauge.

**Flujos alternativos / casos borde**

- Si el usuario no ha configurado ninguna meta, se muestra un estado vacío invitando a configurarla
  ("Set a goal" en vez de "Change goal"), sin gauge ni porcentaje.
- Si el Networth actual es negativo respecto al monto objetivo (resultado del cociente negativo), el
  porcentaje mostrado es `0%`.
- Si el Networth actual supera el monto objetivo, el gauge se topa visualmente en `100%`, pero el
  porcentaje mostrado en texto refleja el valor real y puede superar `100%` (ej. `142%`).
- Un monto objetivo `≤ 0` se rechaza con `VALIDATION_037`.

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Se crea o actualiza el registro de meta de Networth del usuario.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `monto_objetivo` | CurrencyInput | Sí | — | Numérico, mayor a 0 | — | — | RN-254; `VALIDATION_037` |

**Reglas de negocio**

- RN-254: La meta de Networth es un único valor configurable por usuario, sin historial de metas
  anteriores — se sobreescribe cada vez que se guarda un nuevo valor desde el modal "Change goal".
- RN-255: El porcentaje de avance = Networth actual (mismo cálculo que RN-253, restando
  Liabilities) ÷ meta configurada. Si el resultado es negativo, se muestra como `0%`. El gauge nunca
  sobrepasa visualmente el `100%`, pero el porcentaje mostrado en texto refleja el valor real, aun
  si supera `100%`.
- RN-256: Si el usuario no ha configurado ninguna meta, se muestra un estado vacío invitando a
  configurarla, sin gauge ni porcentaje.

**Casos de uso derivados identificados**

- Ninguno adicional.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `monto_objetivo` | numeric | Obligatorio; mayor a 0 | A03 — Validar tipo y rango numérico |

**Mensajes de error**

*Validación*
- `VALIDATION_037`: "El monto de la meta debe ser mayor a cero." *(nuevo)*

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/dashboard/networth-goal` | Bearer JWT |
| PUT | `/api/v1/dashboard/networth-goal` | Bearer JWT |

*Request (PUT)*
```json
{
  "monto_objetivo": 1000000.00
}
```

*Response (éxito, GET)*
```json
{
  "monto_objetivo": 1000000.00,
  "networth_actual": 124580.45,
  "porcentaje_avance": 0.1246
}
```

*Response (éxito, GET, sin meta configurada)*
```json
{
  "monto_objetivo": null,
  "networth_actual": 124580.45,
  "porcentaje_avance": null
}
```

*Modelo de información*

Introduce la tabla nueva `networth_goals` — ver detalle en [[data-model-registry]].

```json
{
  "user_id": "uuid"
}
```

| Campo | Tipo | Requerido | Default | Procedencia (CU) |
|---|---|---|---|---|
| `user_id` | uuid (FK → users.id, primary key) | Sí | — | CU-068 |
| `monto_objetivo` | numeric(14,2) | Sí | — | CU-068 (RN-254); editable, se sobreescribe (upsert) |
| `created_at` | timestamptz | Sí | `now()` | CU-068 |
| `updated_at` | timestamptz | Sí | `now()` | CU-068; se actualiza en cada cambio de meta |

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| `user_id` como primary key (no `id` propio) | Una fila por usuario, sin historial | La meta no tiene versiones — cambiarla es un upsert directo sobre la única fila del usuario, sin necesidad de un identificador propio |

*Índices*

`user_id` ya es primary key — no requiere índice adicional.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Usuario configura una meta por primera vez | `monto_objetivo=1000000` | Se crea el registro, gauge muestra el % correcto | 200 |
| 2 | Flujo exitoso | Usuario cambia una meta existente | `monto_objetivo=1500000` | Se sobreescribe el valor anterior | 200 |
| 3 | Lógica de negocio | Networth actual supera la meta | — | Gauge al 100%, texto con el % real (ej. 142%) | 200 |
| 4 | Lógica de negocio | Networth actual es negativo | — | Porcentaje mostrado como 0% | 200 |
| 5 | Lógica de negocio | Usuario sin meta configurada | — | Estado vacío, `monto_objetivo = null` | 200 |
| 6 | Validación de entrada | `monto_objetivo = 0` o negativo | `monto_objetivo=-100` | `VALIDATION_037` | 400 |
| 7 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 8 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: Figma — [Networth tab](https://www.figma.com/design/McS1WiO2R2Z8sKpJBfkOx6/Finanzas-App---Artes?node-id=52-192) (card "Networth goal")

---

### CU-069 — Consultar resumen de Income, Expenses, Savings e Investment

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, en la pestaña "Analytics" del Dashboard, cuatro
cards con el total de Income, Expenses, Savings e Investment dentro de un periodo seleccionado, cada
una con un indicador de crecimiento o caída respecto al periodo anterior equivalente.

**Flujo principal**

1. El usuario accede a la pestaña "Analytics" y selecciona un periodo: 1M, 6M, YTD, 1Y, All o un
   rango personalizado (Custom); por defecto, "1M".
2. El sistema resuelve el rango de fechas del periodo seleccionado y, salvo que sea "All", el rango
   del periodo inmediatamente anterior de igual longitud, para la comparación.
3. El sistema calcula Income (suma de `transactions` `tipo = ingreso` de categorías de grupos
   `flujo = inflow`), Expenses (suma en valor absoluto de `tipo = gasto` de grupos
   `flujo = outflow`), Savings (suma con signo invertido de `tipo` en `aportacion_meta`/
   `retiro_meta`) e Investment (suma en valor absoluto de `tipo = gasto` de grupos
   `flujo = investment`), todos dentro del rango del periodo actual.
4. El sistema repite el mismo cálculo sobre el rango del periodo anterior (si aplica) y calcula el %
   de variación de cada card.
5. El sistema muestra las cuatro cards con su monto y, salvo en "All", un indicador verde (creció) o
   rojo (disminuyó) con el % de variación.

**Flujos alternativos / casos borde**

- Con el periodo "All" no se muestra ningún indicador de variación — no hay un "periodo anterior"
  contra el cual comparar.
- Si el valor del periodo anterior es `$0`, no se muestra indicador de variación para esa card (un
  porcentaje sobre base cero no es representativo) — se muestra solo el monto actual.
- Movimientos de metas de ahorro archivadas dentro del rango del periodo sí cuentan para Savings —
  el movimiento ya ocurrió, independientemente del estado actual de la meta (mismo criterio que
  [[reportes]] aplicaba a categorías archivadas).
- En el periodo "Custom", si la fecha de inicio es posterior a la fecha de fin, se rechaza con
  `VALIDATION_036` (reutilizado de CU-066).

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `periodo` (query param) | Segmentador | No | — | Enum: `1m`, `6m`, `ytd`, `1y`, `all`, `custom` | — | `1m` | RN-261 |
| `fecha_inicio` (query param) | Date picker | Sí, solo si `periodo=custom` | — | Fecha válida | `periodo=custom` | — | RN-261 |
| `fecha_fin` (query param) | Date picker | Sí, solo si `periodo=custom` | — | Fecha válida, ≥ `fecha_inicio` | `periodo=custom` | — | RN-261 |

**Reglas de negocio**

- RN-257: Income = Σ `transactions.monto` con `tipo = ingreso` cuya categoría pertenece a un grupo
  con `flujo = inflow`, dentro del rango del periodo seleccionado.
- RN-258: Expenses = Σ `abs(transactions.monto)` con `tipo = gasto` cuya categoría pertenece a un
  grupo con `flujo = outflow`, dentro del rango del periodo seleccionado. Los grupos con
  `flujo = investment` quedan fuera — tienen su propia card (RN-260), sin traslape.
- RN-259: Savings = Σ con signo invertido de `transactions.monto` con `tipo` en `aportacion_meta` o
  `retiro_meta`, dentro del rango del periodo seleccionado (aportaciones suman, retiros restan) —
  incluye movimientos de metas archivadas si el movimiento cayó dentro del periodo.
- RN-260: Investment = Σ `abs(transactions.monto)` con `tipo = gasto` cuya categoría pertenece a un
  grupo con `flujo = investment`, dentro del rango del periodo seleccionado.
- RN-261: El periodo de comparación (para el % de variación) según el periodo seleccionado: `1m` =
  mes calendario inmediatamente anterior; `6m` = los 6 meses calendario inmediatamente anteriores;
  `ytd` = el mismo rango (1 de enero a la misma fecha) del año anterior; `1y` = los 12 meses
  inmediatamente anteriores; `custom` = el mismo número de días, inmediatamente antes de
  `fecha_inicio`; `all` = sin comparación (RN-263).
- RN-262: % de variación = `(valor_actual − valor_anterior) ÷ abs(valor_anterior)`. Si
  `valor_anterior = 0`, no se calcula (RN-263).
- RN-263: El indicador es verde si `valor_actual > valor_anterior`, rojo si `valor_actual <
  valor_anterior`, y no se muestra si son iguales, si el periodo es `all`, o si `valor_anterior = 0`
  — la dirección del indicador es siempre "creció/disminuyó", sin importar si ese cambio es
  financieramente positivo o negativo para esa card en particular (ej. un aumento en Expenses se
  muestra en verde, igual que un aumento en Income).

**Casos de uso derivados identificados**

- Ninguno adicional.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `periodo` | enum | Uno de `1m`, `6m`, `ytd`, `1y`, `all`, `custom` | A03 — Validar contra catálogo cerrado |
| `fecha_inicio`, `fecha_fin` | date | Obligatorias si `periodo=custom`; `fecha_fin ≥ fecha_inicio` | A03 — Validar formato y rango de fecha |

**Mensajes de error**

*Validación*
- `VALIDATION_036`: "La fecha final no puede ser anterior a la fecha inicial." *(reutilizado de CU-066)*

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/dashboard/analytics-summary?periodo={periodo}&fecha_inicio={fecha_inicio}&fecha_fin={fecha_fin}` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)*
```json
{
  "periodo": "1m",
  "income": { "monto": 38420.00, "monto_anterior": 34560.00, "variacion": 0.1117 },
  "expenses": { "monto": 24910.00, "monto_anterior": 26290.00, "variacion": -0.0525 },
  "savings": { "monto": 1200.00, "monto_anterior": 900.00, "variacion": 0.3333 },
  "investment": { "monto": 3500.00, "monto_anterior": 3500.00, "variacion": null }
}
```

*Modelo de información*

No introduce colección nueva — consulta agregada sobre `transactions`, `categories` y
`savings_goals`.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Agregación en tiempo de consulta | Cálculo derivado, no persistido | Mismo patrón que el resto del Dashboard |
| Resolución de periodo/comparación compartida con Networth | Helper común (`src/lib/date-periods.ts`) | CU-066 (Networth) y este CU usan el mismo vocabulario de periodo (`1m`/`6m`/`ytd`/`1y`/`all`/`custom`); se generaliza en un solo lugar en vez de duplicar la lógica de rangos |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Usuario con movimientos en las 4 categorías, periodo `1m` | `periodo=1m` | 4 montos correctos, con % de variación | 200 |
| 2 | Lógica de negocio | Periodo `all` | `periodo=all` | Sin indicador de variación en ninguna card | 200 |
| 3 | Lógica de negocio | `valor_anterior = 0` en una card | — | Esa card no muestra indicador | 200 |
| 4 | Lógica de negocio | Meta de ahorro archivada con movimientos en el periodo | — | Cuentan para Savings | 200 |
| 5 | Validación de entrada | `custom` con `fecha_fin < fecha_inicio` | — | `VALIDATION_036` | 400 |
| 6 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 7 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: Figma — [Analytics tab](https://www.figma.com/design/McS1WiO2R2Z8sKpJBfkOx6/Finanzas-App---Artes?node-id=64-303) (cards de resumen)

---

### CU-070 — Consultar gráfica de Cash Flow (Income vs Expenses)

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, dentro de la pestaña "Analytics", una gráfica de
línea comparando Income vs Expenses a lo largo del tiempo, para el periodo seleccionado — mismo
segmentador de periodo que CU-069.

**Flujo principal**

1. El usuario, dentro de "Analytics", visualiza la card "Cash Flow" (comparte el periodo
   seleccionado en CU-069).
2. El sistema determina el rango de meses correspondiente al periodo seleccionado.
3. Para cada mes del rango, el sistema calcula Income y Expenses de ese mes (mismos criterios de
   RN-257/RN-258, acotados al mes).
4. El sistema devuelve la serie mensual de ambas series, lista para graficarse como dos líneas.

**Flujos alternativos / casos borde**

- La granularidad es siempre mensual, sin importar el periodo seleccionado — mismo criterio que
  RN-250 de Networth (CU-066).
- Si el usuario no tiene ningún movimiento de ingreso o gasto, se muestra un estado vacío en vez de
  la gráfica.

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

_Comparte los mismos parámetros de periodo que CU-069 — ver esa tabla._

**Reglas de negocio**

- RN-264: La granularidad del histórico es siempre mensual, sin importar el periodo seleccionado.
- RN-265: El rango de meses se resuelve con el mismo mecanismo que RN-251 (Networth, CU-066),
  generalizado vía el helper compartido de periodo.
- RN-266: Income y Expenses de cada punto usan los mismos criterios de RN-257/RN-258, acotados al
  mes de ese punto (sin acumular entre meses).

**Casos de uso derivados identificados**

- Ninguno adicional.

**Validaciones**

_Comparte las mismas validaciones de periodo que CU-069._

**Mensajes de error**

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/dashboard/analytics-cash-flow?periodo={periodo}&fecha_inicio={fecha_inicio}&fecha_fin={fecha_fin}` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)*
```json
{
  "meses": [
    { "mes": "2026-07", "income": 35200.00, "expenses": 22100.00 },
    { "mes": "2026-08", "income": 38420.00, "expenses": 24910.00 }
  ]
}
```

*Modelo de información*

No introduce colección nueva — consulta agregada sobre `transactions` y `categories`.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Agregación en tiempo de consulta | Cálculo derivado, no persistido | Mismo patrón que CU-069 y el resto del Dashboard |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Usuario con ingresos y gastos en varios meses | `periodo=1y` | Serie mensual de ambas líneas | 200 |
| 2 | Lógica de negocio | Usuario sin movimientos | — | Estado vacío | 200 |
| 3 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 4 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: Figma — [Analytics tab](https://www.figma.com/design/McS1WiO2R2Z8sKpJBfkOx6/Finanzas-App---Artes?node-id=64-303) (card "Cash Flow")

---

### CU-071 — Consultar distribución por categoría de cada grupo

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar, dentro de la pestaña "Analytics", una card por
cada grupo activo de categorías del usuario (Inflow, Outflow e Investment por igual), con una
gráfica de barras horizontales de sus categorías internas, ordenadas de mayor a menor monto dentro
del periodo seleccionado.

**Flujo principal**

1. El usuario, dentro de "Analytics", visualiza la cuadrícula de cards de distribución (comparte el
   periodo seleccionado en CU-069).
2. El sistema identifica los grupos activos de categorías del usuario.
3. Para cada grupo, el sistema calcula el monto de cada una de sus categorías dentro del periodo
   seleccionado (`tipo = ingreso` para grupos `inflow`, `tipo = gasto` para `outflow`/`investment`).
4. El sistema muestra una card por grupo, con sus categorías ordenadas de mayor a menor monto como
   barras horizontales.

**Flujos alternativos / casos borde**

- Solo se muestran categorías con monto mayor a `$0` dentro del periodo; si ninguna categoría del
  grupo tuvo actividad, la card de ese grupo muestra un estado vacío en vez de barras.
- La cuadrícula de cards no crece en alto de forma ilimitada — el contenedor tiene una altura fija
  con scroll vertical propio (RN-269), para que la pantalla no se alargue con la cantidad de grupos
  del usuario.

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

_Comparte los mismos parámetros de periodo que CU-069 — ver esa tabla._

**Reglas de negocio**

- RN-267: Se muestra una card por cada grupo de categorías `status = active` del usuario —
  `flujo = inflow`, `outflow` e `investment` por igual (a diferencia de RN-090 de [[reportes]],
  retirado, que excluía los grupos Inflow del ranking de gasto — aquí no hay tal exclusión, todos
  los grupos se muestran).
- RN-268: Dentro de cada card, solo se muestran las categorías con monto mayor a `$0` en el periodo
  seleccionado, ordenadas de mayor a menor. Si ninguna categoría del grupo tiene actividad, se
  muestra un estado vacío en la card.
- RN-269: La cuadrícula de cards se presenta en un contenedor de altura fija con scroll vertical
  propio, en vez de crecer en alto según la cantidad de grupos — decisión de presentación en
  frontend, sin impacto en el modelo de datos (mismo criterio que RN-228 de Balance para el estilo
  de carrusel).

**Casos de uso derivados identificados**

- Ninguno adicional.

**Validaciones**

_Comparte las mismas validaciones de periodo que CU-069._

**Mensajes de error**

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/dashboard/analytics-category-distribution?periodo={periodo}&fecha_inicio={fecha_inicio}&fecha_fin={fecha_fin}` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)* — categorías ya vienen ordenadas por RN-268:
```json
{
  "grupos": [
    {
      "grupo_id": "665f...g01",
      "nombre": "Bills",
      "flujo": "outflow",
      "color": "#EF4444",
      "categorias": [
        { "categoria_id": "665f...c01", "nombre": "Rent", "monto": 1200.00 },
        { "categoria_id": "665f...c02", "nombre": "Electricity", "monto": 340.50 }
      ]
    }
  ]
}
```

*Modelo de información*

No introduce colección nueva — consulta agregada sobre `transactions` y `categories`.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Agregación en tiempo de consulta | Cálculo derivado, no persistido | Mismo patrón que CU-069/CU-070 |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Usuario con movimientos en varios grupos | — | Una card por grupo, categorías ordenadas por RN-268 | 200 |
| 2 | Lógica de negocio | Grupo sin actividad en el periodo | — | Estado vacío en esa card | 200 |
| 3 | Lógica de negocio | Grupo `flujo = inflow` | — | Sí aparece (RN-267, a diferencia del viejo RN-090) | 200 |
| 4 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 5 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: Figma — [Analytics tab](https://www.figma.com/design/McS1WiO2R2Z8sKpJBfkOx6/Finanzas-App---Artes?node-id=64-303) (cuadrícula de barras horizontales)

---

## Historial de cambios

| Fecha | Cambio | CU afectado | Impacto en otros documentos |
|---|---|---|---|
| 2026-08-26 | Se documenta la pestaña Balance del módulo Dashboard: balance total + cards de cuentas débito/efectivo (imagen, orden, carrusel), evolución mensual de balance (año navegable limitado a años con datos), resumen de tarjetas de crédito (utilización, disponible, orden, carrusel) con el indicador de gasto mínimo recalculado por ciclo de corte en vez de mes calendario, y evolución mensual de gasto por tarjeta. Se agregan CU-061 a CU-064, RN-225 a RN-241 (incluye RN-241, total de tarjetas de crédito, agregada durante la construcción en código). No se crean colecciones ni campos nuevos — agregación en tiempo de consulta sobre `accounts` y `transactions`, reutilizando `accounts.dia_corte` (ya existente desde [[cuentas]]) para el cálculo del ciclo de corte. Networth y Analytics quedan pendientes de documentar. Aprovechando esta revisión, se detectó y corrige una inconsistencia de formato en toda la plataforma (no específica de este módulo): montos siempre a 2 decimales, porcentajes a 1 decimal salvo que sea `.0`, en cuyo caso se muestra sin decimales — ver commit correspondiente. | CU-061, CU-062, CU-063, CU-064 | Se actualiza [[data-model-registry]] con el índice de numeración (hasta CU-064 / RN-240) y una nota de sucesión funcional sobre [[reportes]] — sin nuevas colecciones que registrar. |
| 2026-08-26 | Se documenta la pestaña Networth del módulo Dashboard — territorio nuevo, no sucede a ningún CU de [[reportes]]. Se agregan CU-065 a CU-068: desglose de Cash & Savings/Investments/Liabilities, histórico de Networth total con selector de periodo, comparativo Assets vs Liabilities, y meta de Networth configurable. Se introduce la tabla `networth_goals`. Analytics queda pendiente. | CU-065, CU-066, CU-067, CU-068 | Se actualiza [[data-model-registry]] con el índice de numeración (hasta CU-068 / RN-256 / VALIDATION_037), la tabla `networth_goals`, sus relaciones y el diagrama ER — ver el detalle completo en el historial de [[data-model-registry]]. |
| 2026-08-28 | Se documenta la pestaña Analytics del módulo Dashboard, la última del alcance completo: cuatro cards de resumen (Income, Expenses, Savings, Investment) con comparativo contra el periodo anterior equivalente, gráfica de Cash Flow (Income vs Expenses, granularidad siempre mensual) y una card de barras horizontales por cada grupo de categorías del usuario. Se agregan CU-069 a CU-071, RN-257 a RN-269. **Cambio previo, disparado por esta pestaña:** `categories.flujo` gana un tercer valor estructural, `investment` (antes un subconjunto de Outflow distinguido por nombre exacto) — ver changelog de [[categorias]] del mismo día. Con esto, Expenses e Investment nunca se traslapan sin depender de un nombre de grupo. Suceden funcionalmente a CU-027, CU-028 y CU-030 de [[reportes]] (resumen por grupo, distribución de gasto por categoría, ingresos vs. gastos) — CU-031 (frecuencia de transacciones) no se retoma, queda en [[backlog]]. Los números `CU-023`–`CU-031`/`RN-076`–`RN-097` de [[reportes]] no se reutilizan ni se renumeran. No se crean colecciones nuevas — 100% agregación en tiempo de consulta sobre `transactions`, `categories` y `savings_goals`. Con esta pestaña se completa la construcción en código de todo el alcance definido del producto. | CU-069, CU-070, CU-071 | Se actualiza [[data-model-registry]] con el índice de numeración (hasta CU-071 / RN-269) y la nota de sucesión final sobre [[reportes]]. |

## Referencias

- [[estrategia]]
- [[brief-ux]]
- [[data-model-registry]]
- [[cuentas]]
- [[transacciones]]
- [[categorias]]
- [[presupuesto]]
- [[ahorros-y-metas]]
- [[inversiones]]
- [[creditos-deudas]]
- [[reportes]]
