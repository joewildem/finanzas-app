---
modulo: "Categorías"
status: en progreso
---
## Resumen del módulo

El módulo de Categorías permite a cada usuario organizar sus finanzas mediante una estructura de
dos niveles: **Grupos de categoría** (ej. "Bills", "Needs", "Wants", "Investment") y **Categorías**
dentro de cada grupo (ej. "Rent", "Internet", "Subscriptions"). Los grupos llevan un color
distintivo — reutilizado en dashboards, reportes y gráficas —, mientras que las categorías
individuales llevan un ícono; ningún nivel combina ambos atributos. Es infraestructura transversal:
el mismo modelo se reutilizará sin rediseño en Ahorros, Créditos e Inversión (v1.1/v1.2), aunque en
este módulo solo se construye lo que [[transacciones]] necesita hoy. Los pagos a tarjetas de
crédito y las aportaciones a metas de ahorro quedan fuera de alcance de este módulo por diseño: no
son gastos categorizables, se resuelven como transacciones con un destino propio (cuenta o meta) al
construir [[transacciones]]. El sistema siembra un catálogo de grupos y categorías predefinidos
por usuario al darse de alta, sin restringir la personalización completa (creación, edición y
ocultamiento) que necesita el usuario avanzado.

## Casos de uso

### CU-007 — Crear grupo de categorías

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario crear un nuevo grupo de categorías (ej. "Bills", "Needs"),
como contenedor de nivel superior para organizar sus categorías de gasto e ingreso. Para ello será
necesario capturar el nombre del grupo, declarar explícitamente su tipo de flujo
(Inflow/Outflow/Investment) y,
opcionalmente, elegir un color distintivo, usado posteriormente para diferenciar visualmente cada
grupo en dashboards, reportes y gráficas. Los grupos no llevan ícono — ese atributo es exclusivo de
las categorías dentro de ellos (ver CU-008).

**Flujo principal**

1. El usuario accede a la sección "Categorías" y selecciona "Agregar grupo".
2. El sistema muestra el formulario de alta de grupo.
3. El usuario captura el nombre.
4. El usuario elige el tipo de flujo del grupo: Inflow (entrada), Outflow (salida) o Investment
   (capital invertido) — sin valor por defecto, es una elección explícita (RN-118).
5. El usuario, opcionalmente, elige un color (de la paleta de 16 predefinidos definida en
   [[cuentas]] o mediante el editor hexadecimal libre).
6. El usuario confirma la creación.
7. El sistema valida los datos ingresados.
8. El sistema crea el grupo con estado "activo", asignándole automáticamente la siguiente posición
   disponible en el orden de despliegue del usuario (RN-119).
9. El sistema muestra el grupo recién creado (sin categorías) en el listado, en la última posición.

**Flujos alternativos / casos borde**

- Si el usuario no elige color, se asigna el valor por defecto (gris, `#9CA3AF`).
- Los grupos predefinidos (Bills, Needs, Wants, Investment, Income) no se crean desde este caso
  de uso — se generan automáticamente y de forma independiente por usuario (copiados, no
  compartidos) al activarse la cuenta del usuario; ese proceso depende del módulo de autenticación,
  aún pendiente de documentar (ver [[auth]]).

**Precondiciones**

- El usuario debe estar autenticado con una sesión activa (módulo de autenticación — pendiente de
  documentar, ver [[auth]]).

**Postcondiciones**

- Se crea un nuevo documento en la colección `categories` con `tipo = "grupo"`, `grupo_id = null`,
  `flujo` (Inflow/Outflow/Investment) y `orden` (siguiente posición disponible), asociado al `user_id` del
  usuario autenticado.
- El grupo queda disponible como contenedor al crear categorías (CU-008).

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `nombre` | Texto | Sí | 2–30 caracteres | Letras, números y espacios | Único entre grupos del mismo usuario | — | RN-022 |
| `flujo` | Selección única (Inflow / Outflow / Investment) | Sí | N/A | Enum: `inflow`, `outflow`, `investment` | — | Sin default — elección explícita | RN-118 |
| `color` | Selector de color (16 predefinidos + editor hexadecimal libre) | No | 7 caracteres | Código hexadecimal `#RRGGBB` | — | `#9CA3AF` (gris) | RN-023 |
| `orden` | N/A — asignado por el sistema | Sí (automático) | N/A | Entero | — | Siguiente posición disponible del usuario | RN-119 |

> La paleta de 16 colores de referencia es la misma definida en [[cuentas]] (CU-001) — se reutiliza
> el mismo componente de selección en frontend, sin duplicar la tabla aquí.

**Reglas de negocio**

- RN-022: El nombre debe ser único entre grupos del mismo usuario.
- RN-023: `color` es puramente visual (dashboards, reportes, gráficas); no afecta ninguna regla de
  negocio. Se almacena siempre como hexadecimal, igual que en [[cuentas]] (RN-019, RN-021).
- RN-024: Un grupo no tiene ícono — ese atributo es exclusivo de las categorías (CU-008); si el
  frontend envía un campo `icono` para un grupo, el backend lo ignora.
- RN-025: Los grupos predefinidos (Bills, Needs, Wants, Investment, Income) se siembran
  automáticamente por usuario al alta (copiados, no referenciados desde un catálogo global), de
  modo que cada usuario puede editarlos u ocultarlos sin afectar a otros usuarios del grupo
  cerrado. El disparador de esta siembra depende del módulo de autenticación. El grupo Income
  (nombrado "Ingresos" al documentarse, traducido a inglés al construirse — ver historial de
  cambios) se agregó al catálogo semilla al construir [[transacciones]] (2026-07-30), ya que ese
  módulo requiere categorizar los movimientos de tipo `ingreso` de forma simétrica a los de `gasto`.
  Los 5 grupos predefinidos también fijan `flujo`/`orden` desde su siembra: Bills, Needs y Wants
  quedan como Outflow (posiciones 0 a 2), Investment como Investment (posición 3, ver RN-118) e
  Income como Inflow (posición 4).
