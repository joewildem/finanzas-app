---
modulo: "Ahorros y Metas"
status: cerrado
---
---

# Requerimientos — Ahorros y Metas

## Resumen del módulo

El módulo de Ahorros y Metas permite al usuario definir metas de ahorro con nombre, emoji, monto objetivo y, opcionalmente, un monto inicial y una fecha límite, dando seguimiento a su avance mediante aportaciones y retiros. Reutiliza el tipo `aportacion_meta` ya reservado en `transactions` (ver [[transacciones]] y [[data-model-registry]]) e introduce el tipo simétrico `retiro_meta`; ambos se registran como un **único documento** en `transactions`, referenciando la cuenta afectada y la meta correspondiente mediante el nuevo campo `meta_id` — a diferencia de transferencia y pago a tarjeta, no requiere un segundo documento enlazado, ya que una meta no es una cuenta. Cada meta activa se convierte además en su propia línea presupuestable dentro de [[presupuesto]], sustituyendo el pseudo-registro único `categoria_reservada="ahorros"` que existía hasta este cierre (ver "Cambios en otros documentos"). Una meta es independiente de cualquier cuenta específica — cualquier cuenta de débito o efectivo puede aportar o recibir un retiro — y su archivado es siempre una decisión manual del usuario, sin relación con haber alcanzado el monto objetivo.

## Casos de uso

### CU-042 — Crear meta de ahorro

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario crear una nueva meta de ahorro, capturando un nombre, un emoji, un monto objetivo y, opcionalmente, un monto inicial (si ya contaba con algo ahorrado antes de registrar la meta en la aplicación) y una fecha límite. La meta nace en `status = active`, sin movimientos propios — el monto aportado a la fecha se calcula, no se captura, a partir del monto inicial y del historial de aportaciones y retiros que se registren después (CU-047, CU-048).

**Flujo principal**

1. El usuario accede a "Crear meta" desde el listado de metas (CU-043).
2. El sistema muestra el formulario: nombre, selector de emoji, monto objetivo, monto inicial (opcional) y fecha límite (opcional).
3. El usuario captura los datos y confirma.
4. El sistema valida los datos ingresados.
5. El sistema crea el documento en `savings_goals` con `status = active`.
6. El sistema muestra la meta recién creada en el listado, con monto aportado igual al monto inicial capturado (o $0 si no se definió).

**Flujos alternativos / casos borde**

- Si el usuario no selecciona un emoji, el sistema asigna uno genérico por defecto.
- Si no se define fecha límite, la meta se muestra sin fecha ni "tiempo restante" en el listado y en el detalle (CU-043, CU-044).
- Si `monto_inicial` es mayor o igual a `monto_objetivo`, la meta se crea de todas formas — nace ya alcanzada o superada; el sistema no lo bloquea ni advierte de forma especial.

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Se crea un documento en `savings_goals` perteneciente al usuario, con `status = active`.
- El monto aportado calculado de la meta recién creada es igual a `monto_inicial`.

**Definición detallada de campos**

|Campo|Tipo de control|Obligatorio|Longitud|Formato / validación|Dependencias|Valor por defecto|Regla de negocio|
|---|---|---|---|---|---|---|---|
|`nombre`|Texto|Sí|2–50 caracteres|Letras, números y espacios; único entre metas activas del usuario|—|—|RN-120|
|`emoji`|Selector de emoji nativo|No|1 carácter (unicode)|Cualquier emoji soportado por el dispositivo|—|💰 (genérico)|RN-121|
|`monto_objetivo`|Numérico|Sí|—|Decimal mayor a cero|—|—|RN-122|
|`monto_inicial`|Numérico|No|—|Decimal mayor o igual a cero|—|0|RN-123|
|`fecha_limite`|Selector de fecha|No|—|date, igual o posterior a hoy|—|`null`|RN-124|

**Reglas de negocio**

- RN-120: `nombre` debe ser único entre las metas en `status = active` del usuario; no se valida contra metas archivadas.
- RN-121: `emoji` es opcional y puramente visual, sin catálogo cerrado — el usuario puede capturar cualquier emoji disponible en su dispositivo (a diferencia de `categories.icono`, que usa un catálogo curado de íconos).
- RN-122: `monto_objetivo` es obligatorio y debe ser un número positivo mayor a cero.
- RN-123: `monto_inicial` es opcional (default 0); si se captura, debe ser mayor o igual a cero. No genera un documento en `transactions` — es únicamente el punto de partida del cálculo de `monto_aportado_actual` (mismo patrón que `saldo_inicial` en [[cuentas]]).
- RN-124: `fecha_limite` es opcional; si se captura, debe ser una fecha igual o posterior a hoy.
- RN-125: una meta puede crearse con `monto_inicial` mayor o igual a `monto_objetivo` — nace ya alcanzada o superada, sin bloqueo ni validación especial (ver RN-127 para el cálculo de porcentaje sin tope).

**Casos de uso derivados identificados**

- CU-043: Listar metas de ahorro
- CU-044: Ver detalle de una meta
- CU-045: Editar meta de ahorro
- CU-046: Archivar (y reactivar) meta de ahorro
- _Patrón Búsqueda y Filtrado:_ evaluado y descartado — mismo criterio que [[cuentas]] (CU-001), volumen bajo de metas esperado por usuario.

**Validaciones**

|Campo|Tipo|Reglas|Mitigación OWASP|
|---|---|---|---|
|`nombre`|string|Requerido, 2–50 caracteres, único entre metas activas del usuario|A03 — Sanitizar entrada; A07 — Codificar en salida|
|`emoji`|string|Opcional; debe ser un carácter emoji válido|A03 — Validar formato antes de persistir|
|`monto_objetivo`|number|Requerido, decimal mayor a cero|A03 — Validar tipo y rango numérico|
|`monto_inicial`|number|Opcional, decimal mayor o igual a cero|A03 — Validar tipo y rango numérico|
|`fecha_limite`|date|Opcional; si se envía, igual o posterior a hoy|A03 — Validar formato y rango de fecha|

**Mensajes de error**

_Validación_

- `VALIDATION_001`: "El campo {campo} es obligatorio." _(reutilizado)_
- `VALIDATION_026`: "Ya tienes una meta con ese nombre."
- `VALIDATION_012`: "El monto debe ser un número mayor a cero." _(reutilizado)_
- `VALIDATION_006`: "El monto no puede ser negativo." _(reutilizado)_
- `VALIDATION_024`: "La fecha límite debe ser hoy o una fecha futura."
- `VALIDATION_025`: "El emoji no es válido."

_Autenticación / autorización_

- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." _(reutilizado)_

_Sistema_

- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." _(reutilizado)_

**Requerimientos técnicos backend**

_Definición del servicio_

|Método|Endpoint|Auth|
|---|---|---|
|POST|`/api/v1/savings-goals`|Bearer JWT|

_Request_

```json
{
  "nombre": "string (requerido)",
  "emoji": "string (opcional, unicode, default: genérico)",
  "monto_objetivo": "number (requerido, > 0)",
  "monto_inicial": "number (opcional, >= 0, default: 0)",
  "fecha_limite": "date (opcional, >= hoy)"
}
```

