---
modulo: "Inversiones"
status: cerrado
---

# Requerimientos — Inversiones

## Resumen del módulo

El módulo de Inversiones permite al usuario mantener el registro de los instrumentos que componen su
portafolio (ticker, nombre, grupo y tipo de activo), definir la distribución objetivo del capital
entre ellos, capturar el balance actual de cada uno, y calcular cómo repartir la siguiente
aportación para acercarse a esa distribución. A diferencia del resto de los módulos del sistema,
**Inversiones no ejecuta ni registra movimientos de dinero**: el capital que entra al portafolio ya
se captura en [[transacciones]] como un `gasto` con categoría del grupo "Investment", y
[[reportes]] ya lo excluye del gasto real del periodo (RN-094). En consecuencia, `balance_actual`
es un **dato capturado manualmente** — una foto del valor de mercado — y no un derivado de
`transactions`, a diferencia de `accounts.saldo_actual` o de `savings_goals.monto_aportado_actual`.

El módulo introduce dos tablas nuevas: `investments` (los instrumentos) e
`investment_balance_history` (una fila por instrumento y fecha de captura, sin pantalla propia, cuyo
único fin es que el módulo consolidado de Dashboard + Reportes pueda reconstruir el patrimonio
invertido en el tiempo — un dato que no es recuperable retroactivamente si no se captura en el
momento). El seguimiento de precios, rendimiento e histórico de mercado queda deliberadamente fuera
de alcance: se resuelve en Yahoo Finance, al que el módulo enlaza directamente.

## Casos de uso

### CU-049 — Registrar instrumento de inversión

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario dar de alta un instrumento en su portafolio, capturando su
ticker, su nombre completo, el grupo de activo y el tipo de activo al que pertenece, y
opcionalmente el balance con el que cuenta a la fecha. El instrumento nace siempre **inactivo y con
distribución objetivo en 0%**, de modo que el alta nunca pueda romper la regla que exige que los
instrumentos activos sumen exactamente 100%. Activarlo y asignarle un porcentaje objetivo es una
operación posterior, que ocurre en la configuración del portafolio (CU-052) junto con la
redistribución del resto.

**Flujo principal**

1. El usuario accede a "Agregar instrumento" desde la vista de portafolio (CU-050).
2. El sistema muestra el formulario: ticker, nombre, grupo de activo, tipo de activo y balance
   actual (opcional).
3. El usuario captura los datos y confirma.
4. El sistema valida los datos ingresados.
5. El sistema crea el registro en `investments` con `status = inactivo` y
   `porcentaje_objetivo = 0`.
6. Si se capturó un balance mayor a cero, el sistema registra la primera fila del histórico de
   balances con la fecha del día.
7. El sistema muestra el instrumento recién creado en la tabla de instrumentos inactivos.

**Flujos alternativos / casos borde**

- Si el usuario no captura balance actual, el instrumento se crea con balance en `0` y sin fila de
  histórico — un instrumento registrado antes de invertir en él es un estado válido.
- Si el ticker ya existe en el portafolio del usuario, el sistema rechaza el alta, sin importar si
  el instrumento existente está activo o inactivo.
- El usuario no puede asignar porcentaje objetivo ni estado activo desde este formulario: ambos
  campos no se presentan.

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Se crea un registro en `investments` con `status = inactivo` y `porcentaje_objetivo = 0`.
- Se crea, en su caso, una fila en `investment_balance_history` con la fecha del día.
- El instrumento queda disponible para activarse y recibir distribución objetivo en CU-052.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `ticker` | Texto | Sí | 1–20 | Alfanumérico con espacios, guiones y puntos; único por usuario sin importar `status` | — | — | RN-153 |
| `nombre` | Texto | Sí | 2–120 | Texto libre | — | — | — |
| `grupo_activo` | Selección (catálogo cerrado) | Sí | N/A | Uno de: `Large Cap`, `Small Cap`, `REIT`, `Developed Markets`, `Emerging Markets`, `Treasury Bonds`, `Crypto`, `Retirement` | — | — | RN-155 |
| `tipo_activo` | Selección (catálogo cerrado) | Sí | N/A | Uno de: `Stock`, `ETF`, `Bond`, `Fund`, `Crypto`, `Real Estate`, `PPR` | — | — | RN-155 |
| `balance_actual` | Numérico | No | N/A | Número mayor o igual a cero, hasta 2 decimales | — | `0` | RN-156, RN-157, RN-158 |

**Reglas de negocio**

- RN-153: `ticker` debe ser único entre **todos** los instrumentos del usuario, sin importar su
  `status`. A diferencia de `savings_goals.nombre` (único solo entre metas activas, RN-107), un
  instrumento inactivo sigue conservando capital real, por lo que nunca debe existir un duplicado
  que fragmente el balance de una misma posición.
- RN-154: todo instrumento nace en `status = inactivo` con `porcentaje_objetivo = 0`. El alta nunca
  puede alterar la suma de la distribución objetivo (RN-172); la activación y la asignación de
  porcentaje ocurren exclusivamente en CU-052.
- RN-155: `grupo_activo` y `tipo_activo` son catálogos cerrados definidos a nivel de esquema (enum),
  no administrables por el usuario en esta versión. Sus valores se conservan en inglés por
  corresponder a la terminología que el usuario maneja en sus plataformas de inversión.
- RN-156: `balance_actual` es un dato capturado manualmente que representa el valor de mercado del
  instrumento a la fecha de captura. **No se deriva de `transactions` ni se modifica por ninguna
  transacción del grupo "Investment"** — el valor de mercado se mueve de forma independiente al
  capital aportado, por lo que no es reconstruible desde el historial de movimientos.
- RN-157: `balance_actual` debe ser un número mayor o igual a cero, con hasta 2 decimales. El valor
  `0` es válido (instrumento registrado sin capital, o posición liquidada).
- RN-158: si `balance_actual` es mayor a cero al momento del alta, se registra la primera fila de
  `investment_balance_history` con `fecha = CURRENT_DATE`, bajo el mismo mecanismo de RN-178.

**Casos de uso derivados identificados**

- Aplica el patrón CRUD: la consulta se resuelve en CU-050, la edición de la ficha en CU-051 y la
  eliminación en CU-054. El cambio de estado **no** se documenta como caso de uso independiente —
  se resuelve dentro de CU-052 (RN-180).
- No se genera un caso de uso de búsqueda y filtrado: el portafolio se presenta completo en dos
  tablas dentro de CU-050 y el volumen esperado (decenas de instrumentos) no lo justifica.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `ticker` | string | Requerido, 1–20 caracteres, único por usuario sin importar estado | A03 — Sanitizar entrada; A07 — Codificar en salida |
| `nombre` | string | Requerido, 2–120 caracteres | A03 — Sanitizar entrada; A07 — Codificar en salida |
| `grupo_activo` | string (enum) | Requerido; solo valores del catálogo cerrado | A03 — Validación estricta de enum en backend |
| `tipo_activo` | string (enum) | Requerido; solo valores del catálogo cerrado | A03 — Validación estricta de enum en backend |
| `balance_actual` | number | Opcional, decimal mayor o igual a cero | A03 — Validar tipo y rango numérico |

**Mensajes de error**

*Validación*
- `VALIDATION_001`: "El campo {campo} es obligatorio." *(reutilizado)*
- `VALIDATION_027`: "Ya tienes un instrumento con ese ticker."
- `VALIDATION_006`: "El monto no puede ser negativo." *(reutilizado)*
- `VALIDATION_031`: "El grupo de activo seleccionado no es válido."
- `VALIDATION_032`: "El tipo de activo seleccionado no es válido."

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| POST | `/api/v1/investments` | Bearer JWT |

*Request*
```json
{
  "ticker": "string (requerido, 1-20)",
  "nombre": "string (requerido, 2-120)",
  "grupo_activo": "string (requerido, enum)",
  "tipo_activo": "string (requerido, enum)",
  "balance_actual": "number (opcional, >= 0, default: 0)"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "ticker": "string",
    "nombre": "string",
    "grupo_activo": "string",
    "tipo_activo": "string",
    "porcentaje_objetivo": 0,
    "balance_actual": "number",
    "balance_actualizado_en": "date|null",
    "status": "inactivo",
    "created_at": "timestamptz"
  },
  "message": "Instrumento registrado exitosamente."
}
```

