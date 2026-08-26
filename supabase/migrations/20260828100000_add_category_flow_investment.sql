-- Analytics (Dashboard) — agrega 'investment' como tercer valor de `categories.flujo`, junto a
-- 'inflow'/'outflow'. Decisión del usuario al alinear Analytics: el grupo "Investment" dejaba de
-- ser distinguible del resto de Outflow sin un hack por nombre exacto (ver RN-094, retirado, de
-- docs/pdr/reportes.md, y la nota "queda fuera de este cambio" de RN-039 en docs/pdr/transacciones.md)
-- — necesario para que Analytics separe "gasto" de "capital invertido" sin contarlo dos veces.
--
-- Este archivo SOLO agrega el valor al enum. Postgres no permite usar un valor de enum recién
-- agregado dentro de la misma transacción que lo crea (error 55P04) — el resto del cambio (backfill,
-- siembra, RPCs) vive en el siguiente archivo de migración
-- (20260828100001_backfill_category_flow_investment.sql), que debe ejecutarse por separado, DESPUÉS
-- de que este quede aplicado.

alter type public.category_flow add value 'investment';