- RN-118: Todo grupo declara explícitamente su tipo de flujo (`flujo`: Inflow, Outflow o
  Investment) al crearse — no hay valor por defecto implícito, es una elección obligatoria en el
  formulario. Es editable en cualquier momento (CU-010), sin restricciones adicionales: cambiar el
  flujo de un grupo reclasifica de inmediato sus categorías y cualquier módulo que dependa de esa
  clasificación (ej. [[presupuesto]], que agrupa sus tablas Inflow/Outflow/Investment por este
  campo), ya que no se duplica el valor en otras colecciones. Las categorías (`tipo = "categoria"`)
  no llevan este campo — heredan el flujo de su grupo en tiempo de consulta, igual que heredan su
  `color` hoy. Reemplaza la identificación por nombre de grupo (`"Income"`, `"Bills"`, etc.) que
  usaban [[presupuesto]] y [[transacciones]] (RN-039) antes de este campo — un grupo renombrado ya
  no pierde su clasificación. **Revisado 2026-08-28** (al alinear la pestaña Analytics de
  [[dashboard]]): se agrega `investment` como tercer valor del enum. Hasta entonces, el grupo
  "Investment" era un subconjunto de Outflow distinguido únicamente por nombre exacto en el chip
  del formulario de alta de transacciones y en el cálculo de ingresos vs. gastos del viejo
  [[reportes]] (RN-094, retirado) — ambos casos frágiles ante un renombrado, documentados en su
  momento como "queda fuera de este cambio" (ver RN-039 de [[transacciones]]). Con `investment`
  como valor estructural, esa distinción deja de depender del nombre en cualquier lugar del
  sistema.
- RN-119: Todo grupo tiene una posición manual de despliegue (`orden`), asignada automáticamente al
  crearse como la siguiente disponible del usuario (RN-118 no afecta el conteo — Inflow y Outflow
  comparten una sola secuencia). Es reordenable desde CU-009 con controles de mover arriba/abajo
  (intercambia `orden` con el grupo inmediato vecino en la lista visible). Determina el orden de
  despliegue tanto en la lista de Categorías como en las tablas Inflow/Outflow de [[presupuesto]].
  Las categorías no tienen `orden` propio — siguen ordenándose alfabéticamente dentro de su grupo,
  sin cambio.

**Casos de uso derivados identificados**

- *Patrón CRUD+Activar:* no aplica tal cual — el "activar/desactivar" de este módulo se resuelve
  como ocultar/archivar (CU-012), no como una configuración operativa independiente.
- *Patrón Búsqueda y Filtrado:* evaluado y descartado — el volumen esperado de grupos por usuario es
  bajo (4–6 grupos); se reconsidera si la ventana de observación de uso real (ver [[roadmap]])
  muestra lo contrario.
- CU-008: Crear categoría
- CU-009: Listar categorías y grupos (vista jerárquica)
- CU-010: Editar grupo
- CU-011: Editar categoría
- CU-012: Ocultar (archivar) grupo o categoría

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `nombre` | string | Requerido, 2–30 caracteres, único entre grupos del usuario | A03 — Sanitizar entrada; A07 — Codificar en salida |
| `flujo` | string | Requerido, enum: `inflow`, `outflow`, `investment` | A03 — Validar contra el enum antes de persistir |
| `color` | string | Opcional; debe cumplir el formato hexadecimal `^#[0-9A-Fa-f]{6}$` | A03 — Validar formato con regex antes de persistir; nunca interpolar sin validar en atributos de estilo |

**Mensajes de error**

*Validación*
- `VALIDATION_001`: "El campo {campo} es obligatorio." *(reutilizado de [[cuentas]])*
- `VALIDATION_008`: "El color debe ser un código hexadecimal válido (#RRGGBB)." *(reutilizado de [[cuentas]])*
- `VALIDATION_009`: "Ya tienes un grupo con ese nombre."

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado de [[cuentas]])*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado de [[cuentas]])*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| POST | `/api/v1/category-groups` | Bearer JWT |

*Request*
```json
{
  "nombre": "string (requerido)",
  "color": "string (opcional, hex #RRGGBB, default: #9CA3AF)"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "tipo": "grupo",
    "nombre": "string",
    "color": "string (hex)",
    "status": "active",
    "created_at": "ISODate"
  },
  "message": "Grupo creado exitosamente."
}
```

*Modelo de información*
```json
// Colección: categories
{
  "_id": "ObjectId",
  "user_id": "ObjectId (ref: users)",
  "tipo": "string (enum: grupo, categoria)",
  "nombre": "string",
  "grupo_id": "ObjectId|null (ref: categories — self-referencia; null si tipo=grupo, obligatorio si tipo=categoria)",
  "color": "string|null (hex #RRGGBB; solo aplica si tipo=grupo)",
  "icono": "string|null (solo aplica si tipo=categoria)",
  "status": "string (enum: active, archived)",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```
> Registrar en [[data-model-registry]] al cerrar el módulo.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| `categories.user_id` → `users` | Referenciado | Igual que `accounts.user_id` — pendiente de formalizar con el módulo de autenticación |
| `categories.grupo_id` → `categories` (self-referencia) | Referenciado | Una sola colección modela grupo y categoría, distinguidos explícitamente por `tipo` (no solo por la presencia/ausencia de `grupo_id`), lo que facilita la reutilización directa en Ahorros, Créditos e Inversión sin rediseño |

*Índices*

| Colección | Campos | Tipo | Propósito |
|---|---|---|---|
| `categories` | `{ user_id: 1, tipo: 1, status: 1 }` | Compuesto | Listar grupos activos/archivados de un usuario |
| `categories` | `{ user_id: 1, grupo_id: 1, nombre: 1 }` | Único compuesto | Garantizar unicidad del nombre entre grupos (`grupo_id: null`) y entre categorías del mismo grupo |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Crear grupo con nombre y color | Datos válidos | Grupo creado | 201 |
| 2 | Flujo exitoso | Crear grupo sin color | Campo opcional omitido | `color=#9CA3AF` | 201 |
| 3 | Validación de entrada | Nombre faltante | Sin `nombre` | `VALIDATION_001` | 400 |
| 4 | Validación de entrada | Nombre duplicado entre grupos | `nombre` ya existente | `VALIDATION_009` | 409 |
| 5 | Validación de entrada | Color con formato inválido | `color="verde"` | `VALIDATION_008` | 400 |
| 6 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 7 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-categorias-alta-grupo]] · [[user-flow-crear-grupo]]