*Modelo de información*
```json
// Tabla: investments (nueva, Postgres/Supabase)
{
  "id": "uuid",
  "user_id": "uuid (FK → users.id)",
  "ticker": "text",
  "nombre": "text",
  "grupo_activo": "text (enum: Large Cap, Small Cap, REIT, Developed Markets, Emerging Markets, Treasury Bonds, Crypto, Retirement)",
  "tipo_activo": "text (enum: Stock, ETF, Bond, Fund, Crypto, Real Estate, PPR)",
  "porcentaje_objetivo": "numeric(5,2)",
  "balance_actual": "numeric(14,2)",
  "status": "text (enum: activo, inactivo)",
  "created_at": "timestamptz",
  "updated_at": "timestamptz"
}
```
> Registrar en [[data-model-registry]] al cerrar el módulo. Política RLS: `auth.uid() = user_id`.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| `investments.user_id → users` | Referenciado (FK) | Igual que `accounts.user_id` — cada instrumento pertenece a un usuario |
| `grupo_activo` / `tipo_activo` | Enum en la propia tabla, no FK a `categories` | Son dos taxonomías **ortogonales** (un instrumento tiene grupo *y* tipo, independientes entre sí), incompatibles con la jerarquía de un nivel grupo→categoría de `categories`. Además, `categories` clasifica transacciones; reutilizarla contaminaría el selector de categorías al capturar un gasto |
| `balance_actual` | Capturado manualmente, **no** derivado de `transactions` | El valor de mercado se mueve independientemente del capital aportado; a diferencia de `savings_goals.monto_aportado_actual` (RN-113), no es reconstruible desde el historial de movimientos |

*Índices*

| Tabla | Campos | Tipo | Propósito |
|---|---|---|---|
| `investments` | `(user_id, ticker)` | Único compuesto | Garantizar unicidad del ticker por usuario sin importar el estado (RN-153) |
| `investments` | `(user_id, status)` | B-tree compuesto | Separar instrumentos activos e inactivos en la vista de portafolio (CU-050) |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Alta con datos mínimos | `ticker`, `nombre`, `grupo_activo`, `tipo_activo` | Instrumento creado con `status=inactivo`, `porcentaje_objetivo=0`, `balance_actual=0`, sin fila de histórico | 201 |
| 2 | Flujo exitoso | Alta con balance inicial | Todos los campos, `balance_actual=8100.31` | Instrumento creado y primera fila de histórico con fecha de hoy | 201 |
| 3 | Validación de entrada | Campo obligatorio faltante | Sin `ticker` o sin `grupo_activo` | `VALIDATION_001` | 400 |
| 4 | Validación de entrada | Ticker duplicado con instrumento inactivo | `ticker` de un instrumento inactivo existente | `VALIDATION_027` | 409 |
| 5 | Validación de entrada | Valor fuera del catálogo | `tipo_activo="Commodity"` | `VALIDATION_032` | 400 |
| 6 | Validación de entrada | Balance negativo | `balance_actual=-50` | `VALIDATION_006` | 400 |
| 7 | Lógica de negocio | Intento de crear directamente activo | `status="activo"` en el payload | Campo ignorado; instrumento creado inactivo (RN-154) | 201 |
| 8 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 9 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-inversiones-alta]]

---

### CU-050 — Consultar portafolio de inversión

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar el estado completo de su portafolio en una sola
pantalla: dos tablas independientes (instrumentos activos e inactivos), dos indicadores de total
(portafolio completo y portafolio activo), un desglose de exposición por grupo y por tipo de activo,
y un indicador de qué tan reciente es la captura de balances. Para cada instrumento activo el
sistema calcula el porcentaje que representa hoy dentro del portafolio activo y la diferencia en
pesos respecto a su porcentaje objetivo, permitiendo detectar de un vistazo qué posiciones están
por debajo o por encima de la distribución deseada. La vista incluye además el acceso directo al
portafolio en Yahoo Finance, donde el usuario consulta precios, gráficas y rendimiento — información
que este módulo no replica.

**Flujo principal**

1. El usuario accede a la sección "Inversiones".
2. El sistema recupera todos los instrumentos del usuario y los separa por `status`.
3. El sistema calcula el total del portafolio activo y el total general.
4. Para cada instrumento activo, el sistema calcula su porcentaje actual sobre el total activo y su
   diferencia en pesos respecto al objetivo.
5. Para cada instrumento inactivo, el sistema calcula el porcentaje que representa sobre el total
   general.
6. El sistema calcula el desglose de exposición por grupo y por tipo de activo sobre el total
   general.
7. El sistema determina la fecha de última actualización de balances, global y por instrumento.
8. El sistema presenta las dos tablas, los indicadores, el desglose y el acceso al portafolio
   externo.

**Flujos alternativos / casos borde**

- Si el usuario no tiene ningún instrumento registrado, el sistema muestra un estado vacío con el
  acceso directo a "Agregar instrumento" (CU-049).
- Si el total del portafolio activo es cero, los porcentajes actuales y las diferencias se muestran
  como no disponibles (—) en vez de intentar dividir entre cero.
- Si no existe ningún instrumento activo, la tabla de activos se muestra vacía y los indicadores del
  portafolio activo se presentan en cero; la tabla de inactivos y el total general se muestran
  normalmente.
- Si un instrumento nunca ha tenido captura de balance, su indicador de última actualización se
  muestra vacío en lugar de una fecha.
- En viewport móvil, cada tabla se presenta como lista de tarjetas por instrumento (RN-167).

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura.

**Definición detallada de campos**

_Caso de uso de solo lectura, sin captura de datos. Los valores presentados se derivan íntegramente
de `investments` e `investment_balance_history`._

**Reglas de negocio**

- RN-159: `total_activo` es la suma de `balance_actual` de los instrumentos en `status = activo`.
- RN-160: `total_general` es la suma de `balance_actual` de todos los instrumentos del usuario, sin
  importar su estado.
- RN-161: `porcentaje_actual` de un instrumento activo = `balance_actual ÷ total_activo`. Se calcula
  exclusivamente sobre el conjunto activo, nunca sobre el total general, porque la distribución
  objetivo solo aplica al capital que el usuario sigue aportando. Si `total_activo` es cero, el
  valor se presenta como no disponible.
- RN-162: `diferencia` de un instrumento activo = `balance_actual − ((porcentaje_objetivo ÷ 100) ×
  total_activo)`. Un valor negativo indica que el instrumento está por debajo de su objetivo y un
  valor positivo que lo rebasa. Se calcula sobre el total activo **actual**, sin considerar ninguna
  aportación pendiente — a diferencia del cálculo de CU-053, que proyecta sobre el total más la
  aportación.
- RN-163: los instrumentos inactivos no participan en ningún cálculo de porcentaje objetivo,
  porcentaje actual ni diferencia. Se presentan con `porcentaje_del_total` = `balance_actual ÷
  total_general`, dato informativo sin regla asociada.
- RN-164: el desglose de exposición por `grupo_activo` y por `tipo_activo` se calcula sobre
  `total_general` (activos e inactivos), no sobre el conjunto activo, porque describe la exposición
  real del patrimonio invertido y no la distribución objetivo. Es una vista de solo lectura, sin
  configuración ni umbrales.
- RN-165: `balance_actualizado_en` de un instrumento es la fecha máxima registrada en
  `investment_balance_history` para ese instrumento; `ultima_actualizacion_portafolio` es la fecha
  máxima entre todos los instrumentos del usuario. Ambos son campos calculados en tiempo de
  consulta, no persistidos — mismo patrón que `disponible` en [[cuentas]].
- RN-166: el acceso al portafolio externo es un enlace fijo a `https://finance.yahoo.com/portfolios`,
  no configurable por el usuario. En web abre en pestaña nueva; en la aplicación híbrida se abre en
  el navegador del sistema, no en un webview embebido, para que el usuario conserve su sesión de
  Yahoo Finance.
- RN-167: en viewport móvil, ambas tablas se presentan como lista de tarjetas por instrumento en
  lugar de tabla de columnas, dado que el número de columnas de la vista de escritorio no es
  legible en pantallas angostas.
- RN-168: este caso de uso no persiste ningún dato ni modifica el estado de ningún instrumento.

**Casos de uso derivados identificados**

- No se genera un caso de uso independiente de búsqueda y filtrado: la separación activo/inactivo ya
  segmenta el listado y el volumen esperado de instrumentos no justifica filtros adicionales.