_Response (éxito)_

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "string",
    "emoji": "string",
    "monto_objetivo": "number",
    "monto_inicial": "number",
    "monto_aportado_actual": "number (= monto_inicial al crear)",
    "fecha_limite": "date|null",
    "status": "active",
    "created_at": "timestamptz"
  },
  "message": "Meta de ahorro creada exitosamente."
}
```

_Modelo de información_

```json
// Tabla: savings_goals (nueva, Postgres/Supabase)
{
  "id": "uuid",
  "user_id": "uuid (FK → users.id)",
  "nombre": "text",
  "emoji": "text",
  "monto_objetivo": "numeric(14,2)",
  "monto_inicial": "numeric(14,2)",
  "fecha_limite": "date|null",
  "status": "text (enum: active, archived)",
  "created_at": "timestamptz",
  "updated_at": "timestamptz"
}
```

> Registrar en [[data-model-registry]] al cerrar el módulo. Política RLS: `auth.uid() = user_id`.

_Decisiones de modelado_

|Relación|Patrón|Justificación|
|---|---|---|
|`savings_goals.user_id → users`|Referenciado (FK)|Igual que `accounts.user_id` — cada meta pertenece a un usuario|
|`monto_aportado_actual`|Calculado en tiempo de consulta, no persistido|Igual que `saldo_actual`/`disponible` en [[cuentas]] — se deriva de `monto_inicial` y del historial de `transactions`, nunca queda desincronizado|

_Índices_

|Tabla|Campos|Tipo|Propósito|
|---|---|---|---|
|`savings_goals`|`(user_id, status)`|B-tree compuesto|Listar metas activas/archivadas de un usuario (CU-043)|
|`savings_goals`|`(user_id, nombre) WHERE status = 'active'`|Único parcial|Garantizar unicidad del nombre solo entre metas activas (RN-120)|

**Matriz de pruebas**

|#|Categoría|Escenario|Input|Resultado esperado|HTTP|
|---|---|---|---|---|---|
|1|Flujo exitoso|Crear meta con datos mínimos|`nombre`, `monto_objetivo`|Meta creada, `monto_inicial=0`, `monto_aportado_actual=0`|201|
|2|Flujo exitoso|Crear meta con monto inicial y fecha límite|Todos los campos|Meta creada con `monto_aportado_actual = monto_inicial`|201|
|3|Flujo exitoso|Crear meta con monto inicial mayor al objetivo|`monto_inicial=6000`, `monto_objetivo=5000`|Meta creada sin bloqueo|201|
|4|Validación de entrada|`monto_objetivo` faltante o cero|Sin `monto_objetivo`|`VALIDATION_001` / `VALIDATION_012`|400|
|5|Validación de entrada|Nombre duplicado con otra meta activa|`nombre` de una meta activa existente|`VALIDATION_026`|409|
|6|Validación de entrada|Fecha límite en el pasado|`fecha_limite` anterior a hoy|`VALIDATION_024`|400|
|7|Validación de entrada|`monto_inicial` negativo|`monto_inicial=-100`|`VALIDATION_006`|400|
|8|Autenticación / autorización|Token expirado o ausente|Sin JWT válido|`AUTH_001`|401|
|9|Error del sistema|Falla de base de datos|Simulado|`SYS_001`|500|

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-metas-alta]]

---

### CU-043 — Listar metas de ahorro

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar todas sus metas de ahorro en una vista de tarjetas, mostrando para cada una su emoji, nombre, fecha límite (si existe), monto aportado, monto objetivo, porcentaje ahorrado, monto restante y tiempo restante hasta la fecha límite (si existe). El listado se organiza en dos pestañas: "En progreso" (`status = active`) y "Completadas" (`status = archived`).

**Flujo principal**

1. El usuario accede a la sección "Metas".
2. El sistema recupera las metas del usuario autenticado con `status = active` (pestaña "En progreso" por defecto).
3. Para cada meta, el sistema calcula `monto_aportado_actual`, `porcentaje_ahorrado`, `monto_restante` y, si aplica, el tiempo restante hasta `fecha_limite`.
4. El sistema muestra las tarjetas ordenadas por fecha límite más próxima primero; las metas sin fecha límite se muestran al final.
5. El usuario puede alternar a la pestaña "Completadas" para ver las metas archivadas.

**Flujos alternativos / casos borde**

- Si el usuario no tiene metas registradas, el sistema muestra un estado vacío invitando a crear la primera meta (CU-042).
- Si una meta no tiene `fecha_limite`, la card se muestra sin el dato de tiempo restante, sin afectar el resto de los cálculos.
- Si `monto_aportado_actual` supera `monto_objetivo`, el porcentaje se muestra sin tope (ej. 150%) y `monto_restante` se muestra en $0 en la card (el cálculo interno conserva el valor real, incluyendo el negativo, para no perder precisión en futuros cómputos).

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — operación de solo lectura.

**Definición detallada de campos**

|Campo|Tipo de control|Obligatorio|Longitud|Formato / validación|Dependencias|Valor por defecto|Regla de negocio|
|---|---|---|---|---|---|---|---|
|`status` (filtro, pestaña)|Selección única|No|N/A|Enum: `active`, `archived`|—|`active`|Determina qué metas se incluyen|

**Reglas de negocio**

- RN-126: `monto_aportado_actual` se calcula en tiempo de consulta como `monto_inicial` menos la suma con signo de `monto` de todas las transacciones (`aportacion_meta`, `retiro_meta`) ligadas a esa meta mediante `meta_id` — nunca se persiste, mismo patrón que `saldo_actual`/`disponible` en otros módulos. La resta (en vez de suma) es porque el signo de `monto` está definido desde la perspectiva de la cuenta, no de la meta: una aportación resta de la cuenta (negativo) y por tanto suma a la meta; un retiro suma a la cuenta (positivo) y por tanto resta de la meta.
- RN-127: `porcentaje_ahorrado = monto_aportado_actual / monto_objetivo`; no tiene tope superior — puede superar el 100% si el usuario sigue aportando después de alcanzar el objetivo.
- RN-128: `monto_restante = monto_objetivo - monto_aportado_actual`; si el resultado es negativo (meta superada), se muestra como $0 en la card.
- RN-129: si la meta no tiene `fecha_limite`, no se calcula ni se muestra tiempo restante.
- RN-130: la pestaña "Completadas" corresponde exclusivamente a `status = archived`, no a haber alcanzado el `monto_objetivo` — una meta que supera su objetivo permanece en "En progreso" hasta que el usuario decida archivarla manualmente (CU-046).

**Casos de uso derivados identificados**

- Ya identificados en CU-042. _Patrón Búsqueda y Filtrado:_ descartado, mismo criterio.

**Validaciones**

|Campo|Tipo|Reglas|Mitigación OWASP|
|---|---|---|---|
|`status` (query param)|string|Opcional; si se envía, debe ser `active` o `archived`|A01 — Validar contra whitelist|

**Mensajes de error**

_Validación_

- `VALIDATION_004`: "El filtro de estado no es válido." _(reutilizado)_

_Autenticación / autorización_

- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." _(reutilizado)_

_Sistema_

- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." _(reutilizado)_

**Requerimientos técnicos backend**

_Definición del servicio_

|Método|Endpoint|Auth|
|---|---|---|
|GET|`/api/v1/savings-goals?status=active`|Bearer JWT|

_Request_

```
(sin body — filtro por query param `status`)
```

_Response (éxito)_

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nombre": "string",
      "emoji": "string",
      "monto_objetivo": "number",
      "monto_aportado_actual": "number (calculado)",
      "porcentaje_ahorrado": "number (calculado, sin tope)",
      "monto_restante": "number (calculado, mín. mostrado: 0)",
      "fecha_limite": "date|null",
      "meses_restantes": "number|null (calculado, null si no hay fecha_limite)",
      "status": "active"
    }
  ]
}
```

