-- Ajuste de saldo de una meta de ahorro (CU-084) — docs/pdr/ahorros-y-metas.md
--
-- Una meta guardada en un instrumento con rendimientos crece sin que el usuario aporte: la
-- diferencia no sale de ninguna cuenta, así que no puede registrarse como aportación. Este ajuste
-- es el equivalente de CU-006 (ajuste de saldo de cuenta) para metas: el usuario captura el saldo
-- nuevo y el sistema registra la diferencia.
--
-- Vive en su propia tabla y NO en `transactions`. Hoy toda fila de `transactions` mueve
-- exactamente una cuenta (`account_id not null`), y cada RPC, listado y reconstrucción de saldo se
-- apoya en eso. Un ajuste de meta no mueve ninguna: meterlo ahí obligaba a volver nullable
-- `account_id` y a que cada consulta de la tabla recordara ese caso. Separado, queda fuera del
-- listado de Transacciones, de los historiales de cuenta, del "real" de Presupuesto y de Analytics
-- por construcción, no por un filtro que alguien tenga que acordarse de poner.
--
-- Lo que sí tiene que verlo todo cálculo del saldo de una meta se resuelve con una vista,
-- `savings_goal_movements`: la única definición de "lo que mueve una meta". El detalle, el listado,
-- Networth y la validación de retiros leen de ella, así que pantalla y servidor no pueden discrepar
-- sobre cuánto hay disponible.

-- ---------------------------------------------------------------------------
-- 1. savings_goal_adjustments
-- ---------------------------------------------------------------------------

create table public.savings_goal_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- Cascade: sin su meta un ajuste no significa nada, y no toca ninguna cuenta que haya que revertir.
  -- Es también lo que deja a `clean_my_data` funcionar sin conocer esta tabla (mismo criterio que
  -- `msi_payments` y `subscription_payments`).
  meta_id uuid not null references public.savings_goals (id) on delete cascade,
  -- RN-334: desde la perspectiva de la meta — positivo si el saldo subió, negativo si bajó. Es la
  -- convención natural para una fila sin cuenta; la vista la traduce a la de `transactions`.
  monto numeric(14,2) not null,
  fecha timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint savings_goal_adjustments_monto_non_zero check (monto <> 0)
);

create index savings_goal_adjustments_meta_fecha_idx on public.savings_goal_adjustments (meta_id, fecha desc);

alter table public.savings_goal_adjustments enable row level security;

create policy "savings_goal_adjustments_select_own" on public.savings_goal_adjustments for select to authenticated
  using (auth.uid() = user_id);
-- Sin políticas de insert/update/delete: el único camino de escritura es adjust_goal_balance, que
-- calcula la diferencia contra el saldo actual con la meta bloqueada. Un ajuste no se edita ni se
-- borra (mismo criterio que RN-015 de cuentas): un error se corrige con otro ajuste.

-- ---------------------------------------------------------------------------
-- 2. savings_goal_movements — todo lo que mueve el saldo de una meta
-- ---------------------------------------------------------------------------

-- `monto` va con la convención de `transactions` (perspectiva de la cuenta: lo que entra a la meta
-- es negativo), por eso el ajuste se niega. Así el saldo sigue siendo
-- `monto_inicial - sum(monto)` sin importar el origen, y los cálculos existentes no cambian.
--
-- `security_invoker`: la vista corre con los permisos de quien consulta, así que el RLS de
-- `transactions`, `savings_goal_adjustments` y `accounts` aplica igual que si se leyeran directo.
create view public.savings_goal_movements
with (security_invoker = true) as
  select
    t.id,
    t.user_id,
    t.meta_id,
    t.tipo as origen,
    t.account_id,
    ac.nombre as account_nombre,
    t.monto,
    t.fecha,
    t.nota,
    t.created_at
  from public.transactions t
  left join public.accounts ac on ac.id = t.account_id
  -- `meta_id is not null` equivale a `tipo in (aportacion_meta, retiro_meta)` por el constraint
  -- transactions_meta_id_matches_tipo.
  where t.meta_id is not null
  union all
  select
    a.id,
    a.user_id,
    a.meta_id,
    'ajuste_meta' as origen,
    null::uuid as account_id,
    null::text as account_nombre,
    -a.monto as monto,
    a.fecha,
    null::text as nota,
    a.created_at
  from public.savings_goal_adjustments a;

-- ---------------------------------------------------------------------------
-- 3. adjust_goal_balance (CU-084)
-- ---------------------------------------------------------------------------

