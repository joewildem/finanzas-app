-- Ajustes de saldo con fecha y monto, capturables desde el alta de movimientos.
--
-- Contexto: `tipo = 'ajuste'` ya existía (RN-015, "edit balance" de una cuenta) y ya era el único
-- tipo de movimiento sin categoría que mueve el saldo. Lo que faltaba era poder expresarlo como
-- "tanto dinero, tal día" en vez de "cuál es el saldo nuevo hoy", que es lo que obligaba a
-- registrar correcciones como gastos de una categoría cualquiera e inflaba esa categoría con
-- dinero que no se gastó ahí.
--
-- Esta migración hace cuatro cosas:
--   1. Unifica la convención de signo de `monto` en los ajustes de tarjetas de crédito.
--   2. Agrega `create_adjustment`.
--   3. Permite editar y eliminar un ajuste.
--   4. Deja `adjust_account_balance` escribiendo en la convención unificada.

-- ---------------------------------------------------------------------------
-- 1. Convención de signo
-- ---------------------------------------------------------------------------
-- En toda la tabla `monto` es el movimiento de dinero: negativo sale, positivo entra. En una
-- tarjeta de crédito `saldo_actual` es la deuda en positivo, así que los RPC invierten el signo al
-- aplicarlo — un gasto de -1000 suma 1000 de deuda.
--
-- `adjust_account_balance` era la excepción: guardaba la diferencia de saldo tal cual, o sea ya en
-- términos de deuda, con lo que un ajuste que aumentaba la deuda quedaba en la tabla como positivo
-- y un gasto equivalente como negativo. Vivía con un caso especial en `computeAccountBalanceAsOf`
-- (`tipo !== 'ajuste'`) que lo compensaba al reconstruir históricos.
--
-- Esa excepción no se sostiene si el usuario captura ajustes a mano: la misma columna querría decir
-- dos cosas opuestas según qué pantalla escribió la fila. Se unifica aquí, y el caso especial de
-- `networth.ts` desaparece junto con ella.
--
-- Guardia de idempotencia: voltear un signo dos veces lo deja como estaba, y una fila ya volteada
-- no se distingue de una que no lo está — no hay forma de saberlo por el valor. Como estas
-- migraciones se corren a mano en el SQL Editor, donde nada impide ejecutarlas de nuevo, el volteo
-- se condiciona a que `create_adjustment` todavía no exista: esa función nace en esta misma
-- migración, así que su ausencia es la prueba de que el volteo no ha corrido.
do $$
declare
  v_filas int;
begin
  if to_regprocedure('public.create_adjustment(uuid,numeric,date,text)') is null then
    update public.transactions t
    set monto = -t.monto
    from public.accounts a
    where a.id = t.account_id
      and t.tipo = 'ajuste'
      and a.tipo = 'credito';
    get diagnostics v_filas = row_count;
    raise notice 'Convención de signo unificada en % ajuste(s) de tarjeta.', v_filas;
  else
    raise notice 'El volteo de signo ya se había aplicado — se omite.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. create_adjustment
-- ---------------------------------------------------------------------------
-- `p_monto` llega con signo, a diferencia de `create_transaction`, donde el signo lo decide
-- `p_tipo`: aquí la dirección es justamente lo que el usuario está declarando.
create or replace function public.create_adjustment(
  p_account_id uuid,
  p_monto numeric,
  p_fecha date,
  p_nota text
)
returns public.transactions
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_account public.accounts;
  v_transaction public.transactions;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_monto is null or p_monto = 0 then
    raise exception 'VALIDATION_012';
  end if;

  select * into v_account from public.accounts
  where id = p_account_id and user_id = auth.uid()
  for update;

  if not found or v_account.status <> 'active' then
    raise exception 'BIZ_010';
  end if;

  -- Concepto distinto del "Ajuste manual" que escribe `adjust_account_balance`, aunque compartan
  -- `tipo`: aquel corrige un saldo, este registra una salida o entrada que el usuario decidió no
  -- clasificar. Es el texto que el listado muestra como nombre del movimiento, y la nota del
  -- usuario queda debajo.
  insert into public.transactions (user_id, account_id, tipo, concepto, monto, nota, fecha)
  values (
    auth.uid(), p_account_id, 'ajuste', 'Uncategorized',
    p_monto, p_nota, coalesce(p_fecha, public.today_local())
  )
  returning * into v_transaction;

  update public.accounts
  set saldo_actual = saldo_actual + (case when v_account.tipo = 'credito' then -p_monto else p_monto end)
  where id = p_account_id;

  return v_transaction;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Editar y eliminar un ajuste
