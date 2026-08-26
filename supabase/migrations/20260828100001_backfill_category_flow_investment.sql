-- Analytics (Dashboard) — segunda parte de la extensión de `categories.flujo` con 'investment'.
-- Requiere que 20260828100000_add_category_flow_investment.sql ya haya quedado aplicado y
-- confirmado (el valor de enum debe estar comprometido antes de poder usarse) — ejecutar este
-- archivo por separado, después de aquel.
--
-- Alcance: backfill del grupo "Investment" de cuentas ya existentes, `seed_default_categories_for_user`
-- (el grupo nace con flujo='investment' para usuarios nuevos), y `create_transaction`/
-- `update_transaction` (permiten `tipo=gasto` contra un grupo `flujo='investment'`, no solo
-- `outflow`). El chip "Investment" del formulario de alta de transacciones y las tablas de Budget
-- se actualizan en el frontend — ver commit correspondiente.

-- ---------------------------------------------------------------------------
-- Backfill: el grupo semilla "Investment" de cuentas ya existentes pasa de outflow a investment.
-- Mismo criterio (name-based, único momento en que se permite) que el backfill original de
-- 20260811110000 (Income -> inflow, resto -> outflow).
-- ---------------------------------------------------------------------------

update public.categories
set flujo = 'investment'
where tipo = 'grupo' and nombre = 'Investment' and flujo = 'outflow';

-- ---------------------------------------------------------------------------
-- seed_default_categories_for_user — el grupo "Investment" nace con flujo='investment'.
-- ---------------------------------------------------------------------------

create or replace function public.seed_default_categories_for_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  -- Bills
  insert into public.categories (user_id, tipo, nombre, color, flujo, orden, status)
  values (target_user_id, 'grupo', 'Bills', '#EF4444', 'outflow', 0, 'active')
  returning id into v_group_id;
  insert into public.categories (user_id, tipo, nombre, grupo_id, icono, status) values
    (target_user_id, 'categoria', 'Rent', v_group_id, 'home', 'active'),
    (target_user_id, 'categoria', 'Electricity', v_group_id, 'bolt', 'active'),
    (target_user_id, 'categoria', 'Internet', v_group_id, 'wifi', 'active'),
    (target_user_id, 'categoria', 'Phone', v_group_id, 'phone', 'active');

  -- Needs
  insert into public.categories (user_id, tipo, nombre, color, flujo, orden, status)
  values (target_user_id, 'grupo', 'Needs', '#3B82F6', 'outflow', 1, 'active')
  returning id into v_group_id;
  insert into public.categories (user_id, tipo, nombre, grupo_id, icono, status) values
    (target_user_id, 'categoria', 'Groceries', v_group_id, 'cart', 'active'),
    (target_user_id, 'categoria', 'Transport', v_group_id, 'car', 'active'),
    (target_user_id, 'categoria', 'Health', v_group_id, 'heart', 'active');

  -- Wants
  insert into public.categories (user_id, tipo, nombre, color, flujo, orden, status)
  values (target_user_id, 'grupo', 'Wants', '#A855F7', 'outflow', 2, 'active')
  returning id into v_group_id;
  insert into public.categories (user_id, tipo, nombre, grupo_id, icono, status) values
    (target_user_id, 'categoria', 'Dining Out', v_group_id, 'utensils', 'active'),
    (target_user_id, 'categoria', 'Entertainment', v_group_id, 'film', 'active'),
    (target_user_id, 'categoria', 'Subscriptions', v_group_id, 'repeat', 'active');

  -- Investment
  insert into public.categories (user_id, tipo, nombre, color, flujo, orden, status)
  values (target_user_id, 'grupo', 'Investment', '#22C55E', 'investment', 3, 'active')
  returning id into v_group_id;
  insert into public.categories (user_id, tipo, nombre, grupo_id, icono, status) values
    (target_user_id, 'categoria', 'Stocks', v_group_id, 'trend-up', 'active'),
    (target_user_id, 'categoria', 'Retirement', v_group_id, 'wallet', 'active');

  -- Income
  insert into public.categories (user_id, tipo, nombre, color, flujo, orden, status)
  values (target_user_id, 'grupo', 'Income', '#14B8A6', 'inflow', 4, 'active')
  returning id into v_group_id;
  insert into public.categories (user_id, tipo, nombre, grupo_id, icono, status) values
    (target_user_id, 'categoria', 'Salary', v_group_id, 'wallet', 'active'),
    (target_user_id, 'categoria', 'Other Income', v_group_id, 'generic', 'active');
