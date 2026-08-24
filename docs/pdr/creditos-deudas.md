---
modulo: "Créditos y Deudas"
status: en progreso
---

# Requerimientos — Créditos y Deudas

## Resumen del módulo

El módulo de Créditos y Deudas permite al usuario dar seguimiento a deuda externa —automotriz,
hipotecaria o préstamos personales— que no vive dentro de [[cuentas]] (las tarjetas de crédito ya
se resuelven ahí, como `tipo = credito`). Para cada deuda se captura su monto original, tasa de
interés, pago mensual esperado, día de pago y una fecha estimada de liquidación, y se da
seguimiento a su saldo mediante pagos: cada pago se registra como una única transacción,
referenciando la cuenta de origen y la deuda destino mediante el nuevo campo `deuda_id` de
`transactions` (mismo patrón de documento único que una aportación a meta de [[ahorros-y-metas]],
retomando la nota dejada explícitamente en [[transacciones]] cuando se cerró ese módulo: el pago a
deudas externas se excluyó a propósito de ahí para resolverse aquí como entidad propia, no como
cuenta). A diferencia de una aportación a meta, un pago a deuda se captura dividido en capital e
interés —el saldo de la deuda solo baja por la parte de capital, nunca por el interés— y cada deuda
activa gana además su propio renglón presupuestable en [[presupuesto]], igual que cada meta de
ahorro activa. Con este módulo se completan los 9 documentos de `docs/pdr/`, cerrando la fase de
Casos de uso y Requerimientos del alcance completo (ver [[estrategia]]).

## Casos de uso

### CU-055 — Crear deuda

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario registrar una nueva deuda externa, capturando un nombre, un
tipo (automotriz, hipotecaria, préstamo personal u otro), el monto original prestado y,
opcionalmente, la tasa de interés, el pago mensual esperado, el día de pago y una fecha estimada de
liquidación. La deuda nace en `status = active`, sin pagos propios — el saldo se calcula, no se
captura, a partir del monto original y del historial de pagos que se registren después (CU-060).

**Flujo principal**

1. El usuario accede a "Agregar deuda" desde el listado de deudas (CU-056).
2. El sistema muestra el formulario: nombre, tipo, monto original, tasa de interés (opcional), pago
   mensual esperado (opcional), día de pago (opcional) y fecha estimada de liquidación (opcional).
3. El usuario captura los datos y confirma.
4. El sistema valida los datos ingresados.
5. El sistema crea el documento en `debts` con `status = active`.
6. El sistema muestra la deuda recién creada en el listado, con saldo igual al monto original.

**Flujos alternativos / casos borde**

- Si el usuario no captura tasa de interés, se asume `0`.
- Si no se captura pago mensual esperado o día de pago, la deuda se muestra sin esos datos en el
  detalle, sin bloquear la creación.
- Si no se define fecha estimada de liquidación, la deuda se muestra sin ese dato en el listado y en
  el detalle (CU-056, CU-057).

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Se crea un documento en `debts` perteneciente al usuario, con `status = active`.
- El saldo calculado de la deuda recién creada es igual a `monto_original`.

**Definición detallada de campos**

|Campo|Tipo de control|Obligatorio|Longitud|Formato / validación|Dependencias|Valor por defecto|Regla de negocio|
|---|---|---|---|---|---|---|---|
|`nombre`|Texto|Sí|2–50 caracteres|Letras, números y espacios; único entre deudas activas del usuario|—|—|RN-195|
|`tipo`|Selección única|Sí|N/A|Enum: `auto`, `hipoteca`, `personal`, `otro`|—|—|RN-196|
|`monto_original`|Numérico|Sí|—|Decimal mayor a cero|—|—|RN-197|
|`tasa_interes`|Numérico (%)|No|—|Decimal mayor o igual a cero|—|0|RN-198|
|`pago_mensual_esperado`|Numérico|No|—|Decimal mayor a cero|—|`null`|RN-199|
|`dia_pago`|Numérico (entero)|No|—|Entero entre 1 y 31|—|`null`|RN-199|
|`fecha_liquidacion_estimada`|Selector de fecha|No|—|date|—|`null`|RN-200|

**Reglas de negocio**

- RN-195: `nombre` debe ser único entre las deudas en `status = active` del usuario; no se valida
  contra deudas archivadas.
- RN-196: `tipo` es un catálogo cerrado (`auto`, `hipoteca`, `personal`, `otro`), no administrable
  por el usuario.
- RN-197: `monto_original` es obligatorio y debe ser un número positivo mayor a cero; a diferencia de
  `saldo_inicial` en [[cuentas]] (no editable, RN-006), sí es editable después de creada la deuda
  (ver CU-058).
- RN-198: `tasa_interes` es opcional (default 0) y puramente informativa — no se usa para recalcular
  automáticamente el desglose capital/interés de un pago, que se captura a mano en cada uno (RN-215).
- RN-199: `pago_mensual_esperado` y `dia_pago` son independientes entre sí y ambos opcionales; si se
  captura `dia_pago`, debe ser un entero entre 1 y 31 (mismo criterio que `dia_pago` de una cuenta de
  crédito en [[cuentas]]).
- RN-200: `fecha_liquidacion_estimada` es opcional y puramente informativa — no se recalcula
  automáticamente a partir de los pagos ni se valida contra el saldo; el usuario la ajusta manualmente
  si su plan de pagos cambia.
- RN-201: la deuda nace en `status = active`; sin pagos registrados, el saldo calculado es igual a
  `monto_original`.

**Casos de uso derivados identificados**

- CU-056: Listar deudas
- CU-057: Ver detalle de una deuda
- CU-058: Editar deuda
- CU-059: Archivar (y reactivar) deuda
- *Patrón Búsqueda y Filtrado:* evaluado y descartado — mismo criterio que [[cuentas]] (CU-001) y
  [[ahorros-y-metas]] (CU-042), volumen bajo de deudas esperado por usuario.

**Validaciones**

