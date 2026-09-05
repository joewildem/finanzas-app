---
modulo: "Meses Sin Intereses (MSI)"
status: cerrado
last-updated: 2026-09-04
---

# Requerimientos — Meses Sin Intereses (MSI)

## Resumen del módulo

Las compras a meses sin intereses son una figura habitual de las tarjetas de crédito en México: el
comercio cobra el monto completo a la tarjeta el día de la compra, pero el tarjetahabiente lo paga en
parcialidades fijas durante un número pactado de meses. Para la planeación mensual, lo relevante no
es el monto de la compra sino la parcialidad: un televisor de $12,000 a seis meses no consume $12,000
del presupuesto del mes en que se compró, consume $2,000 durante seis meses.

Este módulo permite registrar esas compras, seguir su avance mes a mes y verlas reflejadas en el
presupuesto como el compromiso mensual que realmente son. Sustituye el seguimiento manual en hoja de
cálculo que el usuario llevaba, donde la deuda corriente y las parcialidades vivían en columnas
separadas que se sumaban para saber cuánto pagar cada mes.

A diferencia del resto de los movimientos, una compra a meses **no lleva categoría**. Esa ausencia es
deliberada y estructural: es lo que impide que el monto completo distorsione los reportes de gasto por
categoría sin depender de que cada consulta recuerde excluirla.

> **Nota de procedencia (2026-09-04):** este módulo se construyó primero en código y se documentó
> después, a diferencia del resto del repositorio. El diseño se validó en conversación y se ajustó
> tres veces sobre la pantalla ya funcionando; el documento recoge el resultado final, no el camino.
> Ver el historial de cambios al pie.

## Casos de uso

### CU-072 — Registrar una compra a meses sin intereses

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario registrar una compra pactada a meses sin intereses sobre una
de sus tarjetas de crédito. Para ello será necesario capturar una descripción que identifique la
compra, su monto total, el número de parcialidades y el mes en que se cobrará la primera. El sistema
cargará el monto completo a la tarjeta —igual que hace el banco— y derivará a partir de esos datos el
calendario de parcialidades que alimentará al presupuesto de cada mes.

El alta vive en el detalle de la tarjeta y no en el modal general de registro de movimientos: una
compra a meses no es un gasto ordinario y no comparte con él ni la categoría ni los campos.

**Flujo principal**

1. El usuario abre el detalle de una tarjeta de crédito y elige "Add installment purchase".
2. Captura descripción, monto total, número de parcialidades y mes de la primera.
3. El sistema muestra la mensualidad estimada como referencia mientras captura.
4. El usuario confirma.
5. El sistema registra el movimiento, incrementa la deuda de la tarjeta por el monto completo y
   recalcula el calendario de pagos.

**Flujos alternativos / casos borde**

- Cuenta que no es tarjeta de crédito, ajena o archivada → `BIZ_034`.
- Plazo fuera del rango admitido → `VALIDATION_038`.
- Descripción vacía o fuera de longitud → `VALIDATION_001`.
- Monto menor o igual a cero → `VALIDATION_012`.
- Compra hecha después de la fecha de corte: el usuario elige el mes siguiente como inicio; el
  sistema no lo deduce por su cuenta (RN-274).

**Precondiciones**

- El usuario tiene al menos una tarjeta de crédito activa.

**Postcondiciones**

- Existe un movimiento `tipo = compra_msi` sin categoría asociado a la tarjeta.
- `accounts.saldo_actual` de la tarjeta aumentó por el monto completo de la compra.
- El plan aparece en el presupuesto de cada mes de su ventana de parcialidades.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| Descripción | Input texto | Sí | 2-50 | Texto libre, se recorta | — | Vacío | RN-275 |
| Monto total | Input moneda | Sí | — | Mayor que cero | — | Vacío | RN-272 |
| Parcialidades | Select | Sí | — | 3, 6, 9, 12, 15, 18, 24 | — | 12 | RN-273 |
| Mes de la primera | Select | Sí | — | `YYYY-MM`, mes actual o los tres siguientes | — | Mes actual | RN-274 |

**Reglas de negocio**