---

### CU-008 — Crear categoría

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario crear una nueva categoría dentro de un grupo existente (ej.
"Rent" dentro de "Bills"), para clasificar sus ingresos y gastos. Para ello será necesario capturar
el nombre de la categoría y seleccionar el grupo al que pertenece — a diferencia de los grupos, una
categoría no puede existir sin un grupo asignado. Opcionalmente, el usuario puede elegir un ícono de
una biblioteca predefinida (emoji o set de íconos, a definir en Setup técnico) para identificar
visualmente la categoría; las categorías no llevan color — ese atributo es exclusivo de los grupos
(CU-007).

**Flujo principal**

1. El usuario accede a la sección "Categorías" y selecciona "Agregar categoría" (desde el listado
   general o desde el detalle de un grupo específico).
2. El sistema muestra el formulario de alta, solicitando el grupo al que pertenece — preseleccionado
   si el usuario partió desde el detalle de un grupo.
3. El usuario captura el nombre y confirma o selecciona el grupo.
4. El usuario, opcionalmente, elige un ícono de la biblioteca disponible.
5. El usuario confirma la creación.
6. El sistema valida los datos ingresados.
7. El sistema crea la categoría con estado "activa".
8. El sistema muestra la categoría recién creada dentro de su grupo en el listado.

**Flujos alternativos / casos borde**

- Si el usuario no elige ícono, se asigna un ícono genérico por defecto.
- Si el `grupo_id` no existe o no pertenece al usuario, el sistema responde con el mismo mensaje
  genérico de "no encontrado" (mitigación IDOR, mismo patrón que RN-008 de [[cuentas]]).
- Si el grupo seleccionado está oculto (archivado), el sistema rechaza la creación de la categoría
  dentro de él — primero debe reactivarse el grupo.
- Las categorías predefinidas (Rent, Internet, Subscriptions, etc.) no se crean desde este caso de
  uso — se siembran automáticamente por usuario al alta, junto con los grupos predefinidos (ver
  CU-007).

**Precondiciones**

- El usuario debe estar autenticado.
- El `grupo_id` especificado debe existir, pertenecer al usuario autenticado, ser de `tipo = grupo`,
  y encontrarse en `status = active`.

**Postcondiciones**

- Se crea un nuevo documento en `categories` con `tipo = "categoria"`, asociado al `grupo_id`
  indicado y al `user_id` del usuario autenticado.
- La categoría queda disponible como opción al registrar movimientos en [[transacciones]] y, a
  futuro, al configurar el presupuesto mensual dentro de su grupo en el módulo de Presupuesto (aún
  sin documentar).

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `nombre` | Texto | Sí | 2–30 caracteres | Letras, números y espacios | Único dentro del mismo grupo | — | RN-026 |
| `grupo_id` | Selección (grupo existente del usuario) | Sí | N/A | ObjectId válido; debe referenciar un grupo activo propio | Determina bajo qué grupo aparece la categoría | — | RN-027 |
| `icono` | Selección única | No | N/A | Enum cerrado de un catálogo/biblioteca de íconos (emoji o set gráfico, a definir en Setup técnico) | — | ícono genérico | RN-029 |

**Reglas de negocio**

- RN-026: El nombre debe ser único entre categorías que pertenezcan al mismo grupo, para un mismo
  usuario (dos categorías dentro de "Bills" no pueden llamarse igual entre sí, pero una categoría
  puede compartir nombre con otra de un grupo distinto, ej. "Otros" en "Needs" y en "Wants").
- RN-027: `grupo_id` es obligatorio — no puede existir una categoría sin grupo asignado.
- RN-028: Una categoría no tiene color — ese atributo es exclusivo de los grupos (CU-007); si el
  frontend envía un campo `color` para una categoría, el backend lo ignora.
- RN-029: `icono` es opcional y puramente visual; el catálogo de íconos disponibles (biblioteca de
  emoji o set gráfico) es una capa de presentación en el frontend — no se permite cargar una imagen
  propia.
- RN-030: Las categorías predefinidas se siembran de forma independiente por usuario (copiadas a su
  propio `user_id`), de modo que cada usuario puede editarlas u ocultarlas sin afectar a otros
  usuarios del grupo cerrado. El disparador de esta siembra depende del módulo de autenticación.

**Casos de uso derivados identificados**

- Ninguno adicional a los ya identificados en CU-007.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `nombre` | string | Requerido, 2–30 caracteres, único dentro del grupo | A03 — Sanitizar entrada; A07 — Codificar en salida |
| `grupo_id` | ObjectId | Requerido; debe existir, pertenecer al usuario, ser `tipo=grupo` y estar `status=active` | A01 — Control de acceso a nivel de objeto (IDOR) |
| `icono` | string | Opcional; debe pertenecer al enum cerrado del catálogo de íconos | A01 — Validar contra whitelist |

**Mensajes de error**

*Validación*
- `VALIDATION_001`: "El campo {campo} es obligatorio." *(reutilizado)*
- `VALIDATION_010`: "Ya tienes una categoría con ese nombre en este grupo."
- `VALIDATION_011`: "El ícono seleccionado no es válido."

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Lógica de negocio*
- `BIZ_005`: "El grupo seleccionado no existe, no te pertenece, o está oculto."

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| POST | `/api/v1/categories` | Bearer JWT |

*Request*
```json
{
  "nombre": "string (requerido)",
  "grupo_id": "ObjectId (requerido)",
  "icono": "string (opcional, enum catálogo, default: 'generico')"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "tipo": "categoria",
    "nombre": "string",
    "grupo_id": "ObjectId",
    "icono": "string",
    "status": "active",
    "created_at": "ISODate"
  },
  "message": "Categoría creada exitosamente."
}
```

