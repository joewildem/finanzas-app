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

**Balance** (esta entrega) informa sobre el dinero disponible: balance total y cards de cuentas de
débito/efectivo, su evolución mensual, y el resumen de tarjetas de crédito (utilización, disponible,
y avance de gasto contra el mínimo mensual por ciclo de corte) junto con su evolución de gasto
mensual. **Networth** y **Analytics** quedan pendientes de documentar.

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

## Historial de cambios

| Fecha | Cambio | CU afectado | Impacto en otros documentos |
|---|---|---|---|
| 2026-08-26 | Se documenta la pestaña Balance del módulo Dashboard: balance total + cards de cuentas débito/efectivo (imagen, orden, carrusel), evolución mensual de balance (año navegable limitado a años con datos), resumen de tarjetas de crédito (utilización, disponible, orden, carrusel) con el indicador de gasto mínimo recalculado por ciclo de corte en vez de mes calendario, y evolución mensual de gasto por tarjeta. Se agregan CU-061 a CU-064, RN-225 a RN-241 (incluye RN-241, total de tarjetas de crédito, agregada durante la construcción en código). No se crean colecciones ni campos nuevos — agregación en tiempo de consulta sobre `accounts` y `transactions`, reutilizando `accounts.dia_corte` (ya existente desde [[cuentas]]) para el cálculo del ciclo de corte. Networth y Analytics quedan pendientes de documentar. Aprovechando esta revisión, se detectó y corrige una inconsistencia de formato en toda la plataforma (no específica de este módulo): montos siempre a 2 decimales, porcentajes a 1 decimal salvo que sea `.0`, en cuyo caso se muestra sin decimales — ver commit correspondiente. | CU-061, CU-062, CU-063, CU-064 | Se actualiza [[data-model-registry]] con el índice de numeración (hasta CU-064 / RN-240) y una nota de sucesión funcional sobre [[reportes]] — sin nuevas colecciones que registrar. |

## Referencias

- [[estrategia]]
- [[brief-ux]]
- [[data-model-registry]]
- [[cuentas]]
- [[transacciones]]
- [[reportes]]