- RN-270: Una compra a meses se almacena como `transactions.tipo = 'compra_msi'` y **nunca** lleva
  `category_id`. Toda agregación de gasto del sistema filtra por `tipo in ('gasto','ingreso')`, de
  modo que estas compras quedan fuera de los reportes por categoría por construcción y no por una
  exclusión que cada consulta deba recordar.
- RN-271: Un plan solo puede crearse sobre una cuenta propia, activa y de tipo `credito`.
- RN-272: El monto completo de la compra incrementa `accounts.saldo_actual` de la tarjeta el día del
  registro. No es una elección de modelado: es lo que se le debe al banco desde ese momento, y de ahí
  dependen el crédito disponible (RN-234) y el patrimonio neto.
- RN-273: El plazo admitido va de 2 a 60 parcialidades. El selector ofrece el catálogo habitual
  (3, 6, 9, 12, 15, 18, 24); el rango de la base de datos es más amplio para no bloquear un plan
  fuera de lo común capturado por otra vía.
- RN-274: `msi_mes_inicio` fija el mes de la primera parcialidad y **no se deriva de la fecha de
  compra**: comprar después de la fecha de corte de la tarjeta empuja el plan al mes siguiente, y esa
  diferencia solo la conoce el usuario.
- RN-275: La descripción capturada es el nombre del plan en todas las vistas. Se exige porque el
  `concepto` de un gasto ordinario es el nombre de su categoría, inservible para distinguir dos
  compras del mismo tipo.

**Casos de uso derivados identificados**

- Consulta y seguimiento del plan → CU-073.
- Corrección y baja → CU-074 y CU-075.

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| Cuenta | uuid | Propia, activa, tipo `credito` | IDOR: la propiedad se valida en el RPC con `auth.uid()` |
| Descripción | text | 2-50 caracteres tras recortar | Inyección: parámetro tipado, sin concatenación |
| Monto | numeric | Mayor que cero | — |
| Parcialidades | smallint | Entre 2 y 60 | — |
| Mes de inicio | text | Formato `YYYY-MM` | Inyección: validado contra expresión regular |

**Mensajes de error**

*Validación*
- `VALIDATION_001`: "This field is required."
- `VALIDATION_012`: "The amount must be a number greater than zero."
- `VALIDATION_017`: "That month isn't valid."
- `VALIDATION_038`: "The number of months must be between 2 and 60."

*Autenticación / autorización*
- `AUTH_001`: "Your session has expired. Please sign in again."

*Lógica de negocio*
- `BIZ_034`: "Installment plans can only be set on an expense charged to a credit card."

*Sistema*
- `SYS_001`: "Ocurrió un error inesperado. Intenta de nuevo más tarde."

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| POST | `rpc/create_msi_purchase` | Sí |

*Request*
```json
{
  "p_account_id": "uuid",
  "p_concepto": "Pantalla",
  "p_monto": 12000,
  "p_meses": 6,
  "p_mes_inicio": "2026-11",
  "p_fecha": "2026-09-20",
  "p_nota": null
}
```

*Response (éxito)*
```json
{
  "id": "uuid",
  "tipo": "compra_msi",
  "category_id": null,
  "monto": -12000,
  "msi_meses": 6,
  "msi_mes_inicio": "2026-11",
  "msi_liquidado_mes": null
}
```

*Modelo de información*
```json
// Colección: transactions (extensión)
{
  "msi_meses": "smallint|null",
  "msi_mes_inicio": "text|null",
  "msi_liquidado_mes": "text|null"
}
```
> Registrado en [[data-model-registry]].

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|
| Plan ↔ tarjeta | Movimiento en `transactions` con tipo propio | Reutiliza el saldo, el historial y la baja de cualquier movimiento; no requiere entidad nueva |
| Plan ↔ categoría | Sin relación | RN-270: la ausencia es lo que lo mantiene fuera de los reportes por categoría |

*Índices*