create or replace function public.adjust_goal_balance(p_meta_id uuid, p_nuevo_monto numeric)
returns public.savings_goal_adjustments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta public.savings_goals;
  v_monto_actual numeric(14, 2);
  v_diff numeric(14, 2);
  v_adjustment public.savings_goal_adjustments;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  -- RN-334: el saldo de una meta nunca es negativo — mismo criterio que `monto_inicial` (RN-123).
  if p_nuevo_monto is null or p_nuevo_monto < 0 then
    raise exception 'VALIDATION_006';
  end if;

  -- `for update`: sin el bloqueo, un retiro concurrente cambiaría el saldo entre leerlo y registrar
  -- la diferencia, y el ajuste dejaría la meta en un monto distinto al que capturó el usuario.
  select * into v_meta from public.savings_goals
  where id = p_meta_id and user_id = auth.uid() and status = 'active'
  for update;

  if not found then
    raise exception 'BIZ_023';
  end if;

  select v_meta.monto_inicial - coalesce(sum(m.monto), 0) into v_monto_actual
  from public.savings_goal_movements m
  where m.meta_id = p_meta_id;

  v_diff := p_nuevo_monto - v_monto_actual;

  -- RN-334: sin diferencia no hay nada que registrar — un renglón en $0 solo ensuciaría el historial.
  if v_diff = 0 then
    return null;
  end if;

  insert into public.savings_goal_adjustments (user_id, meta_id, monto, fecha)
  values (auth.uid(), p_meta_id, v_diff, now())
  returning * into v_adjustment;

  return v_adjustment;
end;
$$;

