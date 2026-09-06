---
modulo: "Suscripciones"
status: cerrado
last-updated: 2026-09-05
---

# Requerimientos — Suscripciones

## Resumen del módulo

Un rastreador de las suscripciones recurrentes del usuario: qué se paga, cada cuánto, con qué tarjeta
y cuándo toca el siguiente cobro. Da de alta cada servicio una sola vez y deriva de ahí el calendario
completo de cargos, el gasto del mes y del año, y la evolución mes a mes.

Es un módulo **deliberadamente aislado**: no se relaciona con `transactions`, `budgets`, `accounts`
ni `categories`. Un cobro de suscripción no genera una transacción, no consume presupuesto y no
aparece en Analytics. Esa independencia está garantizada por el esquema —la tabla `subscriptions` no
tiene ninguna llave foránea fuera de `users`— y no por disciplina al escribir consultas.

La consecuencia de ese aislamiento es que el gasto de una suscripción puede aparecer **dos veces** en
la aplicación: aquí como cobro programado, y en [[transacciones]] si el usuario además registra el
cargo real de su tarjeta. No es un defecto: son dos preguntas distintas. Este módulo responde "¿qué
tengo contratado y cuándo me lo cobran?"; [[transacciones]] responde "¿qué salió de mis cuentas?".

> **Nota de procedencia (2026-09-05):** segundo módulo construido primero en código y documentado
> después, siguiendo el precedente de [[msi]]. Además, revierte una decisión previa: hasta el
> 2026-09-04 Suscripciones estaba explícitamente fuera del alcance del proyecto ("se resuelve con una
> app externa"). El usuario la reincorporó al constatar que la aplicación externa que usaba no
> cubría lo que necesitaba.

## Casos de uso

### CU-078 — Registrar una suscripción

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Permite dar de alta un servicio recurrente capturando su nombre, categoría, sitio web, monto, ciclo
de cobro y fecha de inicio. Opcionalmente admite una fecha de fin conocida de antemano, la marca de
prueba gratuita, el método de pago y una nota. De la fecha de inicio y el ciclo se deriva todo el
calendario de cobros; no se captura fecha de cobro alguna.

**Flujo principal**

1. El usuario abre "Add subscription" desde la pantalla del módulo.
2. Captura nombre, categoría, monto, ciclo y fecha de inicio; opcionalmente sitio web, fecha de fin,
   prueba gratuita, método de pago y nota.
3. El sistema valida los campos contra las mismas restricciones que la base de datos.
4. El sistema inserta la fila en `subscriptions` con `status = 'active'`.
5. La pantalla se actualiza: la suscripción aparece en el listado, en el calendario y en los totales
   del mes visible si le corresponde algún cobro ahí.

**Flujos alternativos / casos borde**

- Si ya existe una suscripción **activa** con el mismo nombre, la operación se rechaza
  (`VALIDATION_040`, RN-294). Una archivada no bloquea el nombre.
- Si la fecha de fin es anterior a la de inicio, se rechaza (`VALIDATION_041`, RN-298).
- Si no se captura sitio web, la card muestra la inicial del nombre sobre el color de la categoría
  en lugar de un logo (RN-299).
- Si el ciclo es `one_time`, la suscripción produce un único cobro y no aporta al promedio mensual
  normalizado (RN-296, RN-305).

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Existe una fila nueva en `subscriptions` con `status = 'active'` y `archivada_en = null`.
- Ninguna otra tabla cambia. En particular, no se genera transacción ni renglón de presupuesto.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| Name | Input texto | Sí | 2-50 | Único entre activas | — | Vacío | RN-294 |
| Website | Input texto | No | ≤253 | Dominio o URL; se normaliza a dominio | — | Vacío | RN-299 |
| Category | Select | Sí | — | Catálogo cerrado de 14 valores | — | `other` | RN-295 |
| Amount | Input moneda | Sí | — | Mayor que cero | — | Vacío | RN-297 |
| Billing cycle | Select | Sí | — | 7 valores | — | `monthly` | RN-296 |
| Start date | Selector de fecha | Sí | — | Cualquier fecha | — | Hoy | RN-303 |
| Has an end date | Switch | No | — | Al activarse habilita End date | — | Apagado | RN-298 |
| End date | Selector de fecha | No | — | Igual o posterior a Start date | Has an end date | Vacío | RN-298 |
| Free trial | Switch | No | — | — | — | Apagado | RN-301 |
| Paid with | Select | No | ≤50 | Nombre de una cuenta activa, guardado como texto | — | Vacío | RN-300 |
| Note | Textarea | No | ≤500 | Texto libre | — | Vacío | — |

**Reglas de negocio**

- RN-294: el nombre es único entre las suscripciones **activas** del usuario. Una archivada libera su
  nombre — mismo criterio que [[ahorros-y-metas]] y [[creditos-deudas]].
- RN-295: la categoría proviene de un catálogo cerrado de catorce valores (`ai`, `education`,
  `entertainment`, `finance`, `fitness`, `gaming`, `music`, `news`, `other`, `productivity`,
  `shopping`, `streaming`, `travel`, `utilities`), definido en la aplicación y **sin relación con la
  tabla `categories`** de [[categorias]]. Reutilizar aquella habría acoplado los dos módulos y
  llevado el gasto de suscripciones a los reportes de gasto corriente, que es justo lo que este
  módulo no debe hacer (RN-311). Cada categoría tiene además un color fijo, no asignado por posición,
  para que conserve su identidad visual aunque cambie qué categorías tienen gasto en el mes visible.
- RN-296: los ciclos admitidos son `daily`, `weekly`, `monthly`, `quarterly` (cada 3 meses),
  `semiannual` (cada 6 meses), `annual` y `one_time`. Se descartaron dos que el usuario había
  propuesto: *seasonal*, por ambiguo —no queda claro si son tres meses o una temporada del año—, y
  *fortnightly*, por no tener uso. `one_time` no es una suscripción recurrente, pero cubre el pago
  único que uno quiere seguir junto a las demás (una licencia perpetua, un dominio).
- RN-297: el monto debe ser mayor que cero.
- RN-298: la fecha de fin es opcional y, si se captura, debe ser igual o posterior a la de inicio. El
  switch "Has an end date" y la fecha son un solo estado: apagarlo limpia la fecha, de modo que "sin
  fecha de fin" no pueda representarse de dos maneras contradictorias.
- RN-299: el sitio web es opcional y su única función es derivar el logo. No se almacena imagen
  alguna: la aplicación construye la URL del logo a partir del dominio y la enlaza directamente, en
  una cadena de respaldo de tres pasos (RN-316).
- RN-300: el método de pago guarda el **nombre** de la cuenta como texto, no una referencia a
  `accounts`. El formulario ofrece los nombres de las cuentas activas para no teclearlos, pero la
  suscripción no queda atada a la cuenta: renombrar una cuenta después no actualiza las
  suscripciones. Es el precio explícito de la independencia entre módulos (RN-311).
- RN-301: la marca de prueba gratuita no altera ningún cálculo. Solo destaca la suscripción en la
  card y en la lista de próximos cobros, porque no ver a tiempo el fin de una prueba es el caso donde
  no mirar cuesta dinero.

**Casos de uso derivados identificados**

- Consulta y seguimiento → CU-079 y CU-082.
- Corrección y baja → CU-080 y CU-081.
- *Patrón Búsqueda y Filtrado:* descartado. El conjunto es de unas decenas de filas y cabe completo
  en pantalla; el listado ofrece ordenamiento por nombre o por costo anual, no búsqueda.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| `nombre` | text | 2-50 caracteres tras recortar; único entre activas | Inyección: parámetro tipado, sin concatenación |
| `categoria` | text | Uno de los 14 valores | Inyección: validado contra CHECK |
| `sitio_web` | text | ≤253 caracteres | XSS: se usa solo para construir una URL de imagen, nunca se inyecta como HTML |
| `monto` | numeric | Mayor que cero | — |
| `ciclo` | text | Uno de los 7 valores | Inyección: validado contra CHECK |
| `fecha_inicio` | date | Requerida | — |
| `fecha_fin` | date | Nula o ≥ `fecha_inicio` | — |
| `metodo_pago` | text | ≤50 caracteres | — |
| `nota` | text | ≤500 caracteres | — |
| `user_id` | uuid | Igual a `auth.uid()` | A01 — IDOR: forzado por RLS en insert y update |

**Mensajes de error**

*Validación*
- `VALIDATION_001`: "This field is required."
- `VALIDATION_012`: "The amount must be a number greater than zero."
- `VALIDATION_040`: "You already have a subscription with this name."
- `VALIDATION_041`: "The end date must be on or after the start date."

*Autenticación / autorización*
- `AUTH_001`: "Your session has expired. Please sign in again."

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde."

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| POST | `/api/v1/subscriptions` | Bearer JWT |

*Decisiones de modelado*

Este módulo **no define funciones RPC**, a diferencia de todos los anteriores. Crear o editar una
suscripción no mueve el saldo de ninguna cuenta ni tiene que coordinar dos escrituras, de modo que un
insert directo bajo RLS es suficiente y no hay lógica que centralizar en Postgres. Lo único que
podría considerarse "lógica de negocio" —qué días cae cada cobro— es derivado y vive en el cliente
(RN-302).

*Modelo de información*

Tabla `subscriptions`, detallada en [[data-model-registry]]. Sin llaves foráneas fuera de
`users(id)`.

*Índices*

- `subscriptions_user_nombre_active_key`: único parcial sobre `(user_id, nombre) where status = 'active'` (RN-294).
- `subscriptions_user_status_idx`: sobre `(user_id, status)`.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Alta mínima | Nombre, categoría, monto, ciclo, fecha de inicio | Suscripción creada, activa | 201 |
| 2 | Flujo exitoso | Alta completa | Todos los campos, con fecha de fin y prueba | Suscripción creada con ambos | 201 |
| 3 | Validación de entrada | Nombre duplicado entre activas | Nombre existente | `VALIDATION_040` | 409 |
| 4 | Flujo exitoso | Nombre de una archivada | Nombre liberado por archivado | Suscripción creada | 201 |
| 5 | Validación de entrada | Fecha de fin anterior al inicio | `fecha_fin < fecha_inicio` | `VALIDATION_041` | 400 |
| 6 | Validación de entrada | Monto cero o negativo | `monto = 0` | `VALIDATION_012` | 400 |
| 7 | Validación de entrada | Ciclo fuera del catálogo | `ciclo = 'seasonal'` | Rechazo por CHECK | 400 |
| 8 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |
| 9 | Error del sistema | Falla de base de datos | Simulado | `SYS_001` | 500 |

**Referencia de diseño**

- Pantalla / flujo: construido directamente en código, sin paso por Figma — mismo criterio que
  [[msi]], [[inversiones]] y [[creditos-deudas]].

---

### CU-079 — Consultar el panel de suscripciones

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Pantalla única del módulo. Muestra, para el mes visible: el gasto cobrado en el mes y en el año, el
número de suscripciones vigentes, los cobros de los próximos treinta días, el listado de
suscripciones, el desglose por categoría y la evolución mes a mes del año. El calendario de cobros
del mismo mes se documenta aparte en CU-082.

**Flujo principal**

1. El usuario accede a "Subscriptions".
2. El sistema recupera **todas** las suscripciones del usuario en una sola consulta, activas y
   archivadas.
3. Para el mes visible (por defecto el actual), el sistema deriva las fechas de cobro de cada
   suscripción y calcula los totales, el desglose por categoría y los doce puntos del año.
4. El usuario navega entre meses con un único control; todos los bloques se recalculan en el cliente,
   sin volver a consultar la base.

**Flujos alternativos / casos borde**

- Si el usuario no tiene suscripciones, el listado muestra un estado vacío y los totales quedan en
  $0.00.
- Si el mes visible no tiene ningún cobro, la gráfica por categoría muestra un estado vacío y la card
  del mes queda en $0.00. Ese es el resultado correcto y no un error: una anual cobrada en marzo no
  aporta nada a septiembre (RN-304).
- Las archivadas siguen apareciendo en los meses anteriores a su archivado (RN-312).

**Precondiciones**

- El usuario debe estar autenticado.

**Postcondiciones**

- Ninguna — operación de solo lectura.

**Reglas de negocio**

- RN-302: las fechas de cobro **no se almacenan**. Se derivan al vuelo de `fecha_inicio`, `ciclo` y
  el corte vigente cada vez que se consulta un periodo — mismo criterio que el resto de la
  aplicación con los datos derivados (RN-113 de [[ahorros-y-metas]], el calendario de [[msi]], los
  históricos de [[dashboard]]). Como el conjunto son unas decenas de filas, una sola consulta las
  trae todas y navegar entre meses no vuelve a pegarle a la base.
- RN-303: la i-ésima fecha de cobro se cuenta **siempre desde `fecha_inicio`**, no desde la
  ocurrencia anterior. En los ciclos mensuales o mayores eso significa que el cálculo recorta al
  último día del mes cuando el día de inicio no existe —una mensual iniciada el 31 de enero cae el 28
  de febrero— y **recupera el día original** en los meses que sí lo tienen: marzo vuelve al 31.
  Encadenar desde la ocurrencia anterior habría arrastrado el recorte hacia adelante y perdido el
  día 31 para siempre.
- RN-304: los totales del mes y del año son **cargos reales del periodo**, no un costo normalizado:
  suman lo que efectivamente se cobra en esas fechas. Es lo que mantiene coherentes las cards con el
  calendario y las dos gráficas, que están construidos sobre las mismas fechas. Un total normalizado
  arriba y uno real abajo habrían mostrado dos cifras distintas del mismo mes en la misma pantalla.
- RN-305: junto al total del mes se muestra el **costo mensual equivalente**: el costo anual de las
  suscripciones vigentes ese mes dividido entre doce. Responde una pregunta distinta a la de RN-304
  —"¿cuánto me cuestan realmente?" frente a "¿cuánto me cobran este mes?"— y por eso va como dato
  secundario dentro de la misma card. Un `one_time` aporta cero, porque no se repite.
- RN-306: la card de cada suscripción muestra el monto de cobro con el sufijo de su ciclo
  (`/mo`, `/yr`, …) y, al lado, el costo anualizado. Un pago único no lleva ninguno de los dos.
- RN-307: un **único navegador de mes** gobierna las cards, el listado, ambas gráficas y el
  calendario. La única excepción es la lista de próximos cobros, que cuenta desde la fecha actual y
  no desde el mes visible, porque la pregunta que responde solo tiene sentido en presente.
- RN-308: el listado y el conteo de suscripciones muestran las que estaban **vigentes en el mes
  visible** —las que ya habían iniciado y cuyo corte aún no llegaba— y no las vigentes hoy. Navegar a
  enero muestra lo que se pagaba en enero.
- RN-309: el desglose por categoría corresponde al mes visible y se ordena de mayor a menor. Solo
  aparecen las categorías con al menos un cobro ese mes.
- RN-310: la gráfica de evolución muestra **los doce meses del año**, incluidos los que no tienen
  cobros. Una línea con huecos sugeriría información faltante, cuando el dato es que ese mes no se
  pagó nada.
- RN-311: el módulo no lee ni escribe `transactions`, `budgets`, `accounts` ni `categories`. Un cobro
  de suscripción **no** genera transacción, **no** consume presupuesto y **no** aparece en Analytics
  ni en ningún reporte de [[dashboard]]. La única lectura de otro módulo es la lista de nombres de
  cuentas que ofrece el selector de método de pago, y de ahí solo se copia texto (RN-300).
- RN-316: el logo se obtiene enlazando directamente al CDN de Brandfetch a partir del dominio, con
  una cadena de respaldo de tres pasos: Brandfetch, el favicon de DuckDuckGo, y la inicial del nombre
  sobre el color de la categoría. No se descarga ni se almacena imagen alguna — los términos de la
  API exigen enlazar y no cachear. Brandfetch responde `200` con un marcador genérico para un dominio
  que no conoce en lugar de un `404`, de modo que el paso al siguiente respaldo se decide por el
  tamaño de la imagen recibida: sirve 40×40 donde un logo real viene en 400×400.

**Requerimientos técnicos backend**

| Método | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/subscriptions` | Bearer JWT |

Devuelve todas las suscripciones del usuario. No hay endpoint por periodo: el cálculo de qué cae en
cada mes es del cliente (RN-302).

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Mes con cobros de varios ciclos | Mensual, semanal y trimestral vigentes | Totales, desglose y gráfica coherentes entre sí | 200 |
| 2 | Flujo exitoso | Mes sin cobros | Solo una anual que cobra en otro mes | Total del mes $0.00, promedio mensual mayor que cero | 200 |
| 3 | Caso borde | Mensual iniciada el 31 | `fecha_inicio = 2026-01-31` | Cobra el 28 en febrero y el 31 en marzo | 200 |
| 4 | Caso borde | Anual iniciada el 29 de febrero | `fecha_inicio = 2024-02-29` | Cobra el 28 de febrero en años no bisiestos | 200 |
| 5 | Caso borde | Pago único | `ciclo = one_time` | Cuenta en su mes, no en los siguientes ni en el promedio | 200 |
| 6 | Caso borde | Mes anterior al inicio | Suscripción que inicia en noviembre, mes visible septiembre | No aparece ni cuenta | 200 |
| 7 | Flujo exitoso | Usuario sin suscripciones | Usuario nuevo | Estado vacío, totales en $0.00 | 200 |
| 8 | Autenticación / autorización | Token expirado o ausente | Sin JWT válido | `AUTH_001` | 401 |

---

### CU-080 — Editar una suscripción

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Permite modificar cualquiera de los campos capturados en CU-078. Cambiar la fecha de inicio o el
ciclo reconstruye el calendario completo de cobros, incluido el pasado, porque las ocurrencias son
derivadas y no almacenadas.

**Flujo principal**

1. El usuario abre "Edit" desde el menú de la card.
2. El formulario se precarga con los valores actuales.
3. El usuario modifica lo que necesite y guarda.
4. El sistema valida y actualiza la fila.

**Flujos alternativos / casos borde**

- Renombrar hacia un nombre ya usado por otra activa se rechaza (`VALIDATION_040`).
- Apagar "Has an end date" limpia la fecha de fin y devuelve los cobros futuros (RN-298).
- Editar una archivada es posible; `archivada_en` no se toca y el corte sigue vigente.

**Postcondiciones**

- La fila queda actualizada. Ninguna otra tabla cambia.

**Reglas de negocio**

- RN-317: todos los campos son editables en cualquier momento, incluidos la fecha de inicio y el
  ciclo. Como ninguna ocurrencia está almacenada, el histórico se recalcula solo — no hay registros
  pasados que corregir ni que puedan quedar inconsistentes con la definición nueva.

**Mensajes de error**

Los mismos de CU-078, más `BIZ_036`: "That subscription doesn't exist or isn't yours."

**Requerimientos técnicos backend**

| Método | Endpoint | Auth |
|---|---|---|
| PATCH | `/api/v1/subscriptions/{id}` | Bearer JWT |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Cambiar monto | Monto nuevo | Totales y gráficas reflejan el cambio en todo el histórico | 200 |
| 2 | Flujo exitoso | Cambiar ciclo | De mensual a anual | Calendario reconstruido | 200 |
| 3 | Flujo exitoso | Quitar la fecha de fin | Switch apagado | Vuelven los cobros futuros | 200 |
| 4 | Validación de entrada | Nombre de otra activa | Nombre duplicado | `VALIDATION_040` | 409 |
| 5 | Recurso no encontrado | `id` ajeno o inexistente | `id` inválido | `BIZ_036` | 404 |

---

### CU-081 — Archivar (y reactivar) una suscripción

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Permite dar de baja una suscripción cancelada, sellando la fecha del corte, y revertir esa baja.

**Flujo principal**

1. El usuario elige "Archive" en el menú de la card y confirma.
2. El sistema fija `status = 'archived'` y `archivada_en = fecha actual`.
3. La suscripción deja de aparecer en el listado, en el conteo y en los cobros posteriores a esa
   fecha. Los meses anteriores siguen mostrándola.
4. Para revertir, el usuario elige "Reactivate": el sistema devuelve `status = 'active'` y limpia
   `archivada_en`.

**Flujos alternativos / casos borde**

- Si la suscripción ya tenía `fecha_fin` anterior al archivado, manda la más temprana (RN-313).
- Reactivar una suscripción cuya `fecha_fin` ya pasó la devuelve al listado pero sin cobros futuros:
  el corte por fecha de fin sigue vigente.

**Postcondiciones**

- `status` y `archivada_en` quedan actualizados. Ninguna otra tabla cambia.

**Reglas de negocio**

- RN-312: archivar **sella la fecha del corte** (`archivada_en = hoy`), no solo cambia el estatus. Es
  lo que permite que la suscripción desaparezca de ese día en adelante y **siga contando en los meses
  en que sí se pagó**. Sin esa fecha, archivar habría borrado retroactivamente gasto real de las
  gráficas históricas, y un número histórico que cambia solo destruye la confianza en la pantalla.
- RN-313: el corte efectivo de una suscripción es la **más temprana** entre `fecha_fin` y
  `archivada_en`. La primera es la baja conocida de antemano; la segunda, el atajo para "ya la
  cancelé, hoy".
- RN-314: reactivar limpia `archivada_en`, de modo que el corte no sobreviva a la reactivación. Una
  restricción de la base garantiza que ambos campos no puedan contradecirse: `archivada_en` existe si
  y solo si el estatus es `archived`.
- RN-315: el archivado es siempre una decisión manual y no hay borrado físico — mismo criterio que
  [[ahorros-y-metas]] y [[creditos-deudas]]. La tabla no tiene política de `delete`.

**Requerimientos técnicos backend**

| Método | Endpoint | Auth |
|---|---|---|
| PATCH | `/api/v1/subscriptions/{id}` | Bearer JWT |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Archivar | Suscripción activa | Sale del listado y de los cobros futuros | 200 |
| 2 | Flujo exitoso | El pasado se conserva | Mensual archivada el 15 de junio | Mayo y junio la siguen contando; julio no | 200 |
| 3 | Flujo exitoso | Reactivar | Suscripción archivada | Vuelve al listado, `archivada_en` en nulo, cobros futuros restituidos | 200 |
| 4 | Caso borde | Fecha de fin anterior al archivado | `fecha_fin` en marzo, archivada en junio | Manda marzo | 200 |
| 5 | Recurso no encontrado | `id` ajeno o inexistente | `id` inválido | `BIZ_036` | 404 |

---

### CU-082 — Consultar el calendario de cobros

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Muestra el mes visible como una cuadrícula donde cada día indica si hay cobros, cuánto suman y —al
pasar el cursor— qué suscripciones son.

**Flujo principal**

1. El usuario observa el calendario al pie de la pantalla del módulo.
2. Cada día con cobros muestra un punto y el total del día.
3. Al pasar el cursor sobre un día con cobros, se despliega el desglose: logo, nombre y monto de cada
   suscripción.

**Flujos alternativos / casos borde**

- Un día sin cobros se muestra atenuado, sin punto ni monto, y no tiene desglose.
- El día actual se resalta solo cuando el mes visible es el mes en curso.

**Postcondiciones**

- Ninguna — es de solo lectura y no admite selección.

**Reglas de negocio**

- RN-318: el calendario es de **solo lectura**: no selecciona fechas ni permite capturar nada. Por
  eso no reutiliza el componente de calendario de los formularios, cuyo propósito es justamente
  elegir una fecha; aquí cada día es una celda con contenido propio.
- RN-319: la semana empieza en lunes.
- RN-320: un día con cobros muestra el total del día; el desglose por suscripción vive en el
  emergente al pasar el cursor, para no saturar una celda que mide poco más de un centímetro.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Día con un cobro | Una mensual ese día | Punto, monto y desglose de un renglón | 200 |
| 2 | Flujo exitoso | Día con varios cobros | Dos suscripciones el mismo día | Total sumado y desglose de dos renglones | 200 |
| 3 | Flujo exitoso | Mes con ciclo semanal | Semanal iniciada el día 7 | Cuatro días marcados: 7, 14, 21 y 28 | 200 |
| 4 | Caso borde | Mes visible distinto del actual | Navegación a otro mes | Ningún día resaltado como hoy | 200 |

---

## Cambios en otros documentos

### [[data-model-registry]]

Se agrega la colección `subscriptions`, sin relaciones nuevas fuera de `users`. Se actualiza el
índice de numeración e historial de cambios.

### Ninguno más

Es la particularidad del módulo: no modifica [[transacciones]], [[presupuesto]], [[cuentas]],
[[categorias]] ni [[dashboard]]. Ningún enum se extiende, ninguna tabla existente gana columnas
(RN-311).

## Historial de cambios

|Fecha|Cambio|CU afectado|Impacto en otros documentos|
|---|---|---|---|
|2026-09-05|Se crea el módulo Suscripciones, construido primero en código y documentado después (segundo caso, tras [[msi]]). Tabla `subscriptions` propia, sin llaves foráneas fuera de `users`: un cobro de suscripción no genera transacción, no consume presupuesto y no aparece en Analytics (RN-311). Se agregan CU-078 a CU-082 y RN-294 a RN-320. Es el primer módulo **sin funciones RPC**: no hay saldo que mover, así que insert/update directos bajo RLS bastan, y lo único derivado —qué días cae cada cobro— se calcula en el cliente (RN-302). Decisiones de fondo acordadas antes de construir: los totales son cargos reales del periodo y no un costo normalizado (RN-304), con el promedio mensual como dato secundario (RN-305); un solo navegador de mes gobierna toda la pantalla (RN-307); archivar sella la fecha del corte y conserva el pasado (RN-312); se descartan los ciclos *seasonal* y *fortnightly* y se agregan `quarterly` y `semiannual` (RN-296). El logo se deriva del sitio web vía Brandfetch, enlazado y no almacenado (RN-316), lo que elimina el campo de avatar que el diseño original contemplaba. Este documento **revierte** la decisión registrada en `CLAUDE.md` de dejar Suscripciones fuera del alcance para siempre.|CU-078 a CU-082|Se actualiza [[data-model-registry]] con la colección `subscriptions`, el diagrama ER y el índice de numeración. Ningún otro documento cambia — el módulo no toca ninguna tabla existente.|

## Referencias

- [[estrategia]]
- [[data-model-registry]]
- [[msi]] — precedente de módulo construido primero y documentado después
- [[ahorros-y-metas]] — criterio de archivado manual y nombre único entre activas
- [[creditos-deudas]] — mismo criterio de archivado