_Modelo de información_

Reutiliza `savings_goals` definida en CU-042. No se agregan campos nuevos.

_Decisiones de modelado_

Sin cambios respecto a CU-042.

_Índices_

Reutiliza `(user_id, status)` definido en CU-042.

**Matriz de pruebas**

|#|Categoría|Escenario|Input|Resultado esperado|HTTP|
|---|---|---|---|---|---|
|1|Flujo exitoso|Listar metas activas con datos completos|Usuario con 3 metas activas|Listado con campos calculados correctos|200|
|2|Flujo exitoso|Meta sin fecha límite|Meta con `fecha_limite=null`|`meses_restantes=null`, resto de campos normal|200|
|3|Flujo exitoso|Meta que superó su objetivo|`monto_aportado_actual > monto_objetivo`|`porcentaje_ahorrado > 1`, `monto_restante=0` en la card|200|
|4|Flujo exitoso|Pestaña "Completadas"|`status=archived`|Solo metas archivadas|200|
|5|Flujo exitoso|Usuario sin metas|Usuario nuevo|Listado vacío, sin error|200|
|6|Validación de entrada|Filtro de estado inválido|`status=eliminada`|`VALIDATION_004`|400|
|7|Autenticación / autorización|Token expirado o ausente|Sin JWT válido|`AUTH_001`|401|
|8|Error del sistema|Falla de base de datos|Simulado|`SYS_001`|500|

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-metas-listado]] — inspirado en la referencia visual de grid de cards con anillo de progreso compartida por el usuario; estilo final (color rosa del módulo, tipografía, disposición) se resuelve en Figma.

---

### CU-044 — Ver detalle de una meta

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar el detalle completo de una meta específica, incluyendo su historial propio de movimientos — todas las aportaciones y retiros registrados contra ella — mostrando, para cada uno, la fecha, el monto, el tipo (aportación o retiro) y la cuenta involucrada.

**Flujo principal**

1. El usuario selecciona una meta desde el listado (CU-043).
2. El sistema recupera el detalle de la meta y calcula sus campos derivados (igual que CU-043).
3. El sistema recupera las transacciones con `meta_id` igual a esa meta, ordenadas cronológicamente en orden descendente.
4. El sistema muestra el detalle junto con el historial de movimientos, indicando para cada uno la cuenta de origen (aportación) o destino (retiro).

**Flujos alternativos / casos borde**

- Si la meta no tiene movimientos (recién creada), el historial se muestra vacío; el `monto_inicial` se muestra como el punto de partida del progreso, pero no aparece como un renglón del historial, ya que no genera transacción (RN-123).

**Precondiciones**

- La meta debe existir y pertenecer al usuario autenticado.

**Postcondiciones**

- Ninguna — operación de solo lectura.

**Definición detallada de campos**

No aplica — este CU no captura datos nuevos, solo consulta un registro existente y su historial.

**Reglas de negocio**

- RN-131: el historial de movimientos de una meta incluye todas las transacciones con `tipo = aportacion_meta` o `tipo = retiro_meta` cuyo `meta_id` corresponda a esta meta, mostrando la cuenta involucrada en cada una (`account_id`) — mismo patrón que el historial de movimientos de una cuenta (CU-003 de [[cuentas]]).

**Casos de uso derivados identificados**

- Ninguno adicional a los ya identificados en CU-042.

**Validaciones**

|Campo|Tipo|Reglas|Mitigación OWASP|
|---|---|---|---|
|`id` (path param)|uuid|Requerido, debe existir y pertenecer al usuario autenticado|A01 — Control de acceso a nivel de objeto (IDOR)|

**Mensajes de error**

_Lógica de negocio_

- `BIZ_026`: "La meta solicitada no existe."

_Autenticación / autorización_

- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." _(reutilizado)_

_Sistema_

- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." _(reutilizado)_

**Requerimientos técnicos backend**

_Definición del servicio_

|Método|Endpoint|Auth|
|---|---|---|
|GET|`/api/v1/savings-goals/{id}`|Bearer JWT|

_Request_

```
(sin body)
```