|Campo|Tipo|Reglas|Mitigación OWASP|
|---|---|---|---|
|`nombre`|string|Requerido, 2–50 caracteres, único entre deudas activas del usuario|A03 — Sanitizar entrada; A07 — Codificar en salida|
|`tipo`|string|Requerido, enum cerrado|A03 — Validar contra whitelist|
|`monto_original`|number|Requerido, decimal mayor a cero|A03 — Validar tipo y rango numérico|
|`tasa_interes`|number|Opcional, decimal mayor o igual a cero|A03 — Validar tipo y rango numérico|
|`pago_mensual_esperado`|number|Opcional, decimal mayor a cero|A03 — Validar tipo y rango numérico|
|`dia_pago`|integer|Opcional, entero entre 1 y 31|A03 — Validar rango|

**Mensajes de error**

*Validación*
- `VALIDATION_001`: "El campo {campo} es obligatorio." *(reutilizado)*
- `VALIDATION_033`: "Ya tienes una deuda con ese nombre."
- `VALIDATION_034`: "El tipo de deuda no es válido."
- `VALIDATION_012`: "El monto debe ser un número mayor a cero." *(reutilizado)*
- `VALIDATION_006`: "El monto no puede ser negativo." *(reutilizado)*
- `VALIDATION_005`: "El día debe estar entre 1 y 31." *(reutilizado)*

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

|Método|Endpoint|Auth|
|---|---|---|
|POST|`/api/v1/debts`|Bearer JWT|

*Request*
```json
{
  "nombre": "string (requerido)",
  "tipo": "string (requerido, enum: auto|hipoteca|personal|otro)",
  "monto_original": "number (requerido, > 0)",
  "tasa_interes": "number (opcional, >= 0, default: 0)",
  "pago_mensual_esperado": "number (opcional, > 0)",
  "dia_pago": "number (opcional, 1-31)",
  "fecha_liquidacion_estimada": "date (opcional)"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "string",
    "tipo": "string",
    "monto_original": "number",
    "saldo_actual": "number (= monto_original al crear)",
    "tasa_interes": "number",
    "pago_mensual_esperado": "number|null",
    "dia_pago": "number|null",
    "fecha_liquidacion_estimada": "date|null",
    "status": "active",
    "created_at": "timestamptz"
  },
  "message": "Deuda creada exitosamente."
}
```

*Modelo de información*
```json
// Tabla: debts (nueva, Postgres/Supabase)
{
  "id": "uuid",
  "user_id": "uuid (FK → users.id)",
  "nombre": "text",
  "tipo": "text (enum: auto, hipoteca, personal, otro)",
  "monto_original": "numeric(14,2)",
  "tasa_interes": "numeric(5,2)",
  "pago_mensual_esperado": "numeric(14,2)|null",
  "dia_pago": "smallint|null (1-31)",
  "fecha_liquidacion_estimada": "date|null",
  "status": "text (enum: active, archived)",
  "created_at": "timestamptz",
  "updated_at": "timestamptz"
}
```
> Registrar en [[data-model-registry]] al cerrar el módulo. Política RLS: `auth.uid() = user_id`.

*Decisiones de modelado*

|Relación|Patrón|Justificación|
|---|---|---|
|`debts.user_id → users`|Referenciado (FK)|Igual que `accounts.user_id` — cada deuda pertenece a un usuario|
|`saldo_actual`|Calculado en tiempo de consulta, no persistido|Igual que `monto_aportado_actual` en [[ahorros-y-metas]] — se deriva de `monto_original` y de la parte de capital del historial de pagos, nunca queda desincronizado|

*Índices*

|Tabla|Campos|Tipo|Propósito|
|---|---|---|---|
|`debts`|`(user_id, status)`|B-tree compuesto|Listar deudas activas/archivadas de un usuario (CU-056)|
|`debts`|`(user_id, nombre) WHERE status = 'active'`|Único parcial|Garantizar unicidad del nombre solo entre deudas activas (RN-195)|

**Matriz de pruebas**

|#|Categoría|Escenario|Input|Resultado esperado|HTTP|
|---|---|---|---|---|---|
|1|Flujo exitoso|Crear deuda con datos mínimos|`nombre`, `tipo`, `monto_original`|Deuda creada, `saldo_actual = monto_original`|201|
|2|Flujo exitoso|Crear deuda con todos los campos opcionales|Todos los campos|Deuda creada con datos completos|201|
|3|Validación de entrada|`monto_original` faltante o cero|Sin `monto_original`|`VALIDATION_001` / `VALIDATION_012`|400|
|4|Validación de entrada|Nombre duplicado con otra deuda activa|`nombre` de una deuda activa existente|`VALIDATION_033`|409|
|5|Validación de entrada|`tipo` fuera del catálogo|`tipo="auto_usado"`|`VALIDATION_034`|400|
|6|Validación de entrada|`dia_pago` fuera de rango|`dia_pago=35`|`VALIDATION_005`|400|
|7|Autenticación / autorización|Token expirado o ausente|Sin JWT válido|`AUTH_001`|401|
|8|Error del sistema|Falla de base de datos|Simulado|`SYS_001`|500|

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-deudas-alta]]

---

### CU-056 — Listar deudas

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar todas sus deudas en una vista de tarjetas,
mostrando para cada una su nombre, tipo, saldo, monto original, porcentaje pagado, tasa de interés,
pago mensual esperado y fecha estimada de liquidación (si existe). El listado se organiza en dos
pestañas: "Activas" (`status = active`) y "Liquidadas" (`status = archived`).

**Flujo principal**

1. El usuario accede a la sección "Deudas".
2. El sistema recupera las deudas del usuario autenticado con `status = active` (pestaña "Activas"
   por defecto).
3. Para cada deuda, el sistema calcula `saldo_actual` y `porcentaje_pagado`.
4. El sistema muestra las tarjetas ordenadas por `fecha_liquidacion_estimada` más próxima primero;
   las deudas sin fecha estimada se muestran al final.
5. El usuario puede alternar a la pestaña "Liquidadas" para ver las deudas archivadas.

**Flujos alternativos / casos borde**

- Si el usuario no tiene deudas registradas, el sistema muestra un estado vacío invitando a crear la
  primera deuda (CU-055).
- Si `saldo_actual` llega a $0 o menos (por pagos que igualan o exceden el monto original), la deuda
  permanece en la pestaña "Activas" — el archivado es siempre una decisión manual del usuario, sin
  relación con el saldo (RN-204).

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — operación de solo lectura.

**Definición detallada de campos**