- El detalle individual de un instrumento no se documenta como caso de uso aparte: toda la
  información relevante ya vive en el renglón de la tabla, y el histórico de balances no tiene
  presentación en este módulo (RN-179).

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| — | — | Sin parámetros de entrada; el alcance de los datos se resuelve por `user_id` del token | A01 — Filtrado obligatorio por `auth.uid()` vía RLS, nunca por parámetro del cliente |

**Mensajes de error**

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/investments/portfolio` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "totales": {
      "total_general": 56507.51,
      "total_activo": 18665.60,
      "ultima_actualizacion_portafolio": "2026-08-23"
    },
    "activos": [
      {
        "id": "uuid",
        "ticker": "PPR",
        "nombre": "Fintual",
        "grupo_activo": "Retirement",
        "tipo_activo": "PPR",
        "porcentaje_objetivo": 55.00,
        "balance_actual": 8100.31,
        "porcentaje_actual": 43.40,
        "diferencia": -2165.77,
        "balance_actualizado_en": "2026-08-23"
      }
    ],
    "inactivos": [
      {
        "id": "uuid",
        "ticker": "SPYM",
        "nombre": "State Street SPDR Portfolio S&P 500 ETF",
        "grupo_activo": "Large Cap",
        "tipo_activo": "ETF",
        "balance_actual": 19917.95,
        "porcentaje_del_total": 35.25,
        "balance_actualizado_en": "2026-07-28"
      }
    ],
    "desglose_por_grupo": [
      { "grupo_activo": "Large Cap", "monto": 24752.38, "porcentaje": 43.80 }
    ],
    "desglose_por_tipo": [
      { "tipo_activo": "ETF", "monto": 41338.42, "porcentaje": 73.16 }
    ],
    "portafolio_externo_url": "https://finance.yahoo.com/portfolios"
  }
}
```

*Modelo de información*
```json
// Sin cambios de esquema: agregación en tiempo de consulta sobre
// investments e investment_balance_history
{}
```
> Todos los valores calculados de esta vista (`total_activo`, `total_general`,
> `porcentaje_actual`, `diferencia`, `porcentaje_del_total`, desgloses,
> `balance_actualizado_en`) se derivan al vuelo y **no se persisten**.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| `porcentaje_actual`, `diferencia`, totales y desgloses | Calculados en tiempo de consulta, no persistidos | Mismo criterio que `disponible` en [[cuentas]] y los cálculos de [[presupuesto]] — no pueden desincronizarse del dato base |
| `balance_actualizado_en` | Derivado de `MAX(fecha)` en `investment_balance_history` | Evita duplicar la fecha en `investments`; el histórico ya es la fuente de verdad de cuándo se capturó cada valor |

*Índices*

| Tabla | Campos | Tipo | Propósito |
|---|---|---|---|
| `investments` | `(user_id, status)` | B-tree compuesto | Separar activos e inactivos en una sola consulta *(reutilizado de CU-049)* |
| `investment_balance_history` | `(investment_id, fecha desc)` | B-tree compuesto | Obtener la fecha de última captura por instrumento |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Portafolio con activos e inactivos | Usuario con 12 instrumentos, 6 activos | Dos listas separadas, totales correctos, suma de `porcentaje_actual` de activos = 100 | 200 |
| 2 | Flujo exitoso | Cálculo de diferencia | Activo al 55% objetivo con balance por debajo | `diferencia` negativa; instrumento por encima del objetivo devuelve `diferencia` positiva | 200 |
| 3 | Flujo exitoso | Desglose por grupo y tipo | Portafolio mixto | Desgloses calculados sobre `total_general`, suma de porcentajes = 100 | 200 |
| 4 | Lógica de negocio | Portafolio activo en cero | Todos los activos con `balance_actual=0` | `porcentaje_actual` y `diferencia` como no disponibles, sin división entre cero | 200 |
| 5 | Lógica de negocio | Sin instrumentos activos | Solo instrumentos inactivos | Lista de activos vacía, `total_activo=0`, lista de inactivos y `total_general` correctos | 200 |
| 6 | Recurso no encontrado | Usuario sin instrumentos | Portafolio vacío | Listas vacías y totales en cero, sin error | 200 |
| 7 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 8 | Autenticación / autorización | Aislamiento entre usuarios | Usuario A consulta con sesión propia | Solo devuelve instrumentos de A, nunca de otro usuario | 200 |
| 9 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-inversiones-portafolio]]

---

### CU-051 — Editar instrumento de inversión

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario corregir la ficha descriptiva de un instrumento ya
registrado: su ticker, su nombre completo, su grupo de activo y su tipo de activo. Los campos
sujetos a la regla de conjunto del portafolio — porcentaje objetivo, balance actual y estado — **no
se editan aquí**: viven en la configuración del portafolio (CU-052), porque no pueden validarse de
forma aislada sobre un solo instrumento.

**Flujo principal**

1. El usuario selecciona "Editar" sobre un instrumento desde cualquiera de las dos tablas (CU-050).
2. El sistema muestra el formulario precargado con los valores actuales de la ficha.
3. El usuario modifica uno o más campos y confirma.
4. El sistema valida los datos ingresados.
5. El sistema actualiza el registro en `investments` y refresca la vista de portafolio.

**Flujos alternativos / casos borde**

- Si el usuario cambia el ticker a uno que ya usa otro instrumento propio, el sistema rechaza el
  cambio, sin importar el estado de aquel instrumento.
- Cambiar el grupo o el tipo de activo no altera balances, porcentajes ni el histórico — solo
  reclasifica al instrumento dentro del desglose de exposición (RN-164).
- Un instrumento puede editarse tanto en estado activo como inactivo, sin restricción.

**Precondiciones**

- El usuario debe estar autenticado.
- El instrumento debe existir y pertenecer al usuario autenticado.

**Postcondiciones**

- El registro de `investments` queda actualizado, con `updated_at` refrescado.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `ticker` | Texto | Sí | 1–20 | Único por usuario, excluyendo el propio `id` | — | valor actual | RN-153, RN-170 |
| `nombre` | Texto | Sí | 2–120 | Texto libre | — | valor actual | — |
| `grupo_activo` | Selección (catálogo cerrado) | Sí | N/A | Uno de los valores del catálogo | — | valor actual | RN-155, RN-171 |
| `tipo_activo` | Selección (catálogo cerrado) | Sí | N/A | Uno de los valores del catálogo | — | valor actual | RN-155, RN-171 |

**Reglas de negocio**

- RN-169: este caso de uso edita únicamente la ficha descriptiva del instrumento.
  `porcentaje_objetivo`, `balance_actual` y `status` no son editables aquí — están sujetos a la
  regla del 100% (RN-172), que es una propiedad del conjunto de instrumentos activos y no puede
  evaluarse sobre un instrumento aislado.
- RN-170: al modificar `ticker` se revalida la unicidad de RN-153, excluyendo el propio `id` del
  instrumento en edición.
- RN-171: modificar `grupo_activo` o `tipo_activo` no tiene efecto sobre balances, porcentajes,
  distribución ni histórico de balances — únicamente reclasifica al instrumento en el desglose de
  exposición de CU-050.

**Casos de uso derivados identificados**

- No aplica el patrón CRUD+Activar en este caso de uso: la activación se resuelve en CU-052
  (RN-180).

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `id` | uuid | Debe existir y pertenecer al usuario autenticado | A01 — Mitigación IDOR: mensaje genérico de "no encontrado" sin distinguir inexistente de ajeno |
| `ticker` | string | Requerido, 1–20 caracteres, único por usuario excluyendo el propio `id` | A03 — Sanitizar entrada; A07 — Codificar en salida |
| `nombre` | string | Requerido, 2–120 caracteres | A03 — Sanitizar entrada; A07 — Codificar en salida |
| `grupo_activo` / `tipo_activo` | string (enum) | Requeridos; solo valores del catálogo cerrado | A03 — Validación estricta de enum en backend |

**Mensajes de error**

*Validación*
- `VALIDATION_001`: "El campo {campo} es obligatorio." *(reutilizado)*
- `VALIDATION_027`: "Ya tienes un instrumento con ese ticker." *(reutilizado)*
- `VALIDATION_031`: "El grupo de activo seleccionado no es válido." *(reutilizado)*
- `VALIDATION_032`: "El tipo de activo seleccionado no es válido." *(reutilizado)*

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Lógica de negocio*
- `BIZ_027`: "El instrumento solicitado no existe."

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| PATCH | `/api/v1/investments/{id}` | Bearer JWT |

