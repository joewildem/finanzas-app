-- Módulo Transacciones (CU-014) — docs/pdr/transacciones.md, docs/pdr/data-model-registry.md
--
-- Registrar transferencia entre cuentas propias: dos documentos enlazados en `transactions`
-- (monto negativo en origen, positivo en destino, ambos tipo=transferencia), atómico junto con la
-- actualización de `saldo_actual` de ambas cuentas. Mismo patrón que `create_transaction` (CU-013)
-- y `adjust_account_balance` ([[cuentas]]): RPC `security definer` como única vía de escritura.

create or replace function public.create_transfer(
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

  -- RN-044
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

  -- RN-043: ninguna de las dos puede ser tarjeta de crédito (CU-015 resuelve ese caso).
  if v_origen.tipo = 'credito' or v_destino.tipo = 'credito' then
    raise exception 'BIZ_012';
  end if;

  insert into public.transactions (user_id, account_id, tipo, concepto, monto, nota, fecha)
  values (auth.uid(), p_cuenta_origen_id, 'transferencia', 'Transfer', -abs(p_monto), p_nota, coalesce(p_fecha, now()))
  returning * into v_tx_origen;

  insert into public.transactions (
    user_id, account_id, tipo, concepto, monto, nota, fecha, transaccion_relacionada_id
  )
  values (
    auth.uid(), p_cuenta_destino_id, 'transferencia', 'Transfer', abs(p_monto), p_nota,
    coalesce(p_fecha, now()), v_tx_origen.id
  )
  returning * into v_tx_destino;

  update public.transactions set transaccion_relacionada_id = v_tx_destino.id where id = v_tx_origen.id
  returning * into v_tx_origen;

  update public.accounts set saldo_actual = saldo_actual - abs(p_monto) where id = p_cuenta_origen_id;
  update public.accounts set saldo_actual = saldo_actual + abs(p_monto) where id = p_cuenta_destino_id;

  return next v_tx_origen;
  return next v_tx_destino;
  return;
end;
$$;

revoke all on function public.create_transfer(uuid, uuid, numeric, timestamptz, text) from public;
grant execute on function public.create_transfer(uuid, uuid, numeric, timestamptz, text) to authenticated;