_Response (éxito)_

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "string",
    "emoji": "string",
    "monto_objetivo": "number",
    "monto_inicial": "number",
    "monto_aportado_actual": "number (calculado)",
    "porcentaje_ahorrado": "number (calculado)",
    "fecha_limite": "date|null",
    "status": "string",
    "movimientos": [
      {
        "id": "uuid",
        "tipo": "aportacion_meta|retiro_meta",
        "account_id": "uuid",
        "monto": "number (con signo, perspectiva de la cuenta)",
        "fecha": "timestamptz",
        "nota": "string|null"
      }
    ]
  }
}
```

_Modelo de información_

Consulta `savings_goals` (CU-042) y `transactions` filtrando por `meta_id` (ver CU-047). No se agregan campos nuevos.

_Decisiones de modelado_

Sin cambios respecto a CU-042/CU-047.

_Índices_

Reutiliza `(meta_id, fecha desc) WHERE meta_id IS NOT NULL`, definido formalmente en CU-047.

**Matriz de pruebas**

|#|Categoría|Escenario|Input|Resultado esperado|HTTP|
|---|---|---|---|---|---|
|1|Flujo exitoso|Ver detalle con movimientos|Meta con aportaciones y retiros previos|Detalle completo, historial ordenado cronológicamente|200|
|2|Flujo exitoso|Ver detalle sin movimientos|Meta recién creada|Historial vacío, `monto_aportado_actual = monto_inicial`|200|
|3|Recurso no encontrado|`id` inexistente o de otro usuario|`id` inválido|`BIZ_026`|404|
|4|Autenticación / autorización|Token expirado o ausente|Sin JWT válido|`AUTH_001`|401|
|5|Error del sistema|Falla de base de datos|Simulado|`SYS_001`|500|

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-metas-detalle]]

---

### CU-045 — Editar meta de ahorro

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario modificar los datos de una meta existente: nombre, emoji, monto objetivo, monto inicial y fecha límite. A diferencia de `saldo_inicial` en Cuentas (no editable), `monto_inicial` de una meta sí es editable en cualquier momento — no representa una reconciliación contra una institución externa, solo el punto de partida de un cálculo de seguimiento personal.

**Flujo principal**

1. El usuario accede al detalle de una meta (CU-044) y selecciona "Editar".
2. El sistema muestra el formulario pre-llenado con los datos actuales.
3. El usuario modifica nombre, emoji, monto objetivo, monto inicial y/o fecha límite.
4. El usuario confirma los cambios.
5. El sistema valida los datos ingresados.
6. El sistema actualiza el registro de la meta y `updated_at`.
7. El sistema muestra la meta actualizada, con sus campos calculados recalculados.

**Flujos alternativos / casos borde**

- Si el nuevo nombre coincide con otra meta activa del mismo usuario (distinta de la que se edita), el sistema rechaza el cambio.
- Cambiar `monto_objetivo` o `monto_inicial` no afecta el historial de movimientos ya registrado — solo cambia los valores base sobre los que se recalculan `monto_aportado_actual`, `porcentaje_ahorrado` y `monto_restante` hacia adelante.
- Editar una meta archivada está permitido (por ejemplo, corregir el nombre); no requiere reactivarla primero.

**Precondiciones**

- El usuario debe estar autenticado.
- La meta debe existir y pertenecer al usuario autenticado.

**Postcondiciones**

- Se actualizan `nombre`, `emoji`, `monto_objetivo`, `monto_inicial` y/o `fecha_limite` del documento en `savings_goals`.
- Se actualiza `updated_at`.

**Definición detallada de campos**

|Campo|Tipo de control|Obligatorio|Longitud|Formato / validación|Dependencias|Valor por defecto|Regla de negocio|
|---|---|---|---|---|---|---|---|
|`nombre`|Texto|No|2–50 caracteres|Único entre metas activas (excluyendo la meta actual)|—|valor actual|RN-120|
|`emoji`|Selector de emoji nativo|No|1 carácter (unicode)|Cualquier emoji soportado|—|valor actual|RN-121|
|`monto_objetivo`|Numérico|No|—|Decimal mayor a cero|—|valor actual|RN-122|
|`monto_inicial`|Numérico|No|—|Decimal mayor o igual a cero|—|valor actual|RN-132|
|`fecha_limite`|Selector de fecha|No|—|date, igual o posterior a hoy, o `null` para quitarla|—|valor actual|RN-124|

**Reglas de negocio**

- RN-132: a diferencia de `saldo_inicial` en [[cuentas]] (no editable, RN-006), `monto_inicial` de una meta sí es editable en cualquier momento — no representa una reconciliación contra una institución externa, solo el punto de partida de un cálculo de seguimiento personal, y no requiere un caso de uso de "ajuste" independiente.
- RN-133: `nombre`, `emoji`, `monto_objetivo`, `monto_inicial` y `fecha_limite` son editables en cualquier momento, incluso si la meta ya tiene aportaciones o retiros registrados, y sin importar si `status = active` o `archived`.

**Casos de uso derivados identificados**

- Ninguno adicional a los ya identificados en CU-042.

**Validaciones**

|Campo|Tipo|Reglas|Mitigación OWASP|
|---|---|---|---|
|`nombre`|string|Opcional; si se envía, único entre metas activas (excluyendo la actual)|A03 — Sanitizar entrada; A07 — Codificar en salida|
|`monto_objetivo`|number|Opcional; si se envía, decimal mayor a cero|A03 — Validar tipo y rango numérico|
|`monto_inicial`|number|Opcional; si se envía, decimal mayor o igual a cero|A03 — Validar tipo y rango numérico|
|`fecha_limite`|date|Opcional; si se envía, igual o posterior a hoy|A03 — Validar formato y rango de fecha|
|`id` (path param)|uuid|Requerido, debe existir y pertenecer al usuario autenticado|A01 — Control de acceso a nivel de objeto (IDOR)|

**Mensajes de error**

_Validación_

- `VALIDATION_026`, `VALIDATION_012`, `VALIDATION_006`, `VALIDATION_024`, `VALIDATION_025` _(reutilizados — ver CU-042)_

_Autenticación / autorización_

- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." _(reutilizado)_

_Lógica de negocio_

- `BIZ_026`: "La meta solicitada no existe." _(reutilizado — ver CU-044)_

_Sistema_

- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." _(reutilizado)_

**Requerimientos técnicos backend**

_Definición del servicio_

|Método|Endpoint|Auth|
|---|---|---|
|PATCH|`/api/v1/savings-goals/{id}`|Bearer JWT|

_Request_

```json
{
  "nombre": "string (opcional)",
  "emoji": "string (opcional)",
  "monto_objetivo": "number (opcional, > 0)",
  "monto_inicial": "number (opcional, >= 0)",
  "fecha_limite": "date|null (opcional)"
}
```

_Response (éxito)_

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "string",
    "emoji": "string",
    "monto_objetivo": "number",
    "monto_inicial": "number",
    "fecha_limite": "date|null",
    "updated_at": "timestamptz"
  },
  "message": "Meta actualizada exitosamente."
}
```

_Modelo de información_

Reutiliza `savings_goals` definida en CU-042. No se agregan campos nuevos.

_Decisiones de modelado_

Sin cambios respecto a CU-042.

_Índices_

Reutiliza `(user_id, nombre) WHERE status = 'active'` para la validación de unicidad (excluyendo el `id` propio).

**Matriz de pruebas**

|#|Categoría|Escenario|Input|Resultado esperado|HTTP|
|---|---|---|---|---|---|
|1|Flujo exitoso|Editar nombre y emoji|Datos válidos|Meta actualizada|200|
|2|Flujo exitoso|Editar monto inicial|Nuevo `monto_inicial`|`monto_aportado_actual` recalculado con el nuevo valor|200|
|3|Flujo exitoso|Quitar fecha límite|`fecha_limite=null`|Meta sin fecha límite ni tiempo restante|200|
|4|Flujo exitoso|Editar meta archivada|Meta con `status=archived`|Meta actualizada sin requerir reactivación|200|
|5|Validación de entrada|Nombre duplicado con otra meta activa|`nombre` de otra meta activa|`VALIDATION_026`|409|
|6|Validación de entrada|Fecha límite en el pasado|`fecha_limite` anterior a hoy|`VALIDATION_024`|400|
|7|Recurso no encontrado|Editar meta inexistente o ajena|`id` inválido o de otro usuario|`BIZ_026`|404|
|8|Autenticación / autorización|Token expirado o ausente|Sin JWT válido|`AUTH_001`|401|
|9|Error del sistema|Falla de base de datos|Simulado|`SYS_001`|500|

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-metas-alta]] (formulario compartido con alta)

---

### CU-046 — Archivar (y reactivar) meta de ahorro

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario dar de baja una meta sin eliminar su historial. El sistema cambia el `status` de la meta a `archived`, moviéndola a la pestaña "Completadas" (CU-043). Una meta archivada deja de estar disponible como destino de nuevas aportaciones o retiros, pero conserva su historial y sigue siendo consultable. El archivado es siempre una decisión manual —no ocurre automáticamente al alcanzar el `monto_objetivo`.

**Flujo principal**

1. El usuario accede al detalle de una meta (CU-044) y selecciona "Archivar".
2. El sistema muestra un mensaje de confirmación explicando que la meta dejará de estar disponible para nuevas aportaciones o retiros, pero su historial se conserva.
3. El usuario confirma la acción.
4. El sistema actualiza el `status` de la meta a `archived`.
5. El sistema mueve la meta a la pestaña "Completadas" y la retira de los selectores de meta al registrar aportaciones o retiros.

**Flujos alternativos / casos borde**

