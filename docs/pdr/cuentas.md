---
modulo: "Cuentas"
status: cerrado
---
## Resumen del módulo

El módulo de Cuentas permite a cada usuario administrar sus cuentas financieras (débito, crédito o
efectivo) dentro de la aplicación: crear, consultar, editar, archivar y ajustar manualmente su saldo, incluyendo la carga de una imagen y un color distintivo por cuenta (usado en dashboards y reportes) y la posibilidad de excluir una cuenta de las vistas agregadas sin dejar de usarla. Es el
módulo base del sistema — toda transacción registrada en [[transacciones]] pertenece a una
cuenta, y este módulo ya introduce un contrato mínimo y provisional para esas transacciones (ver
CU-006). El cálculo de net worth (v1.1) también depende de este módulo, pero queda fuera de su
alcance en el MVP. El sistema opera con una sola moneda estándar en el MVP — no se almacena moneda por cuenta. Catálogo de instituciones financieras, ahorro/metas (módulo propio en v1.1),
recompensas de tarjetas de crédito, multi-moneda y conexión con proveedores de pago externos (ej. Apple Pay) quedan fuera de alcance (ver [[backlog]]).

## Casos de uso

### CU-001 — Crear cuenta financiera

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario registrar una nueva cuenta financiera dentro de la
aplicación, de tipo débito, crédito o efectivo. Para ello será necesario capturar el nombre de la
cuenta, el tipo y el saldo inicial, y opcionalmente cargar una imagen, elegir un color distintivo y
marcar si la cuenta debe excluirse de las vistas agregadas (net worth, reportes). Si el tipo
seleccionado es crédito, el sistema solicitará además la línea de crédito, el día de corte, el día
de pago y, opcionalmente, un monto mínimo de gasto mensual para exentar comisión. El sistema
calculará el saldo actual a partir del saldo inicial, el cual se actualiza posteriormente conforme
se registran gastos asociados a la cuenta o se realiza un ajuste manual (CU-006).

**Flujo principal**

1. El usuario accede a la sección "Cuentas" y selecciona "Agregar cuenta".
2. El sistema muestra el formulario de alta de cuenta.
3. El usuario completa nombre, tipo de cuenta y saldo inicial.
4. Si el tipo seleccionado es `credito`, el sistema muestra campos adicionales: línea de crédito,
   día de corte, día de pago y monto mínimo de gasto mensual (opcional).
5. El usuario, opcionalmente, sube una imagen, elige un color (de una paleta de 16 predefinidos o
   mediante un editor hexadecimal libre) y/o marca la cuenta como excluida de vistas agregadas.
6. El usuario confirma la creación.
7. El sistema valida los datos ingresados.
8. El sistema crea el registro de la cuenta con estado "activa" y `saldo_actual = saldo_inicial`.
9. El sistema muestra la cuenta recién creada en el listado.

**Flujos alternativos / casos borde**

- Si el usuario no sube imagen, la cuenta se crea con un ícono por defecto según el tipo.
- Si la carga de imagen falla (ej. archivo corrupto), la cuenta se crea igualmente sin imagen y se
  notifica el error de forma no bloqueante.
- Si el usuario no elige color, se asigna el valor por defecto (gris, `#9CA3AF`).
- Si el tipo es `debito` o `efectivo`, los campos exclusivos de crédito no se muestran ni se
  envían.

**Precondiciones**

- El usuario debe estar autenticado con una sesión activa (módulo de autenticación — pendiente de documentar, ver [[auth]]).

**Postcondiciones**

- Se crea un nuevo documento en la colección `accounts` asociado al `user_id` del usuario
  autenticado.
- Si se subió imagen, el archivo queda almacenado en el servicio de object storage configurado y su referencia se guarda en el documento.
- La cuenta queda disponible como opción al registrar gastos en [[transacciones]].

**Definición detallada de campos**

Los campos marcados como "Solo si tipo=credito" en la columna Dependencias únicamente se muestran y son obligatorios cuando el tipo seleccionado es crédito; para `debito` y `efectivo` no aplican.

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `nombre` | Texto | Sí | 2–50 caracteres | Letras, números y espacios | Único por usuario | — | Se usa como título de la cuenta en listados y selectores |
| `tipo` | Selección única | Sí | N/A | Enum: `debito`, `credito`, `efectivo` | Determina el ícono por defecto si no hay imagen y si se muestran los campos de crédito | — | No editable después de creada la cuenta (RN-002) |
| `saldo_inicial` | Numérico | Sí | — | Decimal; puede ser negativo solo si `tipo=credito` | Ver regla de negocio | 0 | Se usa una sola vez, para inicializar `saldo_actual` |
| `imagen` | Archivo | No | Máx. 5 MB | JPG, PNG | — | ícono por defecto según `tipo` | Almacenamiento a definir en Setup técnico |
| `color` | Selector de color (16 predefinidos + editor hexadecimal libre) | No | 7 caracteres | Código hexadecimal `#RRGGBB` | — | `#9CA3AF` (gris) | Puramente visual; se guarda siempre como hex (RN-019, RN-021) |
| `excluir_de_stats` | Switch (booleano) | No | N/A | `true` / `false` | — | `false` | No participa en vistas agregadas si es `true` (RN-016, RN-017) |
| `linea_credito` | Numérico | Sí (solo si tipo=credito) | — | Decimal > 0 | Solo si tipo=credito | — | Límite total asignado por el banco (RN-010) |
| `dia_corte` | Numérico (entero) | Sí (solo si tipo=credito) | — | Entero entre 1 y 31 | Solo si tipo=credito | — | Día fijo del mes en que corta el ciclo (RN-010) |
| `dia_pago` | Numérico (entero) | Sí (solo si tipo=credito) | — | Entero entre 1 y 31 | Solo si tipo=credito | — | Día fijo del mes en que vence el pago (RN-010) |
| `gasto_minimo_mensual` | Numérico | No | — | Decimal ≥ 0 | Solo si tipo=credito | 0 (sin umbral) | Monto a gastar en el ciclo para exentar comisión (RN-012) |

**Paleta de color de referencia**

| # | Name | Hex (referencia) |
|---|---|---|
| 1 | Green | `#22C55E` |
| 2 | Blue | `#3B82F6` |
| 3 | Purple | `#A855F7` |
| 4 | Gray | `#9CA3AF` |
| 5 | Red | `#EF4444` |
| 6 | Orange | `#F97316` |
| 7 | Yellow | `#EAB308` |
| 8 | Pink | `#EC4899` |
| 9 | Teal | `#14B8A6` |
| 10 | Indigo | `#6366F1` |
| 11 | Brown | `#92400E` |
| 12 | Black | `#1F2937` |
| 13 | Lime | `#84CC16` |
| 14 | Coral | `#FB7185` |
| 15 | Navy | `#1E3A8A` |
| 16 | Mint | `#6EE7B7` |