*Request*
```json
{
  "ticker": "string (opcional, 1-20)",
  "nombre": "string (opcional, 2-120)",
  "grupo_activo": "string (opcional, enum)",
  "tipo_activo": "string (opcional, enum)"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "ticker": "string",
    "nombre": "string",
    "grupo_activo": "string",
    "tipo_activo": "string",
    "porcentaje_objetivo": "number (sin cambio)",
    "balance_actual": "number (sin cambio)",
    "status": "string (sin cambio)",
    "updated_at": "timestamptz"
  },
  "message": "Instrumento actualizado exitosamente."
}
```

*Modelo de información*
```json
// Tabla: investments — sin campos nuevos respecto a CU-049
{}
```

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Separación ficha (CU-051) vs. configuración (CU-052) | Dos endpoints distintos sobre la misma tabla | La ficha se valida por instrumento; la configuración se valida sobre el conjunto (RN-172). Mezclarlas obligaría a evaluar la regla del 100% en cada edición de nombre |

*Índices*

| Tabla | Campos | Tipo | Propósito |
|---|---|---|---|
| `investments` | `(user_id, ticker)` | Único compuesto | Revalidar unicidad al cambiar el ticker *(reutilizado de CU-049)* |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Editar nombre y tipo de activo | `nombre`, `tipo_activo` | Registro actualizado, `updated_at` refrescado | 200 |
| 2 | Flujo exitoso | Editar ticker a un valor libre | `ticker` no usado | Registro actualizado | 200 |
| 3 | Flujo exitoso | Cambiar grupo de activo | `grupo_activo` distinto | Balance, porcentaje e histórico intactos; cambia solo el desglose (RN-171) | 200 |
| 4 | Validación de entrada | Ticker duplicado | `ticker` de otro instrumento propio | `VALIDATION_027` | 409 |
| 5 | Validación de entrada | Valor fuera del catálogo | `grupo_activo` inexistente | `VALIDATION_031` | 400 |
| 6 | Lógica de negocio | Intento de editar campos de configuración | `porcentaje_objetivo` o `status` en el payload | Campos ignorados, sin efecto (RN-169) | 200 |
| 7 | Recurso no encontrado | Instrumento inexistente o ajeno | `id` de otro usuario | `BIZ_027` | 404 |
| 8 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 9 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-inversiones-edicion]]

---

### CU-052 — Configurar el portafolio (objetivos, balances y estado)

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario ajustar, en una sola vista editable, los tres datos que
definen la operación del portafolio: el porcentaje objetivo de cada instrumento, su balance actual,
y si el instrumento participa o no en la distribución. La vista replica el patrón de captura en
línea de [[presupuesto]] (CU-019): las mismas dos tablas de la consulta, con celdas editables y un
guardado único por lote. A diferencia de aquel caso de uso, **el guardado aquí es atómico**: la
regla que exige que los instrumentos activos sumen exactamente 100% es una propiedad del conjunto,
por lo que un rechazo parcial dejaría el portafolio en un estado inválido. Cada balance guardado
deja además una huella en el histórico de balances, que este módulo nunca presenta pero que el
módulo consolidado de Dashboard + Reportes consumirá para reconstruir el patrimonio invertido en el
tiempo.

**Flujo principal**

1. El usuario activa el modo de edición desde la vista de portafolio (CU-050).
2. El sistema presenta ambas tablas con celdas editables de porcentaje objetivo y balance actual, y
   un control de activación por instrumento.
3. El usuario modifica uno o varios valores y/o cambia el estado de uno o varios instrumentos.
4. Conforme el usuario captura, el sistema recalcula en pantalla la suma de los porcentajes
   objetivo del conjunto activo resultante y muestra la diferencia respecto a 100%.
5. El usuario confirma el guardado.
6. El sistema valida el lote completo, incluida la regla del 100%.
7. El sistema aplica todos los cambios en una sola transacción y registra, por cada balance
   incluido en el lote, la fila correspondiente en el histórico con la fecha del día.
8. El sistema regresa a la vista de consulta con los valores actualizados.

**Flujos alternativos / casos borde**

- Si la suma de porcentajes objetivo del conjunto activo resultante no es exactamente 100%, el
  sistema rechaza el lote completo y ningún cambio se aplica.
- Si el lote deja el portafolio sin ningún instrumento activo, la suma válida es cero — un
  portafolio sin distribución configurada es un estado permitido.
- Al desactivar un instrumento, el sistema fuerza su porcentaje objetivo a cero, ignorando cualquier
  valor capturado para ese renglón.
- Al activar un instrumento, el usuario debe asignarle un porcentaje mayor a cero en el mismo lote;
  de lo contrario el guardado se rechaza.
- Si el usuario guarda dos veces el mismo día, el histórico conserva una sola fila por instrumento y
  fecha: el segundo guardado actualiza la del día en curso.
- Guardar un balance con el mismo valor que ya tenía sí escribe (o refresca) la fila del histórico:
  reconfirmar un valor es información válida sobre la fecha de captura.

**Precondiciones**

- El usuario debe estar autenticado.
- Todos los `investment_id` del lote deben existir y pertenecer al usuario autenticado.

**Postcondiciones**

- Los instrumentos incluidos en el lote quedan actualizados en `investments`.
- Se crea o actualiza una fila en `investment_balance_history` por cada balance incluido en el lote,
  con la fecha del día.
- La suma de `porcentaje_objetivo` de los instrumentos activos del usuario es exactamente 100.00, o
  bien no existe ningún instrumento activo.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `investment_id` | Identificador (renglón de la tabla) | Sí | N/A | uuid válido; debe existir y pertenecer al usuario | — | — | RN-181 |
| `porcentaje_objetivo` | Numérico en línea | Sí | N/A | Número entre 0 y 100, hasta 2 decimales | Forzado a 0 si `status = inactivo` | valor actual | RN-172, RN-173, RN-174, RN-176 |
| `balance_actual` | Numérico en línea | Sí | N/A | Número mayor o igual a cero, hasta 2 decimales | — | valor actual | RN-177, RN-178 |
| `status` | Interruptor (activo/inactivo) | Sí | N/A | Uno de: `activo`, `inactivo` | Determina si el instrumento entra al cálculo de RN-172 | valor actual | RN-173, RN-174, RN-180 |

**Reglas de negocio**

- RN-172: tras aplicar el lote, la suma de `porcentaje_objetivo` de los instrumentos que queden en
  `status = activo` debe ser exactamente `100.00`. Si el lote deja el portafolio sin ningún
  instrumento activo, la suma válida es `0`.
- RN-173: un instrumento en `status = inactivo` siempre tiene `porcentaje_objetivo = 0`. Al
  desactivarlo, el sistema fuerza el valor a cero e ignora cualquier porcentaje enviado para ese
  renglón.
- RN-174: un instrumento en `status = activo` debe tener `porcentaje_objetivo` mayor a cero — un
  objetivo de 0% describe, por definición, un instrumento que ya no recibe aportaciones y por lo
  tanto pertenece al conjunto inactivo.
- RN-175: el guardado del lote es **atómico**: o se aplican todos los renglones o ninguno. A
  diferencia de CU-019 de [[presupuesto]], que rechaza renglones individuales sin afectar el resto
  del lote, aquí la regla del 100% (RN-172) es una propiedad del conjunto y un rechazo parcial
  dejaría el portafolio en un estado inválido.
- RN-176: `porcentaje_objetivo` es un número entre 0 y 100 con hasta 2 decimales.
- RN-177: `balance_actual` es un número mayor o igual a cero con hasta 2 decimales, capturado
  manualmente (RN-156).
- RN-178: por cada instrumento cuyo `balance_actual` venga incluido en el lote se registra una fila
  en `investment_balance_history` con `fecha = CURRENT_DATE` y el valor guardado — incluso si el
  valor no cambió respecto al anterior, ya que la semántica de la tabla es "a esta fecha el
  instrumento valía X" y reconfirmar un valor es información válida. Existe una única fila por
  instrumento y fecha: un segundo guardado el mismo día actualiza la fila existente (upsert), nunca
  la duplica.