- Si la meta ya se encuentra archivada, el sistema rechaza la operación e informa que ya está archivada.
- El usuario puede reactivar una meta archivada desde el listado (cambiando `status` de vuelta a `active`); este flujo se resuelve con el mismo endpoint, no se documenta como CU independiente por ser simétrico y de bajo volumen — mismo criterio que CU-005 de [[cuentas]].
- Archivar una meta que superó su `monto_objetivo` es una acción idéntica a archivar cualquier otra meta — no hay una ruta especial de "marcar como cumplida".

**Precondiciones**

- El usuario debe estar autenticado.
- La meta debe existir, pertenecer al usuario autenticado, y encontrarse en `status = active` (para archivar) o `status = archived` (para reactivar).

**Postcondiciones**

- El `status` de la meta cambia a `archived` (o de vuelta a `active` en una reactivación).
- El resto de los campos permanece sin cambios.
- La meta se mueve entre las pestañas "En progreso" / "Completadas" del listado (CU-043).

**Definición detallada de campos**

No aplica — este CU no captura datos nuevos, solo modifica el campo `status` de un registro existente.

|Campo|Tipo de control|Obligatorio|Longitud|Formato / validación|Dependencias|Valor por defecto|Regla de negocio|
|---|---|---|---|---|---|---|---|
|`status`|N/A (acción del sistema)|N/A|N/A|Enum: `active` ↔ `archived`|—|—|RN-134, RN-135, RN-136|

**Reglas de negocio**

- RN-134: una meta archivada no está disponible como destino de nuevas aportaciones ni retiros (CU-047, CU-048), pero conserva su historial de movimientos y sigue siendo consultable (CU-044).
- RN-135: no se puede archivar una meta que ya se encuentra en `status = archived`.
- RN-136: reactivar una meta (`archived → active`) se resuelve con el mismo endpoint que archivar (cambio inverso de `status`) — no requiere un CU independiente, mismo criterio que CU-005 de [[cuentas]].
- RN-137: archivar una meta es siempre una decisión manual del usuario, sin relación con haber alcanzado el `monto_objetivo` (ver RN-130).

**Casos de uso derivados identificados**

- Reactivación de meta archivada: se resuelve con el mismo endpoint (cambio inverso de `status`), no requiere un CU independiente.

**Validaciones**

|Campo|Tipo|Reglas|Mitigación OWASP|
|---|---|---|---|
|`id` (path param)|uuid|Requerido, debe existir y pertenecer al usuario autenticado|A01 — Control de acceso a nivel de objeto|

**Mensajes de error**

_Lógica de negocio_

- `BIZ_026`: "La meta solicitada no existe." _(reutilizado)_
- `BIZ_024`: "La meta ya se encuentra archivada."

_Autenticación / autorización_

- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." _(reutilizado)_

_Sistema_

- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." _(reutilizado)_

**Requerimientos técnicos backend**

_Definición del servicio_

|Método|Endpoint|Auth|
|---|---|---|
|PATCH|`/api/v1/savings-goals/{id}/status`|Bearer JWT|

_Request_

```json
{
  "status": "string (requerido, enum: active|archived)"
}
```

_Response (éxito)_

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "string",
    "updated_at": "timestamptz"
  },
  "message": "Meta archivada exitosamente."
}
```

_Modelo de información_

Reutiliza `savings_goals` definida en CU-042. No se agregan campos nuevos.

_Decisiones de modelado_

Sin cambios respecto a CU-042.

_Índices_

Reutiliza `(user_id, status)` definido en CU-042.

**Matriz de pruebas**

|#|Categoría|Escenario|Input|Resultado esperado|HTTP|
|---|---|---|---|---|---|
|1|Flujo exitoso|Archivar meta activa|Meta con `status=active`|`status=archived`|200|
|2|Flujo exitoso|Reactivar meta archivada|Meta con `status=archived`|`status=active`|200|
|3|Flujo exitoso|Archivar meta que superó su objetivo|`monto_aportado_actual > monto_objetivo`|Se archiva con normalidad, sin flujo especial|200|
|4|Lógica de negocio|Archivar meta ya archivada|Meta con `status=archived`, se pide archivar de nuevo|`BIZ_024`|409|
|5|Recurso no encontrado|Meta inexistente o ajena|`id` inválido o de otro usuario|`BIZ_026`|404|
|6|Autenticación / autorización|Token expirado o ausente|Sin JWT válido|`AUTH_001`|401|
|7|Error del sistema|Falla de base de datos|Simulado|`SYS_001`|500|

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-metas-detalle]] (acción "Archivar" con modal de confirmación)

---

### CU-047 — Registrar aportación a una meta

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario registrar una aportación de dinero hacia una meta de ahorro, desde una cuenta de débito o efectivo propia. A diferencia de una transferencia entre cuentas propias, este movimiento **no** genera dos documentos enlazados — se registra como una única transacción de `tipo = aportacion_meta`, referenciando tanto la cuenta de origen (`account_id`) como la meta destino (`meta_id`). El mismo documento es consultable desde el historial de la cuenta afectada (CU-003 de [[cuentas]]) y desde el historial propio de la meta (CU-044), sin necesidad de un segundo registro.

**Flujo principal**

1. El usuario captura el monto y selecciona el chip "Aportar a meta" dentro de Registrar movimiento.
2. El sistema muestra el selector de meta destino (solo metas propias, `status = active`) y el selector de cuenta de origen (débito o efectivo, propia, activa).
3. El usuario selecciona ambos y, opcionalmente, ajusta la fecha y captura una nota.
4. El usuario confirma el registro.
5. El sistema valida los datos ingresados.
6. El sistema crea el documento en `transactions` con `tipo = aportacion_meta`, `account_id`, `meta_id`, `monto` negativo, `category_id = null`, `transaccion_relacionada_id = null`, y actualiza `saldo_actual` de la cuenta de origen de forma atómica junto con la creación del registro.
7. El sistema muestra el movimiento en el historial de la cuenta y en el historial de la meta.

**Flujos alternativos / casos borde**

- Si la cuenta seleccionada está archivada o no es de tipo débito/efectivo, el sistema rechaza el registro.
- Si la meta seleccionada está archivada, el sistema rechaza el registro (RN-142).
- El `concepto` se genera automáticamente ("Aportación a meta: {nombre de la meta}") — no es capturado por el usuario, mismo criterio que el `concepto` fijo de un ajuste manual (CU-006 de [[cuentas]]).

**Precondiciones**

- El usuario debe estar autenticado.
- La cuenta de origen debe existir, pertenecer al usuario, ser de tipo débito o efectivo, y encontrarse en `status = active`.
- La meta debe existir, pertenecer al usuario, y encontrarse en `status = active`.

**Postcondiciones**

- Se crea un documento en `transactions` con `tipo = aportacion_meta`.
- `saldo_actual` de la cuenta de origen disminuye en el monto aportado.
- `monto_aportado_actual` de la meta aumenta en el monto aportado (calculado, RN-126).

**Definición detallada de campos**

|Campo|Tipo de control|Obligatorio|Longitud|Formato / validación|Dependencias|Valor por defecto|Regla de negocio|
|---|---|---|---|---|---|---|---|
|`meta_id`|Selección (meta existente)|Sí|—|Debe referenciar una meta propia y activa|—|—|RN-142|
|`cuenta_origen_id`|Selección (cuenta existente)|Sí|—|Debe referenciar una cuenta propia, débito/efectivo, activa|—|—|RN-141|
|`monto`|Numérico (con calculadora integrada)|Sí|—|Decimal mayor a cero|—|—|—|
|`fecha`|Selector de fecha|No|—|timestamptz|—|hoy|—|
|`nota`|Texto|No|máx. 140 caracteres|—|—|`null`|—|

**Reglas de negocio**

- RN-138: una aportación genera un **único** documento en `transactions`, con `tipo = aportacion_meta`, `account_id` (cuenta de origen) y `meta_id` (la meta destino) — a diferencia de transferencia y pago a tarjeta (RN-045, RN-050 de [[transacciones]]), no se generan dos documentos enlazados; el mismo documento es consultable desde el historial de la cuenta (filtrando por `account_id`) y desde el historial de la meta (filtrando por `meta_id`).
- RN-139: el monto se registra con signo negativo en la cuenta de origen (mismo criterio que un gasto, RN-038 de [[transacciones]]) y actualiza `saldo_actual` de dicha cuenta de forma atómica junto con la creación del documento.
- RN-140: `category_id` y `transaccion_relacionada_id` quedan en `null` para este tipo — no lleva categoría (mismo criterio que transferencia y pago a tarjeta) ni enlace a un segundo documento.
- RN-141: la cuenta de origen debe ser de tipo débito o efectivo, estar en `status = active`, y pertenecer al usuario.
- RN-142: la meta debe estar en `status = active` para recibir nuevas aportaciones.
- RN-143: el `concepto` se genera automáticamente como "Aportación a meta: {nombre de la meta}" — no es capturado por el usuario.

**Casos de uso derivados identificados**

- Ninguno adicional — reutiliza CU-017/CU-018 de [[transacciones]] para editar/eliminar (ver "Cambios en otros documentos").

**Validaciones**

|Campo|Tipo|Reglas|Mitigación OWASP|
|---|---|---|---|
|`meta_id`|uuid|Requerido; debe existir, pertenecer al usuario, y estar `status = active`|A01 — Control de acceso a nivel de objeto (IDOR)|
|`cuenta_origen_id`|uuid|Requerido; debe existir, pertenecer al usuario, ser débito/efectivo, `status = active`|A01 — Control de acceso a nivel de objeto (IDOR)|
|`monto`|number|Requerido, decimal mayor a cero|A03 — Validar tipo y rango numérico|
|`nota`|string|Opcional, máx. 140 caracteres|A03 — Sanitizar entrada; A07 — Codificar en salida|

**Mensajes de error**

_Validación_

- `VALIDATION_001`: "El campo {campo} es obligatorio." _(reutilizado)_
- `VALIDATION_012`: "El monto debe ser un número mayor a cero." _(reutilizado)_

_Autenticación / autorización_

- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." _(reutilizado)_

_Lógica de negocio_

- `BIZ_010`: "La cuenta seleccionada no existe, no te pertenece, o está archivada." _(reutilizado — ver CU-013 de [[transacciones]])_
- `BIZ_023`: "La meta seleccionada no existe, no te pertenece, o está archivada."

_Sistema_

- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." _(reutilizado)_

**Requerimientos técnicos backend**

_Definición del servicio_

|Método|Endpoint|Auth|
|---|---|---|
|POST|`/api/v1/savings-goals/{meta_id}/contributions`|Bearer JWT|

_Request_

```json
{
  "cuenta_origen_id": "uuid (requerido)",
  "monto": "number (requerido, > 0)",
  "fecha": "timestamptz (opcional, default: hoy)",
  "nota": "string (opcional, máx 140 caracteres)"
}
```

_Response (éxito)_

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tipo": "aportacion_meta",
    "account_id": "uuid",
    "meta_id": "uuid",
    "monto": "number (negativo)",
    "fecha": "timestamptz",
    "concepto": "string"
  },
  "message": "Aportación registrada exitosamente."
}
```