> Los valores exactos son de referencia; el diseño visual final se ajusta en Figma (ver
> [[brief-ux]]). Además de estas 16 opciones, el usuario puede introducir cualquier código
> hexadecimal mediante un editor libre (RN-021) — predefinido o personalizado, todo se guarda en el
> mismo campo `color` como hex.

**Reglas de negocio**

- RN-001: El nombre de la cuenta debe ser único por usuario.
- RN-002: El campo `tipo` no se puede modificar una vez creada la cuenta.
- RN-003: `saldo_actual` se inicializa con el valor de `saldo_inicial` al crear la cuenta; a partir
  de ahí solo se modifica por efecto de otros módulos (registro de gastos) o mediante un ajuste
  manual (CU-006), nunca directamente desde este caso de uso.
- RN-004: Si `tipo` es distinto de `credito`, `saldo_inicial` no puede ser negativo.
- RN-010: `linea_credito`, `dia_corte` y `dia_pago` son obligatorios únicamente cuando
  `tipo = credito`; no aplican para `debito` ni `efectivo`.
- RN-011: A diferencia de `tipo` y `saldo_inicial`, los campos `linea_credito`, `dia_corte`,
  `dia_pago` y `gasto_minimo_mensual` sí son editables después de creada la cuenta (ver CU-004).
- RN-012: `gasto_minimo_mensual` es opcional; si no se define, la cuenta no tiene umbral de
  exención de comisión. El seguimiento de cumplimiento contra este umbral, calculado a partir de las transacciones del ciclo (`dia_corte` a `dia_corte`), se resuelve en [[transacciones]] —
  no en este módulo.
- RN-016: `excluir_de_stats` no afecta el registro normal de gastos ni el cálculo de
  `saldo_actual`; únicamente excluye la cuenta de vistas agregadas (net worth, balance total,
  reportes sumatorios) que se construirán en módulos futuros.
- RN-017: Una cuenta con `excluir_de_stats = true` permanece disponible en los selectores de
  cuenta al registrar gastos — a diferencia de una cuenta archivada (CU-005), que no lo está.
- RN-019: `color` es puramente visual (dashboards, reportes, listados); no afecta ninguna regla de negocio ni cálculo.
- RN-021: El campo `color` se almacena siempre como código hexadecimal (`#RRGGBB`); la paleta de 16 colores predefinidos es una capa de presentación en el frontend — toda selección, predefinida o   personalizada, se traduce a un valor hex antes de guardarse.

**Casos de uso derivados identificados**

- *Patrón CRUD+Activar (configuraciones versionadas):* no aplica — una cuenta es un registro de
  datos del usuario, no una configuración operativa del sistema.
- *Patrón Búsqueda y Filtrado:* evaluado y descartado para el listado de cuentas — con el volumen
  esperado (pocas cuentas por usuario), un buscador/filtro dedicado no aporta valor en el MVP. Se reconsidera si la ventana de observación de uso real (ver [[roadmap]]) muestra lo contrario.
- CU-002: Listar cuentas
- CU-003: Ver detalle de cuenta
- CU-004: Editar cuenta
- CU-005: Eliminar (archivar) cuenta
- CU-006: Ajustar saldo actual (manual)

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `nombre` | string | Requerido, 2–50 caracteres, único por usuario | A03 — Sanitizar entrada; A07 — Codificar en salida |
| `tipo` | string | Requerido, enum cerrado | A01 — Validar contra whitelist |
| `saldo_inicial` | number | Requerido, decimal, signo según `tipo` | A03 — Validar tipo y rango numérico |
| `imagen` | file | Opcional, ≤5 MB, JPG/PNG | A03 — Validar tipo MIME real, no solo extensión |
| `color` | string | Opcional; debe cumplir el formato hexadecimal `^#[0-9A-Fa-f]{6}$` | A03 — Validar formato con regex antes de persistir; nunca interpolar sin validar en atributos de estilo (previene inyección CSS) |
| `excluir_de_stats` | boolean | Opcional, debe ser `true` o `false` | A03 — Validar tipo |
| `linea_credito` | number | Requerido si `tipo=credito`, decimal > 0 | A03 — Validar tipo y rango numérico |
| `dia_corte` | integer | Requerido si `tipo=credito`, entero entre 1 y 31 | A03 — Validar rango |
| `dia_pago` | integer | Requerido si `tipo=credito`, entero entre 1 y 31 | A03 — Validar rango |
| `gasto_minimo_mensual` | number | Opcional, decimal ≥ 0 | A03 — Validar tipo y rango numérico |

**Mensajes de error**

*Validación*
- `VALIDATION_001`: "This field is required."
- `VALIDATION_002`: "You already have an account with this name."
- `VALIDATION_003`: "Initial balance cannot be negative for this account type."
- `VALIDATION_005`: "Day must be between 1 and 31."
- `VALIDATION_006`: "Amount cannot be negative."
- `VALIDATION_008`: "Enter a valid hex color (e.g. #RRGGBB)."

*Autenticación / autorización*
- `AUTH_001`: "Your session has expired. Please sign in again."

*Lógica de negocio*
- `BIZ_001`: "We couldn't process the image, but your account was saved."

*Sistema*
- `SYS_001`: "Something went wrong. Please try again later."

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| POST | `/api/v1/accounts` | Bearer JWT |

*Request*
```json
{
  "nombre": "string (requerido)",
  "tipo": "string (requerido, enum: debito|credito|efectivo)",
  "saldo_inicial": "number (requerido)",
  "imagen": "file (opcional, multipart)",
  "color": "string (opcional, hex #RRGGBB, ej. #3B82F6; default: #9CA3AF)",
  "excluir_de_stats": "boolean (opcional, default: false)",
  "linea_credito": "number (requerido solo si tipo=credito)",
  "dia_corte": "number (requerido solo si tipo=credito, 1-31)",
  "dia_pago": "number (requerido solo si tipo=credito, 1-31)",
  "gasto_minimo_mensual": "number (opcional, solo si tipo=credito)"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "nombre": "string",
    "tipo": "string",
    "saldo_actual": "number",
    "imagen_url": "string|null",
    "color": "string (hex)",
    "excluir_de_stats": "boolean",
    "linea_credito": "number|null",
    "dia_corte": "number|null",
    "dia_pago": "number|null",
    "gasto_minimo_mensual": "number|null",
    "status": "active",
    "created_at": "ISODate"
  },
  "message": "Cuenta creada exitosamente."
}
```