- RN-179: el histórico de balances no se presenta en este módulo ni tiene pantalla propia. Existe
  exclusivamente para que el módulo consolidado de Dashboard + Reportes pueda reconstruir el
  patrimonio invertido en el tiempo — un dato que, a diferencia del saldo de cuentas de débito
  (reconstruible desde `transactions`, CU-024 de [[reportes]]), no es recuperable retroactivamente
  si no se captura en el momento.
- RN-180: el cambio de `status` se resuelve dentro de este mismo lote. No se documenta un caso de
  uso independiente de activar/desactivar porque la transición está acoplada a RN-172 y no puede
  guardarse de forma aislada sin dejar el portafolio fuera del 100%.
- RN-181: el lote solo puede referenciar instrumentos que existan y pertenezcan al usuario
  autenticado; un `investment_id` inexistente o ajeno invalida el lote completo (RN-175).

**Casos de uso derivados identificados**

- El patrón CRUD+Activar se resuelve **dentro de este caso de uso** en lugar de un documento aparte:
  su contenido como caso de uso independiente sería una transición de estado sin reglas propias,
  dado que toda la lógica relevante es la regla de conjunto RN-172.
- No se genera caso de uso de búsqueda/filtrado: la vista editable reutiliza el mismo listado
  completo de CU-050.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `investment_id` | uuid | Debe existir y pertenecer al usuario autenticado | A01 — Mitigación IDOR: mensaje genérico, sin distinguir inexistente de ajeno |
| `porcentaje_objetivo` | number | Entre 0 y 100, máx. 2 decimales; suma del conjunto activo = 100.00 | A03 — Validar tipo, rango y regla de conjunto en backend, nunca solo en frontend |
| `balance_actual` | number | Mayor o igual a cero, máx. 2 decimales | A03 — Validar tipo y rango numérico |
| `status` | string (enum) | Solo `activo` o `inactivo` | A03 — Validación estricta de enum en backend |
| Lote completo | array | Transacción única; cualquier renglón inválido aborta el lote | A04 — Diseño seguro: invariante del 100% garantizada a nivel de transacción |

**Mensajes de error**

*Validación*
- `VALIDATION_006`: "El monto no puede ser negativo." *(reutilizado)*
- `VALIDATION_028`: "El porcentaje debe ser un número entre 0 y 100."
- `VALIDATION_029`: "La suma de los porcentajes objetivo de los instrumentos activos debe ser exactamente 100%."
- `VALIDATION_030`: "Un instrumento activo debe tener un porcentaje objetivo mayor a cero."

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Lógica de negocio*
- `BIZ_028`: "Uno o más instrumentos del portafolio no existen o no te pertenecen. No se guardó ningún cambio."

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| PUT | `/api/v1/investments/portfolio-config` | Bearer JWT |

*Request*
```json
{
  "instrumentos": [
    {
      "investment_id": "uuid (requerido)",
      "porcentaje_objetivo": "number (requerido, 0-100)",
      "balance_actual": "number (requerido, >= 0)",
      "status": "string (requerido, enum: activo | inactivo)"
    }
  ]
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "instrumentos_actualizados": 12,
    "filas_historico_registradas": 12,
    "fecha_historico": "2026-08-23",
    "suma_porcentaje_objetivo_activo": 100.00,
    "total_activo": 18665.60,
    "total_general": 56507.51
  },
  "message": "Portafolio actualizado exitosamente."
}
```

*Modelo de información*
```json
// Tabla: investment_balance_history (nueva, Postgres/Supabase)
{
  "id": "uuid",
  "user_id": "uuid (FK → users.id)",
  "investment_id": "uuid (FK → investments.id, ON DELETE CASCADE)",
  "fecha": "date",
  "balance": "numeric(14,2)",
  "created_at": "timestamptz",
  "updated_at": "timestamptz"
}
```
> Registrar en [[data-model-registry]] al cerrar el módulo. Política RLS: `auth.uid() = user_id`.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| `investment_balance_history.investment_id → investments` | Referenciado (FK), `ON DELETE CASCADE` | El histórico carece de sentido sin su instrumento; la eliminación en cascada se advierte explícitamente al usuario (RN-194) |
| Granularidad diaria (`fecha` como `date`, no `timestamptz`) | Upsert por instrumento y día | Acota el crecimiento de la tabla a una fila por instrumento y día, suficiente para una captura de periodicidad mensual, y evita duplicados si el usuario guarda varias veces seguidas |
| Guardado atómico del lote | Transacción única | La regla del 100% (RN-172) es una invariante de conjunto; el guardado parcial la rompería |
| `balance_actual` persistido en `investments` **y** en el histórico | Duplicación deliberada | `investments.balance_actual` es el valor vigente que consulta todo el módulo; el histórico es la serie temporal. Resolver el valor vigente con `MAX(fecha)` en cada consulta encarecería la vista principal sin beneficio |

*Índices*

| Tabla | Campos | Tipo | Propósito |
|---|---|---|---|
| `investment_balance_history` | `(investment_id, fecha)` | Único compuesto | Garantizar una sola fila por instrumento y día; soporta el upsert de RN-178 |
| `investment_balance_history` | `(user_id, fecha)` | B-tree compuesto | Reconstruir el patrimonio invertido del usuario a una fecha dada (consumo futuro de Dashboard + Reportes) |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Actualizar solo balances | Lote con porcentajes sin cambio y balances nuevos | Balances actualizados, una fila de histórico por instrumento con fecha de hoy | 200 |
| 2 | Flujo exitoso | Redistribuir porcentajes sumando 100 | Lote con porcentajes 55/26/9/6/2/2 | Lote aplicado completo | 200 |
| 3 | Flujo exitoso | Desactivar un instrumento y redistribuir | Instrumento a `inactivo` y resto ajustado a 100% | Porcentaje del desactivado forzado a 0 (RN-173); lote aplicado | 200 |
| 4 | Flujo exitoso | Segundo guardado el mismo día | Mismo lote guardado dos veces | Una sola fila de histórico por instrumento y fecha (upsert, RN-178) | 200 |
| 5 | Validación de entrada | Suma distinta de 100 | Porcentajes activos sumando 98 | `VALIDATION_029`; ningún cambio aplicado (RN-175) | 400 |
| 6 | Validación de entrada | Instrumento activo con 0% | `status=activo`, `porcentaje_objetivo=0` | `VALIDATION_030` | 400 |
| 7 | Validación de entrada | Balance negativo o porcentaje fuera de rango | `balance_actual=-1` o `porcentaje_objetivo=120` | `VALIDATION_006` / `VALIDATION_028`; lote completo rechazado | 400 |
| 8 | Lógica de negocio | Lote deja el portafolio sin activos | Todos los instrumentos a `inactivo` | Lote aceptado, suma válida = 0 (RN-172) | 200 |
| 9 | Recurso no encontrado | Instrumento ajeno en el lote | `investment_id` de otro usuario | `BIZ_028`; ningún cambio aplicado | 404 |
| 10 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 11 | Error del sistema | Falla a mitad de la transacción | Simulado | `SYS_001`; rollback completo, sin cambios parciales | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-inversiones-configuracion]]

---

### CU-053 — Simular la distribución de la siguiente aportación

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario capturar el monto de su siguiente aportación al portafolio y
obtener, para cada instrumento activo, cuánto conviene destinarle para acercarse a la distribución
objetivo sin necesidad de vender ninguna posición. El cálculo reparte la aportación en proporción a
lo que le falta a cada instrumento para alcanzar su objetivo sobre el portafolio proyectado, de modo
que los instrumentos que ya rebasan su porcentaje no reciben nada y los más rezagados concentran la
mayor parte. El resultado incluye también el porcentaje en que quedaría cada instrumento después de
aplicar la aportación. El monto se pre-llena con el total presupuestado del grupo "Investment" del
mes en curso, y todo el cálculo es **efímero**: la simulación no persiste nada, no modifica balances
y no genera transacciones.

**Flujo principal**

1. El usuario captura o confirma el monto de la siguiente aportación en la vista de portafolio.
2. El sistema pre-llena ese campo con el total presupuestado del grupo "Investment" del mes en
   curso, si existe.
3. El sistema valida que exista al menos un instrumento activo y que sus porcentajes objetivo sumen
   exactamente 100%.
4. El sistema calcula el portafolio proyectado (total activo más la aportación) y, para cada
   instrumento activo, su objetivo monetario y su faltante.