| Colección | Campos | Tipo | Propósito |
|---|---|---|---|
| `transactions` | `(account_id, msi_mes_inicio)` where `tipo = 'compra_msi'` | Parcial | Listar los planes de una tarjeta |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Alta sobre tarjeta activa | $12,000 a 6 meses desde 2026-11 | Movimiento `compra_msi`, saldo +$12,000 | 200 |
| 2 | Validación | Plazo de 1 mes | `p_meses = 1` | `VALIDATION_038` | 400 |
| 3 | Validación | Descripción de un carácter | `p_concepto = "x"` | `VALIDATION_001` | 400 |
| 4 | Lógica de negocio | Cuenta de débito | Cuenta `tipo = debito` | `BIZ_034`, saldo intacto | 409 |
| 5 | Autorización | Cuenta de otro usuario | uuid ajeno | `BIZ_034` (indistinguible de inexistente) | 409 |
| 6 | Reportes | La compra no infla la categoría | Consulta de gasto del mes de la compra | La compra no aparece | 200 |

**Referencia de diseño**

- Pantalla: detalle de cuenta de crédito, tarjeta "Installment plans (MSI)".

---

### CU-073 — Consultar los planes y el calendario de pagos de una tarjeta

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario saber cuánto tiene que pagarle a una tarjeta cada mes y en qué
punto va cada uno de sus planes. Para ello el sistema presentará dos lecturas independientes: un
calendario que descompone el pago de cada mes del año en compras corrientes y parcialidades, y una
tabla de amortización por plan con su avance acumulado.

**Flujo principal**

1. El usuario abre el detalle de una tarjeta de crédito.
2. El sistema muestra el calendario de pagos de los doce meses del año en curso, con navegación por
   año, y la lista de planes con su avance.
3. Al posicionar el cursor sobre el total de parcialidades de un mes, el sistema desglosa cuánto
   aporta cada plan.
4. Al desplegar un plan, el sistema muestra su tabla de amortización completa, marcando cada
   parcialidad como cargada, pendiente o absorbida por una liquidación.

**Flujos alternativos / casos borde**

- Tarjeta sin planes: se muestra únicamente el estado vacío, sin calendario.
- Meses sin cargos: aparecen en ceros y atenuados. Que un mes no deba nada también es información.
- Los años navegables se limitan a aquellos con movimientos o parcialidades (mismo criterio que
  RN-232/RN-240 en [[dashboard]]).

**Precondiciones**

- La cuenta consultada es propia y de tipo `credito`.

**Postcondiciones**

- Ninguna. Es una vista de solo lectura.

**Reglas de negocio**

- RN-276: La mensualidad se calcula como el monto total entre el número de parcialidades, redondeado
  a centavos, salvo la última, que absorbe la diferencia de redondeo. Sin ese ajuste el calendario no
  sumaría el monto de la compra: $10,000 a 12 meses da $833.33, y doce veces esa cifra son $9,999.96.
- RN-277: Un plan corre durante los meses del intervalo `[msi_mes_inicio, msi_mes_inicio + meses)`.
  Fuera de él no aparece en ninguna vista mensual.
- RN-278: El pago que corresponde a una tarjeta en un mes es la suma de sus compras corrientes de ese
  mes más las parcialidades vigentes de sus planes. Las compras a meses **no** se cuentan por su monto
  completo en el mes de la compra; entran repartidas en la columna de parcialidades.
- RN-279: El avance de un plan ("cargado") se deriva del calendario, no de los pagos capturados por el
  usuario: el banco carga la parcialidad al corte con independencia de que el estado de cuenta se
  haya liquidado o no.

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| GET | `transactions?tipo=eq.compra_msi` | Sí |

> El calendario y la amortización se derivan íntegramente en el cliente (`src/lib/msi.ts`) a partir de
> los planes y los movimientos que ya se consultan para el detalle de la cuenta. No hay agregación en
> el servidor ni snapshots persistidos, mismo criterio que [[dashboard]].

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Calendario de un mes con dos planes | Planes de $2,000 y $833.33 | Parcialidades $2,833.33 | 200 |
| 2 | Lógica de negocio | Suma del calendario de amortización | $10,000 a 12 meses | Once de $833.33 y una de $833.37 | 200 |
| 3 | Caso borde | Mes previo al inicio del plan | Plan que arranca en noviembre, consulta de octubre | El plan no aparece | 200 |
| 4 | Recurso no encontrado | Tarjeta sin planes | — | Estado vacío | 200 |