*Modelo de información*
```json
// Colección: accounts
{
  "_id": "ObjectId",
  "user_id": "ObjectId (ref: users)",
  "nombre": "string",
  "tipo": "string (enum: debito, credito, efectivo)",
  "saldo_inicial": "number",
  "saldo_actual": "number",
  "imagen_url": "string|null",
  "color": "string (hex #RRGGBB)",
  "excluir_de_stats": "boolean",
  "linea_credito": "number|null (solo si tipo=credito)",
  "dia_corte": "number|null (1-31, solo si tipo=credito)",
  "dia_pago": "number|null (1-31, solo si tipo=credito)",
  "gasto_minimo_mensual": "number|null (solo si tipo=credito, default 0)",
  "status": "string (enum: active, archived)",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```
> Registrado en [[data-model-registry]]. Ver también la colección provisional `transactions`,
> introducida en CU-006.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| `accounts.user_id` → `users` | Referenciado | Un usuario tiene varias cuentas; se consultan por separado con frecuencia |

*Índices*

| Colección | Campos | Tipo | Propósito |
|---|---|---|---|
| `accounts` | `{ user_id: 1, status: 1 }` | Compuesto | Listar cuentas activas de un usuario |
| `accounts` | `{ user_id: 1, nombre: 1 }` | Único compuesto | Garantizar unicidad del nombre por usuario |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Crear cuenta de débito con todos los campos | Datos válidos, tipo=debito, con imagen y color | Cuenta creada, saldo_actual = saldo_inicial | 201 |
| 2 | Flujo exitoso | Crear cuenta de crédito con saldo inicial negativo y campos de crédito completos | tipo=credito, saldo_inicial=-500, linea_credito=15000, dia_corte=16, dia_pago=5 | Cuenta creada correctamente | 201 |
| 3 | Flujo exitoso | Crear cuenta sin color ni excluir_de_stats | Campos opcionales omitidos | `color=#9CA3AF`, `excluir_de_stats=false` | 201 |
| 4 | Flujo exitoso | Crear cuenta con color hexadecimal personalizado | `color=#00FF00` (fuera de la paleta de 16) | Cuenta creada con ese color | 201 |
| 5 | Validación de entrada | Campo requerido faltante | Sin `nombre` | `VALIDATION_001` | 400 |
| 6 | Validación de entrada | Saldo negativo en cuenta no crédito | tipo=debito, saldo_inicial=-100 | `VALIDATION_003` | 400 |
| 7 | Validación de entrada | Nombre duplicado para el mismo usuario | nombre ya existente | `VALIDATION_002` | 409 |
| 8 | Validación de entrada | Color con formato inválido | `color="verde"` (no es hex) | `VALIDATION_008` | 400 |
| 9 | Validación de entrada | Cuenta de crédito sin línea de crédito | tipo=credito, sin `linea_credito` | `VALIDATION_001` | 400 |
| 10 | Validación de entrada | Día de corte fuera de rango | tipo=credito, dia_corte=35 | `VALIDATION_005` | 400 |
| 11 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 12 | Lógica de negocio | Falla al procesar la imagen subida | Archivo corrupto | Cuenta creada, `BIZ_001` como advertencia | 201 |
| 13 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-cuentas-alta]] · [[user-flow-alta-cuenta]]

---

### CU-002 — Listar cuentas

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar el listado de sus cuentas financieras
registradas en la aplicación. Para ello el sistema recuperará las cuentas asociadas al usuario
autenticado, mostrando por defecto únicamente las cuentas activas. El usuario podrá alternar la
vista para incluir cuentas archivadas cuando lo necesite.

**Flujo principal**

1. El usuario accede a la sección "Cuentas".
2. El sistema recupera las cuentas del usuario autenticado con `status = active`.
3. El sistema muestra el listado con nombre, tipo, saldo actual, color e imagen/ícono de cada
   cuenta.
4. El usuario puede alternar el filtro para incluir cuentas archivadas.

**Flujos alternativos / casos borde**

- Si el usuario no tiene cuentas registradas, el sistema muestra un estado vacío invitando a crear
  la primera cuenta (enlace directo a CU-001).
- Si el usuario activa el filtro "incluir archivadas", el sistema agrega las cuentas con
  `status = archived` al listado, visualmente diferenciadas (p. ej. atenuadas).
- Las cuentas con `excluir_de_stats = true` aparecen en este listado con normalidad (con una marca
  visual discreta, ej. un ícono), a diferencia de las archivadas — siguen totalmente activas para
  uso diario, solo se excluyen de vistas agregadas.

**Precondiciones**

- El usuario debe estar autenticado con una sesión activa.

**Postcondiciones**

- Ninguna: es una operación de solo lectura, no modifica datos.

**Definición detallada de campos**

Este CU no captura datos de negocio; expone un único parámetro de consulta para filtrar el
listado.

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `status` (filtro) | Selección única | No | N/A | Enum: `active`, `archived`, `all` | — | `active` | Determina qué cuentas se incluyen en la respuesta |

**Reglas de negocio**

- Ninguna nueva — reutiliza el índice `{ user_id: 1, status: 1 }` definido en CU-001 para esta
  consulta.

**Casos de uso derivados identificados**

- *Patrón Búsqueda y Filtrado:* evaluado y descartado en CU-001 — el filtro de estado
  (activa/archivada) es la única segmentación necesaria en el MVP; no se justifica un buscador
  dedicado con el volumen esperado de cuentas por usuario.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `status` (query param) | string | Opcional; si se envía, debe ser uno de `active`, `archived`, `all` | A01 — Validar contra whitelist antes de construir la consulta |

**Mensajes de error**

*Validación*
- `VALIDATION_004`: "That status filter isn't valid."

*Autenticación / autorización*
- `AUTH_001`: "Your session has expired. Please sign in again."

