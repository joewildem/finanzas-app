---
modulo: "Autenticación"
status: borrador
---

# Requerimientos — Autenticación

## Resumen del módulo

Este módulo cubre el ingreso al sistema para el grupo cerrado de usuarios de Finanzas App, mediante
autenticación con Google (sin contraseña propia ni flujo de registro público). Formaliza además la
colección `users`, referenciada desde el primer módulo (`user_id` en `accounts`, `categories`,
`transactions` y `budgets`) pero nunca antes documentada, y el mecanismo real detrás de `AUTH_001`
("Your session has expired"), que el resto de los módulos ya asume que existe. El alta de usuarios es
un proceso administrativo manual — no hay panel de administración ni autoregistro dentro de la
aplicación.

> **Nota de arquitectura:** a partir de este módulo, el backend completo se implementa sobre
> Supabase (Postgres + Supabase Auth), en lugar de MongoDB. Los cinco documentos ya cerrados
> ([[cuentas]], [[categorias]], [[transacciones]], [[presupuesto]], [[reportes]]) mantienen sus
> casos de uso, reglas de negocio, validaciones y mensajes de error sin cambio — únicamente sus
> secciones técnicas (*Modelo de información*, *Índices*) quedan pendientes de traducir de sintaxis
> Mongo (`ObjectId`, colecciones) a Postgres (`uuid`, tablas, foreign keys, políticas RLS). Se deja
> registrado como pendiente en [[data-model-registry]] al cierre de este documento, a resolver como
> tarea aparte antes de iniciar desarrollo (semana 7, "Backlog y setup técnico" en [[roadmap]]).

## Casos de uso

### CU-032 — Iniciar sesión con Google

**Actor:** Usuario no autenticado (intenta ingresar)

**Descripción del caso de uso**

Esta funcionalidad permitirá a un usuario del grupo cerrado ingresar a la aplicación utilizando su
cuenta de Google, sin necesidad de crear ni recordar una contraseña propia. Para ello el sistema
delegará la verificación de identidad a Google mediante el flujo estándar de OAuth 2.0, y
adicionalmente verificará que el correo autenticado corresponda a un usuario pre-registrado y
activo en la tabla `users` — la autenticación exitosa con Google es condición necesaria pero no
suficiente para obtener acceso. Si es el primer ingreso exitoso del usuario, el sistema
aprovechará el momento para completar la vinculación de su identidad y sembrar sus categorías
predefinidas.

**Flujo principal**

1. El usuario, desde la pantalla de acceso, selecciona "Continuar con Google" (única opción de
   ingreso disponible; no existe alternativa de correo/contraseña).
2. El sistema redirige al flujo estándar de consentimiento OAuth 2.0 de Google.
3. Google autentica al usuario y devuelve el control a la aplicación con una identidad verificada
   (correo confirmado por Google).
4. Antes de emitir el token de sesión, el sistema verifica que el correo exista en la tabla `users`
   con `status = active`.
5. Si la verificación es exitosa y es el primer ingreso del usuario (`primer_login_completado =
   false`), el sistema vincula el identificador de la sesión de Google a su registro en `users`,
   marca `primer_login_completado = true`, y dispara la siembra de sus categorías predefinidas
   (grupos semilla definidos en [[categorias]] — cumple el disparador señalado en RN-030).
6. El sistema emite la sesión (access token + refresh token) y redirige al usuario al Dashboard.
7. El sistema actualiza `ultimo_acceso` en el registro del usuario.

**Flujos alternativos / casos borde**

- Si el correo autenticado por Google no existe en `users`, o existe con `status = inactive`, el
  sistema rechaza el acceso con `AUTH_002` y no emite sesión — independientemente de que la
  autenticación con Google haya sido exitosa.
- Si el usuario cancela el consentimiento en la pantalla de Google, o la comunicación con Google
  falla, el sistema regresa a la pantalla de acceso con `AUTH_003`.
- Si el usuario ya cuenta con una sesión activa y repite el flujo de login, el sistema lo redirige
  directamente al Dashboard sin volver a sembrar categorías ni duplicar el vínculo de identidad.

**Precondiciones**

- El correo del usuario debe existir previamente en la tabla `users`, insertado de forma manual por
  el administrador del proyecto directamente en la tabla de Supabase — no existe flujo de
  autoregistro ni panel de administración dentro de la aplicación.
