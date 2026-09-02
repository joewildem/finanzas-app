-- Corrección de bug (CU-013, CU-015, CU-017, CU-018) — docs/pdr/transacciones.md
--
-- RN-049 (y su comentario en 20260808180000) asumían que `accounts.saldo_actual` de una cuenta
-- `tipo = credito` se almacena en NEGATIVO (la deuda se "acerca a cero" al abonar). En la práctica,
-- ningún otro punto del sistema siguió esa convención: la creación de cuenta, el ajuste manual
-- (CU-006) y toda la UI (detalle de cuenta, card-tile, CreditBalanceCard, "Total credit cards" del
-- Dashboard) tratan `saldo_actual` de una tarjeta como un número POSITIVO que representa la deuda —
-- exactamente lo que el usuario reportó ver. El bug real es que `create_credit_card_payment` SUMABA
-- el abono al lado destino (tarjeta) en vez de restarlo, y `create_transaction`/`update_transaction`/
-- `delete_transaction` nunca invertían el signo del impacto sobre `saldo_actual` para cuentas de
-- crédito (aplicaban el mismo signo que a débito/efectivo).
--
-- Esta migración adopta como definitivo el comportamiento que YA está implementado en el resto del
-- sistema — `saldo_actual` de una cuenta de crédito es positivo y representa la deuda — y corrige la
-- única pieza que no lo seguía. `transactions.monto` NO cambia de signo en ningún caso (RN-038 sigue
-- intacto: gasto siempre negativo, ingreso siempre positivo en `transactions`); lo único que cambia
-- es cómo ese monto se refleja en `accounts.saldo_actual` cuando la cuenta es de tipo `credito` — el
-- impacto se invierte (gasto incrementa la deuda, ingreso/abono la reduce), dejando intactas todas
-- las agregaciones de Budget/Analytics/Reportes que leen `transactions.monto` directamente.
--
-- Incluye una corrección de datos de una sola vez para las cuentas de crédito ya afectadas por el
-- bug (ver el bloque final).

-- ---------------------------------------------------------------------------
-- CU-013 — Registrar gasto o ingreso: invierte el impacto sobre saldo_actual si la cuenta es credito.
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

  -- RN-040 (corregida): en cuentas de crédito, `saldo_actual` es la deuda en positivo — un gasto la
  -- incrementa y un ingreso la reduce, el impacto opuesto al de débito/efectivo.
  update public.accounts
  set saldo_actual = saldo_actual + (case when v_account.tipo = 'credito' then -v_signed_monto else v_signed_monto end)
  where id = p_account_id;

  return v_transaction;
end;
$$;

-- ---------------------------------------------------------------------------
-- CU-015 — Pago a tarjeta de crédito: el abono ahora RESTA de saldo_actual (reduce la deuda).
-- ---------------------------------------------------------------------------

create or replace function public.create_credit_card_payment(
  p_cuenta_origen_id uuid,
  p_cuenta_destino_id uuid,
  p_monto numeric,
  p_fecha timestamptz,
  p_nota text
)
returns setof public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origen public.accounts;
  v_destino public.accounts;
  v_tx_origen public.transactions;
  v_tx_destino public.transactions;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'VALIDATION_012';
  end if;

  if p_cuenta_origen_id = p_cuenta_destino_id then
    raise exception 'VALIDATION_014';
  end if;

  select * into v_origen from public.accounts
  where id = p_cuenta_origen_id and user_id = auth.uid()
  for update;

  if not found or v_origen.status <> 'active' then
    raise exception 'BIZ_011';
  end if;

  select * into v_destino from public.accounts
  where id = p_cuenta_destino_id and user_id = auth.uid()
  for update;

  if not found or v_destino.status <> 'active' then
    raise exception 'BIZ_011';
  end if;

  if v_destino.tipo <> 'credito' or v_origen.tipo = 'credito' then
    raise exception 'BIZ_013';
  end if;

  insert into public.transactions (user_id, account_id, tipo, concepto, monto, nota, fecha)
  values (auth.uid(), p_cuenta_origen_id, 'pago_tarjeta', 'Card payment', -abs(p_monto), p_nota, coalesce(p_fecha, now()))
  returning * into v_tx_origen;

  insert into public.transactions (
    user_id, account_id, tipo, concepto, monto, nota, fecha, transaccion_relacionada_id
  )
  values (
    auth.uid(), p_cuenta_destino_id, 'pago_tarjeta', 'Card payment', abs(p_monto), p_nota,
    coalesce(p_fecha, now()), v_tx_origen.id
  )
  returning * into v_tx_destino;

  update public.transactions set transaccion_relacionada_id = v_tx_destino.id where id = v_tx_origen.id
  returning * into v_tx_origen;

  -- RN-049 (corregida): saldo_actual de una tarjeta es la deuda en positivo — el abono la reduce.
  update public.accounts set saldo_actual = saldo_actual - abs(p_monto) where id = p_cuenta_origen_id;
  update public.accounts set saldo_actual = saldo_actual - abs(p_monto) where id = p_cuenta_destino_id;

  return next v_tx_origen;
  return next v_tx_destino;
  return;