---

### CU-074 — Editar un plan

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá corregir un plan mal capturado: su descripción, su monto, su plazo o el
mes en que arranca. El sistema ajustará la deuda de la tarjeta por la diferencia entre el monto
anterior y el nuevo, y recalculará el calendario completo.

**Flujo principal**

1. El usuario abre el detalle de la tarjeta y elige editar sobre el plan.
2. El formulario se presenta con los datos actuales del plan.
3. El usuario ajusta lo que corresponda y confirma.
4. El sistema actualiza el movimiento y corrige el saldo de la tarjeta por la diferencia.

**Flujos alternativos / casos borde**

- Plan inexistente o de otro usuario → `BIZ_035`.
- El mes de inicio original puede haber quedado fuera del catálogo que ofrece el selector (que arranca
  en el mes actual); se agrega a la lista para no perderlo al guardar.
- La edición **no** está disponible desde el listado de transacciones: el plazo y el mes de inicio no
  caben en el modal general y editarlo desde ahí dejaría el plan sin esos campos.

**Postcondiciones**

- `accounts.saldo_actual` refleja el monto nuevo del plan.

**Reglas de negocio**

- RN-280: Editar el monto de un plan ajusta la deuda de la tarjeta por la diferencia contra el monto
  anterior, nunca reasignando el saldo completo.

**Mensajes de error**

*Lógica de negocio*
- `BIZ_035`: "That installment plan doesn't exist or isn't yours."

**Requerimientos técnicos backend**

| Método | Endpoint | Auth |
|---|---|---|
| POST | `rpc/update_msi_purchase` | Sí |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Cambiar monto y plazo | $12,000 a 6 → $15,000 a 12 | Saldo +$3,000, calendario recalculado | 200 |
| 2 | Recurso no encontrado | Plan ajeno | uuid ajeno | `BIZ_035` | 409 |

---

### CU-075 — Eliminar un plan

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá dar de baja un plan capturado por error. El sistema revertirá el cargo
sobre la tarjeta y eliminará los pagos que se hubieran registrado contra sus parcialidades, que sin el
plan carecen de significado.

**Flujo principal**

1. El usuario elige eliminar sobre el plan y confirma en el diálogo, que anticipa el efecto sobre el
   saldo.
2. El sistema elimina el movimiento, revierte el cargo y arrastra los pagos asociados.

**Postcondiciones**

- El plan desaparece del calendario, de la amortización y del presupuesto de todos sus meses.
- `msi_payments` no conserva registros del plan eliminado.

**Reglas de negocio**

- RN-281: Eliminar un plan revierte su cargo sobre la tarjeta y elimina en cascada sus pagos
  capturados. La eliminación sí está disponible desde el listado de transacciones, a diferencia de la
  edición.

**Requerimientos técnicos backend**

| Método | Endpoint | Auth |
|---|---|---|
| POST | `rpc/delete_transaction` | Sí |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Plan con pago capturado | Plan de $12,000 | Saldo revertido, 0 pagos | 200 |

---

### CU-076 — Liquidar un plan anticipadamente

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad cubrirá el caso de pagar por adelantado lo que resta de un plan para cerrarlo antes
de tiempo. El usuario indicará en qué mes lo liquida y el sistema concentrará en ese mes todas las
parcialidades pendientes, dejando en cero las posteriores.

**Flujo principal**

1. El usuario elige liquidar sobre el plan.
2. Selecciona el mes de la liquidación entre los del plan; el sistema muestra el monto que quedaría a
   pagar ese mes.
3. Al confirmar, el sistema marca el plan y recalcula el calendario.

**Flujos alternativos / casos borde**

- Mes fuera del rango del plan → `VALIDATION_039`.
- La liquidación es reversible: el mismo control ofrece deshacerla y el calendario vuelve a su forma
  original.

**Postcondiciones**

- El plan deja de aparecer en el presupuesto de los meses posteriores al de la liquidación.

**Reglas de negocio**

- RN-282: El mes de liquidación concentra la suma de su propia parcialidad y de todas las pendientes;
  los meses posteriores quedan en cero. La suma del calendario sigue siendo el monto de la compra:
  liquidar adelanta la deuda, no la perdona.