- El usuario debe contar con una cuenta de Google válida.

**Postcondiciones**

- Se crea una sesión activa (access token + refresh token).
- Si era el primer ingreso, se marca `primer_login_completado = true`, se vincula el identificador
  de proveedor, y se siembran las categorías predefinidas del usuario.
- Se actualiza `ultimo_acceso`.

**Definición detallada de campos**

Este CU no captura datos de negocio propios — la identidad (correo verificado) proviene del token
emitido por Google, no de un formulario propio de la aplicación.

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — |

**Reglas de negocio**

- RN-098: El acceso a la aplicación se determina exclusivamente por la preexistencia del correo en
  la tabla `users` con `status = active` — la autenticación exitosa con Google es condición
  necesaria pero no suficiente.
- RN-099: El alta de usuarios es un proceso administrativo manual, realizado directamente en la
  tabla `users` de Supabase — no existe flujo de autoregistro ni panel de administración dentro de
  la aplicación.
- RN-100: En el primer ingreso exitoso de un usuario, el sistema siembra automáticamente sus
  categorías predefinidas (grupos semilla: Bills, Needs, Wants, Investment, Ingresos), cumpliendo
  el disparador señalado en RN-030 de [[categorias]].
- RN-101: El identificador de proveedor (Google) se vincula al registro de `users` en el primer
  ingreso exitoso y no se modifica después.
- RN-102: La verificación del correo contra la tabla `users` ocurre en **cada** emisión de token,
  no solo en el primer ingreso — si un usuario es desactivado (`status = inactive`) después de
  haber tenido acceso, pierde el acceso en su siguiente intento de login, no solo en el primero.

**Casos de uso derivados identificados**

- Ninguno — el alta de usuarios es un proceso externo a la aplicación (tabla de Supabase),
  intencionalmente sin CRUD ni pantalla propia, dado el tamaño del grupo cerrado.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| Token de identidad de Google | JWT firmado | Debe validarse firma, emisor (`iss`), audiencia (`aud`) y vigencia (`exp`); el claim `email_verified` debe ser `true` | A02 — Verificación criptográfica de token; A07 — Nunca confiar en el correo sin verificar la firma |
| Correo (derivado del token) | string | Debe existir en `users` con `status = active` | A01 — Control de acceso; lista blanca explícita, no lista negra |

**Mensajes de error**

*Autenticación / autorización*
- `AUTH_002`: "Your account doesn't have access to this app. Contact your administrator."
- `AUTH_003`: "We couldn't complete sign-in with Google. Please try again."

*Sistema*
- `SYS_001`: "Something went wrong. Please try again later." *(reutilizado)*

> Nota de idioma (2026-08-06): el texto mostrado al usuario final es el copy en inglés de arriba
> — la app adoptó inglés como único idioma de interfaz. El resto de este documento (nombres de
> campo, prosa, comentarios) permanece en español, como el resto de `docs/pdr/`; solo el texto
> literal que el usuario ve en pantalla se tradujo. Ver historial de cambios.

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| — | `signInWithOAuth({ provider: 'google' })` vía Supabase Auth Client SDK (frontend) | Pública (no requiere sesión previa) |

> Este CU no se implementa como un endpoint REST propio — Supabase Auth maneja el flujo de OAuth
> de extremo a extremo (redirección, intercambio de código, emisión de sesión). El control de
> acceso descrito en RN-098/RN-102 se implementa mediante un **Custom Access Token Hook** de
> Supabase: una función de Postgres que se ejecuta en cada emisión/renovación de token, consulta
> la tabla `users` por el correo del token, y aborta la emisión (forzando `AUTH_002`) si no
> encuentra una fila con `status = active`. La siembra de categorías predefinidas (RN-100) se
> dispara desde la misma función, condicionada a `primer_login_completado = false`.

*Request*
```
(sin body propio — gestionado por el SDK de Supabase Auth)
```

*Response (éxito)*
```json
{
  "success": true,
  "data": {
    "session": {
      "access_token": "string (JWT)",
      "refresh_token": "string",
      "expires_in": "number (segundos)"
    },
    "primer_login": "boolean"
  }
}
```