*Modelo de información*

Reutiliza la colección `categories` definida en CU-007. No se agregan campos nuevos.

*Decisiones de modelado*

Sin cambios respecto a CU-007.

*Índices*

Reutiliza el índice único compuesto `{ user_id: 1, grupo_id: 1, nombre: 1 }` definido en CU-007
para la validación de unicidad. Se agrega:

| Colección | Campos | Tipo | Propósito |
|---|---|---|---|
| `categories` | `{ user_id: 1, grupo_id: 1, status: 1 }` | Compuesto | Listar categorías activas/archivadas de un grupo específico |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Crear categoría con grupo e ícono | Datos válidos | Categoría creada | 201 |
| 2 | Flujo exitoso | Crear categoría sin ícono | Campo opcional omitido | ícono genérico | 201 |
| 3 | Flujo exitoso | Crear categorías con el mismo nombre en grupos distintos | `nombre="Otros"` en "Needs" y en "Wants" | Ambas se crean sin conflicto | 201 |
| 4 | Validación de entrada | Nombre faltante | Sin `nombre` | `VALIDATION_001` | 400 |
| 5 | Validación de entrada | `grupo_id` faltante | Sin `grupo_id` | `VALIDATION_001` | 400 |
| 6 | Validación de entrada | Nombre duplicado dentro del mismo grupo | Mismo `nombre` y `grupo_id` que uno existente | `VALIDATION_010` | 409 |
| 7 | Validación de entrada | Ícono fuera del catálogo | `icono="no-existe"` | `VALIDATION_011` | 400 |
| 8 | Lógica de negocio | `grupo_id` inexistente o ajeno | `grupo_id` inválido o de otro usuario | `BIZ_005` | 404 |
| 9 | Lógica de negocio | `grupo_id` de un grupo oculto | Grupo con `status=archived` | `BIZ_005` | 404 |
| 10 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 11 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-categorias-alta]] · [[user-flow-crear-categoria]]

---

### CU-009 — Listar categorías (vista jerárquica)

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario consultar sus grupos de categorías junto con las categorías
que contiene cada uno, en una sola vista jerárquica, ordenados según `orden` (RN-119). Por defecto
el sistema muestra únicamente grupos y categorías activos; el usuario puede alternar la vista para
incluir los ocultos (archivados). Desde esta misma vista, el usuario también puede reordenar los
grupos con controles de mover arriba/abajo.

**Flujo principal**

1. El usuario accede a la sección "Categorías".
2. El sistema recupera los grupos del usuario con `status = active`, y para cada uno sus categorías
   con `status = active`, ordenando los grupos por `orden` ascendente.
3. El sistema muestra la vista jerárquica: cada grupo con su color, su etiqueta de flujo
   (Inflow/Outflow/Investment) y controles de mover arriba/abajo, y debajo sus categorías con su
   ícono.
4. El usuario puede alternar el filtro para incluir ocultos.
5. El usuario puede reordenar un grupo con los controles de mover arriba/abajo — el sistema
   intercambia su `orden` con el del grupo inmediato vecino en la lista visible (RN-119) y refresca
   la vista.

**Flujos alternativos / casos borde**

- Si el usuario no tiene grupos (caso extremo, ya que se siembran predefinidos al alta), se muestra
  un estado vacío invitando a crear el primero.
- Si un grupo no tiene categorías (recién creado), se muestra igual, con un estado vacío interno
  invitando a agregar la primera categoría.
- Si se activa "incluir ocultos", se muestran también los grupos y categorías con
  `status = archived`, visualmente diferenciados (atenuados) — incluyendo el caso de una categoría
  oculta dentro de un grupo activo (posible tras una reactivación parcial, ver RN-035 de CU-012).
- El control de mover arriba se deshabilita en el primer grupo de la lista, y el de mover abajo en
  el último — no hay envoltura circular.

**Precondiciones**

- El usuario debe estar autenticado con una sesión activa.

**Postcondiciones**

- De solo lectura salvo por la acción de reordenar (RN-119), que actualiza el `orden` de los dos
  grupos involucrados en el intercambio.

**Definición detallada de campos**

Este CU no captura datos de negocio; expone un único parámetro de consulta para filtrar el listado.

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `status` (filtro) | Selección única | No | N/A | Enum: `active`, `archived`, `all` | — | `active` | Determina qué grupos y categorías se incluyen en la respuesta |

**Reglas de negocio**

- Ninguna nueva — reutiliza los índices `{ user_id: 1, tipo: 1, status: 1 }` y
  `{ user_id: 1, grupo_id: 1, status: 1 }` definidos en CU-007 y CU-008.

**Casos de uso derivados identificados**

- *Patrón Búsqueda y Filtrado:* evaluado y descartado — el volumen esperado de grupos y categorías
  por usuario es bajo en el MVP; se reconsidera si la ventana de observación de uso real (ver
  [[roadmap]]) muestra lo contrario.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `status` (query param) | string | Opcional; si se envía, debe ser uno de `active`, `archived`, `all` | A01 — Validar contra whitelist antes de construir la consulta |

**Mensajes de error**

*Validación*
- `VALIDATION_004`: "El filtro de estado no es válido." *(reutilizado de [[cuentas]])*

*Autenticación / autorización*
- `AUTH_001`: "Tu sesión ha expirado. Inicia sesión nuevamente." *(reutilizado)*

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/categories?status={active\|archived\|all}` | Bearer JWT |

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
      "tipo": "grupo",
      "nombre": "string",
      "color": "string (hex)",
      "status": "active",
      "categorias": [
        {
          "id": "ObjectId",
          "nombre": "string",
          "icono": "string",
          "status": "active"
        }
      ]
    }
  ]
}
```

*Modelo de información*

Reutiliza la colección `categories` definida en CU-007/CU-008. No se agregan campos nuevos.

*Decisiones de modelado*

La respuesta anida las categorías dentro de su grupo en la capa de servicio (agregación al momento
de la consulta); no se modela como array embebido en la base de datos — se mantienen como
documentos independientes referenciados por `grupo_id`, consistente con la decisión de CU-007/CU-008.