- RN-283: El mes de liquidación debe caer dentro del rango de parcialidades del plan. Antes de que
  arranque no hay nada que adelantar y después de que termina ya no queda saldo.
- RN-284: Liquidar no altera `accounts.saldo_actual`. La deuda ya estaba cargada completa desde el día
  de la compra; el dinero que sale al liquidar se registra como cualquier otro pago a la tarjeta.

**Mensajes de error**

*Validación*
- `VALIDATION_039`: "That month is outside this plan's range."

**Requerimientos técnicos backend**

| Método | Endpoint | Auth |
|---|---|---|
| POST | `rpc/set_msi_settlement` | Sí |

> `p_mes = null` deshace la liquidación.

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Liquidar en la parcialidad 3 de 6 | Plan de $12,000, mes 3 | Mes 3 en $8,000, meses 4-6 en cero | 200 |
| 2 | Validación | Mes posterior al plan | Mes fuera de rango | `VALIDATION_039` | 400 |
| 3 | Flujo exitoso | Deshacer | `p_mes = null` | Calendario original restaurado | 200 |
| 4 | Lógica de negocio | Saldo de la tarjeta | Liquidación | Sin cambios | 200 |

---

### CU-077 — Registrar el pago de una parcialidad

**Actor:** Usuario autenticado (dueño de los datos)

**Descripción del caso de uso**

Esta funcionalidad permitirá al usuario llevar el control de cuánto ha pagado de cada parcialidad,
desde el renglón que el plan ocupa en el presupuesto mensual. Es una captura manual por necesidad: un
abono a la tarjeta es un monto único que no indica qué parte corresponde a qué plan, de modo que el
sistema no puede derivarlo.

**Flujo principal**

1. El usuario abre el presupuesto de un mes.
2. En el grupo "Installments (MSI)" ve un renglón por cada plan vigente ese mes, con la mensualidad
   fija y el campo de pago editable.
3. Captura el monto pagado; el sistema lo guarda de inmediato.

**Flujos alternativos / casos borde**

- Vaciar el campo elimina el registro del pago, mismo criterio que un monto nulo en `save_budgets`.
- El plan dejó de existir → `BIZ_035`; el ítem se omite sin abortar nada más.

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| Pagado | Input moneda en línea | No | — | Mayor o igual a cero | Plan vigente en el mes | `$0.00` | RN-285 |

**Reglas de negocio**

- RN-285: El pago de una parcialidad se captura a mano y se almacena en `msi_payments`, con unicidad
  por usuario, plan y mes. No se guarda en `budgets` porque ahí `monto` significa "lo que planeo
  asignar" y alimenta el cálculo de dinero por repartir; un pago ya ocurrido no es eso, y colocarlo
  ahí dejaría una fila cuyo monto el presupuesto tendría que ignorar.
- RN-286: El renglón de un plan en Presupuesto invierte la semántica del resto de la tabla: "Assigned"
  es la mensualidad derivada del calendario y se muestra fija, y "Current" es el pago capturado y es
  el campo editable. La mensualidad la impone el banco —es un dato, no una decisión— y lo único que el
  sistema no puede derivar es cuánto se pagó de ella.
- RN-287: El cálculo de dinero por repartir (RN-075) resta la **mensualidad derivada**, no el pago
  capturado: lo que reduce el dinero disponible es el compromiso del mes, con independencia de si ya
  se saldó.
- RN-288: El pago capturado es exclusivamente de seguimiento. No modifica el saldo de ninguna cuenta,
  ni el patrimonio neto, ni ningún reporte.

**Mensajes de error**

*Validación*
- `VALIDATION_016`: "The amount can't be negative."
- `VALIDATION_017`: "That month isn't valid."

*Lógica de negocio*
- `BIZ_035`: "That installment plan doesn't exist or isn't yours."

**Requerimientos técnicos backend**

| Método | Endpoint | Auth |
|---|---|---|
| POST | `rpc/save_msi_payment` | Sí |