*Modelo de información*
```json
// Tabla: users (Postgres / Supabase — reemplaza la colección Mongo asumida en módulos previos)
{
  "id": "uuid (nullable hasta el primer login; igual a auth.users.id de Supabase una vez vinculado)",
  "correo": "text (único, requerido — pre-registrado manualmente)",
  "nombre_para_mostrar": "text (nullable; se autocompleta con el perfil de Google en el primer login si no se definió antes)",
  "status": "enum ('active', 'inactive') (default 'active')",
  "primer_login_completado": "boolean (default false)",
  "ultimo_acceso": "timestamptz (nullable)",
  "created_at": "timestamptz (default now())",
  "updated_at": "timestamptz (default now())"
}
```
> Registrar en [[data-model-registry]] al cerrar el módulo. `accounts.user_id`,
> `categories.user_id` y `transactions.user_id` (referenciados desde CU-001 en adelante como
> pendientes) quedan formalmente resueltos como foreign key a `users.id`.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| `users.id` ↔ `auth.users.id` (interno de Supabase) | Igualdad de identificador, no tabla separada de mapeo | Permite que las políticas RLS de `accounts`, `categories`, `transactions` y `budgets` usen `auth.uid() = user_id` directamente, sin joins ni claims personalizados |
| Pre-registro con `id` nulo | Fila "reservada" antes del primer login | Sostiene la lista blanca (RN-098) sin depender de que Supabase Auth haya creado la identidad todavía |

*Índices*

| Tabla | Campos | Tipo | Propósito |
|---|---|---|---|
| `users` | `correo` | Único | Localizar la fila pre-registrada por correo en cada verificación de acceso (RN-098, RN-102) |
| `users` | `id` | Único (primary key) | Join directo con `auth.uid()` en políticas RLS de las demás tablas |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Primer login de usuario pre-registrado | Correo activo en `users`, `primer_login_completado=false` | Sesión creada, vínculo de identidad guardado, categorías predefinidas sembradas | 200 |
| 2 | Flujo exitoso | Login subsecuente de usuario ya vinculado | Correo activo, `primer_login_completado=true` | Sesión creada, sin re-siembra de categorías | 200 |
| 3 | Autenticación / autorización | Correo no pre-registrado | Correo válido de Google, ausente en `users` | `AUTH_002`, sin sesión emitida | 401 |
| 4 | Autenticación / autorización | Usuario desactivado | Correo presente en `users`, `status=inactive` | `AUTH_002`, sin sesión emitida | 401 |
| 5 | Autenticación / autorización | Usuario cancela consentimiento de Google | Flujo OAuth abandonado | `AUTH_003`, regreso a pantalla de login | 400 |
| 6 | Error del sistema | Falla de comunicación con Google o de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-login]] (único botón "Continuar con Google", sin campos de
  correo/contraseña)

---

### CU-033 — Cerrar sesión

**Actor:** Usuario autenticado

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario cerrar su sesión de forma explícita. Para ello el sistema
invalidará su sesión del lado del servidor, no solo eliminará el token del lado del cliente,
evitando que una sesión robada o filtrada siga siendo válida después de un cierre de sesión
intencional.

**Flujo principal**

1. El usuario selecciona "Cerrar sesión" desde el menú de configuración/perfil.
2. El sistema revoca el refresh token asociado a la sesión actual del lado del servidor (Supabase
   Auth).
3. El sistema elimina el access token y el refresh token del almacenamiento local del cliente.
4. El sistema redirige al usuario a la pantalla de login.

**Flujos alternativos / casos borde**

- Si el usuario ya no tiene una sesión activa (token ya expirado) e intenta cerrar sesión, el
  sistema simplemente limpia el estado local y redirige a login, sin error visible.

**Precondiciones**

- El usuario debe tener una sesión activa.

**Postcondiciones**

- La sesión queda revocada del lado del servidor; el token ya no es válido para ninguna solicitud
  futura, aunque no haya expirado por tiempo.

**Definición detallada de campos**

Este CU no captura datos de negocio; es una acción sin parámetros.

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — |

**Reglas de negocio**

- RN-103: Cerrar sesión invalida el refresh token del lado del servidor (revocación real), no
  únicamente un borrado local del token — un token robado antes del logout deja de ser utilizable
  después de él.

**Casos de uso derivados identificados**

- Ninguno.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| — | — | — | — |

**Mensajes de error**

*Sistema*
- `SYS_001`: "Something went wrong. Please try again later." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| — | `signOut()` vía Supabase Auth Client SDK | Bearer JWT (sesión activa) |

*Request*
```
(sin body propio — gestionado por el SDK de Supabase Auth)
```