*Índices*

Reutiliza `{ user_id: 1, tipo: 1, status: 1 }` (CU-007) y `{ user_id: 1, grupo_id: 1, status: 1 }`
(CU-008) — no se crean índices nuevos.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Listar grupos y categorías activos | Usuario con grupos y categorías activos | Vista jerárquica completa | 200 |
| 2 | Flujo exitoso | Grupo sin categorías | Grupo recién creado | Aparece con arreglo `categorias` vacío | 200 |
| 3 | Flujo exitoso | Incluir ocultos | `status=all` | Aparecen grupos y categorías archivados, diferenciados | 200 |
| 4 | Flujo exitoso | Grupo activo con una categoría oculta dentro | Tras reactivar el grupo (CU-012) sin reactivar la categoría | La categoría aparece diferenciada dentro del grupo activo | 200 |
| 5 | Validación de entrada | Filtro inválido | `status=eliminado` | `VALIDATION_004` | 400 |
| 6 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 7 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-categorias-listado]]

---

### CU-010 — Editar grupo

**Actor:** Usuario autenticado (dueño del grupo)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario modificar el nombre, tipo de flujo y/o color de un grupo
existente. El ocultamiento (archivado) del grupo se gestiona mediante un caso de uso independiente
(CU-012), no desde aquí; reordenar el grupo (`orden`) tampoco se gestiona desde este formulario —
se hace con los controles de mover arriba/abajo de CU-009.

**Flujo principal**

1. El usuario accede al grupo desde el listado y selecciona "Editar".
2. El sistema muestra el formulario pre-llenado con los datos actuales.
3. El usuario modifica nombre, tipo de flujo y/o color.
4. El usuario confirma los cambios.
5. El sistema valida los datos ingresados.
6. El sistema actualiza el registro y `updated_at`.
7. El sistema muestra el grupo actualizado.

**Flujos alternativos / casos borde**

- Si el nuevo nombre coincide con otro grupo del mismo usuario (distinto del que se edita), se
  rechaza el cambio.
- Si el usuario cambia el `flujo` del grupo, la reclasificación es inmediata (RN-118) — sus
  categorías pasan a aparecer bajo el otro flujo en cualquier módulo que dependa de este campo (ej.
  [[presupuesto]]), sin necesidad de pasos adicionales.

**Precondiciones**

- El usuario debe estar autenticado.
- El grupo debe existir, pertenecer al usuario autenticado, y ser `tipo = grupo`.

**Postcondiciones**

- Se actualizan `nombre`, `flujo` y/o `color` del documento en `categories`.
- Se actualiza `updated_at`.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `nombre` | Texto | No | 2–30 caracteres | Letras, números y espacios | Único entre grupos (excluyendo el grupo actual) | valor actual | RN-031 |
| `flujo` | Selección única (Inflow / Outflow / Investment) | No | N/A | Enum: `inflow`, `outflow`, `investment` | — | valor actual | Ver RN-118 (CU-007) |
| `color` | Selector de color (16 predefinidos + editor hexadecimal libre) | No | 7 caracteres | Código hexadecimal `#RRGGBB` | — | valor actual | Ver RN-023 (CU-007) |

**Reglas de negocio**

- RN-031: El nombre del grupo debe seguir siendo único por usuario al editarse, excluyendo el
  propio grupo de la comparación.
- Ver RN-023, RN-024 (CU-007) para el comportamiento de `color` y la ausencia de ícono; ver RN-118
  para el comportamiento de `flujo` al editarse.

**Casos de uso derivados identificados**

- Ninguno adicional a los ya identificados en CU-007.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `nombre` | string | Opcional; si se envía, 2–30 caracteres, único entre grupos (excluyendo el actual) | A03 — Sanitizar entrada; A07 — Codificar en salida |
| `color` | string | Opcional; debe cumplir el formato hexadecimal `^#[0-9A-Fa-f]{6}$` | A03 — Validar formato con regex |
| `id` (path param) | ObjectId | Requerido, debe existir, ser `tipo=grupo`, y pertenecer al usuario autenticado | A01 — Control de acceso a nivel de objeto |

**Mensajes de error**

*Validación*
- `VALIDATION_001`, `VALIDATION_008`, `VALIDATION_009` *(reutilizados — ver CU-007)*

*Autenticación / autorización*
- `AUTH_001` *(reutilizado)*

*Lógica de negocio*
- `BIZ_006`: "El grupo solicitado no existe."

*Sistema*
- `SYS_001` *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| PATCH | `/api/v1/category-groups/{id}` | Bearer JWT |

*Request*
```json
{
  "nombre": "string (opcional)",
  "color": "string (opcional, hex #RRGGBB)"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "nombre": "string",
    "color": "string (hex)",
    "updated_at": "ISODate"
  },
  "message": "Grupo actualizado exitosamente."
}
```

*Modelo de información*

Reutiliza la colección `categories` definida en CU-007. Se actualizan `nombre`, `color` y
`updated_at`.

*Decisiones de modelado*

Sin cambios respecto a CU-007.

*Índices*

Reutiliza el índice único compuesto `{ user_id: 1, grupo_id: 1, nombre: 1 }` definido en CU-007
para la validación de unicidad (excluyendo el `_id` del grupo actual).

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Editar nombre de un grupo | Datos válidos | Grupo actualizado | 200 |
| 2 | Flujo exitoso | Editar color del grupo | `color` válido | Color actualizado | 200 |
| 3 | Validación de entrada | Nombre duplicado con otro grupo propio | `nombre` de otro grupo del mismo usuario | `VALIDATION_009` | 409 |
| 4 | Validación de entrada | Color con formato inválido | `color="azul"` | `VALIDATION_008` | 400 |
| 5 | Recurso no encontrado | Editar grupo inexistente o ajeno | `id` inválido o de otro usuario | `BIZ_006` | 404 |
| 6 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 7 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-categorias-alta-grupo]] (formulario compartido con alta)

---

### CU-011 — Editar categoría

