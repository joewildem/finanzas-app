---
status: activo
last-updated: 2026-07-24
---

Arquitectura de información, flujos clave e inventario de pantallas que guían el diseño visual en
Figma. Se basa en [[definición-del-producto]] y [[estrategia]].

## Arquitectura de información (navegación principal, MVP)

```
Finanzas app
├── Dashboard            (vista rápida: saldo total, gasto del mes, avance de presupuesto)
├── Cuentas               (lista, detalle, alta/edición, imagen de tarjeta)
├── Gastos & Presupuesto  (registro de gasto, historial, presupuesto mensual por categoría)
├── Reportes              (vista semanal / mensual)
└── Categorías            (config — CRUD de categorías y subcategorías, transversal)
```

## Flujos de usuario clave

| # | Flujo | Frecuencia | Notas de diseño |
|---|---|---|---|
| 1 | Registrar un gasto | Muy alta | Alta rápida: mínimo de campos obligatorios (monto, categoría, cuenta), resto opcional |
| 2 | Consultar dashboard | Alta | Estado del mes visible de un vistazo |
| 3 | Configurar presupuesto mensual por categoría | Media (mensual) | Permite copiar el mes anterior como punto de partida |
| 4 | Crear/editar categoría y subcategoría | Media al inicio, baja después | Categorías predefinidas disponibles desde el primer uso |
| 5 | Dar de alta una cuenta nueva | Baja | Incluye carga de imagen de la tarjeta/cuenta |
| 6 | Consultar reporte semanal/mensual | Media | Vista visual, sin configuración previa requerida |

## Inventario de pantallas

- [ ] Login / acceso (grupo cerrado, sin flujo de registro público)
- [ ] Dashboard
- [ ] Cuentas — listado
- [ ] Cuentas — detalle
- [ ] Cuentas — alta / edición (con carga de imagen)
- [ ] Gastos — listado / historial
- [ ] Gastos — alta rápida
- [ ] Gastos — edición
- [ ] Presupuesto — vista mensual por categoría
- [ ] Categorías — listado y CRUD
- [ ] Reportes — vista semanal
- [ ] Reportes — vista mensual
- [ ] Configuración / perfil

## Principios de UX por persona

| Principio | Justificación | Aplica a |
|---|---|---|
| Alta rápida en menos de 15 segundos | Necesidad del usuario guiado ([[definición-del-producto]]) | Registro de gastos |
| Valores por defecto listos para usar | Evita configuración inicial obligatoria | Categorías, presupuesto |
| Personalización disponible, no obligatoria | Necesidad del usuario avanzado | Categorías, presupuesto, reportes |
| Estado financiero legible de un vistazo | Aplica a ambos perfiles de usuario | Dashboard, reportes |
| Consistencia entre web y móvil | Resuelve la limitación identificada en [[definición-del-producto]] | Toda la aplicación |

## Estado del diseño

Los wireframes y las pantallas de alta fidelidad se desarrollan en Figma a partir de este
inventario. Las revisiones de diseño (crítica de UI, accesibilidad WCAG y especificaciones de
handoff para desarrollo) se documentan en `design/wireframes/` y `design/user-flows/` conforme
avanza cada módulo.

---

Documentos relacionados: [[definición-del-producto]] · [[estrategia]] · [[roadmap]]