5. Si la aportación no alcanza a cubrir el faltante total, el sistema la reparte en proporción al
   faltante de cada instrumento.
6. Si la aportación excede el faltante total, el sistema cubre primero todos los faltantes y reparte
   el remanente entre todos los activos en proporción a su porcentaje objetivo.
7. El sistema ajusta el redondeo para que la suma de las aportaciones sugeridas sea exactamente
   igual al monto capturado.
8. El sistema presenta, por instrumento, la aportación sugerida y el porcentaje resultante, junto al
   total de la aportación distribuida.

**Flujos alternativos / casos borde**

- Si el monto de aportación es cero o el campo está vacío, el sistema no ejecuta la simulación y la
  vista conserva únicamente las columnas de diagnóstico (porcentaje actual y diferencia, CU-050).
- Si el portafolio activo está completamente en ceros, el faltante de cada instrumento equivale a su
  porcentaje objetivo aplicado a la aportación, por lo que el reparto degenera en la distribución
  simple por porcentaje objetivo.
- Si todos los instrumentos activos están exactamente en su objetivo, el faltante total es cero y la
  totalidad de la aportación se reparte por porcentaje objetivo.
- Una sola aportación normalmente **no** lleva a un instrumento hasta su porcentaje objetivo: la
  columna de diferencia (RN-162) indica cuánto falta en total y la de aportación sugerida cuánto
  corresponde ahora. Ambas se presentan simultáneamente y no deben confundirse.
- Si no existe ningún instrumento activo, o si sus porcentajes objetivo no suman 100%, el sistema no
  ejecuta la simulación e informa al usuario que debe configurar el portafolio primero.

**Precondiciones**

- El usuario debe estar autenticado.
- Debe existir al menos un instrumento en `status = activo`.
- La suma de `porcentaje_objetivo` de los instrumentos activos debe ser exactamente 100.00.

**Postcondiciones**

- Ninguna — caso de uso de solo lectura; el resultado no se persiste (RN-183).

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `monto_aportacion` | Numérico | Sí | N/A | Número mayor a cero, hasta 2 decimales | Base de todo el cálculo | Total presupuestado del grupo "Investment" del mes en curso, si existe | RN-183, RN-184 |

**Reglas de negocio**

- RN-182: solo participan en el cálculo los instrumentos en `status = activo`. Si no existe ninguno,
  o si la suma de sus `porcentaje_objetivo` no es exactamente 100.00, la simulación no se ejecuta y
  el sistema devuelve `BIZ_029`.
- RN-183: `monto_aportacion` es un número mayor a cero con hasta 2 decimales. **No se persiste**: el
  simulador es efímero y su resultado se recalcula en cada consulta.
- RN-184: el campo `monto_aportacion` se pre-llena con el total presupuestado del grupo "Investment"
  del mes en curso, tomado de [[presupuesto]] (CU-019). Si ese mes no tiene presupuesto asignado al
  grupo, el campo nace vacío. El valor propuesto siempre es sobreescribible por el usuario.
- RN-185: `total_proyectado` = `total_activo + monto_aportacion`, donde `total_activo` se calcula
  según RN-159.
- RN-186: para cada instrumento activo, `objetivo_monetario` = `(porcentaje_objetivo ÷ 100) ×
  total_proyectado`, y `faltante` = `max(0, objetivo_monetario − balance_actual)`. El faltante nunca
  es negativo porque el módulo no contempla vender para rebalancear: un instrumento por encima de su
  objetivo simplemente deja de recibir aportaciones hasta que el resto lo alcance.
- RN-187 (fase 1 — cubrir faltantes): si `monto_aportacion` es menor o igual al faltante total, cada
  instrumento recibe `monto_aportacion × (faltante ÷ faltante_total)`. Los instrumentos con faltante
  cero reciben cero.
- RN-188 (fase 2 — repartir el remanente): si `monto_aportacion` es mayor que el faltante total,
  cada instrumento recibe primero su `faltante` completo y el remanente
  (`monto_aportacion − faltante_total`) se reparte entre **todos** los instrumentos activos en
  proporción a su `porcentaje_objetivo`.
- RN-189 (casos degenerados): los dos bordes se resuelven con RN-187 y RN-188 sin lógica especial.
  (a) Portafolio activo en ceros: `faltante` de cada instrumento equivale a
  `(porcentaje_objetivo ÷ 100) × monto_aportacion` y el faltante total iguala a la aportación, por
  lo que la fase 1 degenera en el reparto simple por porcentaje objetivo. (b) Todos los instrumentos
  exactamente en su objetivo: el faltante total es cero, por lo que la fase 2 reparte la totalidad
  por porcentaje objetivo.
- RN-190 (redondeo): cada aportación sugerida se redondea a 2 decimales; el residuo entre
  `monto_aportacion` y la suma de las aportaciones redondeadas se asigna íntegro al instrumento con
  mayor `faltante`. En caso de empate, al de mayor `porcentaje_objetivo`; si el empate persiste, al
  de `ticker` menor en orden alfabético. La suma de las aportaciones devueltas es siempre
  exactamente igual a `monto_aportacion`.
- RN-191: `nuevo_balance` = `balance_actual + aportacion_sugerida` y `nuevo_porcentaje` =
  `nuevo_balance ÷ total_proyectado`. Ambos son proyecciones informativas — el módulo no ejecuta
  ninguna operación, no modifica `balance_actual` (RN-156) y no genera transacciones.

**Casos de uso derivados identificados**

- No se genera un caso de uso de "aplicar la distribución": el registro del capital que entra al
  portafolio ya ocurre en [[transacciones]] como `gasto` con categoría del grupo "Investment", y la
  actualización de balances ocurre en CU-052 cuando el usuario consulta el valor de mercado real.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `monto_aportacion` | number | Requerido, decimal mayor a cero, máx. 2 decimales | A03 — Validar tipo y rango numérico; rechazar notación científica y valores no finitos |
| Estado del portafolio | precondición | Al menos un activo y suma de objetivos = 100.00 | A04 — Diseño seguro: no producir un cálculo con una base inconsistente |

**Mensajes de error**

*Validación*
- `VALIDATION_001`: "El campo {campo} es obligatorio." *(reutilizado)*
- `VALIDATION_012`: "El monto debe ser un número mayor a cero." *(reutilizado)*

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Lógica de negocio*
- `BIZ_029`: "Configura primero tu portafolio: necesitas instrumentos activos cuya distribución objetivo sume 100%."

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| POST | `/api/v1/investments/contribution-plan` | Bearer JWT |

*Request*
```json
{
  "monto_aportacion": "number (requerido, > 0)"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "monto_aportacion": 5000.00,
    "total_activo": 18665.60,
    "total_proyectado": 23665.60,
    "faltante_total": 8118.13,
    "remanente_distribuido": 0.00,
    "instrumentos": [
      {
        "id": "uuid",
        "ticker": "PPR",
        "porcentaje_objetivo": 55.00,
        "balance_actual": 8100.31,
        "porcentaje_actual": 43.40,
        "diferencia": -2165.77,
        "faltante": 4915.77,
        "aportacion_sugerida": 3027.65,
        "nuevo_balance": 11127.96,
        "nuevo_porcentaje": 47.02
      },
      {
        "id": "uuid",
        "ticker": "BTC",
        "porcentaje_objetivo": 2.00,
        "balance_actual": 2092.00,
        "porcentaje_actual": 11.21,
        "diferencia": 1718.69,
        "faltante": 0.00,
        "aportacion_sugerida": 0.00,
        "nuevo_balance": 2092.00,
        "nuevo_porcentaje": 8.84
      }
    ]
  }
}
```

*Modelo de información*
```json
// Sin cambios de esquema: cálculo efímero sobre investments,
// con lectura de budgets + categories para el valor pre-llenado (RN-184)
{}
```

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| `monto_aportacion` y el plan resultante | Efímeros, no persistidos | Es una simulación de apoyo a la decisión; nada del sistema depende de ella una vez que el usuario actúa. Persistirla obligaría a mantener sincronizado un plan que caduca en cuanto cambia cualquier balance |
| Pre-llenado desde el presupuesto del grupo "Investment" | Lectura de `budgets` + `categories`, sin FK nueva | Reutiliza el dato que el usuario ya captura en [[presupuesto]] sin acoplar las tablas: si el presupuesto no existe, el campo simplemente nace vacío |