**Actor:** Usuario autenticado (dueño de la categoría)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario modificar el nombre, el ícono y/o el grupo de una categoría
existente. A diferencia de `tipo` en cuentas (no editable, RN-002 de [[cuentas]]), aquí mover una
categoría a otro grupo sí está permitido desde este caso de uso. El ocultamiento (archivado) de la
categoría se gestiona mediante un caso de uso independiente (CU-012).

**Flujo principal**

1. El usuario accede a la categoría desde el listado y selecciona "Editar".
2. El sistema muestra el formulario pre-llenado, incluyendo el grupo actual.
3. El usuario modifica nombre, ícono y/o selecciona un grupo distinto.
4. El usuario confirma los cambios.
5. El sistema valida los datos ingresados.
6. El sistema actualiza el registro (incluyendo `grupo_id`, si cambió) y `updated_at`.
7. El sistema muestra la categoría actualizada, listada bajo su grupo (nuevo o el mismo).

**Flujos alternativos / casos borde**

- Si el nuevo nombre coincide con otra categoría del grupo destino (el nuevo grupo, si cambió; o el
  actual, si no cambió), se rechaza el cambio.
- Si el `grupo_id` destino no existe, no pertenece al usuario, o está oculto, se rechaza el cambio.
- Mover una categoría a otro grupo no afecta las transacciones ya clasificadas con ella en el
  pasado — conservan su referencia a la misma categoría (`id`); solo cambia bajo qué grupo se agrupa
  esa categoría en reportes futuros y en el listado.

**Precondiciones**

- El usuario debe estar autenticado.
- La categoría debe existir y pertenecer al usuario autenticado.
- Si se especifica un nuevo `grupo_id`, debe existir, pertenecer al usuario, ser `tipo = grupo` y
  estar `status = active`.

**Postcondiciones**

- Se actualizan `nombre`, `icono` y/o `grupo_id` del documento en `categories`.
- Se actualiza `updated_at`.
- Las transacciones históricas que referencian esta categoría no se modifican.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `nombre` | Texto | No | 2–30 caracteres | Letras, números y espacios | Único dentro del grupo destino | valor actual | RN-032 |
| `grupo_id` | Selección (grupo existente del usuario) | No | N/A | ObjectId válido; debe referenciar un grupo activo propio | Cambia bajo qué grupo aparece la categoría | valor actual | RN-033 |
| `icono` | Selección única | No | N/A | Enum cerrado del catálogo de íconos | — | valor actual | Ver RN-029 (CU-008) |

**Reglas de negocio**

- RN-032: El nombre debe seguir siendo único dentro del grupo (el destino, si `grupo_id` cambia) al
  editarse, excluyendo la propia categoría de la comparación.
- RN-033: Mover una categoría a otro grupo (cambiar `grupo_id`) está permitido en cualquier
  momento; no afecta la clasificación de transacciones ya registradas con esa categoría —
  únicamente cambia su agrupación hacia adelante en listados y reportes.
- Ver RN-028, RN-029 (CU-008) para el comportamiento de `icono` y la ausencia de color.

**Casos de uso derivados identificados**

- Ninguno adicional a los ya identificados en CU-007/CU-008.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `nombre` | string | Opcional; si se envía, 2–30 caracteres, único dentro del grupo destino | A03 — Sanitizar entrada; A07 — Codificar en salida |
| `grupo_id` | ObjectId | Opcional; si se envía, debe existir, pertenecer al usuario, ser `tipo=grupo` y estar `status=active` | A01 — Control de acceso a nivel de objeto (IDOR) |
| `icono` | string | Opcional; debe pertenecer al enum cerrado del catálogo de íconos | A01 — Validar contra whitelist |
| `id` (path param) | ObjectId | Requerido, debe existir, ser `tipo=categoria`, y pertenecer al usuario autenticado | A01 — Control de acceso a nivel de objeto |

**Mensajes de error**

*Validación*
- `VALIDATION_001`, `VALIDATION_010`, `VALIDATION_011` *(reutilizados — ver CU-008)*

*Autenticación / autorización*
- `AUTH_001` *(reutilizado)*

*Lógica de negocio*
- `BIZ_005`: "El grupo seleccionado no existe, no te pertenece, o está oculto." *(reutilizado — CU-008)*
- `BIZ_007`: "La categoría solicitada no existe."

*Sistema*
- `SYS_001` *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| PATCH | `/api/v1/categories/{id}` | Bearer JWT |

*Request*
```json
{
  "nombre": "string (opcional)",
  "grupo_id": "ObjectId (opcional)",
  "icono": "string (opcional)"
}
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "nombre": "string",
    "grupo_id": "ObjectId",
    "icono": "string",
    "updated_at": "ISODate"
  },
  "message": "Categoría actualizada exitosamente."
}
```

*Modelo de información*

Reutiliza la colección `categories`. Se actualizan `nombre`, `grupo_id`, `icono` y `updated_at`.

*Decisiones de modelado*

A diferencia de `accounts.tipo` (RN-002 de [[cuentas]], no editable), aquí `grupo_id` sí es mutable
por diseño — ver RN-033.

*Índices*

Reutiliza `{ user_id: 1, grupo_id: 1, nombre: 1 }` para la validación de unicidad (con el `grupo_id`
destino) y `{ user_id: 1, grupo_id: 1, status: 1 }` para reflejar el cambio en los listados por
grupo.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Editar nombre de una categoría | Datos válidos | Categoría actualizada | 200 |
| 2 | Flujo exitoso | Editar ícono | `icono` válido | Ícono actualizado | 200 |
| 3 | Flujo exitoso | Mover categoría a otro grupo válido | `grupo_id` de otro grupo propio y activo | Categoría aparece bajo el nuevo grupo | 200 |
| 4 | Validación de entrada | Nombre duplicado en el grupo destino | `nombre` ya existente en ese grupo | `VALIDATION_010` | 409 |
| 5 | Validación de entrada | Ícono inválido | `icono="no-existe"` | `VALIDATION_011` | 400 |
| 6 | Lógica de negocio | Grupo destino inexistente, ajeno u oculto | `grupo_id` inválido | `BIZ_005` | 404 |
| 7 | Recurso no encontrado | Categoría inexistente o ajena | `id` inválido o de otro usuario | `BIZ_007` | 404 |
| 8 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 9 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-categorias-alta]] (formulario compartido con alta)