end;
$$;

-- ---------------------------------------------------------------------------
-- create_transaction / update_transaction — `tipo=gasto` ahora admite grupos `flujo='outflow'` u
-- `'investment'` (antes solo `'outflow'`); `tipo=ingreso` sigue exigiendo `flujo='inflow'`, sin
-- cambio. Mismo cuerpo que la versión previa de cada función, solo cambia la condición señalada.
-- ---------------------------------------------------------------------------

create or replace function public.create_transaction(
  p_account_id uuid,
  p_tipo text,
  p_monto numeric,
  p_category_id uuid,
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
  v_category public.categories;
  v_group public.categories;
  v_signed_monto numeric(14, 2);
  v_transaction public.transactions;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_tipo not in ('gasto', 'ingreso') then
    raise exception 'VALIDATION_001';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'VALIDATION_012';
  end if;

  select * into v_account from public.accounts
  where id = p_account_id and user_id = auth.uid()
  for update;

  if not found or v_account.status <> 'active' then
    raise exception 'BIZ_010';
  end if;

  select * into v_category from public.categories
  where id = p_category_id and user_id = auth.uid() and tipo = 'categoria' and status = 'active';

  if not found then
    raise exception 'BIZ_009';
  end if;

  select * into v_group from public.categories where id = v_category.grupo_id;

  if p_tipo = 'gasto' and v_group.flujo = 'inflow' then
    raise exception 'BIZ_009';
  end if;
  if p_tipo = 'ingreso' and v_group.flujo <> 'inflow' then
    raise exception 'BIZ_009';
  end if;

  v_signed_monto := case when p_tipo = 'gasto' then -abs(p_monto) else abs(p_monto) end;

  insert into public.transactions (user_id, account_id, tipo, category_id, concepto, monto, nota, fecha)
  values (auth.uid(), p_account_id, p_tipo, p_category_id, v_category.nombre, v_signed_monto, p_nota, coalesce(p_fecha, now()))
  returning * into v_transaction;

  update public.accounts set saldo_actual = saldo_actual + v_signed_monto where id = p_account_id;

  return v_transaction;
end;
$$;

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
  v_old_monto numeric(14, 2);
  v_new_monto numeric(14, 2);
  v_category public.categories;
  v_group public.categories;
  v_meta public.savings_goals;
  v_monto_aportado_actual numeric(14, 2);
  v_deuda public.debts;
  v_saldo_actual numeric(14, 2);
  v_related public.transactions;
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
      select v_meta.monto_inicial - coalesce(sum(t.monto), 0) into v_monto_aportado_actual
      from public.transactions t
      where t.meta_id = p_meta_id and t.tipo in ('aportacion_meta', 'retiro_meta') and t.id <> p_transaction_id;

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
    -- RN-053: la categoría se ignora para transferencia/pago_tarjeta — nunca la llevan.
    update public.transactions
    set monto = v_new_monto, fecha = coalesce(p_fecha, v_tx.fecha), nota = p_nota
    where id = p_transaction_id
    returning * into v_tx;
  end if;

  update public.accounts set saldo_actual = saldo_actual - v_old_monto + v_tx.monto where id = v_tx.account_id;

  -- RN-052: si está enlazada, el monto (misma magnitud, signo opuesto), fecha y nota se reflejan
  -- de forma espejada en el documento relacionado y su cuenta — es una sola operación lógica
  -- representada como dos filas. aportacion_meta/retiro_meta/pago_deuda nunca llegan aquí con
  -- transaccion_relacionada_id distinto de null.
  if v_tx.transaccion_relacionada_id is not null then
    select * into v_related from public.transactions
    where id = v_tx.transaccion_relacionada_id
    for update;

    v_new_related_monto := -v_tx.monto;

    update public.transactions
    set monto = v_new_related_monto, fecha = v_tx.fecha, nota = v_tx.nota
    where id = v_related.id;

    update public.accounts
    set saldo_actual = saldo_actual - v_related.monto + v_new_related_monto
    where id = v_related.account_id;
  end if;

  return v_tx;
end;
$$;
