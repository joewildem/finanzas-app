---
status: activo
last-updated: 2026-07-30
---
---

## status: activo last-updated: 2026-08-21

# Backlog de futuro

Funcionalidades identificadas durante la fase de discovery, fuera del alcance definido en [[estrategia]].

## Gestión de suscripciones

|Campo|Detalle|
|---|---|
|Descripción|Registro y seguimiento de suscripciones recurrentes (streaming, software, membresías) con recordatorios de cobro|
|Motivo de la postergación|Ya se resuelve con una aplicación externa dedicada a este propósito; construirlo aquí duplicaría una solución que ya funciona|
|Condición de reactivación|La aplicación externa deja de cubrir la necesidad, o surge valor real en centralizar esto junto con el resto de las finanzas|
|Notas técnicas|Si se retoma, definiría su propia colección `subscriptions`, sin relación directa con `transactions` salvo que se decida registrar el cobro real como gasto|

## Cuentas compartidas / multi-usuario

|Campo|Detalle|
|---|---|
|Descripción|Permite que un grupo (p. ej. una familia) comparta presupuestos, cuentas o gastos, en lugar de que cada usuario mantenga finanzas completamente independientes|
|Motivo de la postergación|El MVP valida primero el modelo individual con menos de 5 usuarios. Las finanzas compartidas incrementan la complejidad (permisos, vistas compartidas vs. privadas) antes de validar el problema base|
|Condición de reactivación|El MVP individual funciona de forma estable y existe intención de escalar a más usuarios|
|Notas técnicas|Implica un modelo de permisos (propietario/miembro), separación de datos privados y compartidos, y un posible rediseño del modelo de datos de cuentas|

## Catálogo de instituciones financieras

|Campo|Detalle|
|---|---|
|Descripción|Selector con catálogo de bancos/instituciones al crear una cuenta, en lugar de omitir el dato por completo|
|Motivo de la postergación|No aporta valor de segmentación identificado para el caso de uso actual; se descartó incluso como campo de texto libre en el módulo de Cuentas (ver [[cuentas]])|
|Condición de reactivación|Surge una necesidad real de agrupar/reportar por institución (ej. comparar exposición por banco)|
|Notas técnicas|Requeriría un catálogo mantenible (alta de instituciones nuevas) y posiblemente logos/branding por institución|

## Recompensas de tarjetas de crédito (cashback / puntos)

|Campo|Detalle|
|---|---|
|Descripción|Configurar y dar seguimiento a programas de recompensas (cashback o puntos) asociados a cuentas de crédito, incluyendo tasas variables por categoría de gasto y el registro de si una transacción se pagó con saldo o con recompensa acumulada|
|Motivo de la postergación|Algunas tarjetas manejan tasas fijas y otras tasas variables por categoría — ese nivel de detalle vuelve compleja la administración dentro de la app y ya lo resuelven las apps de los bancos; no se justifica duplicarlo en el MVP|
|Condición de reactivación|Se valida que exista demanda real de centralizar este seguimiento en lugar de usar las apps bancarias|
|Notas técnicas|Requeriría relacionar recompensas con el sistema de categorías (aún no existe) y con el registro de transacciones de [[transacciones]]; definir si la tasa es fija o variable por categoría|

## Multi-moneda por cuenta

|Campo|Detalle|
|---|---|
|Descripción|Permitir seleccionar una moneda distinta por cuenta (en el MVP el sistema opera en una sola moneda estándar; no se almacena `moneda` por cuenta)|
|Motivo de la postergación|El grupo cerrado de usuarios opera en una sola moneda; no se justifica la complejidad de tasas de cambio y conversión para vistas agregadas en el MVP|
|Condición de reactivación|Se necesita soportar cuentas en distintas monedas (ej. una cuenta en USD)|
|Notas técnicas|Requeriría reintroducir el campo `moneda` por cuenta, definir tasas de conversión para agregados (net worth, reportes) y decidir si se muestra en moneda original o convertida|

## Conexión con Apple Pay

|Campo|Detalle|
|---|---|
|Descripción|Vincular una cuenta con Apple Pay — el alcance exacto (sincronizar saldo, importar transacciones automáticamente, o solo mostrar la tarjeta como vinculada) queda por definir cuando se retome este ítem|
|Motivo de la postergación|Backlog muy futuro; no es prioritario frente al MVP ni a las iteraciones v1.1/v1.2 ya definidas|
|Condición de reactivación|A evaluar junto con la viabilidad técnica y el interés real de automatizar el registro de transacciones|
|Notas técnicas|Requeriría investigar las APIs disponibles (PassKit u otras) y posiblemente un servicio de agregación bancaria de terceros; alcance técnico sin explorar todavía|

---

Este documento se actualiza conforme se identifican nuevos ítems fuera de alcance.

Documentos relacionados: [[estrategia]] · [[roadmap]] · [[cuentas]]