---

### CU-012 — Ocultar (archivar) grupo o categoría

**Actor:** Usuario autenticado (dueño del grupo o de la categoría)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario ocultar un grupo o una categoría individual, sin eliminar
su historial. Ocultar equivale a archivar: el `status` cambia a `archived`, dejando de estar
disponible como opción al registrar transacciones y excluyéndose de reportes, mientras las
transacciones históricas que lo usaron lo conservan sin cambios. Ocultar un grupo oculta en cascada
todas las categorías activas que contiene; reactivar un grupo, en cambio, **no** reactiva
automáticamente sus categorías — deben reactivarse de forma individual, para no hacer reaparecer
categorías que el usuario había ocultado deliberadamente antes de ocultar el grupo completo.

**Flujo principal**

1. El usuario accede al grupo o categoría desde el listado y selecciona "Ocultar".
2. El sistema muestra un mensaje de confirmación. Si es un grupo con categorías activas dentro, el
   mensaje advierte que esas categorías también se ocultarán.
3. El usuario confirma la acción.
4. El sistema actualiza el `status` a `archived` del elemento seleccionado y, si es un grupo, de
   todas sus categorías activas.
5. El sistema retira el/los elemento(s) del listado activo y de los selectores al registrar
   transacciones.

**Flujos alternativos / casos borde**

- Si el elemento ya está oculto, el sistema rechaza la operación e informa que ya está oculto.
- El usuario puede reactivar un grupo o categoría oculta desde el listado (cambiando `status` de
  vuelta a `active`); este flujo de reactivación se resuelve con el mismo endpoint, no se documenta
  como CU independiente por ser simétrico y de bajo volumen — igual que en [[cuentas]] (CU-005).
- Al reactivar un grupo, las categorías que ya estaban ocultas antes de ocultar el grupo permanecen
  ocultas; solo se reactivan explícitamente de forma individual (RN-035).

**Precondiciones**

- El usuario debe estar autenticado.
- El elemento debe existir, pertenecer al usuario, y encontrarse en `status = active` (para
  ocultar) o `status = archived` (para reactivar).

**Postcondiciones**

- El `status` del elemento cambia a `archived` (o a `active`, si se reactiva).
- Si es un grupo, se archivan además todas sus categorías que se encontraban en `status = active`
  en el momento de la operación (cascada); las que ya estaban archivadas no se modifican.
- Se actualiza `updated_at` del elemento (y de las categorías afectadas por la cascada, si aplica).

**Definición detallada de campos**

No aplica — este CU no captura datos nuevos, solo modifica el campo `status` de uno o varios
registros existentes.

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| `status` | N/A (acción del sistema) | N/A | N/A | Enum: `active` ↔ `archived` | Elemento debe estar en el status opuesto al destino | — | RN-034, RN-035, RN-036 |

**Reglas de negocio**

- RN-034: Al ocultar (archivar) un grupo, todas sus categorías en `status = active` se archivan
  automáticamente en cascada.
- RN-035: Al reactivar un grupo, sus categorías **no** se reactivan automáticamente; cada una debe
  reactivarse de forma individual.
- RN-036: No se puede ocultar un grupo o categoría que ya se encuentra en `status = archived`
  (símil RN-009 de [[cuentas]]).
- RN-037: Un grupo o categoría oculto deja de estar disponible como opción al registrar
  transacciones y se excluye de reportes; las transacciones históricas que lo usaron permanecen
  consultables sin cambios (símil RN-007/RN-018 de [[cuentas]]).

**Casos de uso derivados identificados**

- Reactivación de grupo/categoría oculta: se resuelve con el mismo endpoint (cambio inverso de
  `status`), no requiere un CU independiente — mismo patrón que CU-005 de [[cuentas]].

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `id` (path param) | ObjectId | Requerido, debe existir, pertenecer al usuario, y estar en el `status` opuesto al destino de la operación | A01 — Control de acceso a nivel de objeto |

**Mensajes de error**

*Autenticación / autorización*
- `AUTH_001` *(reutilizado)*

*Lógica de negocio*
- `BIZ_006`: "El grupo solicitado no existe." *(reutilizado — CU-010)*
- `BIZ_007`: "La categoría solicitada no existe." *(reutilizado — CU-011)*
- `BIZ_008`: "Este elemento ya está oculto."

*Sistema*
- `SYS_001` *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| PATCH | `/api/v1/category-groups/{id}/archive` | Bearer JWT |
| PATCH | `/api/v1/categories/{id}/archive` | Bearer JWT |

*Request*
```
(sin body)
```

*Response (éxito — grupo)*
```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "status": "archived",
    "categorias_afectadas": "number (categorías ocultadas en cascada)",
    "updated_at": "ISODate"
  },
  "message": "Grupo ocultado exitosamente."
}
```

*Response (éxito — categoría)*
```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "status": "archived",
    "updated_at": "ISODate"
  },
  "message": "Categoría ocultada exitosamente."
}
```

*Modelo de información*

Reutiliza la colección `categories`. Actualiza `status` y `updated_at` del elemento y, en cascada,
de sus categorías hijas si el elemento es un grupo.

> Nota técnica: la actualización del grupo y la cascada a sus categorías deben ejecutarse de forma
> atómica (transacción de base de datos), igual que en la nota técnica de CU-006 de [[cuentas]].

*Decisiones de modelado*

Sin cambios respecto a CU-007/CU-008.

*Índices*

