-- Módulo Transacciones (CU-015, CU-017, CU-018) — docs/pdr/transacciones.md, docs/pdr/data-model-registry.md
--
-- Cierra el módulo Transacciones en código: pago a tarjeta de crédito (CU-015, mismo patrón de dos
-- documentos enlazados que `create_transfer`, pero con validación de tipo de cuenta invertida), y
-- edición/eliminación de una transacción ya registrada (CU-017/CU-018), ambas con reflejo espejado
-- sobre el documento enlazado cuando aplica (transferencia o pago a tarjeta). CU-016 (listado) es de
-- solo lectura y no necesita RPC — ya lo cubre la política `transactions_select_own`.

-- ---------------------------------------------------------------------------
-- CU-015 — Registrar pago a tarjeta de crédito (atómico, dos documentos enlazados)
-- ---------------------------------------------------------------------------
-- RN-048: mismo patrón que `create_transfer`, pero la dirección de la validación de tipo de cuenta
-- se invierte — aquí el destino DEBE ser tarjeta de crédito, y el origen NO puede serlo.

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

  -- RN-048: el destino debe ser tarjeta de crédito; el origen no puede serlo (no se paga una
  -- tarjeta con otra tarjeta desde este caso de uso — para eso existiría un futuro módulo de
  -- Créditos y deudas, fuera de alcance del MVP).
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

  -- RN-049: el abono acerca el saldo de la tarjeta (almacenado en negativo) a cero.
  update public.accounts set saldo_actual = saldo_actual - abs(p_monto) where id = p_cuenta_origen_id;
  update public.accounts set saldo_actual = saldo_actual + abs(p_monto) where id = p_cuenta_destino_id;

  return next v_tx_origen;
  return next v_tx_destino;
  return;
end;
$$;

revoke all on function public.create_credit_card_payment(uuid, uuid, numeric, timestamptz, text) from public;
grant execute on function public.create_credit_card_payment(uuid, uuid, numeric, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- CU-017 — Editar transacción (atómico: reversión del monto anterior + aplicación del nuevo)
-- ---------------------------------------------------------------------------
-- RN-051: `account_id` y `tipo` no son editables — ni siquiera se reciben como parámetro. `monto`
-- y `fecha` son siempre requeridos (el formulario los reenvía con su valor actual si no cambiaron,
-- mismo criterio que `create_transaction`); `category_id` se ignora salvo que el tipo sea
-- gasto/ingreso (RN-053). El signo se preserva del documento original: negativo para gasto/origen
-- de transferencia o pago_tarjeta, positivo para ingreso/destino — así una sola magnitud (`p_monto`,
-- siempre positivo desde el formulario) funciona para los cinco tipos sin necesitar saber cuál es.

create or replace function public.update_transaction(
  p_transaction_id uuid,
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
  v_tx public.transactions;
  v_old_monto numeric(14, 2);
  v_new_monto numeric(14, 2);
  v_category public.categories;
  v_group public.categories;
  v_related public.transactions;
  v_new_related_monto numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'VALIDATION_012';
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

  v_old_monto := v_tx.monto;
  v_new_monto := case when v_old_monto < 0 then -abs(p_monto) else abs(p_monto) end;

  if v_tx.tipo in ('gasto', 'ingreso') then
    select * into v_category from public.categories
    where id = p_category_id and user_id = auth.uid() and tipo = 'categoria' and status = 'active';

    if not found then
      raise exception 'BIZ_009';
    end if;

    select * into v_group from public.categories where id = v_category.grupo_id;

    if v_tx.tipo = 'gasto' and v_group.nombre not in ('Bills', 'Needs', 'Wants', 'Investment') then
      raise exception 'BIZ_009';
    end if;
    if v_tx.tipo = 'ingreso' and v_group.nombre <> 'Income' then
      raise exception 'BIZ_009';
    end if;

    update public.transactions
    set monto = v_new_monto, category_id = v_category.id, fecha = coalesce(p_fecha, v_tx.fecha), nota = p_nota
    where id = p_transaction_id
    returning * into v_tx;
  else
    -- RN-053: la categoría se ignora para transferencia/pago_tarjeta — nunca la llevan.
    update public.transactions
    set monto = v_new_monto, fecha = coalesce(p_fecha, v_tx.fecha), nota = p_nota
    where id = p_transaction_id
    returning * into v_tx;
  end if;

  update public.accounts set saldo_actual = saldo_actual - v_old_monto + v_new_monto where id = v_tx.account_id;

  -- RN-052: si está enlazada, el monto (misma magnitud, signo opuesto), fecha y nota se reflejan
  -- de forma espejada en el documento relacionado y su cuenta — es una sola operación lógica
  -- representada como dos filas.
  if v_tx.transaccion_relacionada_id is not null then
    select * into v_related from public.transactions
    where id = v_tx.transaccion_relacionada_id
    for update;

    v_new_related_monto := -v_new_monto;

    update public.transactions
    set monto = v_new_related_monto, fecha = v_tx.fecha, nota = v_tx.nota
    where id = v_related.id;

    update public.accounts set saldo_actual = saldo_actual - v_related.monto + v_new_related_monto
    where id = v_related.account_id;
  end if;

  return v_tx;
end;
$$;

revoke all on function public.update_transaction(uuid, numeric, uuid, timestamptz, text) from public;
grant execute on function public.update_transaction(uuid, numeric, uuid, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- CU-018 — Eliminar transacción (atómico: reversión de saldo(s) + borrado físico)
-- ---------------------------------------------------------------------------
-- RN-055: si la transacción está enlazada, el borrado del lado relacionado ocurre por cascada — la
-- FK `transactions.transaccion_relacionada_id` ya está declarada `on delete cascade`
-- (20260807150000). Aquí solo hace falta revertir el saldo de ambas cuentas antes de borrar, porque
-- la cascada no toca `accounts`.

create or replace function public.delete_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
  v_related public.transactions;
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

  update public.accounts set saldo_actual = saldo_actual - v_tx.monto where id = v_tx.account_id;

  if v_tx.transaccion_relacionada_id is not null then
    select * into v_related from public.transactions where id = v_tx.transaccion_relacionada_id for update;
    if found then
      update public.accounts set saldo_actual = saldo_actual - v_related.monto where id = v_related.account_id;
    end if;
  end if;

  delete from public.transactions where id = p_transaction_id;
end;
$$;

revoke all on function public.delete_transaction(uuid) from public;
grant execute on function public.delete_transaction(uuid) to authenticated;
