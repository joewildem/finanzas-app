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
- **Documentación (Casos de uso & Requerimientos) completa** para los 10 documentos de `docs/pdr/`: Cuentas, Categorías, Transacciones, Presupuesto, Reportes, Autenticación, Ahorros y Metas, Inversiones, Créditos y Deudas, y Meses Sin Intereses — no queda ningún módulo pendiente de documentar.
- **Construcción en código completa (2026-08-28):** todos los módulos del alcance están construidos y en uso real, incluyendo Créditos y Deudas y las tres pestañas del Dashboard consolidado (Balance, Networth, Analytics — esta última cierra el módulo). `docs/pdr/reportes.md` queda enteramente resuelto entre Balance/Networth/Analytics; sus propios CU/RN no se reutilizan, quedan como registro histórico.
- **Meses Sin Intereses (agregado 2026-09-04):** primer módulo construido **primero en código y documentado después** — `docs/pdr/msi.md` recoge el resultado, no el camino. Es también el primero que no formaba parte del alcance original: surgió del uso diario.
- **Lo que falta:** QA integral y lanzamiento — no queda ningún módulo nuevo por construir. Cambios futuros son ajustes/mejoras sobre lo ya construido, no módulos nuevos del alcance original.
- Backend: Supabase (Postgres + Supabase Auth). Todos los módulos usan sintaxis Postgres nativa.
- Deploy: Cloudflare Workers (assets-only, `wrangler.jsonc`), auto-deploy en cada push a `main` vía GitHub. Flujo de trabajo vigente por cada ajuste: cambio en código → verificar (`tsc`/`build`/`lint`) → mostrar al usuario → commit + push al aprobar → Cloudflare despliega solo. Migraciones de base de datos **en producción** siempre son manuales (el usuario las corre en el SQL Editor de Supabase), nunca automáticas.
- **Ambiente local (desde 2026-09-03):** stack de Supabase en Docker vía `npx supabase start`, con su propia base, Auth y Studio — ver `docs/desarrollo/ambiente-local.md`. Existe porque hasta esa fecha no había separación: cualquier prueba escribía sobre datos financieros reales. Una migración nueva se valida primero ahí (`npx supabase db reset` replica todo desde cero + `supabase/seed.sql`) y solo después se corre a mano en producción. El login local usa un bloque de correo/contraseña visible solo bajo `import.meta.env.DEV` (`dev@localhost.test` / `localdev123`); producción sigue siendo Google únicamente.
- Roadmap completo: `docs/roadmap/roadmap.md` (semanas 1-13 son registro histórico; de ahí en adelante ya no se compromete a fechas específicas, dado que el alcance y el ritmo real cambiaron respecto al plan original).

## Decisiones estructurales ya tomadas (no reabrir sin razón de peso)

- Créditos y Deudas (`docs/pdr/creditos-deudas.md`) introduce su propia tabla `debts` — al igual que Ahorros e Inversiones, **no** terminó reutilizando `categories.grupo_id` (la opción se descartó para los tres módulos; ver la nota de `categories` en `data-model-registry.md`).
- El pago a una deuda se registra como fila única en `transactions` (`tipo = pago_deuda`, campos `deuda_id`/`monto_capital`/`monto_interes`), mismo patrón de documento único que `aportacion_meta`/`retiro_meta` de Ahorros — **no** el patrón de dos documentos enlazados de transferencia/pago a tarjeta.
- El saldo de una deuda se calcula restando solo la porción de capital de cada pago — el interés nunca reduce el saldo. El desglose capital/interés se captura a mano en cada pago (no se deriva de `tasa_interes`, que es puramente informativa).
- Cada deuda activa gana su propio renglón presupuestable en Presupuesto (`budgets.deuda_id`), igual que cada meta de ahorro.
- El archivado de una deuda es siempre manual, sin relación con que el saldo llegue a $0 — mismo criterio ya establecido para metas de ahorro.
- `categories.flujo` (enum `category_flow`) tiene tres valores estructurales: `inflow`, `outflow`, `investment` (agregado 2026-08-28) — Budget tiene tres tablas correspondientes (Inflow/Outflow/Investment); ningún módulo debe volver a identificar el grupo "Investment" por nombre exacto, ya es estructural.
- Una compra a meses sin intereses (`docs/pdr/msi.md`) es `transactions.tipo = compra_msi` y **nunca lleva categoría**. Esa nulidad no es "no aplica": es el mecanismo que la mantiene fuera de las diez agregaciones de gasto del sistema, que filtran por `tipo in (gasto, ingreso)`. El diseño previo —un `gasto` con `msi_meses` encima— se descartó justamente porque obligaba a excluirla en cada consulta, y bastaba olvidarlo en una para tener dos pantallas contradiciéndose. **No volver a colgarle una categoría.**
- El monto completo de una compra a meses carga al `saldo_actual` de la tarjeta el día del registro, igual que hace el banco. Lo que se reparte entre meses es la mensualidad en Presupuesto, nunca la deuda.
- El calendario de un plan se ancla a `msi_mes_inicio`, no a la fecha de la compra: comprar después del corte empuja la primera parcialidad al mes siguiente, y eso solo lo sabe el usuario. La última parcialidad absorbe el redondeo para que el calendario sume exactamente el monto de la compra.
- El renglón de un plan MSI en Presupuesto **invierte las columnas** respecto al resto de la tabla: "Assigned" es la mensualidad derivada (texto fijo) y "Current" es el pago capturado a mano (editable). Es deliberado: la mensualidad la impone el banco, y lo único que la app no puede derivar es cuánto se pagó de ella — un abono a la tarjeta es un monto único que no dice a qué plan corresponde. Ese pago vive en `msi_payments`, **no** en `budgets`, donde `monto` significa "lo que planeo asignar" y alimenta el dinero por repartir.
- Analytics no cuenta las compras a meses ni sus parcialidades (RN-289). Decisión explícita del usuario: Analytics mide gasto corriente. No "arreglarlo" sin pedírselo.
- El Dashboard (`docs/pdr/dashboard.md`) reconstruye históricos "a la fecha" por agregación en tiempo de consulta (sin snapshots persistidos, salvo `investment_balance_history` que ya existía) — mismo patrón en Balance, Networth y Analytics. El vocabulario de periodo (1M/6M/YTD/1Y/All/Custom) vive en `src/lib/date-periods.ts`, compartido entre Networth y Analytics.