_Modelo de información_

```json
// Tabla: transactions (extensión — ver data-model-registry)
{
  "meta_id": "uuid|null (FK → savings_goals.id; obligatorio si tipo=aportacion_meta|retiro_meta; mutuamente excluyente con category_id)"
}
```

> Extiende el esquema definitivo de `transactions` cerrado en [[transacciones]]. Se agrega `meta_id`; se corrige la condición de `transaccion_relacionada_id` (ver "Cambios en otros documentos"). Registrar en [[data-model-registry]] al cerrar el módulo.

_Decisiones de modelado_

|Relación|Patrón|Justificación|
|---|---|---|
|`transactions.meta_id → savings_goals`|Referenciado (FK), nullable|Un movimiento de aportación o retiro pertenece a una meta; mutuamente excluyente con `category_id`, mismo patrón que `budgets.category_id`/`meta_id`|
|Fila única (sin `transaccion_relacionada_id`)|Un solo lado explícito, consultado dos veces|A diferencia de transferencia/pago a tarjeta, una meta no es una cuenta — no existe un segundo lado real que requiera su propia fila; la misma fila se filtra por `account_id` o por `meta_id` según el historial que se consulte|

_Índices_

|Tabla|Campos|Tipo|Propósito|
|---|---|---|---|
|`transactions`|`(meta_id, fecha desc) WHERE meta_id IS NOT NULL`|Parcial|Listar movimientos de una meta en orden cronológico descendente (CU-044; reutilizado en CU-048)|

**Matriz de pruebas**

|#|Categoría|Escenario|Input|Resultado esperado|HTTP|
|---|---|---|---|---|---|
|1|Flujo exitoso|Registrar aportación válida|Cuenta y meta activas, monto > 0|Transacción creada, `saldo_actual` disminuye, `monto_aportado_actual` de la meta aumenta|201|
|2|Validación de entrada|Monto faltante o inválido|Sin `monto` o `monto=0`|`VALIDATION_012`|400|
|3|Lógica de negocio|Cuenta archivada o de tipo crédito|`cuenta_origen_id` inválida para el flujo|`BIZ_010`|404|
|4|Lógica de negocio|Meta archivada o ajena|`meta_id` inválido para el flujo|`BIZ_023`|404|
|5|Autenticación / autorización|Token expirado o ausente|Sin JWT válido|`AUTH_001`|401|
|6|Error del sistema|Falla de base de datos a medio proceso|Simulado|`SYS_001`, ningún documento parcial persiste|500|

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-transacciones-alta]] (variante "Aportar a meta": selector de meta + selector de cuenta de origen, sin selector de categoría)

---

### CU-048 — Registrar retiro de una meta

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario retirar dinero ya aportado a una meta, depositándolo en una cuenta propia de débito o efectivo — por ejemplo, usar parte de un fondo de emergencia. Es el espejo exacto de una aportación (CU-047): se registra como una única transacción de `tipo = retiro_meta`, con `account_id` (cuenta destino) y `meta_id` (meta de origen), monto positivo en la cuenta.

**Flujo principal**