*Sistema*
- `SYS_001`: "Something went wrong. Please try again later."

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/accounts?status={active\|archived\|all}` | Bearer JWT |

*Request*
```
Query params: status (opcional, default "active")
```

*Response (éxito)*
```json
{
  "success": true,
  "data": [
    {
      "id": "ObjectId",
      "nombre": "string",
      "tipo": "string",
      "saldo_actual": "number",
      "imagen_url": "string|null",
      "color": "string (hex)",
      "excluir_de_stats": "boolean",
      "status": "active"
    }
  ]
}
```

*Modelo de información*

Reutiliza la colección `accounts` definida en CU-001. No se agregan campos nuevos.

*Decisiones de modelado*

Sin cambios respecto a CU-001.

*Índices*

Reutiliza el índice compuesto `{ user_id: 1, status: 1 }` definido en CU-001 — no se crean índices nuevos.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Listar cuentas activas | Usuario con 3 cuentas activas | Devuelve 3 cuentas | 200 |
| 2 | Flujo exitoso | Listar sin cuentas registradas | Usuario nuevo, sin cuentas | Arreglo vacío, estado vacío en UI | 200 |
| 3 | Flujo exitoso | Incluir archivadas | `status=all` | Devuelve activas + archivadas | 200 |
| 4 | Flujo exitoso | Listar incluyendo cuenta excluida de stats | Usuario con una cuenta `excluir_de_stats=true` | Aparece en el listado con normalidad | 200 |
| 5 | Validación de entrada | Filtro inválido | `status=eliminada` | `VALIDATION_004` | 400 |
| 6 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 7 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-cuentas-listado]] · [[user-flow-consultar-dashboard]]

---

### CU-003 — Ver detalle de cuenta

**Actor:** Usuario autenticado (dueño de la cuenta)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar la información completa de una cuenta
específica. Para ello el sistema recuperará el registro de la cuenta solicitada, verificará que
pertenezca al usuario autenticado, y mostrará su nombre, tipo, saldo inicial, saldo actual, imagen,
color, si está excluida de stats, y su historial de movimientos (transacciones) asociado, en orden
cronológico y sin filtros ni buscador. Si el tipo de cuenta es crédito, el detalle incluye además
la línea de crédito, el crédito disponible calculado, el día de corte, el día de pago y el monto
mínimo de gasto mensual (si está configurado).

**Flujo principal**

1. El usuario selecciona una cuenta desde el listado (CU-002).
2. El sistema recupera la cuenta por su `id`.
3. El sistema valida que la cuenta pertenezca al usuario autenticado.
4. El sistema muestra el detalle completo de la cuenta.
5. Si `tipo = credito`, el sistema calcula y muestra el crédito disponible.
6. El sistema muestra el historial de movimientos (transacciones) asociados a esta cuenta, en
   orden cronológico (más recientes primero) y sin filtros ni buscador. Por ahora, la única fuente
   de movimientos es CU-006 (ajustes manuales); cuando exista [[transacciones]], los gastos,
   ingresos y transferencias de esta cuenta aparecerán en el mismo historial.

**Flujos alternativos / casos borde**

- Si la cuenta no existe o pertenece a otro usuario, el sistema responde con el mismo mensaje
  genérico de "no encontrada" en ambos casos, para no revelar la existencia de cuentas ajenas
  (mitigación IDOR).
- El seguimiento de cumplimiento del `gasto_minimo_mensual` (cuánto se ha gastado en el ciclo
  actual vs. el umbral) no se calcula en este CU — depende de las transacciones del módulo
  [[transacciones]] y se diseñará al construir ese módulo. Este CU solo expone el valor
  configurado.
- La vista del historial de movimientos reutiliza el mismo componente que tendrá el futuro
  apartado de transacciones/registros — aquí se muestra sin controles adicionales; su diseño visual
  detallado se define en [[brief-ux]].

**Precondiciones**

- El usuario debe estar autenticado.
- La cuenta debe existir y pertenecer al usuario autenticado.

**Postcondiciones**

- Ninguna: operación de solo lectura.

**Definición detallada de campos**

Este CU no captura datos; presenta el detalle completo (solo lectura) de una cuenta existente:
`nombre`, `tipo`, `saldo_inicial`, `saldo_actual`, `imagen_url`, `color`, `excluir_de_stats`,
`status`, `created_at`, su historial de movimientos, y — solo si `tipo = credito` —
`linea_credito`, `disponible` (calculado), `dia_corte`, `dia_pago`, `gasto_minimo_mensual`.

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| — | Solo lectura | N/A | N/A | N/A | N/A | N/A | Ver definición de campos en CU-001 |
| `disponible` | Solo lectura, calculado | N/A | N/A | N/A | Solo si tipo=credito | N/A | RN-013: no se almacena, se calcula al vuelo |
| `movimientos` | Solo lectura, lista | N/A | N/A | N/A | — | N/A | Historial de `transactions` filtrado por esta cuenta (ver CU-006) |

**Reglas de negocio**

- RN-008: Por seguridad, una cuenta inexistente y una cuenta de otro usuario devuelven la misma
  respuesta ("no encontrada"), evitando enumeración de recursos (IDOR).
- RN-013: Para cuentas de crédito, el crédito `disponible` se calcula como
  `linea_credito - abs(saldo_actual)` en el momento de la consulta; no se almacena como campo
  independiente en la colección, para evitar que se desincronice del saldo real.

**Casos de uso derivados identificados**

- Ninguno adicional a los ya identificados en CU-001.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `id` (path param) | ObjectId | Requerido, debe existir y pertenecer al usuario autenticado | A01 — Control de acceso a nivel de objeto (verificar `user_id` antes de responder) |

**Mensajes de error**

*Autenticación / autorización*
- `AUTH_001`: "Your session has expired. Please sign in again."

*Lógica de negocio*
- `BIZ_002`: "Account not found."

*Sistema*
- `SYS_001`: "Something went wrong. Please try again later."

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/accounts/{id}` | Bearer JWT |

*Request*
```
Path param: id
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "nombre": "string",
    "tipo": "string",
    "saldo_inicial": "number",
    "saldo_actual": "number",
    "imagen_url": "string|null",
    "color": "string (hex)",
    "excluir_de_stats": "boolean",
    "status": "active",
    "created_at": "ISODate",
    "linea_credito": "number|null",
    "disponible": "number|null (calculado, solo si tipo=credito)",
    "dia_corte": "number|null",
    "dia_pago": "number|null",
    "gasto_minimo_mensual": "number|null",
    "movimientos": [
      {
        "id": "ObjectId",
        "tipo": "string (ajuste | gasto | ingreso | transferencia — enum provisional)",
        "concepto": "string",
        "monto": "number",
        "fecha": "ISODate"
      }
    ]
  }
}
```

*Modelo de información*

Reutiliza la colección `accounts` definida en CU-001; `disponible` es un campo calculado en la
respuesta, no persistido. `movimientos` consulta la colección provisional `transactions`
(introducida en CU-006) filtrando por `account_id`.

*Decisiones de modelado*

Sin cambios respecto a CU-001. Reutiliza la relación `transactions.account_id → accounts` definida en CU-006.

*Índices*