end;
$$;

-- ---------------------------------------------------------------------------
-- CU-017 — Editar transacción: invierte el impacto sobre saldo_actual para cuentas de crédito,
-- tanto del documento principal como del documento enlazado (si aplica).
-- ---------------------------------------------------------------------------

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

  -- RN-052 (corregida): para cuentas de crédito, el impacto sobre saldo_actual es el opuesto al
  -- signo de `monto` — mismo criterio que CU-013/CU-015.
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

-- ---------------------------------------------------------------------------
-- CU-018 — Eliminar transacción: invierte la reversión sobre saldo_actual para cuentas de crédito,
-- tanto del documento principal como del documento enlazado (si aplica).
-- ---------------------------------------------------------------------------

create or replace function public.delete_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
  v_account public.accounts;
  v_related public.transactions;
  v_related_account public.accounts;
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

  -- RN-054 (corregida): revertir un gasto/pago_tarjeta sobre una cuenta de crédito resta la deuda
  -- que había sumado; revertir un ingreso/abono la vuelve a sumar. Opuesto a débito/efectivo.
  update public.accounts
  set saldo_actual = saldo_actual + (case when v_account.tipo = 'credito' then v_tx.monto else -v_tx.monto end)
  where id = v_tx.account_id;

  if v_tx.transaccion_relacionada_id is not null then
    select * into v_related from public.transactions where id = v_tx.transaccion_relacionada_id for update;
    if found then
      select * into v_related_account from public.accounts where id = v_related.account_id for update;
      update public.accounts
      set saldo_actual = saldo_actual + (case when v_related_account.tipo = 'credito' then v_related.monto else -v_related.monto end)
      where id = v_related.account_id;
    end if;
  end if;

  delete from public.transactions where id = p_transaction_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Corrección de datos (una sola vez): las cuentas de crédito ya afectadas por el bug tienen un
-- exceso de deuda registrada. Para cada cuenta de crédito, se recalcula el exceso sumando `monto`
-- de sus transacciones `tipo <> 'ajuste'` posteriores al último ajuste manual (un ajuste fija un
-- valor absoluto, así que nada anterior a él es relevante) y se resta 2x ese total — el bug aplicaba
-- +monto en vez de -monto, así que el exceso es exactamente el doble del efecto que debió invertirse.
-- ---------------------------------------------------------------------------

with last_ajuste as (
  select account_id, max(fecha) as fecha
  from public.transactions
  where tipo = 'ajuste'
  group by account_id
),
wrong_deltas as (
  select t.account_id, sum(t.monto) as total_monto
  from public.transactions t
  left join last_ajuste la on la.account_id = t.account_id
  where t.tipo <> 'ajuste'
    and (la.fecha is null or t.fecha > la.fecha)
  group by t.account_id
)
update public.accounts a
set saldo_actual = a.saldo_actual - 2 * w.total_monto
from wrong_deltas w
where a.id = w.account_id and a.tipo = 'credito';