*Índices*

| Tabla | Campos | Tipo | Propósito |
|---|---|---|---|
| `investments` | `(user_id, status)` | B-tree compuesto | Recuperar el conjunto activo del cálculo *(reutilizado de CU-049)* |
| `budgets` | `(user_id, mes)` | B-tree compuesto | Obtener el presupuesto del mes en curso para el pre-llenado *(reutilizado de CU-019)* |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Aportación menor al faltante total | `monto_aportacion=5000` sobre el portafolio de referencia | Solo los rezagados reciben monto; los que rebasan su objetivo reciben 0; la suma de aportaciones = 5000.00 exacto | 200 |
| 2 | Flujo exitoso | Aportación mayor al faltante total | `monto_aportacion=15000`, faltante total 8118.13 | Faltantes cubiertos al 100% y remanente repartido por porcentaje objetivo (RN-188) | 200 |
| 3 | Flujo exitoso | Portafolio activo en ceros | Todos los balances en 0 | Reparto igual a `porcentaje_objetivo × monto_aportacion` (RN-189a) | 200 |
| 4 | Flujo exitoso | Todos exactamente en su objetivo | Balances alineados al 100% | Faltante total 0; reparto completo por porcentaje objetivo (RN-189b) | 200 |
| 5 | Flujo exitoso | Ajuste de redondeo | Monto que genera residuo de centavos | Suma de aportaciones exactamente igual al monto; residuo al de mayor faltante (RN-190) | 200 |
| 6 | Validación de entrada | Monto cero o negativo | `monto_aportacion=0` | `VALIDATION_012` | 400 |
| 7 | Lógica de negocio | Portafolio sin instrumentos activos | Solo instrumentos inactivos | `BIZ_029` | 409 |
| 8 | Lógica de negocio | Porcentajes activos que no suman 100 | Suma 90% por manipulación directa de datos | `BIZ_029` | 409 |
| 9 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 10 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-inversiones-aportacion]]

---

### CU-054 — Eliminar instrumento de inversión

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario eliminar de forma definitiva un instrumento de su
portafolio, junto con todo su histórico de balances. A diferencia del resto de los módulos del
sistema, aquí no existe un estado "archivado": el estado `inactivo` ya cumple esa función,
manteniendo visible un instrumento que conserva capital pero que ya no recibe aportaciones. La
eliminación queda reservada para instrumentos que el usuario ya no desea conservar en el registro
en absoluto, y **solo procede sobre instrumentos inactivos**, de modo que la regla del 100% (RN-172)
se mantenga siempre satisfecha sin necesidad de redistribuir durante el borrado.

**Flujo principal**

1. El usuario selecciona "Eliminar" sobre un instrumento de la tabla de inactivos (CU-050).
2. El sistema muestra un diálogo de confirmación que advierte que la acción es permanente y que
   elimina también el histórico de balances del instrumento.
3. El usuario confirma.
4. El sistema valida que el instrumento exista, pertenezca al usuario y se encuentre inactivo.
5. El sistema elimina el registro de `investments` y, en cascada, todas sus filas de
   `investment_balance_history`.
6. El sistema refresca la vista de portafolio.

**Flujos alternativos / casos borde**

- Si el instrumento está en `status = activo`, el sistema rechaza la eliminación e indica al usuario
  que debe desactivarlo primero (CU-052), lo que a su vez obliga a redistribuir el porcentaje
  liberado entre el resto de los activos.
- Un instrumento inactivo con balance mayor a cero **sí** puede eliminarse: la confirmación advierte
  la pérdida del registro, pero el sistema no lo bloquea, ya que ningún otro módulo depende de ese
  balance.
- Si el usuario cancela la confirmación, no se aplica ningún cambio.

**Precondiciones**

- El usuario debe estar autenticado.
- El instrumento debe existir, pertenecer al usuario autenticado y encontrarse en
  `status = inactivo`.

**Postcondiciones**

- El registro de `investments` deja de existir.
- Todas las filas de `investment_balance_history` asociadas al instrumento dejan de existir.
- La suma de `porcentaje_objetivo` del conjunto activo permanece sin cambio (el instrumento
  eliminado estaba en 0% por RN-173).

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `id` | Identificador (parámetro de ruta) | Sí | N/A | uuid válido; debe existir, pertenecer al usuario y estar inactivo | — | — | RN-192 |
| Confirmación | Diálogo de confirmación | Sí | N/A | Confirmación explícita del usuario antes de ejecutar | — | — | RN-193, RN-194 |

**Reglas de negocio**

- RN-192: solo se puede eliminar un instrumento en `status = inactivo`. Para eliminar uno activo, el
  usuario debe desactivarlo primero en CU-052, lo que obliga a redistribuir el porcentaje liberado y
  mantiene la regla del 100% (RN-172) satisfecha en todo momento.
- RN-193: la eliminación siempre requiere confirmación explícita del usuario, sin importar el
  balance registrado. No existe eliminación silenciosa ni deshacer posterior.
- RN-194: eliminar un instrumento elimina en cascada todas sus filas de
  `investment_balance_history`. El diálogo de confirmación lo advierte de forma explícita, ya que
  esto altera retroactivamente el patrimonio invertido histórico que consumirá el módulo consolidado
  de Dashboard + Reportes (RN-179).

**Casos de uso derivados identificados**

- No se documenta un caso de uso de archivado: el estado `inactivo` (CU-052) ya cubre esa necesidad,
  y duplicarlo con un tercer estado no aportaría distinción operativa alguna.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `id` | uuid | Debe existir, pertenecer al usuario autenticado y estar en `status = inactivo` | A01 — Mitigación IDOR: mensaje genérico de "no encontrado" sin distinguir inexistente de ajeno |
| Confirmación | flujo | Acción destructiva; requiere confirmación explícita en frontend antes de invocar el endpoint | A04 — Diseño seguro: prevenir eliminación accidental de datos no recuperables |

**Mensajes de error**

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Lógica de negocio*
- `BIZ_027`: "El instrumento solicitado no existe." *(reutilizado)*
- `BIZ_030`: "Solo se pueden eliminar instrumentos inactivos. Desactívalo primero desde la configuración del portafolio."

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| DELETE | `/api/v1/investments/{id}` | Bearer JWT |

*Request*
```json
{}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "ticker": "string",
    "filas_historico_eliminadas": 7
  },
  "message": "Instrumento eliminado exitosamente."
}
```

*Modelo de información*
```json
// Sin campos nuevos: eliminación física del registro de investments
// y, en cascada, de investment_balance_history
{}
```

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Eliminación física en lugar de archivado | Divergencia deliberada respecto a `accounts`, `categories` y `savings_goals` | El estado `inactivo` ya ocupa el rol semántico de "archivado" en este módulo (instrumento visible, con capital, sin aportaciones). Un tercer estado no agregaría distinción operativa |
| `ON DELETE CASCADE` sobre el histórico | Integridad referencial en base de datos | Evita filas huérfanas que distorsionarían el patrimonio invertido histórico atribuyéndolo a un instrumento inexistente |

*Índices*

| Tabla | Campos | Tipo | Propósito |
|---|---|---|---|
| `investment_balance_history` | `(investment_id, fecha)` | Único compuesto | Localizar y eliminar en cascada el histórico del instrumento *(reutilizado de CU-052)* |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Eliminar instrumento inactivo con balance en cero | `id` de instrumento inactivo | Registro eliminado; sin filas de histórico remanentes | 200 |
| 2 | Flujo exitoso | Eliminar instrumento inactivo con balance mayor a cero | `id` de instrumento inactivo con capital | Registro e histórico eliminados tras confirmación | 200 |
| 3 | Lógica de negocio | Intento de eliminar instrumento activo | `id` de instrumento activo | `BIZ_030`; ningún cambio aplicado | 409 |
| 4 | Lógica de negocio | Eliminación en cascada del histórico | Instrumento con 7 filas de histórico | `filas_historico_eliminadas = 7`; ninguna fila huérfana | 200 |
| 5 | Lógica de negocio | Suma del conjunto activo tras eliminar | Portafolio activo al 100% antes de la operación | La suma permanece en 100.00 (RN-192) | 200 |
| 6 | Recurso no encontrado | Instrumento inexistente o ajeno | `id` de otro usuario | `BIZ_027` | 404 |
| 7 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 8 | Error del sistema | Falla de base de datos | Simulado | `SYS_001`; rollback completo | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-inversiones-portafolio]]

