---
status: activo
last-updated: 2026-07-24
---

# Definición del producto

## Resumen

Finanzas App es una aplicación de gestión financiera personal diseñada para un grupo cerrado de
hasta cinco usuarios. El producto centraliza el seguimiento de cuentas, presupuesto, ahorros,
créditos e inversiones en un solo sistema, reemplazando una combinación de hojas de cálculo y
aplicaciones financieras de propósito único.

## Problema

La gestión financiera personal del grupo de usuarios objetivo depende actualmente de una
combinación de Google Sheets, Looker, y aplicaciones financieras de propósito único (YNAB, Wallet
by BudgetBakers, Buddy Budget Planner).

Este enfoque presenta tres limitaciones:

- **Experiencia móvil deficiente**: el seguimiento basado en hojas de cálculo es difícil de
  mantener desde un dispositivo móvil, lo que hace poco práctica la actualización sobre la marcha.
- **Categorización rígida**: las aplicaciones financieras existentes imponen reglas y esquemas de
  categorización fijos que no permiten cruces de datos personalizados.
- **Datos fragmentados**: ninguna herramienta centraliza cuentas, ahorros, créditos e inversiones —
  los usuarios deben mantener registros manuales distribuidos en múltiples plataformas.

Finanzas App resuelve estas limitaciones mediante una plataforma unificada y flexible, accesible
desde web y móvil.

## Usuarios objetivo

La base inicial de usuarios está compuesta por menos de cinco personas, cada una con finanzas
independientes (no compartidas). Se identificaron dos perfiles de usuario.

### Persona 1 — Usuario avanzado

| Atributo | Detalle |
|---|---|
| Perfil técnico/financiero | Alto — cómodo con hojas de cálculo y cruces de datos complejos |
| Necesidad principal | Flexibilidad: categorías propias, control granular, cruces de datos específicos |
| Punto de dolor actual | Aplicaciones rígidas que no se adaptan a su modelo mental financiero |
| Comportamiento esperado | Configura categorías/subcategorías a detalle, revisa dashboards con frecuencia |

### Persona 2 — Usuario guiado

| Atributo | Detalle |
|---|---|
| Perfil técnico/financiero | Alta nativitidad digital, menor sofisticación financiera/técnica |
| Necesidad principal | Rapidez y simplicidad: registrar y consultar, con configuración mínima |
| Punto de dolor actual | Procesos de configuración largos, jerga financiera compleja |
| Comportamiento esperado | Utiliza categorías predefinidas, consulta reportes visuales simples |

**Implicación de diseño:** la aplicación requiere configuraciones por defecto razonables para la
Persona 2, sin restringir la personalización profunda que necesita la Persona 1, y sin obligar a
ninguno de los dos perfiles a interactuar con ajustes que no necesita. Esto se aborda en la fase de
diseño UX/UI (ver [[brief-ux]]).

## Propuesta de valor

| Elemento | Descripción |
|---|---|
| Quién | Personas con alta capacidad digital que gestionan sus finanzas personales de forma activa, dentro de un grupo pequeño y cerrado, con distintos niveles de sofisticación financiera |
| Situación | Dependencia de hojas de cálculo o aplicaciones rígidas que no se adaptan al modelo mental financiero del usuario, con una experiencia móvil deficiente |
| Alternativa previa | Registro manual en Sheets, cruce manual de datos en Looker, o aplicaciones (YNAB/Wallet/Buddy) sin la flexibilidad de categorización requerida |
| Solución | Aplicación web y móvil híbrida que centraliza cuentas, gastos, presupuesto, ahorros, créditos, inversiones y suscripciones bajo un sistema de categorización único, flexible y reutilizable, con dashboards personalizables |
| Resultado | Visibilidad completa y cruzada del estado financiero desde cualquier dispositivo, con el nivel de detalle que el usuario define |
| Alternativas evaluadas | Google Sheets + Looker Studio, YNAB, Wallet by BudgetBakers, Buddy Budget Planner |

## Funcionalidades identificadas (alcance sin priorizar)

| Módulo | Funcionalidades |
|---|---|
| Cuentas | Administración de cuentas, carga de imagen de tarjeta/cuenta, net worth |
| Gastos y presupuesto | Registro de gastos, presupuesto mensual, CRUD de categorías y subcategorías |
| Ahorros y metas | Seguimiento de ahorros, metas |
| Créditos y deudas | Control de créditos y deudas |
| Inversiones | Portafolio de inversión |
| Suscripciones | Gestión de suscripciones |
| Reportes | Dashboards semanales, mensuales y anuales |

> **Nota transversal:** el sistema de categorías y subcategorías aplica de forma uniforme a
> presupuesto, ahorros, créditos e inversiones. Se implementa como un módulo único y reutilizable,
> en lugar de sistemas independientes por área funcional.

## Alcance confirmado

- **Usuarios**: grupo cerrado, menos de 5 usuarios, cada uno con finanzas independientes (no
  compartidas)
- **Plataforma**: aplicación web + app híbrida (iOS/Android)
- **Ruta de crecimiento**: validado como MVP cerrado; la escalabilidad se evalúa después de la
  validación (ver [[backlog]])

---

Documentos relacionados: [[estrategia]] · [[brief-ux]] · [[roadmap]]