Consulta por `_id` (índice primario por defecto) filtrando adicionalmente por `user_id` — no
requiere índice nuevo en `accounts`. Para `movimientos`, reutiliza el índice `{ account_id: 1, fecha: -1 }` de `transactions` (ver CU-006).

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Ver detalle de cuenta de débito o efectivo | `id` válido, propietario | Detalle completo, sin campos de crédito | 200 |
| 2 | Flujo exitoso | Ver detalle de cuenta de crédito | `id` válido, tipo=credito | Detalle completo con `linea_credito`, `disponible` calculado, `dia_corte`, `dia_pago` | 200 |
| 3 | Flujo exitoso | Ver detalle de cuenta con movimientos previos | Cuenta con 2 ajustes manuales registrados | `movimientos` incluye ambas transacciones, orden cronológico descendente | 200 |
| 4 | Recurso no encontrado | `id` inexistente | `id` no existe en la colección | `BIZ_002` | 404 |
| 5 | Recurso no encontrado | `id` de cuenta de otro usuario | `id` válido, otro `user_id` | `BIZ_002` (mismo mensaje que inexistente) | 404 |
| 6 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 7 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-cuentas-detalle]]

---

### CU-004 — Editar cuenta

**Actor:** Usuario autenticado (dueño de la cuenta)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario modificar los datos editables de una cuenta existente:
nombre, imagen, color, si está excluida de vistas agregadas y, en cuentas de crédito, la línea de
crédito, el día de corte, el día de pago y el monto mínimo de gasto mensual. El tipo de cuenta y el
saldo inicial no son editables una vez creada la cuenta (RN-002, RN-003 de CU-001); el ajuste del
saldo actual se realiza mediante un caso de uso independiente (CU-006), no desde aquí.

**Flujo principal**

1. El usuario accede al detalle de una cuenta (CU-003) y selecciona "Editar".
2. El sistema muestra el formulario pre-llenado con los datos actuales, con `tipo`, `saldo_inicial`
   y `saldo_actual` en modo de solo lectura.
3. El usuario modifica nombre, imagen, color, si la cuenta está excluida de stats y, si es de
   crédito, línea de crédito, día de corte, día de pago y/o monto mínimo de gasto mensual.
4. El usuario confirma los cambios.
5. El sistema valida los datos ingresados.
6. El sistema actualiza el registro de la cuenta y `updated_at`.
7. El sistema muestra la cuenta actualizada.

**Flujos alternativos / casos borde**

- Si el usuario reemplaza la imagen, el sistema sustituye la referencia almacenada; la gestión del
  archivo anterior en el object storage queda pendiente de definir en Setup técnico (mismo
  pendiente heredado de CU-001).
- Si la carga de la nueva imagen falla, la cuenta conserva la imagen anterior y se notifica el
  error de forma no bloqueante.
- Si el nuevo nombre coincide con otra cuenta del mismo usuario (distinta de la que se edita), se
  rechaza el cambio.
- Los campos de crédito solo se aceptan si la cuenta es de `tipo = credito`; si se envían en una
  cuenta de débito o efectivo, se ignoran.

**Precondiciones**

- El usuario debe estar autenticado.
- La cuenta debe existir y pertenecer al usuario autenticado.

**Postcondiciones**

- Se actualizan `nombre`, `imagen_url`, `color` y/o `excluir_de_stats` del documento en `accounts`.
- En cuentas de crédito, se actualizan además `linea_credito`, `dia_corte`, `dia_pago` y/o
  `gasto_minimo_mensual` según lo enviado.
- Se actualiza `updated_at`.
- `tipo`, `saldo_inicial` y `saldo_actual` permanecen sin cambios.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `nombre` | Texto | Sí | 2–50 caracteres | Letras, números y espacios | Único por usuario (excluyendo la cuenta actual) | valor actual | Mismas reglas que en la creación (RN-001) |
| `imagen` | Archivo | No | Máx. 5 MB | JPG, PNG | — | imagen actual | Reemplaza la imagen existente |
| `color` | Selector de color (16 predefinidos + editor hexadecimal libre) | No | 7 caracteres | Código hexadecimal `#RRGGBB` | — | valor actual | RN-019, RN-021 |
| `excluir_de_stats` | Switch (booleano) | No | N/A | `true` / `false` | — | valor actual | RN-016, RN-017 |
| `tipo` | Solo lectura | — | — | — | — | valor actual | RN-002: no editable |
| `saldo_inicial` | Solo lectura | — | — | — | — | valor actual | RN-006: no editable |
| `saldo_actual` | Solo lectura (no editable aquí) | — | — | — | — | valor actual | Ver CU-006 para ajuste manual |
| `linea_credito` | Numérico | No | — | Decimal > 0 | Solo si tipo=credito | valor actual | RN-011: editable |
| `dia_corte` | Numérico (entero) | No | — | Entero entre 1 y 31 | Solo si tipo=credito | valor actual | RN-011: editable |
| `dia_pago` | Numérico (entero) | No | — | Entero entre 1 y 31 | Solo si tipo=credito | valor actual | RN-011: editable |
| `gasto_minimo_mensual` | Numérico | No | — | Decimal ≥ 0 | Solo si tipo=credito | valor actual | RN-011: editable |

**Reglas de negocio**

- RN-005: El nombre de la cuenta debe seguir siendo único por usuario al editarse, excluyendo la
  propia cuenta de la comparación.
- RN-006: `tipo` y `saldo_inicial` no son editables desde este caso de uso (reafirma RN-002 y
  RN-003 de CU-001); `saldo_actual` tampoco se edita aquí — ver CU-006.
- Ver RN-010, RN-011, RN-012, RN-016, RN-017, RN-019 y RN-021 (definidas en CU-001) para el
  comportamiento de los campos exclusivos de crédito, `excluir_de_stats` y `color`.

**Casos de uso derivados identificados**

- Ninguno adicional a los ya identificados en CU-001.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `nombre` | string | Requerido, 2–50 caracteres, único por usuario (excluyendo la cuenta actual) | A03 — Sanitizar entrada; A07 — Codificar en salida |
| `imagen` | file | Opcional, ≤5 MB, JPG/PNG | A03 — Validar tipo MIME real, no solo extensión |
| `color` | string | Opcional; debe cumplir el formato hexadecimal `^#[0-9A-Fa-f]{6}$` | A03 — Validar formato con regex; nunca interpolar sin validar en atributos de estilo |
| `excluir_de_stats` | boolean | Opcional, debe ser `true` o `false` | A03 — Validar tipo |
| `linea_credito` | number | Opcional; si se envía, decimal > 0; solo válido si `tipo=credito` | A03 — Validar tipo y rango numérico |
| `dia_corte` | integer | Opcional; si se envía, entero entre 1 y 31; solo válido si `tipo=credito` | A03 — Validar rango |
| `dia_pago` | integer | Opcional; si se envía, entero entre 1 y 31; solo válido si `tipo=credito` | A03 — Validar rango |
| `gasto_minimo_mensual` | number | Opcional; si se envía, decimal ≥ 0; solo válido si `tipo=credito` | A03 — Validar tipo y rango numérico |
| `id` (path param) | ObjectId | Requerido, debe existir y pertenecer al usuario autenticado | A01 — Control de acceso a nivel de objeto |

