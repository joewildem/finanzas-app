# Finanzas App — Contexto para Claude Code

Este archivo da contexto persistente a Claude Code en cada sesión dentro de este repositorio. Léelo antes de cualquier tarea de documentación o desarrollo.

## Qué es este proyecto

Finanzas App: app de finanzas personales para un grupo cerrado (menos de 5 usuarios), web + app híbrida (iOS/Android). Ver `docs/discovery/definición-del-producto.md` para el detalle completo.

## Punto de entrada a la documentación

Toda la documentación de producto vive en `docs/` y está organizada como un vault de Obsidian. Empieza siempre por `docs/00-Home.md` — ahí está el estado actual y el mapa completo.

## Convenciones de UI

- **Librería de iconos: Hugeicons, siempre.** Paquetes: `@hugeicons/react` (renderer) + `@hugeicons/core-free-icons` (set gratuito, estilo Stroke Rounded). Nunca uses lucide-react ni ninguna otra librería, aunque un componente de shadcn/ui la traiga por defecto en su ejemplo — reemplázala por el ícono equivalente de Hugeicons.
- Cuidado con el nombre del paquete: existe uno viejo y sin mantenimiento llamado `hugeicons-react` (sin scope `@`) que algunas herramientas de IA instalan por error. El correcto es `@hugeicons/react`.
- Patrón de uso: `<HugeiconsIcon icon={Home01Icon} size={24} color="currentColor" strokeWidth={1.5} />`, importando cada ícono específico desde `@hugeicons/core-free-icons` — no importes el paquete completo.

## Reglas no negociables al trabajar en `docs/prd/`

1. **Antes de numerar cualquier CU, regla de negocio o código de error nuevo**, revisa el "Índice de numeración" en `docs/prd/data-model-registry.md` y continúa desde ahí. Nunca reinicies en 001.
2. **Ningún módulo redefine una colección desde cero.** Si un campo ya existe en el registro (ej. `accounts`, `categories`, `transactions`), se extiende — no se duplica ni se contradice sin dejar constancia en la sección "Conflictos sin resolver" del registro.
3. **Al cerrar cualquier módulo**, actualiza `data-model-registry.md` (colecciones, índices, relaciones, diagrama Mermaid, índice de numeración e historial de cambios) antes de darlo por terminado.
4. **Usa `docs/templates/template-requerimiento.md`** para cualquier documento nuevo de requerimientos, y `docs/templates/prompt-inicio-modulo.md` como guía para iniciar un módulo nuevo: primero alinear la visión general en lenguaje no técnico con el usuario, después formalizar en documentos.
5. **Tono de toda la documentación**: técnico, neutral, en tercera persona — como documentación de GitHub, nunca como transcripción de una conversación.

## Estado actual (mantener actualizado)

- **Alcance (actualizado 2026-08-21):** el proyecto ya no lanza un MVP reducido y luego itera — se construye el alcance completo (salvo lo que vive en `docs/backlog/backlog.md`) antes de cualquier lanzamiento. Detalle en `docs/strategy/estrategia.md`. **Suscripciones queda fuera para siempre** (se resuelve con una app externa) — no reabrir ese módulo sin que el usuario lo pida explícitamente.
- **Documentación (Casos de uso & Requerimientos) completa** para los 9 documentos de `docs/pdr/`: Cuentas, Categorías, Transacciones, Presupuesto, Reportes, Autenticación, Ahorros y Metas, Inversiones y **Créditos y Deudas** (cerrado 2026-08-24). Con esto se completa toda la fase de Casos de uso y Requerimientos del alcance definido — no queda ningún módulo pendiente de documentar.
- **Construcción en código:** Auth, Cuentas, Categorías, Transacciones, Presupuesto, Ahorros y Metas e Inversiones ya están construidos y en uso real. **Créditos y Deudas está documentado pero aún no construido en código** — es el único módulo pendiente de construcción antes del Dashboard consolidado. El cascarón de navegación del Dashboard existe (placeholder), pero su contenido analítico real se pospone a propósito.
- **Orden de lo que falta:** 1. Construir Créditos y Deudas en código → 2. Dashboard + Reportes (consolidado: net worth, balance, gráficas — se construye al final, con datos reales de todos los módulos anteriores, no a ciegas) → 3. QA integral y lanzamiento.
- Backend: Supabase (Postgres + Supabase Auth). Todos los módulos ya documentados en `docs/pdr/` usan sintaxis Postgres nativa desde su creación o su traducción (2026-08-22) — no queda ninguna sección "Modelo de información"/"Índices" pendiente de traducir de Mongo.
- Proceso vigente: para cada módulo nuevo — Casos de uso & Requerimientos → diseño Hi-Fi directo en Figma (sin wireframes de baja fidelidad) → construcción en Claude Code — validado antes de avanzar al siguiente módulo.
- Roadmap completo: `docs/roadmap/roadmap.md` (semanas 1-13 son registro histórico; de ahí en adelante ya no se compromete a fechas específicas, dado que el alcance y el ritmo real cambiaron respecto al plan original).

## Decisiones ya tomadas para el módulo que sigue (no reabrir sin razón de peso)

- Créditos y Deudas (`docs/pdr/creditos-deudas.md`) introduce su propia tabla `debts` — al igual que Ahorros e Inversiones, **no** terminó reutilizando `categories.grupo_id` (la opción se descartó para los tres módulos; ver la nota de `categories` en `data-model-registry.md`).
- El pago a una deuda se registra como fila única en `transactions` (`tipo = pago_deuda`, campos `deuda_id`/`monto_capital`/`monto_interes`), mismo patrón de documento único que `aportacion_meta`/`retiro_meta` de Ahorros — **no** el patrón de dos documentos enlazados de transferencia/pago a tarjeta.
- El saldo de una deuda se calcula restando solo la porción de capital de cada pago — el interés nunca reduce el saldo. El desglose capital/interés se captura a mano en cada pago (no se deriva de `tasa_interes`, que es puramente informativa).
- Cada deuda activa gana su propio renglón presupuestable en Presupuesto (`budgets.deuda_id`), igual que cada meta de ahorro — a diferencia de Inversiones, que se presupuesta con una categoría real del grupo "Investment".
- El archivado de una deuda es siempre manual, sin relación con que el saldo llegue a $0 — mismo criterio ya establecido para metas de ahorro.