-- ---------------------------------------------------------------------------
-- BIZ_015 bloqueaba ambas: un ajuste era un asiento de corrección y no se tocaba. Esa regla se
-- sostenía mientras el único ajuste posible venía de "edit balance", donde el usuario declaraba el
-- saldo correcto y no había monto que equivocar. Capturándolo a mano, un error de dedo en el monto
-- o en la fecha es ordinario, y dejarlo permanente en el historial es peor que permitir la
-- corrección.
create or replace function public.delete_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
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

  select * into v_account from public.accounts where id = v_tx.account_id for update;

  -- RN-054 (corregida): revertir un gasto/pago_tarjeta sobre una cuenta de crédito resta la deuda
  -- que había sumado; revertir un ingreso/abono la vuelve a sumar. Opuesto a débito/efectivo.
  -- Un ajuste se revierte por la misma vía desde que comparte la convención de signo.
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

create or replace function public.update_transaction(
  p_transaction_id uuid,
  p_monto numeric,
  p_category_id uuid,
  p_fecha date,
  p_nota text,
  p_meta_id uuid default null::uuid,
  p_deuda_id uuid default null::uuid,
  p_monto_capital numeric default null::numeric,
  p_monto_interes numeric default null::numeric
)
returns public.transactions
language plpgsql
security definer
set search_path to ''
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

  select * into v_account from public.accounts where id = v_tx.account_id for update;

  if v_tx.tipo = 'pago_deuda' then
    if p_monto_capital is null or p_monto_interes is null or p_monto_capital < 0 or p_monto_interes < 0 then
      raise exception 'VALIDATION_006';
    end if;
    if p_monto_capital + p_monto_interes <= 0 then
      raise exception 'VALIDATION_012';
    end if;
  elsif v_tx.tipo = 'ajuste' then
    -- Un ajuste admite monto negativo: su dirección es el dato, no una consecuencia del tipo.
    if p_monto is null or p_monto = 0 then
      raise exception 'VALIDATION_012';
    end if;
  else
    if p_monto is null or p_monto <= 0 then
      raise exception 'VALIDATION_012';
    end if;
  end if;

  v_old_monto := v_tx.monto;
  -- En el resto de los tipos la dirección la fija `tipo` y el monto llega siempre en positivo, así
  -- que se le devuelve el signo que ya tenía la fila. Un ajuste es el único que puede cambiar de
  -- dirección al editarse, y por eso su monto se toma tal cual llega.
  v_new_monto := case
    when v_tx.tipo = 'ajuste' then p_monto
    when v_old_monto < 0 then -abs(p_monto)
    else abs(p_monto)
  end;

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
      -- RN-335: desde la vista, para que los ajustes de saldo cuenten igual que al registrar.
      select coalesce(sum(monto), 0) into v_monto_aportado_actual
      from public.savings_goal_movements
      where meta_id = v_meta.id and id <> p_transaction_id;

      if abs(p_monto) > v_monto_aportado_actual then
        raise exception 'BIZ_024';
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
      raise exception 'BIZ_032';
    end if;

    select v_deuda.monto_total - coalesce(sum(monto_capital), 0) into v_saldo_actual
    from public.transactions
    where deuda_id = v_deuda.id and tipo = 'pago_deuda' and id <> p_transaction_id;

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
    -- update_msi_purchase, desde el detalle de la tarjeta. Y `ajuste`, que nunca lleva categoría.
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

-- ---------------------------------------------------------------------------
-- 4. adjust_account_balance en la convención unificada
-- ---------------------------------------------------------------------------
create or replace function public.adjust_account_balance(p_account_id uuid, p_nuevo_saldo numeric)
returns public.accounts
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_account public.accounts;
  v_diff numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  -- `for update`: bloquea la fila hasta el commit, cerrando la ventana entre verificar `status`
  -- y actualizar `saldo_actual` frente a un archivado concurrente (CU-005).
  select * into v_account from public.accounts
  where id = p_account_id and user_id = auth.uid()
  for update;

  if not found then
    -- RN-008: mismo mensaje para "no existe" y "es de otro usuario" (mitigación IDOR).
    raise exception 'BIZ_002';
  end if;

  if v_account.status <> 'active' then
    raise exception 'BIZ_004';
  end if;

  v_diff := p_nuevo_saldo - v_account.saldo_actual;

  update public.accounts set saldo_actual = p_nuevo_saldo where id = p_account_id
  returning * into v_account;

  -- RN-015: concepto fijo "Ajuste manual", sin motivo capturado por el usuario.
  -- El monto se guarda como movimiento de dinero, no como diferencia de saldo: en una tarjeta de
  -- crédito subir la deuda es dinero que salió, igual que un gasto.
  insert into public.transactions (user_id, account_id, tipo, concepto, monto, fecha)
  values (
    auth.uid(), p_account_id, 'ajuste', 'Ajuste manual',
    case when v_account.tipo = 'credito' then -v_diff else v_diff end,
    public.today_local()
  );

  return v_account;
end;
$$;