**Mensajes de error**

*Validación*
- `VALIDATION_001`: "This field is required."
- `VALIDATION_002`: "You already have an account with this name."
- `VALIDATION_005`: "Day must be between 1 and 31."
- `VALIDATION_006`: "Amount cannot be negative."
- `VALIDATION_008`: "Enter a valid hex color (e.g. #RRGGBB)."

*Autenticación / autorización*
- `AUTH_001`: "Your session has expired. Please sign in again."

*Lógica de negocio*
- `BIZ_001`: "We couldn't process the image, but your account was saved."
- `BIZ_002`: "Account not found."

*Sistema*
- `SYS_001`: "Something went wrong. Please try again later."

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| PATCH | `/api/v1/accounts/{id}` | Bearer JWT |

*Request*
```json
{
  "nombre": "string (opcional)",
  "imagen": "file (opcional, multipart)",
  "color": "string (opcional, hex #RRGGBB)",
  "excluir_de_stats": "boolean (opcional)",
  "linea_credito": "number (opcional, solo si tipo=credito)",
  "dia_corte": "number (opcional, solo si tipo=credito, 1-31)",
  "dia_pago": "number (opcional, solo si tipo=credito, 1-31)",
  "gasto_minimo_mensual": "number (opcional, solo si tipo=credito)"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "nombre": "string",
    "imagen_url": "string|null",
    "color": "string (hex)",
    "excluir_de_stats": "boolean",
    "linea_credito": "number|null",
    "dia_corte": "number|null",
    "dia_pago": "number|null",
    "gasto_minimo_mensual": "number|null",
    "updated_at": "ISODate"
  },
  "message": "Cuenta actualizada exitosamente."
}
```

*Modelo de información*

Reutiliza la colección `accounts` definida en CU-001. No se agregan campos nuevos; se actualizan
`nombre`, `imagen_url`, `color`, `excluir_de_stats`, `linea_credito`, `dia_corte`, `dia_pago`,
`gasto_minimo_mensual` y `updated_at`.

*Decisiones de modelado*

Sin cambios respecto a CU-001.

*Índices*

Reutiliza el índice único compuesto `{ user_id: 1, nombre: 1 }` definido en CU-001 para la
validación de unicidad (excluyendo el `_id` de la cuenta actual en la consulta).

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Editar nombre de una cuenta | Datos válidos | Cuenta actualizada | 200 |
| 2 | Flujo exitoso | Reemplazar imagen | Imagen válida nueva | Imagen actualizada | 200 |
| 3 | Flujo exitoso | Cambiar color con la paleta predefinida | `color=#3B82F6` | Color actualizado | 200 |
| 4 | Flujo exitoso | Cambiar color con hex personalizado | `color=#00FF00` | Color actualizado | 200 |
| 5 | Flujo exitoso | Editar línea de crédito y fechas de una cuenta de crédito | tipo=credito, nuevos valores válidos | Campos de crédito actualizados | 200 |
| 6 | Validación de entrada | Campo requerido vacío | `nombre` vacío | `VALIDATION_001` | 400 |
| 7 | Validación de entrada | Nombre duplicado con otra cuenta propia | `nombre` de otra cuenta del mismo usuario | `VALIDATION_002` | 409 |
| 8 | Validación de entrada | Color con formato inválido | `color="azul"` | `VALIDATION_008` | 400 |
| 9 | Validación de entrada | Día de corte fuera de rango al editar | `dia_corte=0` | `VALIDATION_005` | 400 |
| 10 | Lógica de negocio | Falla al procesar nueva imagen | Archivo corrupto | Resto de cambios guardados, `BIZ_001` como advertencia | 200 |
| 11 | Recurso no encontrado | Editar cuenta inexistente o ajena | `id` inválido o de otro usuario | `BIZ_002` | 404 |
| 12 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 13 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-cuentas-alta]] (formulario compartido con alta, campos `tipo` y
  `saldo_inicial` en modo lectura)

---

### CU-005 — Eliminar (archivar) cuenta

**Actor:** Usuario autenticado (dueño de la cuenta)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario dar de baja una cuenta sin eliminar su historial. Para
ello el sistema cambiará el `status` de la cuenta a `archived` en lugar de borrar el registro,
preservando la integridad de los gastos históricos asociados a ella. Una cuenta archivada deja de
estar disponible como opción al registrar nuevos gastos y de participar en vistas agregadas, pero
permanece visible en el historial y en reportes. A diferencia de `excluir_de_stats` (CU-001/CU-004)
— que mantiene la cuenta en uso diario, solo excluida de sumatorias —, archivar da de baja la
cuenta por completo de la operación cotidiana.

**Flujo principal**

1. El usuario accede al detalle de una cuenta (CU-003) y selecciona "Archivar".
2. El sistema muestra un mensaje de confirmación explicando que la cuenta dejará de estar
   disponible para nuevos registros, pero su historial se conserva.
3. El usuario confirma la acción.
4. El sistema actualiza el `status` de la cuenta a `archived`.
5. El sistema retira la cuenta del listado activo y de los selectores de cuenta al registrar
   gastos.

**Flujos alternativos / casos borde**

- Si la cuenta ya se encuentra archivada, el sistema rechaza la operación e informa que ya está
  archivada.
- El usuario puede reactivar una cuenta archivada desde el listado (cambiando `status` de vuelta a `active`); este flujo de reactivación se resuelve con el mismo endpoint, no se documenta como CU independiente por ser simétrico y de bajo volumen.

**Precondiciones**

- El usuario debe estar autenticado.
- La cuenta debe existir, pertenecer al usuario autenticado, y encontrarse en `status = active`.

**Postcondiciones**

- El `status` de la cuenta cambia a `archived`.
- `saldo_actual`, `saldo_inicial` y el resto de los campos permanecen sin cambios.
- La cuenta deja de aparecer en el listado por defecto (CU-002) y en los selectores de cuenta de
  [[transacciones]], pero sus gastos históricos siguen siendo consultables.

**Definición detallada de campos**

No aplica — este CU no captura datos nuevos, solo modifica el campo `status` de un registro
existente.

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `status` | N/A (acción del sistema) | N/A | N/A | Enum: `active` → `archived` | Cuenta debe estar `active` | — | RN-007 |

**Reglas de negocio**

