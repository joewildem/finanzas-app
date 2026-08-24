---
status: activo
last-updated: 2026-07-30
---
---

## status: activo last-updated: 2026-08-21

# Roadmap

**Horizonte original:** 27 de julio de 2026 – 24 de enero de 2027 (26 semanas)

## Enfoque

**Nota de alcance (actualizada 2026-08-21):** el enfoque original de este roadmap era lanzar un MVP reducido a mitad de camino (semana 15) e iterar con uso real después. Ese plan cambió: tras usar la aplicación con las funcionalidades iniciales ya construidas, se decidió construir el resto del alcance completo (Ahorros y Metas, Créditos y Deudas, Inversiones, Dashboard + Reportes) antes de cualquier lanzamiento. El detalle del alcance vigente vive en [[estrategia]]; este documento se enfoca en la secuencia de trabajo.

Las semanas 1-13 (documentación y desarrollo inicial) ya ocurrieron y se conservan abajo como registro histórico. A partir de ahí, el cronograma deja de comprometerse a fechas específicas por semana — el ritmo real ya se desvió del plan original, y forzar fechas nuevas sin información de avance real generaría una falsa precisión.

## Agosto 2026 — Documentación y diseño (semanas 1-5) — histórico

|Semana|Fechas|Fase|Entregable|
|---|---|---|---|
|1-2|27 jul – 9 ago|Casos de uso y requerimientos|Requerimientos funcionales por módulo ([[cuentas]], [[categorias]], [[transacciones]], [[presupuesto]], [[reportes]])|
|3|10–16 ago|User flows|Flujos detallados por caso de uso|
|4|17–23 ago|Wireframes|Estructura de baja fidelidad de cada pantalla|
|5|24–30 ago|Hi-Fi (Figma) — inicio|Dashboard y Cuentas en alta fidelidad|

## Septiembre 2026 — Diseño y arranque de desarrollo (semanas 6-9) — histórico

|Semana|Fechas|Fase|Entregable|
|---|---|---|---|
|6|31 ago – 6 sep|Hi-Fi (Figma) — cierre|Gastos, presupuesto, categorías y reportes en alta fidelidad|
|7|7–13 sep|Backlog y setup técnico|User stories, criterios de aceptación, stack, repositorio y CI|
|8-9|14–27 sep|Desarrollo — Sprint 1: fundaciones|Autenticación, cuentas (alta/edición/imagen), sistema de categorías|

## Octubre 2026 — Desarrollo del MVP inicial (semanas 10-13) — histórico

|Semana|Fechas|Fase|Entregable|
|---|---|---|---|
|10-11|28 sep – 11 oct|Desarrollo|Registro de transacciones y presupuesto mensual|
|12-13|12–25 oct|Desarrollo|Cuentas, Categorías, Transacciones y Presupuesto completados y en uso real|

## Fases restantes (sin fecha comprometida)

|Orden|Módulo|Depende de|
|---|---|---|
|1|Ahorros y Metas|Presupuesto, Transacciones (ya construidos)|
|2|Créditos y Deudas|Cuentas, Transacciones (ya construidos)|
|3|Inversiones|Sin dependencia directa de los módulos existentes|
|4|Dashboard + Reportes (consolidado)|Todos los anteriores — se construye al final para diseñarse con datos reales, no a ciegas|
|5|QA integral y lanzamiento|Todo lo anterior completo|

Cada módulo sigue el mismo ciclo: Casos de uso & Requerimientos → diseño Hi-Fi en Figma → construcción en Claude Code, validado antes de avanzar al siguiente.

## Riesgos y supuestos

- El cronograma de desarrollo asume una sola persona construyendo con apoyo de Claude Code. La incorporación de colaboradores adicionales permitiría comprimir los tiempos.
- Dashboard + Reportes es intencionalmente el último módulo — construirlo antes, sin datos reales de los demás módulos, ya demostró llevar a iteración sin llegar a una idea central clara.

---

Documentos relacionados: [[definición-del-producto]] · [[estrategia]] · [[brief-ux]] · [[backlog]]