|Campo|Tipo de control|Obligatorio|Longitud|Formato / validación|Dependencias|Valor por defecto|Regla de negocio|
|---|---|---|---|---|---|---|---|
|`status` (filtro, pestaña)|Selección única|No|N/A|Enum: `active`, `archived`|—|`active`|Determina qué deudas se incluyen|

**Reglas de negocio**

- RN-202: `saldo_actual` se calcula en tiempo de consulta como `monto_original` menos la suma de
  `monto_capital` de todas las transacciones `pago_deuda` ligadas a esta deuda mediante `deuda_id` —
  nunca se persiste, mismo patrón que `monto_aportado_actual` en [[ahorros-y-metas]].
- RN-203: `porcentaje_pagado = (monto_original − saldo_actual) ÷ monto_original`; se muestra como 0%
  si aún no hay pagos registrados.
- RN-204: si `saldo_actual` llega a $0 o menos, la deuda permanece en `status = active` — el
  archivado es siempre una decisión manual del usuario, sin relación con el saldo (mismo criterio que
  RN-137 de [[ahorros-y-metas]], confirmado explícitamente para este módulo).
- RN-205: el listado se ordena por `fecha_liquidacion_estimada` más próxima primero; las deudas sin
  fecha estimada se muestran al final (mismo criterio de ordenamiento que CU-043 de
  [[ahorros-y-metas]]).

**Casos de uso derivados identificados**

- Ya identificados en CU-055. *Patrón Búsqueda y Filtrado:* descartado, mismo criterio.

**Validaciones**

|Campo|Tipo|Reglas|Mitigación OWASP|
|---|---|---|---|
|`status` (query param)|string|Opcional; si se envía, debe ser `active` o `archived`|A01 — Validar contra whitelist|

**Mensajes de error**

*Validación*
- `VALIDATION_004`: "El filtro de estado no es válido." *(reutilizado)*

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

|Método|Endpoint|Auth|
|---|---|---|
|GET|`/api/v1/debts?status=active`|Bearer JWT|

*Request*
```
(sin body — filtro por query param `status`)
```