*Modelo de información*
```json
// Colección: msi_payments
{
  "id": "uuid",
  "user_id": "uuid",
  "msi_transaction_id": "uuid",
  "mes": "2026-11",
  "monto": 2000.00
}
```

*Índices*

| Colección | Campos | Tipo | Propósito |
|---|---|---|---|
| `msi_payments` | `(user_id, msi_transaction_id, mes)` | Único | Un pago por plan y mes |

**Matriz de pruebas**

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|
| 1 | Flujo exitoso | Capturar pago | $2,000 en 2026-11 | Registro creado | 200 |
| 2 | Flujo exitoso | Vaciar el campo | `p_monto = null` | Registro eliminado | 200 |
| 3 | Validación | Monto negativo | `-100` | `VALIDATION_016` | 400 |
| 4 | Recurso no encontrado | Plan ajeno | uuid ajeno | `BIZ_035` | 409 |
| 5 | Lógica de negocio | El pago no altera saldos | Captura de pago | Saldo de la tarjeta sin cambios | 200 |

---

## Alcance excluido

- **Analytics no cuenta las compras a meses ni sus parcialidades** (RN-289). Analytics mide gasto
  corriente; el compromiso mensual de un plan se sigue en Presupuesto y en el detalle de la tarjeta.
  Decisión explícita del usuario, no una omisión: incorporarlas exigiría repartir cada compra entre
  los meses de su plan dentro de agregaciones que operan sobre rangos libres (1M/6M/YTD), y el valor
  no compensa la complejidad mientras el módulo no se use a fondo. Queda como posible extensión.
- **Reparto automático de un abono a la tarjeta entre los planes.** Requeriría una regla de
  asignación (¿el plan más antiguo primero? ¿proporcional?) que un pago parcial vuelve ambigua.
  Se resuelve con la captura manual de CU-077.

## Cambios en otros documentos

### [[transacciones]]

`transactions.tipo` incorpora el valor `compra_msi`, con tres campos propios (`msi_meses`,
`msi_mes_inicio`, `msi_liquidado_mes`) y `category_id` forzosamente nulo. La regla RN-039 (catálogo de
categorías permitido por tipo de movimiento) no aplica a este tipo, que no lleva categoría.

CU-017 (editar transacción) excluye `compra_msi` de la edición desde el listado: se corrige con
CU-074, desde el detalle de la tarjeta. CU-018 (eliminar) sí lo admite sin cambios.

### [[presupuesto]]

La tabla "Outflow" gana un cuarto grupo, "Installments (MSI)", con un renglón por plan vigente en el
mes. RN-075 (dinero por repartir) resta también el total de mensualidades del mes (RN-287). Es el
único grupo cuyos renglones invierten el significado de las columnas asignado/real (RN-286).

### [[cuentas]]

El detalle de una cuenta de tipo `credito` incorpora dos tarjetas nuevas: el calendario de pagos y la
lista de planes con su amortización (CU-073). No aplican a cuentas de débito o efectivo.

### [[data-model-registry]]

Extensión de `transactions` con los tres campos de MSI, tabla nueva `msi_payments`, e índice de
numeración actualizado. Se documenta además la columna `budgets.msi_transaction_id`, introducida y
retirada durante la construcción de este módulo.

## Historial de cambios

| Fecha | Cambio | CU afectado | Impacto en otros documentos |
|---|---|---|---|
| 2026-09-04 | Documentación inicial del módulo, retroactiva a su construcción en código. Numeración CU-072 a CU-077, RN-270 a RN-289, `VALIDATION_038`/`VALIDATION_039`, `BIZ_034`/`BIZ_035`. | Todos | [[transacciones]], [[presupuesto]], [[cuentas]], [[data-model-registry]] |
| 2026-09-04 | Registro del diseño descartado: la primera versión modelaba el plan como un `gasto` con metadata y una columna `budgets.msi_transaction_id`. Se sustituyó por el tipo `compra_msi` sin categoría al constatar que obligaba a excluir esas compras en las diez agregaciones de gasto existentes. | CU-072 | [[data-model-registry]] |

## Referencias

- [[estrategia]]
- [[transacciones]]
- [[presupuesto]]
- [[cuentas]]
- [[data-model-registry]]