1. El usuario captura el monto y selecciona el chip "Retirar de meta" dentro de Registrar movimiento.
2. El sistema muestra el selector de meta de origen (solo metas propias, `status = active`) y el selector de cuenta destino (débito o efectivo, propia, activa).
3. El usuario selecciona ambos y, opcionalmente, ajusta la fecha y captura una nota.
4. El usuario confirma el registro.
5. El sistema valida los datos ingresados, incluyendo que el monto no exceda lo disponible en la meta.
6. El sistema crea el documento en `transactions` con `tipo = retiro_meta`, `account_id`, `meta_id`, `monto` positivo, `category_id = null`, `transaccion_relacionada_id = null`, y actualiza `saldo_actual` de la cuenta destino de forma atómica junto con la creación del registro.
7. El sistema muestra el movimiento en el historial de la cuenta y en el historial de la meta.

**Flujos alternativos / casos borde**

- Si la cuenta seleccionada está archivada o no es de tipo débito/efectivo, el sistema rechaza el registro.
- Si la meta seleccionada está archivada, el sistema rechaza el registro (RN-148).
- Si el monto del retiro excede el `monto_aportado_actual` de la meta, el sistema rechaza el registro (RN-146) — a diferencia del pago a tarjeta (RN-049 de [[transacciones]]), que sí permite un sobrepago, un retiro no puede dejar a la meta con un aportado calculado negativo.
- El `concepto` se genera automáticamente ("Retiro de meta: {nombre de la meta}").

**Precondiciones**

- El usuario debe estar autenticado.
- La cuenta destino debe existir, pertenecer al usuario, ser de tipo débito o efectivo, y encontrarse en `status = active`.
- La meta debe existir, pertenecer al usuario, y encontrarse en `status = active`.
- El monto del retiro no debe exceder el `monto_aportado_actual` de la meta.

**Postcondiciones**

- Se crea un documento en `transactions` con `tipo = retiro_meta`.
- `saldo_actual` de la cuenta destino aumenta en el monto retirado.
- `monto_aportado_actual` de la meta disminuye en el monto retirado (calculado, RN-126).

**Definición detallada de campos**

|Campo|Tipo de control|Obligatorio|Longitud|Formato / validación|Dependencias|Valor por defecto|Regla de negocio|
|---|---|---|---|---|---|---|---|
|`meta_id`|Selección (meta existente)|Sí|—|Debe referenciar una meta propia y activa|—|—|RN-148|
|`cuenta_destino_id`|Selección (cuenta existente)|Sí|—|Debe referenciar una cuenta propia, débito/efectivo, activa|—|—|RN-147|
|`monto`|Numérico|Sí|—|Decimal mayor a cero; no mayor a `monto_aportado_actual` de la meta|—|—|RN-146|
|`fecha`|Selector de fecha|No|—|timestamptz|—|hoy|—|
|`nota`|Texto|No|máx. 140 caracteres|—|—|`null`|—|

**Reglas de negocio**

- RN-144: un retiro genera un **único** documento en `transactions`, con `tipo = retiro_meta`, `account_id` (cuenta destino que recibe el dinero) y `meta_id` (la meta de origen) — mismo patrón de documento único que una aportación (RN-138), en sentido inverso.
- RN-145: el monto se registra con signo positivo en la cuenta destino (mismo criterio que un ingreso) y actualiza `saldo_actual` de dicha cuenta de forma atómica junto con la creación del documento.
- RN-146: el monto del retiro no puede ser mayor al `monto_aportado_actual` de la meta al momento del registro — evita que una meta quede con un aportado calculado negativo.
- RN-147: la cuenta destino debe ser de tipo débito o efectivo, estar en `status = active`, y pertenecer al usuario.
- RN-148: la meta debe estar en `status = active` para aceptar retiros.
- RN-149: el `concepto` se genera automáticamente como "Retiro de meta: {nombre de la meta}".

**Casos de uso derivados identificados**

- Ninguno adicional — reutiliza CU-017/CU-018 de [[transacciones]] para editar/eliminar.

**Validaciones**

|Campo|Tipo|Reglas|Mitigación OWASP|
|---|---|---|---|
|`meta_id`|uuid|Requerido; debe existir, pertenecer al usuario, y estar `status = active`|A01 — Control de acceso a nivel de objeto (IDOR)|
|`cuenta_destino_id`|uuid|Requerido; debe existir, pertenecer al usuario, ser débito/efectivo, `status = active`|A01 — Control de acceso a nivel de objeto (IDOR)|
|`monto`|number|Requerido, decimal mayor a cero, no mayor al monto disponible en la meta|A03 — Validar tipo, rango numérico, y regla de negocio antes de persistir|
|`nota`|string|Opcional, máx. 140 caracteres|A03 — Sanitizar entrada; A07 — Codificar en salida|

**Mensajes de error**

_Validación_

- `VALIDATION_001`: "El campo {campo} es obligatorio." _(reutilizado)_
- `VALIDATION_012`: "El monto debe ser un número mayor a cero." _(reutilizado)_

_Autenticación / autorización_

- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." _(reutilizado)_

_Lógica de negocio_

- `BIZ_010`: "La cuenta seleccionada no existe, no te pertenece, o está archivada." _(reutilizado)_
- `BIZ_023`: "La meta seleccionada no existe, no te pertenece, o está archivada." _(reutilizado)_
- `BIZ_025`: "El monto del retiro no puede ser mayor al monto disponible en la meta."

_Sistema_

- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." _(reutilizado)_

**Requerimientos técnicos backend**

_Definición del servicio_

|Método|Endpoint|Auth|
|---|---|---|
|POST|`/api/v1/savings-goals/{meta_id}/withdrawals`|Bearer JWT|

_Request_

```json
{
  "cuenta_destino_id": "uuid (requerido)",
  "monto": "number (requerido, > 0)",
  "fecha": "timestamptz (opcional, default: hoy)",
  "nota": "string (opcional, máx 140 caracteres)"
}
```