---

## Cambios en otros documentos

### [[presupuesto]] — sin cambios de esquema

- **No se agrega `budgets.investment_id`.** El patrón de "cada ítem se presupuesta como su propia
  línea", introducido por [[ahorros-y-metas]] y anotado como posible extensión a este módulo, **no
  se aplica aquí**. Razón: cada meta de ahorro necesitó su propio renglón porque no existía otra
  forma de presupuestarla, mientras que el grupo "Investment" ya existe en `categories` (RN-025) y
  ya se presupuesta con categorías reales. Agregar un tercer `investment_id` mutuamente excluyente
  con `category_id` y `meta_id` duplicaría un mecanismo que ya funciona.
- **Convención operativa (dato, no esquema):** el usuario mantiene una única categoría llamada
  "Investment" dentro del grupo "Investment", donde presupuesta el total mensual destinado al
  portafolio. El "real" de esa categoría se acumula solo con las transacciones de tipo `gasto` que
  la referencian, mediante el mecanismo ya existente (RN-072, RN-073). El reparto de ese total entre
  instrumentos individuales se resuelve en CU-053 de este módulo, no en Presupuesto, porque las
  aportaciones por instrumento son variables mes con mes.
- El total presupuestado del grupo "Investment" del mes en curso se lee desde este módulo para
  pre-llenar el campo de aportación (RN-184). Es una lectura, no una dependencia de esquema: si el
  presupuesto no existe, el campo nace vacío.

### [[transacciones]] — sin cambios de esquema

- **No se agrega `transactions.investment_id`.** Vincular cada `gasto` del grupo "Investment" a un
  instrumento concreto habilitaría calcular capital aportado por instrumento y, con él, rendimiento
  y costo promedio — precisamente el alcance que este módulo delega a Yahoo Finance. Se documenta
  aquí como decisión deliberada para que un módulo futuro no asuma que ese vínculo existe.
- El registro del capital que entra al portafolio permanece exactamente como está hoy: un `gasto`
  con `category_id` del grupo "Investment", capturado mediante el chip "Investment" de CU-013.

### [[reportes]] — sin cambios en este cierre

- `RN-094` (Investment excluido del cálculo de gasto real del periodo) queda **confirmada**, no
  modificada: el capital que entra al portafolio es movimiento de capital, no consumo, y este módulo
  refuerza esa lectura.
- La tabla `investment_balance_history` queda disponible como insumo del módulo consolidado de
  Dashboard + Reportes para reconstruir el patrimonio invertido en el tiempo (RN-179). El detalle de
  cómo se presenta se define en ese módulo, no en este.
- Sigue pendiente, de cierres anteriores, la corrección de `RN-087` cuando le toque su turno de
  construcción a Reportes.

### [[estrategia]] y [[roadmap]]

- Inversiones se adelanta respecto al orden original y queda antes de Créditos y Deudas. La
  justificación de secuencia de [[estrategia]] ya contemplaba esta posibilidad ("Inversiones puede
  adelantarse sin romper nada"), y este cierre lo confirma: el módulo no dependió de ningún terreno
  preparado en el modelo de datos.
- La misma nota de [[estrategia]] menciona `budgets.categoria_reservada="ahorros"` como terreno
  preparado para Ahorros; ese campo fue retirado en el cierre de [[ahorros-y-metas]] y la mención
  queda desactualizada.

### [[backlog]]

Se identifican dos ítems fuera del alcance de esta versión, para registrar en el backlog:

- **Catálogo administrable de grupos y tipos de activo.** En esta versión `grupo_activo` y
  `tipo_activo` son enums cerrados a nivel de esquema (RN-155): agregar un valor requiere una
  migración. La alternativa evaluada — catálogos administrables desde un módulo de "Settings" — se
  pospone por no justificar dos pantallas de CRUD para un grupo cerrado de menos de cinco usuarios.
  Condición de reactivación: la necesidad de agregar valores se vuelve frecuente, o surge un módulo
  de Settings por otra razón que pueda alojarlos.
- **Vínculo transacción ↔ instrumento.** Un `transactions.investment_id` opcional permitiría conocer
  el capital aportado por instrumento y, con ello, costo promedio y rendimiento. Se pospone por
  duplicar deliberadamente lo que el usuario ya resuelve en Yahoo Finance y por agregar fricción a
  la captura de cada gasto de inversión. Condición de reactivación: surge la necesidad de conciliar
  aportaciones planeadas contra ejecutadas dentro de la aplicación.

### [[data-model-registry]]

Ver documento adjunto de actualización del registro
(`registro-actualizacion-inversiones.md`) con los bloques exactos a copiar: nuevas tablas
`investments` e `investment_balance_history`, nuevas relaciones, diagrama ER actualizado, índice de
numeración e historial de cambios.

## Historial de cambios

| Fecha | Cambio | CU afectado | Impacto en otros documentos |
|---|---|---|---|
| 2026-08-23 | Se crea el módulo Inversiones: tabla `investments` (ticker, nombre, grupo y tipo de activo como enums cerrados, porcentaje objetivo, balance actual capturado manualmente, estado activo/inactivo) y tabla `investment_balance_history` (una fila por instrumento y fecha, sin pantalla propia, como insumo del futuro Dashboard + Reportes). Se agregan CU-049 a CU-054. El módulo es un registro y planificador: no ejecuta ni registra movimientos de dinero, y `balance_actual` es un dato capturado, no derivado de `transactions` (RN-156). Se establece la regla del 100% sobre el conjunto activo (RN-172) con guardado atómico por lote (RN-175), y el algoritmo de distribución de la siguiente aportación en dos fases — cubrir faltantes y repartir el remanente por porcentaje objetivo (RN-186 a RN-191). | CU-049 a CU-054 | Se actualiza [[data-model-registry]] con las tablas `investments` e `investment_balance_history`, sus índices, relaciones, diagrama ER e índice de numeración. **No** se modifican [[presupuesto]] ni [[transacciones]]: se documenta explícitamente la decisión de **no** agregar `budgets.investment_id` (el patrón de presupuesto por ítem de [[ahorros-y-metas]] no se extiende a este módulo) ni `transactions.investment_id`. Se confirma `RN-094` de [[reportes]] sin cambios. Se agregan dos ítems a [[backlog]]: catálogo administrable de grupos/tipos de activo y vínculo transacción ↔ instrumento. Sigue pendiente la corrección de `RN-087` de [[reportes]]. |
| 2026-08-23 | **Corrección de numeración, detectada al iniciar la construcción en código**: este documento se había numerado (CU-042 a CU-047, RN-140 a RN-181, `VALIDATION_026`–`VALIDATION_031`, `BIZ_026`–`BIZ_029`) sin consultar el estado real del índice — colisionaba enteramente con el módulo [[ahorros-y-metas]] (CU-042–048, RN-120–152, `VALIDATION_026`, `BIZ_026`), que se había cerrado y numerado correctamente una sesión antes. El índice de [[data-model-registry]] había sido editado para reflejar los números de Inversiones como si fueran los últimos usados, sin partir del máximo real dejado por Ahorros — el mismo tipo de error que Ahorros mismo había cometido y corregido respecto a Transacciones/Presupuesto/Categorías. Se renumeró todo el documento a la siguiente secuencia libre: `CU-042`→`CU-049` … `CU-047`→`CU-054`; `RN-140`→`RN-153` … `RN-181`→`RN-194`; `VALIDATION_026`→`VALIDATION_027` … `VALIDATION_031`→`VALIDATION_032`; `BIZ_026`→`BIZ_027` … `BIZ_029`→`BIZ_030`. Ningún otro documento cambió sus propios números — solo se corrigieron las referencias colisionadas dentro de este archivo y en [[data-model-registry]]. El archivo `registro-actualizacion-inversiones.md` mencionado en la sección "Cambios en otros documentos" nunca llegó a crearse; el registro se actualiza directamente en [[data-model-registry]] al cerrar la construcción. | CU-049 a CU-054 | Se corrige el índice de numeración de [[data-model-registry]]. |

## Referencias

- [[estrategia]]
- [[brief-ux]]
- [[data-model-registry]]
- [[categorias]]
- [[transacciones]]
- [[presupuesto]]
- [[reportes]]
- [[ahorros-y-metas]]
- [[backlog]]