Reutiliza `{ user_id: 1, grupo_id: 1, status: 1 }` (CU-008) — es precisamente el índice que
optimiza la cascada (buscar categorías activas de un grupo) y el listado por status (CU-009).

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Ocultar categoría individual | `id` de categoría, `status=active` | `status` cambia a `archived` | 200 |
| 2 | Flujo exitoso | Ocultar grupo sin categorías activas dentro | Grupo vacío o con todas sus categorías ya ocultas | `status` del grupo cambia, `categorias_afectadas=0` | 200 |
| 3 | Flujo exitoso | Ocultar grupo con 3 categorías activas | Grupo con 3 categorías activas | Grupo y las 3 categorías pasan a `archived`, `categorias_afectadas=3` | 200 |
| 4 | Flujo exitoso | Reactivar grupo previamente oculto | `id` de grupo, `status=archived` | `status` del grupo vuelve a `active`; sus categorías archivadas permanecen archivadas | 200 |
| 5 | Lógica de negocio | Ocultar elemento ya oculto | `id` con `status=archived` (al intentar ocultar de nuevo) | `BIZ_008` | 409 |
| 6 | Recurso no encontrado | Grupo inexistente o ajeno | `id` inválido o de otro usuario | `BIZ_006` | 404 |
| 7 | Recurso no encontrado | Categoría inexistente o ajena | `id` inválido o de otro usuario | `BIZ_007` | 404 |
| 8 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 9 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-categorias-listado]] (acción "Ocultar" con modal de confirmación,
  con advertencia de cascada para grupos)

---

## Historial de cambios

| Fecha | Cambio | CU afectado | Impacto en otros documentos |
|---|---|---|---|
| 2026-07-26 | Se crea el módulo Categorías: estructura de dos niveles (Grupo con color, Categoría con ícono, campo `tipo` explícito); se agregan CU-007 a CU-012 (crear grupo, crear categoría, listar jerárquico, editar grupo, editar categoría con posibilidad de mover de grupo, ocultar en cascada) | CU-007 a CU-012 | Pendiente: actualizar [[data-model-registry]] con la colección `categories`, sus índices y el índice de numeración, al cerrar el módulo |
| 2026-07-30 | Cambio cruzado desde [[transacciones]]: se agrega "Ingresos" al catálogo de grupos predefinidos (RN-025), para categorizar movimientos de tipo `ingreso` de forma simétrica a los de gasto. No se agregan CU ni RN nuevos en este documento — solo se amplía el enum de grupos semilla ya existente | CU-007 | Se actualiza [[data-model-registry]] (sin cambio de esquema, solo nota de contexto) |
| 2026-08-07 | Se construye el módulo Categorías completo (CU-007 a CU-012) sobre Postgres/Supabase: tabla `categories`, RPC `archive_category_group` para el archivado en cascada de CU-012, y la siembra real de grupos/categorías predefinidos (antes un placeholder desde el módulo Auth). Sincronización de idioma con la UI (100% inglés): el grupo semilla "Ingresos" se sembró como "Income", y los ejemplos de categoría citados en este documento ("Renta", "Suscripciones") se tradujeron a "Rent"/"Subscriptions" para reflejar los nombres reales que ve el usuario — sin cambio de CU, RN ni de las reglas de negocio en sí | CU-007 a CU-012 | Se actualiza [[data-model-registry]] con el esquema Postgres real de `categories`, sus índices y relaciones marcados "Real" |
| 2026-08-11 | Se agregan dos columnas estructurales exclusivas de grupo, ambas nuevas en `categories` (`supabase/migrations/20260811110000_add_category_group_flow_and_order.sql`): **RN-118** (`flujo`: Inflow/Outflow, obligatorio al crear, editable en CU-010) y **RN-119** (`orden`: posición manual, asignada automáticamente al crear, reordenable con controles ↑/↓ agregados a CU-009). Reemplazan la identificación de grupos por nombre (`"Income"`, `"Bills"`/`"Needs"`/`"Wants"`/`"Investment"`) que usaban [[presupuesto]] (tablas Inflow/Outflow) y [[transacciones]] (RN-039, `create_transaction`/`update_transaction`) — un grupo renombrado dejaba de reconocerse, que fue el bug reportado que motivó este cambio. Se actualiza CU-007 (campo `flujo` obligatorio y `orden` automático), CU-009 (orden por `orden` en vez de alfabético, controles de reordenar) y CU-010 (campo `flujo` editable). Backfill de datos reales: los grupos existentes conservan su flujo/orden actuales (Income → Inflow, el resto → Outflow; orden visual sin cambio). | CU-007, CU-009, CU-010 | Se actualiza [[data-model-registry]]: esquema de `categories` (enum `category_flow`, columnas `flujo`/`orden`), índice de numeración hasta `RN-119`; cambio cruzado en [[presupuesto]] (RN-075, RN-114, RN-117, referencia de diseño) y [[transacciones]] (RN-039) |
| 2026-08-28 | Al alinear la pestaña Analytics de [[dashboard]], se agrega **`investment`** como tercer valor de `categories.flujo` (RN-118 revisada), reemplazando la distinción por nombre exacto ("Investment") que hasta ahora usaban el chip del formulario de alta de transacciones y el viejo cálculo de ingresos vs. gastos de [[reportes]] (RN-094, retirado) — ambos casos ya documentados como frágiles ante un renombrado. Backfill: el grupo semilla "Investment" de cuentas existentes pasa de `outflow` a `investment`; `seed_default_categories_for_user` siembra el grupo nuevo directamente como `investment`. No se agregan CU nuevos — es una extensión de un enum ya existente, sin cambio de comportamiento salvo la reclasificación del grupo Investment. `supabase/migrations/20260828100000_add_category_flow_investment.sql` (solo agrega el valor al enum — Postgres exige que se confirme antes de usarlo) + `supabase/migrations/20260828100001_backfill_category_flow_investment.sql` (backfill, siembra, RPCs). | CU-007, CU-010 | Se actualiza [[data-model-registry]] (enum `category_flow` en el esquema de `categories`, sin cambio de numeración); cambio cruzado en [[presupuesto]] (RN-075, tabla "Investment" nueva) y [[transacciones]] (RN-039, ya no hay excepción por nombre) |

## Referencias

- [[estrategia]]
- [[brief-ux]]
- [[data-model-registry]]
- [[cuentas]]
- [[backlog]]
