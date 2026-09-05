---
status: en progreso
last-updated: 2026-09-04
---

# 🏦 Finanzas App — Home

Vault de documentación del proyecto. Empieza siempre aquí.

## 📍 Estado actual

- [x] Discovery & Definición
- [x] Estrategia
- [x] Brief UX inicial
- [x] Requerimientos — los 10 módulos del alcance
- [x] Construcción en código — alcance completo
- [ ] QA integral
- [ ] Lanzamiento

El proyecto ya no lanza un MVP reducido para iterar después: se construye el alcance completo (salvo
lo que vive en [[backlog]]) antes de lanzar. Detalle en [[estrategia]]. Suscripciones queda fuera de
forma permanente — se resuelve con una app externa.

Los user flows y wireframes previos a la construcción quedaron sin hacerse: los módulos se
construyeron directamente en código, revisando sobre la pantalla ya funcionando. Se conservan las
plantillas por si un módulo futuro las amerita.

Roadmap completo → [[roadmap]]

## 🔍 Discovery & Definición

- [[definición-del-producto]] — problem statement, personas, propuesta de valor

## 🎯 Estrategia

- [[estrategia]] — visión, diferenciadores, alcance

## 🎨 Diseño UX/UI

- [[brief-ux]] — arquitectura de información, flujos clave, inventario de pantallas

## 📋 Requerimientos (PRD detallado, por módulo)

- [[auth]] — acceso cerrado por lista blanca, OAuth de Google
- [[cuentas]] — débito, efectivo y tarjetas de crédito
- [[categorias]] — grupos y categorías, con flujo estructural
- [[transacciones]] — el registro central de movimientos
- [[presupuesto]] — presupuesto mensual estilo YNAB
- [[ahorros-y-metas]] — metas de ahorro
- [[inversiones]] — instrumentos y balance capturado
- [[creditos-deudas]] — deuda externa (auto, hipoteca, personal)
- [[msi]] — compras a meses sin intereses
- [[dashboard]] — Balance, Networth y Analytics
- [[reportes]] — **registro histórico**: sucedido por [[dashboard]], nunca se construyó en su forma
  original. Sus CU y RN no se reutilizan.

## 🗺️ Roadmap

- [[roadmap]] — semanas 1-13 como registro histórico; de ahí en adelante sin fechas comprometidas

## 🗄️ Backlog de futuro

- [[backlog]] — funcionalidades pospuestas (cuentas compartidas, catálogo de instituciones,
  recompensas, multi-moneda, Apple Pay)

## 🧠 Registro del modelo de datos

- [[data-model-registry]] — colecciones, índice de numeración, diagrama ER acumulativo

## 🛠️ Desarrollo

- [[ambiente-local]] — stack de Supabase en Docker para probar sin tocar producción

## 🧩 Templates

- `templates/template-requerimiento.md`
- `templates/prompt-inicio-modulo.md`
- `templates/template-user-flow.md`
- `templates/template-wireframe.md`
