-- Corrección de bug (continuación de 20260901100000) — docs/pdr/transacciones.md
--
-- La corrección de datos de 20260901100000 filtraba transacciones "posteriores al último ajuste"
-- usando `fecha` (la fecha de negocio que el usuario captura y puede backdatar). Eso es incorrecto:
-- lo que importa es el orden real en que las transacciones se guardaron (`created_at`, columna que
-- ningún RPC permite editar), no la fecha que el usuario les asignó. Un pago registrado DESPUÉS de
-- un ajuste manual, pero con una `fecha` anterior a la de ese ajuste, quedó fuera de la corrección
-- anterior y su saldo siguió mal.
--
-- Esta migración reemplaza ese enfoque por un recálculo completo (no relativo) de `saldo_actual`
-- para cada cuenta de crédito, usando `created_at` para el orden real:
--
--   base    = saldo_inicial + sum(monto) de las transacciones con created_at <= al último ajuste
--             (por construcción, el `monto` de un ajuste es siempre `nuevo_saldo - saldo_actual en
--             ese momento`, así que esta suma reconstruye el valor absoluto del último ajuste sin
--             importar si algo anterior a él tenía el signo mal — el ajuste absorbe cualquier error
--             previo). Si la cuenta nunca tuvo un ajuste, `base = saldo_inicial`.
--   deltas  = -monto de cada transacción no-ajuste posterior al último ajuste (o de todas, si nunca
--             hubo ajuste) — el signo correcto para una cuenta de crédito (RN-040/049 revisadas).
--
-- Al ser un recálculo absoluto (no relativo a lo que ya haya corregido 20260901100000), es seguro
-- de ejecutar sin importar qué haya corregido o no esa migración anterior.

with last_ajuste as (
  select account_id, max(created_at) as created_at
  from public.transactions
  where tipo = 'ajuste'
  group by account_id
),
baseline as (
  select
    a.id as account_id,
    a.saldo_inicial + coalesce(sum(t.monto) filter (
      where la.created_at is not null and t.created_at <= la.created_at
    ), 0) as baseline_saldo
  from public.accounts a
  left join last_ajuste la on la.account_id = a.id
  left join public.transactions t on t.account_id = a.id
  where a.tipo = 'credito'
  group by a.id, a.saldo_inicial
),
post_reset as (
  select
    a.id as account_id,
    coalesce(sum(-t.monto) filter (
      where t.tipo <> 'ajuste' and (la.created_at is null or t.created_at > la.created_at)
    ), 0) as post_reset_delta
  from public.accounts a
  left join last_ajuste la on la.account_id = a.id
  left join public.transactions t on t.account_id = a.id
  where a.tipo = 'credito'
  group by a.id
)
update public.accounts a
set saldo_actual = b.baseline_saldo + p.post_reset_delta
from baseline b
join post_reset p on p.account_id = b.account_id
where a.id = b.account_id;