revoke all on function public.adjust_goal_balance(uuid, numeric) from public;
grant execute on function public.adjust_goal_balance(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. create_goal_withdrawal — mismo cuerpo vigente (20260822100000), saldo desde la vista
-- ---------------------------------------------------------------------------

create or replace function public.create_goal_withdrawal(
  p_meta_id uuid,
  p_account_id uuid,
  p_monto numeric,
  p_fecha timestamptz,
  p_nota text
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.accounts;
  v_meta public.savings_goals;
  v_monto_aportado_actual numeric(14, 2);
  v_signed_monto numeric(14, 2);
  v_transaction public.transactions;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'VALIDATION_012';
  end if;

  select * into v_account from public.accounts
  where id = p_account_id and user_id = auth.uid()
  for update;

  -- RN-147: la cuenta destino debe ser débito o efectivo, activa, propia.
  if not found or v_account.status <> 'active' or v_account.tipo not in ('debito', 'efectivo') then
    raise exception 'BIZ_010';
  end if;

  select * into v_meta from public.savings_goals
  where id = p_meta_id and user_id = auth.uid() and status = 'active'
  for update;

  if not found then
    raise exception 'BIZ_023';
  end if;

  -- RN-126/RN-335: monto_aportado_actual = monto_inicial - suma con signo de todo lo que mueve la
  -- meta, ajustes de saldo incluidos. Se lee de la vista y no de `transactions`: si no, un
  -- rendimiento registrado como ajuste se vería en pantalla pero no se podría retirar.
  select v_meta.monto_inicial - coalesce(sum(t.monto), 0) into v_monto_aportado_actual
  from public.savings_goal_movements t
  where t.meta_id = p_meta_id;

  -- RN-146: el retiro no puede dejar el aportado calculado en negativo.
  if p_monto > v_monto_aportado_actual then
    raise exception 'BIZ_025';
  end if;

  -- RN-145: mismo signo que un ingreso — entra a la cuenta.
  v_signed_monto := abs(p_monto);

  insert into public.transactions (user_id, account_id, tipo, meta_id, concepto, monto, nota, fecha)
  values (
    auth.uid(), p_account_id, 'retiro_meta', p_meta_id,
    'Retiro de meta: ' || v_meta.nombre, v_signed_monto, p_nota, coalesce(p_fecha, now())
  )
  returning * into v_transaction;

  update public.accounts set saldo_actual = saldo_actual + v_signed_monto where id = p_account_id;

  return v_transaction;
end;
$$;

revoke all on function public.create_goal_withdrawal(uuid, uuid, numeric, timestamptz, text) from public;
grant execute on function public.create_goal_withdrawal(uuid, uuid, numeric, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. update_transaction — mismo cuerpo vigente (20260904130000), saldo desde la vista
-- ---------------------------------------------------------------------------
-- Misma firma que la versión vigente, así que `create or replace` la sustituye sin dejar overloads.

create or replace function public.update_transaction(
  p_transaction_id uuid,
  p_monto numeric,
  p_category_id uuid,
  p_fecha timestamptz,
  p_nota text,
  p_meta_id uuid default null,
  p_deuda_id uuid default null,
  p_monto_capital numeric default null,
  p_monto_interes numeric default null
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
  v_account public.accounts;
  v_old_monto numeric(14, 2);
  v_new_monto numeric(14, 2);
  v_category public.categories;
  v_group public.categories;
  v_meta public.savings_goals;
  v_monto_aportado_actual numeric(14, 2);
  v_deuda public.debts;
  v_saldo_actual numeric(14, 2);
  v_related public.transactions;
  v_related_account public.accounts;
  v_new_related_monto numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  select * into v_tx from public.transactions
  where id = p_transaction_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'BIZ_014';
  end if;
  if v_tx.tipo = 'ajuste' then
    raise exception 'BIZ_015';
  end if;

  select * into v_account from public.accounts where id = v_tx.account_id for update;

  if v_tx.tipo = 'pago_deuda' then
    if p_monto_capital is null or p_monto_interes is null or p_monto_capital < 0 or p_monto_interes < 0 then
      raise exception 'VALIDATION_006';
    end if;
    if p_monto_capital + p_monto_interes <= 0 then
      raise exception 'VALIDATION_012';
    end if;
  else
    if p_monto is null or p_monto <= 0 then
      raise exception 'VALIDATION_012';
    end if;
  end if;

  v_old_monto := v_tx.monto;
  v_new_monto := case when v_old_monto < 0 then -abs(p_monto) else abs(p_monto) end;

  if v_tx.tipo in ('gasto', 'ingreso') then
    select * into v_category from public.categories
    where id = p_category_id and user_id = auth.uid() and tipo = 'categoria' and status = 'active';

    if not found then
      raise exception 'BIZ_009';
    end if;

    select * into v_group from public.categories where id = v_category.grupo_id;

    if v_tx.tipo = 'gasto' and v_group.flujo = 'inflow' then
      raise exception 'BIZ_009';
    end if;
    if v_tx.tipo = 'ingreso' and v_group.flujo <> 'inflow' then
      raise exception 'BIZ_009';
    end if;

    update public.transactions
    set monto = v_new_monto, category_id = v_category.id, fecha = coalesce(p_fecha, v_tx.fecha), nota = p_nota
    where id = p_transaction_id
    returning * into v_tx;
  elsif v_tx.tipo in ('aportacion_meta', 'retiro_meta') then
    select * into v_meta from public.savings_goals
    where id = p_meta_id and user_id = auth.uid() and status = 'active'
    for update;

    if not found then
      raise exception 'BIZ_023';
    end if;

    if v_tx.tipo = 'retiro_meta' then
      -- RN-146/RN-152: recalcula el aportado excluyendo la propia transacción que se edita.
      -- RN-335: desde la vista, para que los ajustes de saldo cuenten igual que al registrar.
      select v_meta.monto_inicial - coalesce(sum(t.monto), 0) into v_monto_aportado_actual
      from public.savings_goal_movements t
      where t.meta_id = p_meta_id and t.id <> p_transaction_id;

      if p_monto > v_monto_aportado_actual then
        raise exception 'BIZ_025';
      end if;
    end if;

    update public.transactions
    set monto = v_new_monto, meta_id = v_meta.id, fecha = coalesce(p_fecha, v_tx.fecha), nota = p_nota
    where id = p_transaction_id
    returning * into v_tx;
  elsif v_tx.tipo = 'pago_deuda' then
    select * into v_deuda from public.debts
    where id = p_deuda_id and user_id = auth.uid() and status = 'active'
    for update;

    if not found then
      raise exception 'BIZ_031';
    end if;

    -- RN-221/RN-224: recalcula el saldo excluyendo la propia transacción que se edita.
    select v_deuda.monto_original - coalesce(sum(t.monto_capital), 0) into v_saldo_actual
    from public.transactions t
    where t.deuda_id = p_deuda_id and t.tipo = 'pago_deuda' and t.id <> p_transaction_id;

    if p_monto_capital > v_saldo_actual then
      raise exception 'BIZ_033';
    end if;

    v_new_monto := -(p_monto_capital + p_monto_interes);

    update public.transactions
    set monto = v_new_monto, deuda_id = v_deuda.id, monto_capital = p_monto_capital,
        monto_interes = p_monto_interes, fecha = coalesce(p_fecha, v_tx.fecha), nota = p_nota
    where id = p_transaction_id
    returning * into v_tx;
  else
    -- RN-053: la categoría se ignora para transferencia/pago_tarjeta. Incluye también `compra_msi`:
    -- desde aquí solo se ajustan monto/fecha/nota; el plazo y el mes de inicio se editan con
    -- update_msi_purchase, desde el detalle de la tarjeta.
    update public.transactions
    set monto = v_new_monto, fecha = coalesce(p_fecha, v_tx.fecha), nota = p_nota
    where id = p_transaction_id
    returning * into v_tx;
  end if;

  update public.accounts
  set saldo_actual = saldo_actual +
    (case when v_account.tipo = 'credito' then -(v_tx.monto - v_old_monto) else (v_tx.monto - v_old_monto) end)
  where id = v_tx.account_id;

  if v_tx.transaccion_relacionada_id is not null then
    select * into v_related from public.transactions
    where id = v_tx.transaccion_relacionada_id
    for update;

    select * into v_related_account from public.accounts where id = v_related.account_id for update;

    v_new_related_monto := -v_tx.monto;

    update public.transactions
    set monto = v_new_related_monto, fecha = v_tx.fecha, nota = v_tx.nota
    where id = v_related.id;

    update public.accounts
    set saldo_actual = saldo_actual +
      (case when v_related_account.tipo = 'credito' then -(v_new_related_monto - v_related.monto) else (v_new_related_monto - v_related.monto) end)
    where id = v_related.account_id;
  end if;

  return v_tx;
end;
$$;

revoke all on function public.update_transaction(uuid, numeric, uuid, timestamptz, text, uuid, uuid, numeric, numeric) from public;
grant execute on function public.update_transaction(uuid, numeric, uuid, timestamptz, text, uuid, uuid, numeric, numeric) to authenticated;