*Response (éxito)*
```json
{
  "success": true,
  "message": "Sesión cerrada exitosamente."
}
```

*Modelo de información*

No modifica la tabla `users`; la revocación ocurre en el esquema interno de sesiones de Supabase
Auth (`auth.sessions` / `auth.refresh_tokens`), fuera del alcance de este registro de modelo de
datos de aplicación.

*Decisiones de modelado*

Sin cambios respecto a CU-032.

*Índices*

Sin cambios.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Cerrar sesión activa | Sesión válida | Refresh token revocado; redirección a login | 200 |
| 2 | Flujo exitoso | Cerrar sesión ya expirada | Token vencido | Limpieza local silenciosa; redirección a login | 200 |
| 3 | Error del sistema | Falla al comunicar la revocación | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-configuracion-perfil]] (opción "Cerrar sesión")

---

### CU-034 — Validar y renovar sesión activa

**Actor:** Sistema (mecanismo transversal, sin interacción directa del usuario)

**Descripción del caso de uso**

Este caso de uso no representa una acción visible para el usuario, sino el mecanismo real detrás
de `AUTH_001` ("Your session has expired"), que el resto de los módulos ya documentados (Cuentas,
Categorías, Transacciones, Presupuesto, Reportes) asumen que existe. En cada solicitud autenticada,
el sistema valida el access token; mientras exista actividad dentro de una ventana de 15 días, la
sesión se renueva de forma transparente sin pedir al usuario que vuelva a iniciar sesión. Solo
cuando transcurren 15 días completos sin ninguna actividad, la sesión se invalida y la siguiente
solicitud recibe `AUTH_001`.

**Flujo principal**

1. El cliente envía una solicitud con el access token vigente en el encabezado `Authorization`.
2. El sistema valida la firma y vigencia del access token (vida corta, ej. 1 hora).
3. Si el access token expiró pero el refresh token sigue vigente (dentro de la ventana de 15 días
   desde la última actividad), el sistema emite un nuevo access token de forma transparente y
   reinicia la ventana de 15 días.
4. La solicitud original continúa con normalidad.

**Flujos alternativos / casos borde**

- Si han transcurrido 15 días sin actividad (el refresh token también expiró), el sistema rechaza
  la solicitud con `AUTH_001` y el cliente redirige al usuario a la pantalla de login.
- Si el usuario cerró sesión explícitamente (CU-033), cualquier intento de renovación con ese
  refresh token falla, aunque no hayan pasado los 15 días — la revocación explícita tiene prioridad
  sobre la ventana de inactividad.

**Precondiciones**

- Debe existir una sesión previamente emitida (CU-032).

**Postcondiciones**

- La ventana de inactividad de 15 días se reinicia con cada solicitud autenticada exitosa.

**Definición detallada de campos**

Este CU no captura datos de negocio; opera sobre el token recibido en cada solicitud.

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — |

**Reglas de negocio**

- RN-104: El access token tiene vida corta (ej. 1 hora); el refresh token tiene vida deslizante de
  15 días, renovándose automáticamente con cada solicitud autenticada dentro de esa ventana.
- RN-105: Si transcurren 15 días sin actividad (sin renovación del refresh token), el sistema
  invalida la sesión; cualquier solicitud subsecuente recibe `AUTH_001`, mensaje reutilizado en
  todos los módulos ya documentados.
- RN-106: La renovación de sesión es transparente para el usuario mientras exista actividad dentro
  de la ventana de 15 días — no requiere reautenticación manual ni interrumpe el uso de la
  aplicación.

**Casos de uso derivados identificados**

- Ninguno.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| Access token | JWT | Firma, emisor, audiencia y vigencia válidos | A02 — Verificación criptográfica en cada solicitud |
| Refresh token | Token opaco | Debe existir, no estar revocado, y estar dentro de la ventana de 15 días desde la última actividad | A01/A07 — Revocación efectiva y ventana deslizante aplicada del lado del servidor, no del cliente |

**Mensajes de error**

*Autenticación / autorización*
- `AUTH_001`: "Your session has expired. Please sign in again." *(reutilizado — formalizado aquí)*

*Sistema*
- `SYS_001`: "Something went wrong. Please try again later." *(reutilizado)*

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| — | Middleware transversal aplicado a todos los endpoints `Bearer JWT` de la aplicación | Bearer JWT |