_Response (éxito)_

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tipo": "retiro_meta",
    "account_id": "uuid",
    "meta_id": "uuid",
    "monto": "number (positivo)",
    "fecha": "timestamptz",
    "concepto": "string"
  },
  "message": "Retiro registrado exitosamente."
}
```

_Modelo de información_

Reutiliza la extensión de `transactions` definida en CU-047 (`meta_id`). Se agrega el valor `retiro_meta` al enum `tipo` — no estaba reservado previamente (a diferencia de `aportacion_meta`).

_Decisiones de modelado_

Sin cambios respecto a CU-047 — mismo patrón de fila única, en sentido inverso.

_Índices_

Reutiliza `(meta_id, fecha desc) WHERE meta_id IS NOT NULL` definido en CU-047.

**Matriz de pruebas**

|#|Categoría|Escenario|Input|Resultado esperado|HTTP|
|---|---|---|---|---|---|
|1|Flujo exitoso|Retirar un monto válido|Meta con aportado suficiente|Transacción creada, `saldo_actual` aumenta, `monto_aportado_actual` de la meta disminuye|201|
|2|Validación de entrada|Monto faltante o inválido|Sin `monto` o `monto=0`|`VALIDATION_012`|400|
|3|Lógica de negocio|Retiro mayor al monto aportado|`monto` > `monto_aportado_actual`|`BIZ_025`|409|
|4|Lógica de negocio|Cuenta archivada o de tipo crédito|`cuenta_destino_id` inválida para el flujo|`BIZ_010`|404|
|5|Lógica de negocio|Meta archivada o ajena|`meta_id` inválido para el flujo|`BIZ_023`|404|
|6|Autenticación / autorización|Token expirado o ausente|Sin JWT válido|`AUTH_001`|401|
|7|Error del sistema|Falla de base de datos a medio proceso|Simulado|`SYS_001`, ningún documento parcial persiste|500|

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-transacciones-alta]] (variante "Retirar de meta": selector de meta de origen + selector de cuenta destino)

---

## Cambios en otros documentos

Este módulo modifica reglas y campos ya cerrados en otros documentos. Se detallan aquí para aplicarlos como parte del mismo cierre — no son cambios especulativos, son consecuencia directa de las decisiones de este módulo.

### [[presupuesto]]

- **Se retira** el campo `categoria_reservada` (valor único `"ahorros"`), junto con `RN-070`, `VALIDATION_019`, y el índice único parcial `(user_id, categoria_reservada, mes)` — ninguno se reutiliza.
- **`RN-074` queda retirada**: ya no es cierto que Ahorros nunca calcule "real" — cada meta activa ahora tiene su propio "real" mensual (RN-151, nueva).
- Se agrega `budgets.meta_id` (uuid|null, FK → `savings_goals.id`), mutuamente excluyente con `category_id` (y ya sin `categoria_reservada`). Se agrega el índice único parcial `(user_id, meta_id, mes) WHERE meta_id IS NOT NULL`.
- El grupo "Ahorros" en Presupuesto (CU-019, CU-022) pasa de mostrar un renglón fijo a mostrar un renglón por cada meta activa del usuario — igual que Bills/Needs/Wants/Investment muestran un renglón por categoría real. `RN-071` (% de grupo) se generaliza: el total del grupo Ahorros ahora suma los montos presupuestados de sus renglones (`meta_id`) en vez de un valor fijo.
- **RN-150** (nueva): `budgets.meta_id` sigue exactamente el mismo patrón que `budgets.category_id` — un presupuesto por meta y mes, upsert al guardar, eliminación del documento al dejar el monto vacío (mismo criterio que RN-059/RN-060).
- **RN-151** (nueva): el "real" mensual de una meta en Presupuesto se calcula como la suma con signo invertido de las transacciones (`aportacion_meta`, `retiro_meta`) de esa meta dentro del mes consultado — `monto_inicial` **no** participa en este cálculo, ya que es un acumulado histórico (RN-126), no un movimiento del periodo.
- Solo se presupuestan metas en `status = active` (mismo criterio que categorías archivadas, que no aparecen como opción — RN-058).

### [[transacciones]]

- El resumen del módulo queda desactualizado: la frase que agrupa "aportación a una meta de ahorro" bajo el patrón de "dos documentos enlazados" (junto con transferencia y pago a tarjeta) debe corregirse — una aportación o retiro de meta se registra como un único documento (RN-138, RN-144).
- El enum `tipo` de `transactions` gana el valor `retiro_meta` — no estaba reservado previamente (a diferencia de `aportacion_meta`).
- La condición de `transaccion_relacionada_id` se reduce a `tipo = transferencia|pago_tarjeta` — deja de incluir `aportacion_meta`.
- **RN-152** (nueva): CU-017 (Editar transacción) gana `meta_id` como campo editable, bajo las mismas condiciones de propiedad y estado activo que ya aplican a `category_id` (RN-053).
- CU-018 (Eliminar transacción) aplica sin cambios estructurales a `aportacion_meta`/`retiro_meta`: al ser documentos únicos (RN-138, RN-144), la eliminación revierte `saldo_actual` de la única cuenta involucrada, sin la lógica de "transacción relacionada eliminada" que sí aplica a transferencia y pago a tarjeta.

### [[reportes]] — pendiente, no se modifica en este cierre

- `RN-087` queda desactualizada (ya no es cierto que Ahorros nunca calcule "real"), pero su corrección se pospone hasta que le toque su turno de construcción a Reportes, siguiendo el orden del roadmap. Se deja esta nota para no perder el hilo al retomar ese módulo.

### [[data-model-registry]]

Ver documento adjunto de actualización del registro (`registro-actualizacion-ahorros-y-metas.md`) con los bloques exactos a copiar: nueva colección `savings_goals`, extensión de `transactions` y `budgets`, nuevas relaciones, diagrama ER actualizado, e índice de numeración.

## Historial de cambios

|Fecha|Cambio|CU afectado|Impacto en otros documentos|
|---|---|---|---|
|2026-08-22|Se crea el módulo Ahorros y Metas: colección `savings_goals` (meta con nombre, emoji, monto objetivo, monto inicial opcional, fecha límite opcional); se habilita el flujo de captura de `aportacion_meta` (ya reservado) y se introduce `retiro_meta` (nuevo), ambos como documento único vía el nuevo campo `transactions.meta_id`, sin el patrón de dos documentos enlazados que sí usan transferencia y pago a tarjeta. Se agregan CU-042 a CU-048. Una meta es independiente de cualquier cuenta (cubeta libre); su archivado es siempre manual, sin relación con alcanzar el monto objetivo.|CU-042 a CU-048|Se actualiza [[data-model-registry]] con la colección `savings_goals`, la extensión de `transactions` y `budgets`, nuevas relaciones, diagrama ER e índice de numeración. Se modifica [[presupuesto]]: se retira `categoria_reservada` (con `RN-070`, `VALIDATION_019`, y su índice) y se sustituye por `budgets.meta_id`, un renglón presupuestable por meta activa. Se modifica [[transacciones]]: se corrige el resumen del módulo, se agrega `retiro_meta` al enum `tipo`, se corrige el alcance de `transaccion_relacionada_id`, y CU-017 gana `meta_id` como campo editable. Queda pendiente, para cuando le toque su turno, corregir `RN-087` de [[reportes]].|
|2026-08-22|**Corrección de numeración, detectada al iniciar la construcción en código**: este documento se había numerado (CU-035 a CU-041, RN-107 a RN-139, `VALIDATION_023`, `BIZ_022`) sin consultar el índice de numeración real — colisionaba con `CU-035` y `RN-107`–`RN-111` de [[transacciones]] (acciones en lote), `RN-112`–`RN-117` de [[presupuesto]], `RN-118`/`RN-119` de [[categorias]], y `VALIDATION_023`/`BIZ_022` de [[transacciones]] (los 4 ya asignados en sesiones previas de construcción). Se renumeró todo el documento a la siguiente secuencia libre: `CU-035`→`CU-042` … `CU-041`→`CU-048`; `RN-107`→`RN-120` … `RN-139`→`RN-152`; `VALIDATION_023`→`VALIDATION_026`; `BIZ_022`→`BIZ_026`. Ningún otro documento cambió sus propios números — solo se corrigieron las referencias colisionadas dentro de este archivo y en [[data-model-registry]].|CU-042 a CU-048|Se actualiza [[data-model-registry]]: índice de numeración e historial de cambios.|

## Referencias

- [[estrategia]]
- [[brief-ux]]
- [[data-model-registry]]
- [[cuentas]]
- [[categorias]]
- [[transacciones]]
- [[presupuesto]]
- [[backlog]]