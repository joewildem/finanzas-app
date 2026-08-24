---
status: activo
last-updated: 2026-07-30
---
---

## status: activo last-updated: 2026-08-23

# Estrategia de producto

## Visión

> Ser el lugar único para ver y gestionar todas las finanzas personales — cuentas, gastos, ahorros, créditos e inversiones — sin depender de hojas de cálculo o múltiples aplicaciones, con la flexibilidad de cruzar los datos según las necesidades de cada usuario.

## Diferenciadores clave

1. **Centralización real** — un solo lugar para todos los instrumentos financieros. YNAB, Wallet y Buddy se enfocan casi exclusivamente en gasto/presupuesto; ninguno cubre cuentas, ahorros, créditos e inversión de forma unificada.
2. **Flexibilidad de categorización y cruces de datos**, reutilizable en todos los módulos, en lugar de reglas fijas.
3. **Experiencia consistente web + móvil**, en contraste con el uso de hojas de cálculo, cuya experiencia móvil es limitada.

## Panorama competitivo

|Competidor|Fuerte en|Débil en|
|---|---|---|
|YNAB|Metodología de presupuesto|Rígido, no cubre inversión/créditos a detalle|
|Wallet (BudgetBakers)|Registro de gastos, multi-cuenta|Categorización poco flexible|
|Buddy Budget Planner|Simplicidad|Alcance limitado, sin visión integral|
|Google Sheets + Looker|Flexibilidad total|Mala experiencia móvil, todo manual|

## Alcance del producto

El alcance original se definía con el framework MoSCoW para escalonar un lanzamiento temprano. Esa estrategia cambió: tras usar la aplicación con las funcionalidades iniciales ya construidas, se determinó que el conjunto completo de módulos (salvo lo listado en [[backlog]]) se construye antes de cualquier lanzamiento, no solo un subconjunto inicial. El cronograma correspondiente vive en [[roadmap]].

### Construido

- **Cuentas** (alta/edición, carga de imagen)
- **Sistema de categorías y subcategorías** (infraestructura transversal, reutilizada por el resto de los módulos)
- **Registro de transacciones** (gastos, ingresos, pagos a tarjeta, aportaciones a metas)
- **Presupuesto mensual por categoría**
- **Autenticación**

### En construcción (orden de secuencia)

1. **Ahorros y Metas** — casos de uso ya documentados; pendiente de construir en código
2. **Inversiones** (portafolio)
3. **Créditos y Deudas**
4. **Dashboard + Reportes** (consolidado — incluye net worth y reportes avanzados; se construye al final, con datos reales ya existentes de todos los módulos anteriores)

### Fuera de alcance (backlog)

- **Gestión de suscripciones** → ver [[backlog]] (ya resuelto con una aplicación externa)
- **Cuentas compartidas / multi-usuario** → ver [[backlog]]

### Justificación de la secuencia

- El sistema de categorías se construyó primero porque los módulos posteriores (ahorros, créditos, inversión) lo reutilizan — implementarlo una sola vez evitó rehacerlo por módulo.
- El orden entre Ahorros, Créditos e Inversiones no es una dependencia técnica dura — es una preferencia ajustable. Ahorros y Créditos tienen terreno ya preparado en el modelo de datos (`transactions.tipo="aportacion_meta"`, `budgets.categoria_reservada="ahorros"`), lo cual reduce su riesgo si se hacen primero, pero Inversiones puede adelantarse sin romper nada.
- Dashboard + Reportes se construye al final, a propósito: diseñarlo antes de que existieran datos reales de todos los módulos llevó a iterar sin llegar a una idea central clara. Net worth y los reportes avanzados se resuelven ahí, no como módulos independientes.

---

Documentos relacionados: [[definición-del-producto]] · [[brief-ux]] · [[roadmap]]