> Gestionado nativamente por Supabase Auth: access token corto + refresh token con ventana
> deslizante configurada a 15 días de inactividad. No se implementa como endpoint propio, sino
> como configuración del proyecto de Supabase y verificación de middleware en cada solicitud.

*Request*
```
Header: Authorization: Bearer {access_token}
```

*Response (error)*
```json
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "Your session has expired. Please sign in again."
  }
}
```

*Modelo de información*

No introduce tablas nuevas — opera sobre el esquema interno de sesiones de Supabase Auth.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Ventana deslizante de 15 días | Configuración de proyecto (Supabase Auth settings), no lógica de aplicación | Evita reimplementar manejo de tokens; delega a un mecanismo probado del proveedor |

*Índices*

Sin cambios — no aplica (esquema interno de Supabase Auth).

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Solicitud con access token vigente | Token válido, dentro de la hora | Solicitud procesada con normalidad | 200 |
| 2 | Flujo exitoso | Access token expirado, refresh token vigente | Actividad dentro de los 15 días | Renovación transparente; solicitud procesada | 200 |
| 3 | Autenticación / autorización | Sin actividad por 15 días completos | Refresh token también expirado | `AUTH_001` | 401 |
| 4 | Autenticación / autorización | Sesión cerrada explícitamente (CU-033) | Refresh token revocado | `AUTH_001` | 401 |
| 5 | Error del sistema | Falla de Supabase Auth al validar/renovar | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- No aplica — mecanismo transversal sin pantalla propia.

---

## Historial de cambios

| Fecha | Cambio | CU afectado | Impacto en otros documentos |
|---|---|---|---|
| 2026-07-31 | Se documenta el módulo Autenticación: login exclusivo con Google OAuth (sin contraseña ni registro público), lista blanca de acceso vía tabla `users` pre-registrada manualmente en Supabase, sesión con expiración deslizante por inactividad de 15 días, y formalización del mecanismo detrás de `AUTH_001`. Se agregan CU-032 a CU-034. **Decisión de arquitectura:** el backend completo se implementa sobre Supabase (Postgres + Supabase Auth) en lugar de MongoDB — dado que ningún módulo tiene código implementado aún, el costo de este cambio es exclusivamente documental. Se formaliza la tabla `users`, resolviendo la referencia pendiente de `user_id` en `accounts`, `categories` y `transactions` desde el primer módulo. Con este documento se completan los 6 documentos de `docs/prd/`, cerrando la fase de Casos de uso y Requerimientos. | CU-032, CU-033, CU-034 | **Pendiente 1:** actualizar [[data-model-registry]] con la tabla `users`, sus índices, y el índice de numeración hasta CU-034 / RN-106 / VALIDATION_022 (sin cambio) / AUTH_003 / BIZ_021 (sin cambio) / SYS_001 (sin cambio). **Pendiente 2 (tarea aparte, antes de desarrollo):** traducir las secciones *Modelo de información* e *Índices* de [[cuentas]], [[categorias]], [[transacciones]], [[presupuesto]] y [[reportes]] de sintaxis Mongo (`ObjectId`, colecciones) a Postgres/Supabase (`uuid`, tablas, foreign keys, políticas RLS) — sus casos de uso, reglas de negocio, validaciones y mensajes de error no requieren cambio alguno. |
| 2026-08-06 | **Decisión de producto:** la app adopta inglés como único idioma de interfaz (decidido durante la construcción del módulo Autenticación + Dashboard). Se traduce al inglés el texto literal de los 4 mensajes de error de este documento (`AUTH_001`, `AUTH_002`, `AUTH_003`, `SYS_001` en CU-032 a CU-034) para que coincida con el copy real que ve el usuario — los códigos, la prosa del documento y el resto de la terminología permanecen en español, sin cambio de alcance en los CU/RN. Convención establecida hacia adelante: cuando el copy de un módulo construido en código diverja del texto en español documentado aquí, se actualiza el `.md` correspondiente en vez de dejarlo desactualizado. | CU-032, CU-033, CU-034 | Ninguno — no cambian códigos, RN, ni el índice de numeración. |

## Referencias

- [[estrategia]]
- [[brief-ux]]
- [[data-model-registry]]
- [[cuentas]]
- [[categorias]]
- [[transacciones]]
- [[presupuesto]]
- [[reportes]]
- [[roadmap]]