- RN-007: Una cuenta archivada no está disponible como opción al registrar nuevos gastos, pero su historial y transacciones asociadas permanecen consultables sin cambios.
- RN-009: No se puede archivar una cuenta que ya se encuentra en `status = archived`.
- RN-018: Una cuenta archivada se excluye automáticamente de las vistas agregadas (net worth,
  reportes), sin importar el valor de `excluir_de_stats`.

**Casos de uso derivados identificados**

- Reactivación de cuenta archivada: se resuelve con el mismo endpoint (cambio inverso de
  `status`), no requiere un CU independiente.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `id` (path param) | ObjectId | Requerido, debe existir, pertenecer al usuario y estar en `status = active` | A01 — Control de acceso a nivel de objeto |

**Mensajes de error**

*Autenticación / autorización*
- `AUTH_001`: "Your session has expired. Please sign in again."

*Lógica de negocio*
- `BIZ_002`: "Account not found."
- `BIZ_003`: "This account is already archived."

*Sistema*
- `SYS_001`: "Something went wrong. Please try again later."

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| PATCH | `/api/v1/accounts/{id}/archive` | Bearer JWT |

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
    "status": "archived",
    "updated_at": "ISODate"
  },
  "message": "Cuenta archivada exitosamente."
}
```

*Modelo de información*

Reutiliza la colección `accounts` definida en CU-001. No se agregan campos nuevos; se actualiza
`status` y `updated_at`.

*Decisiones de modelado*

Sin cambios respecto a CU-001. El uso de `status: archived` en lugar de borrado físico ya estaba
contemplado en el enum definido en CU-001.

*Índices*

Reutiliza el índice `{ user_id: 1, status: 1 }` definido en CU-001 — el cambio de `status` es
precisamente el campo que este índice optimiza para el listado (CU-002).

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Archivar cuenta activa | `id` válido, `status=active` | `status` cambia a `archived` | 200 |
| 2 | Lógica de negocio | Archivar cuenta ya archivada | `id` con `status=archived` | `BIZ_003` | 409 |
| 3 | Recurso no encontrado | Archivar cuenta inexistente o ajena | `id` inválido o de otro usuario | `BIZ_002` | 404 |
| 4 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 5 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-cuentas-detalle]] (acción "Archivar" con modal de confirmación)

---

### CU-006 — Ajustar saldo actual (manual)

**Actor:** Usuario autenticado (dueño de la cuenta)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario corregir manualmente el `saldo_actual` de una cuenta
activa, para reconciliar diferencias entre lo que muestra la aplicación y el saldo real (ej. un
movimiento no registrado, un error de captura). Para ello el sistema solicitará únicamente el nuevo
saldo; no se captura un motivo manual — en su lugar, el sistema registra automáticamente el ajuste como una transacción con concepto fijo "Ajuste manual", visible en el historial de movimientos de la cuenta (CU-003). Este ajuste nunca modifica `saldo_inicial`.

**Flujo principal**

1. El usuario accede al detalle de una cuenta (CU-003) y selecciona "Ajustar saldo".
2. El sistema muestra el saldo actual y solicita el nuevo saldo.
3. El usuario captura el nuevo saldo.
4. El usuario confirma.
5. El sistema valida el dato ingresado.
6. El sistema calcula la diferencia entre el saldo anterior y el nuevo saldo.
7. El sistema actualiza `saldo_actual` al nuevo valor.
8. El sistema genera automáticamente una transacción con concepto fijo "Ajuste manual", tipo
   `ajuste` y el monto de la diferencia, asociada a esta cuenta.
9. El sistema muestra la cuenta con el saldo actualizado y la nueva transacción visible en su
   historial de movimientos.

**Flujos alternativos / casos borde**

- Si la cuenta está archivada, el sistema rechaza el ajuste — primero debe reactivarse (CU-005).
- El esquema completo de la colección de transacciones (categorías, montos por tipo de gasto,
  etc.) se define al construir [[transacciones]]; este CU depende únicamente de un contrato
  mínimo (ver RN-020) que ese módulo puede extender pero no debería romper.

**Precondiciones**

- El usuario debe estar autenticado.
- La cuenta debe existir, pertenecer al usuario autenticado, y encontrarse en `status = active`.

**Postcondiciones**

- `saldo_actual` se reemplaza por el valor capturado.
- Se crea un registro en la colección `transactions` (provisional) con `tipo = ajuste`,
  `concepto = "Ajuste manual"`, `monto` igual a la diferencia entre el saldo anterior y el nuevo, y
  `account_id` de esta cuenta.
- `saldo_inicial` permanece sin cambios (RN-014).
- Se actualiza `updated_at`.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `nuevo_saldo` | Numérico | Sí | — | Decimal | — | — | Reemplaza `saldo_actual`; no modifica `saldo_inicial` (RN-014) |

**Reglas de negocio**

- RN-014: El ajuste manual modifica únicamente `saldo_actual`; `saldo_inicial` nunca se toca desde este caso de uso.
- RN-015: Cada ajuste manual genera automáticamente una transacción con concepto fijo
  "Ajuste manual" (tipo `ajuste`) en la colección `transactions`; el usuario no captura un motivo
  manual — el concepto fijo ya lo describe.
- RN-020: La colección `transactions` es provisional en el alcance de este módulo — Cuentas
  únicamente depende de un contrato mínimo (`account_id`, `user_id`, `tipo`, `concepto`, `monto`,  `fecha`). El esquema completo (categorías, presupuesto vinculado, adjuntos, etc.) se define al construir [[transacciones]], que puede extender este contrato pero no debería romperlo.

**Casos de uso derivados identificados**

- Ninguno adicional.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `nuevo_saldo` | number | Requerido, decimal | A03 — Validar tipo numérico |
| `id` (path param) | ObjectId | Requerido, debe existir, pertenecer al usuario y estar en `status = active` | A01 — Control de acceso a nivel de objeto |

**Mensajes de error**

*Validación*
- `VALIDATION_001`: "This field is required."

*Autenticación / autorización*
- `AUTH_001`: "Your session has expired. Please sign in again."

*Lógica de negocio*
- `BIZ_002`: "Account not found."
- `BIZ_004`: "Archived accounts cannot be adjusted. Reactivate it first."

*Sistema*
- `SYS_001`: "Something went wrong. Please try again later."

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| PATCH | `/api/v1/accounts/{id}/adjust-balance` | Bearer JWT |

*Request*
```json
{
  "nuevo_saldo": "number (requerido)"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "saldo_anterior": "number",
    "saldo_actual": "number",
    "transaccion_generada": {
      "concepto": "Ajuste manual",
      "tipo": "ajuste",
      "monto": "number",
      "fecha": "ISODate"
    },
    "updated_at": "ISODate"
  },
  "message": "Saldo ajustado exitosamente."
}
```

*Modelo de información*

Actualiza `saldo_actual` y `updated_at` en `accounts`, y crea un registro en la colección
provisional `transactions`:
```json
// Colección: transactions (provisional — ver nota en data-model-registry)
{
  "_id": "ObjectId",
  "user_id": "ObjectId (ref: users)",
  "account_id": "ObjectId (ref: accounts)",
  "tipo": "string (enum provisional: ajuste, gasto, ingreso, transferencia)",
  "concepto": "string (fijo: \"Ajuste manual\" para tipo=ajuste)",
  "monto": "number",
  "fecha": "ISODate",
  "created_at": "ISODate"
}
```
> Nota técnica: la actualización de `saldo_actual` en `accounts` y la creación del registro en
> `transactions` deben ejecutarse de forma atómica (ej. transacción de base de datos), para evitar
> inconsistencias si una de las dos operaciones falla.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| `transactions.account_id` → `accounts` | Referenciado | Un movimiento pertenece a una cuenta; se consulta con frecuencia filtrando por cuenta (CU-003) |
| `transactions.user_id` → `users` | Referenciado | Igual que `accounts.user_id` — pendiente de formalizar con el módulo de autenticación |

*Índices*

| Colección | Campos | Tipo | Propósito |
|---|---|---|---|
| `transactions` | `{ account_id: 1, fecha: -1 }` | Compuesto | Listar movimientos de una cuenta en orden cronológico descendente (CU-003) |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Ajustar saldo | `nuevo_saldo=1500` | `saldo_actual` actualizado; transacción "Ajuste manual" creada en `transactions` | 200 |
| 2 | Validación de entrada | `nuevo_saldo` faltante | Sin `nuevo_saldo` | `VALIDATION_001` | 400 |
| 3 | Lógica de negocio | Ajustar cuenta archivada | Cuenta con `status=archived` | `BIZ_004` | 409 |
| 4 | Recurso no encontrado | Cuenta inexistente o ajena | `id` inválido o de otro usuario | `BIZ_002` | 404 |
| 5 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 6 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-cuentas-detalle]] (acción "Ajustar saldo" con modal que solo pide
  el nuevo saldo)

---

## Historial de cambios

| Fecha | Cambio | CU afectado | Impacto en otros documentos |
|---|---|---|---|
| 2026-07-25 | Se agregan CU-002 a CU-005 (listar, ver detalle, editar, archivar cuenta); se cierra el módulo Cuentas | CU-002, CU-003, CU-004, CU-005 | Se actualiza [[data-model-registry]] con la colección `accounts`, sus índices y el índice de numeración |
| 2026-07-26 | Se elimina `institucion` del modelo; se elimina `tipo=ahorro`; se agregan campos exclusivos de crédito (`linea_credito`, `dia_corte`, `dia_pago`, `gasto_minimo_mensual`) a CU-001, CU-003 y CU-004; se agrega RN-013 (cálculo de `disponible`) | CU-001, CU-003, CU-004 | Se actualiza [[data-model-registry]]; se agrega ítem de recompensas de tarjetas de crédito a [[backlog]] |
| 2026-07-26 | Se elimina `moneda` del esquema; se agregan `color` y `excluir_de_stats` (CU-001, CU-003, CU-004); se agrega CU-006 (ajuste manual de saldo con `historial_ajustes`); se clarifica la diferencia entre archivar y excluir de stats (RN-018) | CU-001, CU-003, CU-004, CU-005, CU-006 | Se actualiza [[data-model-registry]]; se agregan ítems de multi-moneda y Apple Pay a [[backlog]] |
| 2026-07-26 | CU-006 pasa de `historial_ajustes` embebido con `motivo` manual a generar automáticamente una transacción con concepto fijo "Ajuste manual" — se introduce la colección provisional `transactions` (RN-020); CU-003 muestra el historial de movimientos en vez del historial de ajustes; `color` amplía a paleta de 16 + editor hexadecimal, se almacena siempre como hex (RN-021); se retira `VALIDATION_007` (motivo, ya no aplica) | CU-001, CU-003, CU-004, CU-006 | Se actualiza [[data-model-registry]]: nueva colección `transactions`, primer diagrama ER generado |
| 2026-08-06 | Se construye el módulo Cuentas en código (React + Supabase), completo (CU-001 a CU-006), sobre el modelo traducido a Postgres/RLS — ver [[data-model-registry]] para el detalle del esquema real. Se traduce a inglés el texto literal de los mensajes de error (`VALIDATION_001` a `008`, `BIZ_001` a `004`, `AUTH_001`/`SYS_001` reutilizados) y los nombres de la paleta de 16 colores de referencia, siguiendo la convención de idioma establecida en [[auth]] — los códigos, RN y el resto de la prosa de este documento no cambian. Decisión de implementación no documentada antes: la unicidad del nombre por usuario (RN-001/RN-005) se aplica sin distinguir mayúsculas/minúsculas. | CU-001, CU-002, CU-003, CU-004, CU-005, CU-006 | Se actualiza [[data-model-registry]]: `accounts` y `transactions` traducidas de Mongo a Postgres (tipos, constraints, RLS, RPC de ajuste atómico, bucket de Storage). |

| 2026-09-04 | Cambio cruzado desde [[msi]]: el detalle de una cuenta de tipo `credito` incorpora dos tarjetas nuevas (CU-073), que no aplican a débito ni efectivo. La primera es un **calendario de pagos** de los doce meses del año, con navegación por año acotada a los años con datos (mismo criterio que RN-232/RN-240 de [[dashboard]]), que descompone el pago de cada mes en compras corrientes y parcialidades de planes — las compras a meses no se cuentan por su monto completo en el mes de la compra, entran repartidas (RN-278). La segunda lista los **planes con su amortización**: avance acumulado por plan y, al desplegarlo, cada parcialidad marcada como cargada, pendiente o absorbida por una liquidación. El avance se deriva del calendario y no de los pagos capturados (RN-279): el banco carga la parcialidad al corte, se haya liquidado el estado de cuenta o no. Desde ahí se administran los planes (alta, edición, baja y liquidación anticipada). El saldo de la tarjeta no cambia de definición: una compra a meses lo incrementa por su monto completo el día del registro (RN-272), que es lo que se le debe al banco, y de ahí sigue dependiendo el crédito disponible (RN-234). | CU-003 | Se actualiza [[data-model-registry]]: campos de MSI en `transactions`; numeración acuñada en [[msi]] |
## Referencias

- [[estrategia]]
- [[brief-ux]]
- [[data-model-registry]]
- [[backlog]]
- [[msi]]