*Response (éxito)*
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nombre": "string",
      "tipo": "string",
      "monto_original": "number",
      "saldo_actual": "number (calculado)",
      "porcentaje_pagado": "number (calculado)",
      "tasa_interes": "number",
      "pago_mensual_esperado": "number|null",
      "dia_pago": "number|null",
      "fecha_liquidacion_estimada": "date|null",
      "status": "active"
    }
  ]
}
```

*Modelo de información*

Reutiliza `debts` definida en CU-055. No se agregan campos nuevos.

*Decisiones de modelado*

Sin cambios respecto a CU-055.

*Índices*

Reutiliza `(user_id, status)` definido en CU-055.

**Matriz de pruebas**

|#|Categoría|Escenario|Input|Resultado esperado|HTTP|
|---|---|---|---|---|---|
|1|Flujo exitoso|Listar deudas activas con datos completos|Usuario con 3 deudas activas|Listado con campos calculados correctos|200|
|2|Flujo exitoso|Deuda con saldo en $0|`saldo_actual <= 0`|Deuda permanece en "Activas" (RN-204)|200|
|3|Flujo exitoso|Pestaña "Liquidadas"|`status=archived`|Solo deudas archivadas|200|
|4|Flujo exitoso|Usuario sin deudas|Usuario nuevo|Listado vacío, sin error|200|
|5|Validación de entrada|Filtro de estado inválido|`status=eliminada`|`VALIDATION_004`|400|
|6|Autenticación / autorización|Token expirado o ausente|Sin JWT válido|`AUTH_001`|401|
|7|Error del sistema|Falla de base de datos|Simulado|`SYS_001`|500|

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-deudas-listado]]

---

### CU-057 — Ver detalle de una deuda

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar el detalle completo de una deuda específica,
incluyendo su historial propio de pagos — cada uno con fecha, monto total, desglose de capital e
interés, y la cuenta de origen.

**Flujo principal**

1. El usuario selecciona una deuda desde el listado (CU-056).
2. El sistema recupera el detalle de la deuda y calcula sus campos derivados (igual que CU-056).
3. El sistema recupera las transacciones con `deuda_id` igual a esa deuda, ordenadas
   cronológicamente en orden descendente.
4. El sistema muestra el detalle junto con el historial de pagos, indicando para cada uno la cuenta
   de origen y el desglose capital/interés.

**Flujos alternativos / casos borde**

- Si la deuda no tiene pagos (recién creada), el historial se muestra vacío; `saldo_actual` es igual
  a `monto_original`.

**Precondiciones**

- La deuda debe existir y pertenecer al usuario autenticado.

**Postcondiciones**

- Ninguna — operación de solo lectura.

**Definición detallada de campos**

No aplica — este CU no captura datos nuevos, solo consulta un registro existente y su historial.

**Reglas de negocio**

- RN-206: el historial de una deuda incluye todas las transacciones `tipo = pago_deuda` cuyo
  `deuda_id` corresponda a esta deuda, mostrando la cuenta de origen (`account_id`) y el desglose
  `monto_capital`/`monto_interes` de cada una — mismo patrón que el historial de movimientos de una
  cuenta (CU-003 de [[cuentas]]) o de una meta (CU-044 de [[ahorros-y-metas]]).

**Casos de uso derivados identificados**

- Ninguno adicional a los ya identificados en CU-055.

**Validaciones**

|Campo|Tipo|Reglas|Mitigación OWASP|
|---|---|---|---|
|`id` (path param)|uuid|Requerido, debe existir y pertenecer al usuario autenticado|A01 — Control de acceso a nivel de objeto (IDOR)|

**Mensajes de error**

*Lógica de negocio*
- `BIZ_031`: "La deuda solicitada no existe."

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

|Método|Endpoint|Auth|
|---|---|---|
|GET|`/api/v1/debts/{id}`|Bearer JWT|

*Request*
```
(sin body)
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "string",
    "tipo": "string",
    "monto_original": "number",
    "saldo_actual": "number (calculado)",
    "porcentaje_pagado": "number (calculado)",
    "tasa_interes": "number",
    "pago_mensual_esperado": "number|null",
    "dia_pago": "number|null",
    "fecha_liquidacion_estimada": "date|null",
    "status": "string",
    "pagos": [
      {
        "id": "uuid",
        "account_id": "uuid",
        "monto_capital": "number",
        "monto_interes": "number",
        "fecha": "timestamptz",
        "nota": "string|null"
      }
    ]
  }
}
```

*Modelo de información*

Consulta `debts` (CU-055) y `transactions` filtrando por `deuda_id` (ver CU-060). No se agregan
campos nuevos.

*Decisiones de modelado*

Sin cambios respecto a CU-055/CU-060.

*Índices*

Reutiliza `(deuda_id, fecha desc) WHERE deuda_id IS NOT NULL`, definido formalmente en CU-060.

**Matriz de pruebas**

|#|Categoría|Escenario|Input|Resultado esperado|HTTP|
|---|---|---|---|---|---|
|1|Flujo exitoso|Ver detalle con pagos previos|Deuda con pagos registrados|Detalle completo, historial ordenado cronológicamente con desglose capital/interés|200|
|2|Flujo exitoso|Ver detalle sin pagos|Deuda recién creada|Historial vacío, `saldo_actual = monto_original`|200|
|3|Recurso no encontrado|`id` inexistente o de otro usuario|`id` inválido|`BIZ_031`|404|
|4|Autenticación / autorización|Token expirado o ausente|Sin JWT válido|`AUTH_001`|401|
|5|Error del sistema|Falla de base de datos|Simulado|`SYS_001`|500|

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-deudas-detalle]]

---

### CU-058 — Editar deuda

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario modificar los datos de una deuda existente: nombre, tipo,
monto original, tasa de interés, pago mensual esperado, día de pago y fecha estimada de
liquidación. A diferencia de `saldo_inicial` en [[cuentas]] (no editable), `monto_original` de una
deuda sí es editable en cualquier momento — permite corregir un dato mal capturado o ajustar
retroactivamente el porcentaje pagado mostrado.

**Flujo principal**

1. El usuario accede al detalle de una deuda (CU-057) y selecciona "Editar".
2. El sistema muestra el formulario pre-llenado con los datos actuales.
3. El usuario modifica nombre, tipo, monto original, tasa de interés, pago mensual esperado, día de
   pago y/o fecha estimada de liquidación.
4. El usuario confirma los cambios.
5. El sistema valida los datos ingresados.
6. El sistema actualiza el registro de la deuda y `updated_at`.
7. El sistema muestra la deuda actualizada, con sus campos calculados recalculados.

**Flujos alternativos / casos borde**

- Si el nuevo nombre coincide con otra deuda activa del mismo usuario (distinta de la que se edita),
  el sistema rechaza el cambio.
- Cambiar `monto_original` no afecta el historial de pagos ya registrado — solo cambia el valor base
  sobre el que se recalculan `saldo_actual` y `porcentaje_pagado` hacia adelante.
- Editar una deuda archivada está permitido (por ejemplo, corregir el nombre); no requiere
  reactivarla primero.

**Precondiciones**

- El usuario debe estar autenticado.
- La deuda debe existir y pertenecer al usuario autenticado.

**Postcondiciones**

- Se actualizan `nombre`, `tipo`, `monto_original`, `tasa_interes`, `pago_mensual_esperado`,
  `dia_pago` y/o `fecha_liquidacion_estimada` del documento en `debts`.
- Se actualiza `updated_at`.

**Definición detallada de campos**

|Campo|Tipo de control|Obligatorio|Longitud|Formato / validación|Dependencias|Valor por defecto|Regla de negocio|
|---|---|---|---|---|---|---|---|
|`nombre`|Texto|No|2–50 caracteres|Único entre deudas activas (excluyendo la actual)|—|valor actual|RN-208|
|`tipo`|Selección única|No|N/A|Enum: `auto`, `hipoteca`, `personal`, `otro`|—|valor actual|RN-207|
|`monto_original`|Numérico|No|—|Decimal mayor a cero|—|valor actual|RN-207|
|`tasa_interes`|Numérico (%)|No|—|Decimal mayor o igual a cero|—|valor actual|RN-207|
|`pago_mensual_esperado`|Numérico|No|—|Decimal mayor a cero|—|valor actual|RN-207|
|`dia_pago`|Numérico (entero)|No|—|Entero entre 1 y 31|—|valor actual|RN-207|
|`fecha_liquidacion_estimada`|Selector de fecha|No|—|date, o `null` para quitarla|—|valor actual|RN-207|

**Reglas de negocio**

- RN-207: `nombre`, `tipo`, `monto_original`, `tasa_interes`, `pago_mensual_esperado`, `dia_pago` y
  `fecha_liquidacion_estimada` son editables en cualquier momento, incluso si la deuda ya tiene pagos
  registrados y sin importar si `status = active` o `archived` (mismo criterio que RN-133 de
  [[ahorros-y-metas]]).
- RN-208: `nombre` debe seguir siendo único entre deudas activas al editarse, excluyendo la propia
  deuda de la comparación.

**Casos de uso derivados identificados**

- Ninguno adicional a los ya identificados en CU-055.

**Validaciones**

|Campo|Tipo|Reglas|Mitigación OWASP|
|---|---|---|---|
|`nombre`|string|Opcional; si se envía, único entre deudas activas (excluyendo la actual)|A03 — Sanitizar entrada; A07 — Codificar en salida|
|`tipo`|string|Opcional; si se envía, enum cerrado|A03 — Validar contra whitelist|
|`monto_original`|number|Opcional; si se envía, decimal mayor a cero|A03 — Validar tipo y rango numérico|
|`tasa_interes`|number|Opcional; si se envía, decimal mayor o igual a cero|A03 — Validar tipo y rango numérico|
|`pago_mensual_esperado`|number|Opcional; si se envía, decimal mayor a cero|A03 — Validar tipo y rango numérico|
|`dia_pago`|integer|Opcional; si se envía, entero entre 1 y 31|A03 — Validar rango|
|`id` (path param)|uuid|Requerido, debe existir y pertenecer al usuario autenticado|A01 — Control de acceso a nivel de objeto (IDOR)|

**Mensajes de error**

*Validación*
- `VALIDATION_033`, `VALIDATION_034`, `VALIDATION_012`, `VALIDATION_006`, `VALIDATION_005`
  *(reutilizados — ver CU-055)*

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Lógica de negocio*
- `BIZ_031`: "La deuda solicitada no existe." *(reutilizado — ver CU-057)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

|Método|Endpoint|Auth|
|---|---|---|
|PATCH|`/api/v1/debts/{id}`|Bearer JWT|

*Request*
```json
{
  "nombre": "string (opcional)",
  "tipo": "string (opcional)",
  "monto_original": "number (opcional, > 0)",
  "tasa_interes": "number (opcional, >= 0)",
  "pago_mensual_esperado": "number (opcional, > 0)",
  "dia_pago": "number (opcional, 1-31)",
  "fecha_liquidacion_estimada": "date|null (opcional)"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "string",
    "tipo": "string",
    "monto_original": "number",
    "tasa_interes": "number",
    "pago_mensual_esperado": "number|null",
    "dia_pago": "number|null",
    "fecha_liquidacion_estimada": "date|null",
    "updated_at": "timestamptz"
  },
  "message": "Deuda actualizada exitosamente."
}
```

*Modelo de información*

Reutiliza `debts` definida en CU-055. No se agregan campos nuevos.

*Decisiones de modelado*

Sin cambios respecto a CU-055.

*Índices*

Reutiliza `(user_id, nombre) WHERE status = 'active'` para la validación de unicidad (excluyendo el
`id` propio).

**Matriz de pruebas**

|#|Categoría|Escenario|Input|Resultado esperado|HTTP|
|---|---|---|---|---|---|
|1|Flujo exitoso|Editar nombre y tipo|Datos válidos|Deuda actualizada|200|
|2|Flujo exitoso|Editar monto original|Nuevo `monto_original`|`saldo_actual` y `porcentaje_pagado` recalculados|200|
|3|Flujo exitoso|Quitar fecha estimada de liquidación|`fecha_liquidacion_estimada=null`|Deuda sin fecha estimada|200|
|4|Flujo exitoso|Editar deuda archivada|Deuda con `status=archived`|Deuda actualizada sin requerir reactivación|200|
|5|Validación de entrada|Nombre duplicado con otra deuda activa|`nombre` de otra deuda activa|`VALIDATION_033`|409|
|6|Validación de entrada|`tipo` fuera del catálogo|`tipo="crypto"`|`VALIDATION_034`|400|
|7|Recurso no encontrado|Editar deuda inexistente o ajena|`id` inválido o de otro usuario|`BIZ_031`|404|
|8|Autenticación / autorización|Token expirado o ausente|Sin JWT válido|`AUTH_001`|401|
|9|Error del sistema|Falla de base de datos|Simulado|`SYS_001`|500|

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-deudas-alta]] (formulario compartido con alta)

---

### CU-059 — Archivar (y reactivar) deuda

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario dar de baja una deuda sin eliminar su historial. El sistema
cambia el `status` de la deuda a `archived`, moviéndola a la pestaña "Liquidadas" (CU-056). Una
deuda archivada deja de estar disponible como destino de nuevos pagos y como opción presupuestable
en [[presupuesto]], pero conserva su historial y sigue siendo consultable. El archivado es siempre
una decisión manual —no ocurre automáticamente al llegar el saldo a $0 (RN-204).

**Flujo principal**

1. El usuario accede al detalle de una deuda (CU-057) y selecciona "Archivar".
2. El sistema muestra un mensaje de confirmación explicando que la deuda dejará de estar disponible
   para nuevos pagos, pero su historial se conserva.
3. El usuario confirma la acción.
4. El sistema actualiza el `status` de la deuda a `archived`.
5. El sistema mueve la deuda a la pestaña "Liquidadas" y la retira de los selectores de deuda al
   registrar pagos.

**Flujos alternativos / casos borde**

- Si la deuda ya se encuentra archivada, el sistema rechaza la operación e informa que ya está
  archivada.
- El usuario puede reactivar una deuda archivada desde el listado (cambiando `status` de vuelta a
  `active`); este flujo se resuelve con el mismo endpoint, no se documenta como CU independiente por
  ser simétrico y de bajo volumen — mismo criterio que CU-046 de [[ahorros-y-metas]].
- Archivar una deuda con saldo en $0 o negativo es una acción idéntica a archivar cualquier otra
  deuda — no hay una ruta especial de "marcar como liquidada".

**Precondiciones**

- El usuario debe estar autenticado.
- La deuda debe existir, pertenecer al usuario autenticado, y encontrarse en `status = active` (para
  archivar) o `status = archived` (para reactivar).

**Postcondiciones**

- El `status` de la deuda cambia a `archived` (o de vuelta a `active` en una reactivación).
- El resto de los campos permanece sin cambios.
- La deuda se mueve entre las pestañas "Activas" / "Liquidadas" del listado (CU-056).

**Definición detallada de campos**

No aplica — este CU no captura datos nuevos, solo modifica el campo `status` de un registro
existente.

|Campo|Tipo de control|Obligatorio|Longitud|Formato / validación|Dependencias|Valor por defecto|Regla de negocio|
|---|---|---|---|---|---|---|---|
|`status`|N/A (acción del sistema)|N/A|N/A|Enum: `active` ↔ `archived`|—|—|RN-209, RN-210, RN-211|

**Reglas de negocio**

- RN-209: una deuda archivada no está disponible como destino de nuevos pagos (CU-060) ni como
  opción presupuestable en [[presupuesto]], pero conserva su historial de pagos y sigue siendo
  consultable (CU-057).
- RN-210: no se puede archivar una deuda que ya se encuentra en `status = archived`.
- RN-211: reactivar una deuda (`archived → active`) se resuelve con el mismo endpoint que archivar
  (cambio inverso de `status`) — no requiere un CU independiente, mismo criterio que CU-005 de
  [[cuentas]] y CU-046 de [[ahorros-y-metas]].
- RN-212: archivar una deuda es siempre una decisión manual del usuario, sin relación con el saldo
  (ver RN-204).

**Casos de uso derivados identificados**

- Reactivación de deuda archivada: se resuelve con el mismo endpoint (cambio inverso de `status`),
  no requiere un CU independiente.

**Validaciones**

|Campo|Tipo|Reglas|Mitigación OWASP|
|---|---|---|---|
|`id` (path param)|uuid|Requerido, debe existir y pertenecer al usuario autenticado|A01 — Control de acceso a nivel de objeto|

**Mensajes de error**

*Lógica de negocio*
- `BIZ_031`: "La deuda solicitada no existe." *(reutilizado)*
- `BIZ_032`: "Esta deuda ya se encuentra archivada."

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

|Método|Endpoint|Auth|
|---|---|---|
|PATCH|`/api/v1/debts/{id}/status`|Bearer JWT|

*Request*
```json
{
  "status": "string (requerido, enum: active|archived)"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "string",
    "updated_at": "timestamptz"
  },
  "message": "Deuda archivada exitosamente."
}
```

*Modelo de información*

Reutiliza `debts` definida en CU-055. No se agregan campos nuevos.

*Decisiones de modelado*

Sin cambios respecto a CU-055.

*Índices*

Reutiliza `(user_id, status)` definido en CU-055.

**Matriz de pruebas**

|#|Categoría|Escenario|Input|Resultado esperado|HTTP|
|---|---|---|---|---|---|
|1|Flujo exitoso|Archivar deuda activa|Deuda con `status=active`|`status=archived`|200|
|2|Flujo exitoso|Reactivar deuda archivada|Deuda con `status=archived`|`status=active`|200|
|3|Flujo exitoso|Archivar deuda con saldo en $0|`saldo_actual <= 0`|Se archiva con normalidad, sin flujo especial|200|
|4|Lógica de negocio|Archivar deuda ya archivada|Deuda con `status=archived`, se pide archivar de nuevo|`BIZ_032`|409|
|5|Recurso no encontrado|Deuda inexistente o ajena|`id` inválido o de otro usuario|`BIZ_031`|404|
|6|Autenticación / autorización|Token expirado o ausente|Sin JWT válido|`AUTH_001`|401|
|7|Error del sistema|Falla de base de datos|Simulado|`SYS_001`|500|

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-deudas-detalle]] (acción "Archivar" con modal de confirmación)

---

### CU-060 — Registrar pago a una deuda

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario registrar un pago hacia una deuda, desde una cuenta de
débito o efectivo propia. A diferencia de una transferencia entre cuentas propias, este movimiento
**no** genera dos documentos enlazados — se registra como una única transacción de
`tipo = pago_deuda`, referenciando tanto la cuenta de origen (`account_id`) como la deuda destino
(`deuda_id`). A diferencia de una aportación a meta de [[ahorros-y-metas]], el pago se captura
dividido en capital e interés (el dato que el banco reporta en el estado de cuenta) — el saldo de la
deuda solo se reduce por la parte de capital, ya que el interés es el costo del financiamiento, no
una reducción de lo adeudado.

**Flujo principal**

1. El usuario captura el pago y selecciona el chip "Pago a deuda" dentro de Registrar movimiento.
2. El sistema muestra el selector de deuda destino (solo deudas propias, `status = active`), el
   selector de cuenta de origen (débito o efectivo, propia, activa), y dos campos de monto: capital
   e interés.
3. El usuario captura ambos montos y, opcionalmente, ajusta la fecha y captura una nota.
4. El usuario confirma el registro.
5. El sistema valida los datos ingresados, incluyendo que el monto de capital no exceda el saldo
   actual de la deuda.
6. El sistema crea el documento en `transactions` con `tipo = pago_deuda`, `account_id`, `deuda_id`,
   `monto` negativo (igual a `monto_capital + monto_interes`), `monto_capital`, `monto_interes`,
   `category_id = null`, `transaccion_relacionada_id = null`, y actualiza `saldo_actual` de la cuenta
   de origen de forma atómica junto con la creación del registro.
7. El sistema muestra el movimiento en el historial de la cuenta y en el historial de la deuda.

**Flujos alternativos / casos borde**

- Si la cuenta seleccionada está archivada o no es de tipo débito/efectivo, el sistema rechaza el
  registro.
- Si la deuda seleccionada está archivada, el sistema rechaza el registro (RN-219).
- Si `monto_capital` excede el saldo actual de la deuda, el sistema rechaza el registro (RN-221) —
  mismo criterio que un retiro de meta que excede lo aportado (RN-146 de [[ahorros-y-metas]]).
- El `concepto` se genera automáticamente ("Pago a deuda: {nombre de la deuda}") — no es capturado
  por el usuario, mismo criterio que el `concepto` de una aportación a meta.

**Precondiciones**

- El usuario debe estar autenticado.
- La cuenta de origen debe existir, pertenecer al usuario, ser de tipo débito o efectivo, y
  encontrarse en `status = active`.
- La deuda debe existir, pertenecer al usuario, y encontrarse en `status = active`.
- `monto_capital` no debe exceder el saldo actual de la deuda.

**Postcondiciones**

- Se crea un documento en `transactions` con `tipo = pago_deuda`.
- `saldo_actual` de la cuenta de origen disminuye en `monto_capital + monto_interes`.
- El saldo calculado de la deuda disminuye en `monto_capital` (RN-202, RN-216).

**Definición detallada de campos**

|Campo|Tipo de control|Obligatorio|Longitud|Formato / validación|Dependencias|Valor por defecto|Regla de negocio|
|---|---|---|---|---|---|---|---|
|`deuda_id`|Selección (deuda existente)|Sí|—|Debe referenciar una deuda propia y activa|—|—|RN-219|
|`cuenta_origen_id`|Selección (cuenta existente)|Sí|—|Debe referenciar una cuenta propia, débito/efectivo, activa|—|—|RN-218|
|`monto_capital`|Numérico|Sí|—|Decimal mayor o igual a cero; no mayor al saldo actual de la deuda|—|—|RN-215, RN-221|
|`monto_interes`|Numérico|Sí|—|Decimal mayor o igual a cero|—|—|RN-215|
|`fecha`|Selector de fecha|No|—|timestamptz|—|hoy|—|
|`nota`|Texto|No|máx. 140 caracteres|—|—|`null`|—|

**Reglas de negocio**

- RN-213: un pago genera un **único** documento en `transactions`, con `tipo = pago_deuda`,
  `account_id` (cuenta de origen) y `deuda_id` (la deuda destino) — mismo patrón de documento único
  que una aportación a meta (RN-138 de [[ahorros-y-metas]]), sin segundo documento enlazado.
- RN-214: el monto total pagado (`monto_capital + monto_interes`) se registra con signo negativo en
  la cuenta de origen y actualiza `saldo_actual` de dicha cuenta de forma atómica junto con la
  creación del documento.
- RN-215: el pago se captura dividido en `monto_capital` y `monto_interes`, ambos mayores o iguales a
  cero — a diferencia de una aportación a meta, no existe un único `monto` capturado por el usuario;
  el `monto` de la transacción es la suma de ambos, con signo.
- RN-216: el saldo calculado de la deuda (RN-202) solo se reduce por `monto_capital` —
  `monto_interes` no reduce el saldo, es el costo del financiamiento.
- RN-217: `category_id` y `transaccion_relacionada_id` quedan en `null` para este tipo — no lleva
  categoría (mismo criterio que transferencia, pago a tarjeta y aportación/retiro de meta) ni enlace
  a un segundo documento.
- RN-218: la cuenta de origen debe ser de tipo débito o efectivo, estar en `status = active`, y
  pertenecer al usuario.
- RN-219: la deuda debe estar en `status = active` para recibir nuevos pagos.
- RN-220: el `concepto` se genera automáticamente como "Pago a deuda: {nombre de la deuda}" — no es
  capturado por el usuario.
- RN-221: `monto_capital` no puede ser mayor al saldo actual de la deuda al momento del pago — evita
  que una deuda quede con un saldo calculado negativo, mismo criterio que RN-146 de
  [[ahorros-y-metas]] para un retiro de meta.

**Casos de uso derivados identificados**

- Ninguno adicional — reutiliza CU-017/CU-018 de [[transacciones]] para editar/eliminar (ver
  "Cambios en otros documentos").

**Validaciones**

|Campo|Tipo|Reglas|Mitigación OWASP|
|---|---|---|---|
|`deuda_id`|uuid|Requerido; debe existir, pertenecer al usuario, y estar `status = active`|A01 — Control de acceso a nivel de objeto (IDOR)|
|`cuenta_origen_id`|uuid|Requerido; debe existir, pertenecer al usuario, ser débito/efectivo, `status = active`|A01 — Control de acceso a nivel de objeto (IDOR)|
|`monto_capital`|number|Requerido, decimal mayor o igual a cero, no mayor al saldo actual de la deuda|A03 — Validar tipo, rango numérico, y regla de negocio antes de persistir|
|`monto_interes`|number|Requerido, decimal mayor o igual a cero|A03 — Validar tipo y rango numérico|
|`nota`|string|Opcional, máx. 140 caracteres|A03 — Sanitizar entrada; A07 — Codificar en salida|

**Mensajes de error**

*Validación*
- `VALIDATION_001`: "El campo {campo} es obligatorio." *(reutilizado)*
- `VALIDATION_006`: "El monto no puede ser negativo." *(reutilizado)*
- `VALIDATION_035`: "El capital y el interés deben sumar el monto total pagado."

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Lógica de negocio*
- `BIZ_010`: "La cuenta seleccionada no existe, no te pertenece, o está archivada." *(reutilizado —
  ver CU-013 de [[transacciones]])*
- `BIZ_031`: "La deuda seleccionada no existe, no te pertenece, o está archivada." *(reutilizado —
  ver CU-057, mensaje ampliado para este contexto)*
- `BIZ_033`: "El monto de capital no puede ser mayor al saldo actual de la deuda."

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

|Método|Endpoint|Auth|
|---|---|---|
|POST|`/api/v1/debts/{deuda_id}/payments`|Bearer JWT|

*Request*
```json
{
  "cuenta_origen_id": "uuid (requerido)",
  "monto_capital": "number (requerido, >= 0)",
  "monto_interes": "number (requerido, >= 0)",
  "fecha": "timestamptz (opcional, default: hoy)",
  "nota": "string (opcional, máx 140 caracteres)"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tipo": "pago_deuda",
    "account_id": "uuid",
    "deuda_id": "uuid",
    "monto": "number (negativo, = -(monto_capital + monto_interes))",
    "monto_capital": "number",
    "monto_interes": "number",
    "fecha": "timestamptz",
    "concepto": "string"
  },
  "message": "Pago registrado exitosamente."
}
```

*Modelo de información*
```json
// Tabla: transactions (extensión — ver data-model-registry)
{
  "deuda_id": "uuid|null (FK → debts.id; obligatorio si tipo=pago_deuda; mutuamente excluyente con category_id y meta_id)",
  "monto_capital": "numeric(14,2)|null (obligatorio si tipo=pago_deuda)",
  "monto_interes": "numeric(14,2)|null (obligatorio si tipo=pago_deuda)"
}
```

> Extiende el esquema definitivo de `transactions` cerrado en [[transacciones]] y ya extendido por
> [[ahorros-y-metas]] (`meta_id`). Se agrega `deuda_id`, `monto_capital` y `monto_interes`; se agrega
> el valor `pago_deuda` al enum `tipo`. Registrar en [[data-model-registry]] al cerrar el módulo.

*Decisiones de modelado*

|Relación|Patrón|Justificación|
|---|---|---|
|`transactions.deuda_id → debts`|Referenciado (FK), nullable|Un movimiento de pago pertenece a una deuda; mutuamente excluyente con `category_id` y `meta_id`, mismo patrón que `budgets.category_id`/`meta_id`/`deuda_id`|
|Fila única (sin `transaccion_relacionada_id`)|Un solo lado explícito, consultado dos veces|A diferencia de transferencia/pago a tarjeta, una deuda no es una cuenta — no existe un segundo lado real que requiera su propia fila; la misma fila se filtra por `account_id` o por `deuda_id` según el historial que se consulte|
|`monto_capital` / `monto_interes`|Columnas adicionales sobre `transactions`, exclusivas de `tipo=pago_deuda`|Ningún otro tipo de transacción necesita dividir su monto — extender solo para este tipo evita introducir una tabla de líneas de detalle para un caso de uso único|

*Índices*

|Tabla|Campos|Tipo|Propósito|
|---|---|---|---|
|`transactions`|`(deuda_id, fecha desc) WHERE deuda_id IS NOT NULL`|Parcial|Listar pagos de una deuda en orden cronológico descendente (CU-057)|

**Matriz de pruebas**

|#|Categoría|Escenario|Input|Resultado esperado|HTTP|
|---|---|---|---|---|---|
|1|Flujo exitoso|Registrar pago válido|Cuenta y deuda activas, capital e interés válidos|Transacción creada, `saldo_actual` de la cuenta disminuye, saldo de la deuda disminuye por el capital|201|
|2|Validación de entrada|Montos faltantes|Sin `monto_capital` o `monto_interes`|`VALIDATION_001`|400|
|3|Lógica de negocio|Cuenta archivada o de tipo crédito|`cuenta_origen_id` inválida para el flujo|`BIZ_010`|404|
|4|Lógica de negocio|Deuda archivada o ajena|`deuda_id` inválido para el flujo|`BIZ_031`|404|
|5|Lógica de negocio|Capital mayor al saldo de la deuda|`monto_capital` > saldo actual|`BIZ_033`|409|
|6|Autenticación / autorización|Token expirado o ausente|Sin JWT válido|`AUTH_001`|401|
|7|Error del sistema|Falla de base de datos a medio proceso|Simulado|`SYS_001`, ningún documento parcial persiste|500|

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-transacciones-alta]] (variante "Pago a deuda": selector de deuda +
  selector de cuenta de origen + campos de capital e interés, sin selector de categoría)

---

## Cambios en otros documentos

Este módulo modifica reglas y campos ya cerrados en otros documentos. Se detallan aquí para
aplicarlos como parte del mismo cierre — no son cambios especulativos, son consecuencia directa de
las decisiones de este módulo.

### [[presupuesto]]

- Se agrega `budgets.deuda_id` (uuid|null, FK → `debts.id`), mutuamente excluyente con `category_id`
  y `meta_id` — mismo patrón que `budgets.meta_id`.
- **RN-222** (nueva): `budgets.deuda_id` sigue exactamente el mismo patrón que `budgets.category_id`/
  `meta_id` — un presupuesto por deuda y mes, upsert al guardar, eliminación del documento al dejar
  el monto vacío (mismo criterio que RN-059/RN-060/RN-150).
- **RN-223** (nueva): el "real" mensual de una deuda en Presupuesto se calcula como la suma del monto
  total (`monto_capital + monto_interes`) de las transacciones `pago_deuda` de esa deuda dentro del
  mes consultado — a diferencia del saldo de la deuda (RN-216, que solo cuenta capital), lo
  presupuestado y lo gastado en el mes reflejan la salida de efectivo completa, capital e interés.
- El grupo "Deudas" en Presupuesto (CU-019, CU-022) se agrega como una tercera sección colapsable,
  junto a categorías y metas: un renglón por cada deuda activa del usuario. `RN-075` (Total por
  asignar) se revisa para restar también el presupuesto de deudas activas, junto con el de grupos
  Outflow y metas.
- Solo se presupuestan deudas en `status = active` (mismo criterio que categorías archivadas y metas
  archivadas, que no aparecen como opción — RN-058, RN-070).

### [[transacciones]]

- El enum `tipo` de `transactions` gana el valor `pago_deuda`.
- Se agregan las columnas `deuda_id`, `monto_capital` y `monto_interes`, exclusivas de
  `tipo = pago_deuda`.
- La condición de `transaccion_relacionada_id` no cambia — sigue acotada a
  `tipo = transferencia|pago_tarjeta`; `pago_deuda` es un documento único, igual que
  `aportacion_meta`/`retiro_meta`.
- **RN-224** (nueva): CU-017 (Editar transacción) gana `deuda_id`, `monto_capital` y `monto_interes`
  como campos editables, bajo las mismas condiciones de propiedad y estado activo que ya aplican a
  `category_id`/`meta_id` (RN-053, RN-152).
- CU-018 (Eliminar transacción) aplica sin cambios estructurales a `pago_deuda`: al ser un documento
  único, la eliminación revierte `saldo_actual` de la única cuenta involucrada, sin la lógica de
  "transacción relacionada eliminada" que sí aplica a transferencia y pago a tarjeta.

### [[data-model-registry]]

Se registran en el cierre de este módulo: la nueva tabla `debts`, la extensión de `transactions`
(`deuda_id`, `monto_capital`, `monto_interes`, nuevo valor de enum `pago_deuda`), la extensión de
`budgets` (`deuda_id`), sus índices, nuevas relaciones, el diagrama ER actualizado, y el índice de
numeración.

## Historial de cambios

|Fecha|Cambio|CU afectado|Impacto en otros documentos|
|---|---|---|---|
|2026-08-24|Se crea el módulo Créditos y Deudas: tabla `debts` (deuda externa con nombre, tipo, monto original, tasa de interés, pago mensual esperado, día de pago y fecha estimada de liquidación opcional); se introduce el tipo `pago_deuda` en `transactions` como documento único vía el nuevo campo `deuda_id`, con el pago dividido en `monto_capital`/`monto_interes` — el saldo de la deuda solo baja por capital, nunca por interés. Se agregan CU-055 a CU-060. Cada deuda activa gana su propio renglón presupuestable en [[presupuesto]] (`budgets.deuda_id`), igual que cada meta de ahorro. El archivado es siempre manual, sin relación con que el saldo llegue a $0. Con este documento se completan los 9 documentos de `docs/pdr/`, cerrando la fase de Casos de uso y Requerimientos del alcance completo.|CU-055 a CU-060|Se actualiza [[data-model-registry]] con la tabla `debts`, la extensión de `transactions` y `budgets`, nuevas relaciones, diagrama ER e índice de numeración. Se modifica [[presupuesto]]: se agrega `budgets.deuda_id`, un renglón presupuestable por deuda activa, y se revisa `RN-075` (Total por asignar). Se modifica [[transacciones]]: se agrega `pago_deuda` al enum `tipo`, se agregan `deuda_id`/`monto_capital`/`monto_interes`, y CU-017 gana los tres como campos editables.|

## Referencias

- [[estrategia]]
- [[brief-ux]]
- [[data-model-registry]]
- [[cuentas]]
- [[categorias]]
- [[transacciones]]
- [[presupuesto]]
- [[ahorros-y-metas]]
- [[backlog]]
