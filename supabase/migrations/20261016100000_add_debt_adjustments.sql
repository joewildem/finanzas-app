-- Pago a deuda registrado sin cuenta (CU-086) — docs/pdr/creditos-deudas.md
--
-- Caso de uso: un pago que el usuario hizo en su momento y olvidó capturar. Capturarlo hoy con
-- cuenta no sirve: `create_debt_payment` descuenta el monto del `saldo_actual` de esa cuenta, que
-- ya refleja esa salida desde hace semanas, así que la deuda quedaría bien y la cuenta mal.
--
-- Vive en su propia tabla y NO en `transactions`, por la misma razón que `savings_goal_adjustments`
-- (CU-084): toda fila de `transactions` mueve exactamente una cuenta (`account_id not null`), y de
-- eso dependen los RPC de editar y eliminar, los historiales de cuenta y la reconstrucción de
-- saldos "a la fecha". Volver nullable esa columna obligaría a que cada una de esas consultas
-- recordara el caso. Separado, queda fuera del listado de Transacciones, de los historiales de
-- cuenta, del "real" de Presupuesto y de Analytics **por construcción**, no por un filtro que
-- alguien tenga que acordarse de poner — que es justo lo que el usuario pidió: que cuente solo en
-- la deuda.
--
-- Lo que sí tiene que verlo todo cálculo del saldo de una deuda se resuelve con una vista,
-- `debt_movements`: la única definición de "lo que mueve una deuda". El detalle, las cards,
-- Networth y la validación de BIZ_033 leen de ella, así que pantalla y servidor no pueden discrepar
-- sobre cuánto se debe.

-- ---------------------------------------------------------------------------
-- 1. debt_adjustments
-- ---------------------------------------------------------------------------

create table public.debt_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- Cascade: sin su deuda un pago registrado así no significa nada, y no toca ninguna cuenta que
  -- haya que revertir. Es también lo que deja a `clean_my_data` funcionar sin conocer esta tabla
  -- (mismo criterio que `savings_goal_adjustments`, `msi_payments` y `subscription_payments`).
  deuda_id uuid not null references public.debts (id) on delete cascade,
  -- Mismo desglose que un pago normal (RN-216): solo el capital reduce el saldo; el interés es el
  -- costo del financiamiento y se guarda para que el historial no mienta sobre cuánto se pagó.
  monto_capital numeric(14,2) not null check (monto_capital >= 0),
  monto_interes numeric(14,2) not null default 0 check (monto_interes >= 0),
  fecha date not null default public.today_local(),
  nota text,
  created_at timestamptz not null default now(),

  constraint debt_adjustments_monto_non_zero check (monto_capital + monto_interes > 0)
);

create index debt_adjustments_deuda_fecha_idx on public.debt_adjustments (deuda_id, fecha desc);

alter table public.debt_adjustments enable row level security;

create policy "debt_adjustments_select_own" on public.debt_adjustments for select to authenticated
  using (auth.uid() = user_id);

-- A diferencia de `savings_goal_adjustments`, aquí sí hay política de delete: aquel es una
-- corrección de saldo donde el usuario declara el monto correcto y no hay nada que equivocar; este
-- es un pago capturado a mano, con capital e interés tecleados, y un error de dedo es ordinario.
-- Se corrige borrando y volviendo a capturar — no hay saldo de cuenta que revertir, así que el
-- borrado es seguro bajo RLS sin necesidad de un RPC.
create policy "debt_adjustments_delete_own" on public.debt_adjustments for delete to authenticated
  using (auth.uid() = user_id);

-- Sin políticas de insert/update: el único camino de escritura es `create_debt_adjustment`, que
-- valida contra el saldo vigente con la deuda bloqueada.

-- ---------------------------------------------------------------------------
-- 2. debt_movements — todo lo que mueve el saldo de una deuda
-- ---------------------------------------------------------------------------

-- `security_invoker`: la vista corre con los permisos de quien consulta, así que el RLS de
-- `transactions`, `debt_adjustments` y `accounts` aplica igual que si se leyeran directo.
create view public.debt_movements
with (security_invoker = true) as
  select
    t.id,
    t.user_id,
    t.deuda_id,
    'pago_deuda'::text as origen,
    t.account_id,
    ac.nombre as account_nombre,
    t.monto_capital,
    t.monto_interes,
    t.monto,
    t.fecha,
    t.nota,
    t.created_at
  from public.transactions t
  left join public.accounts ac on ac.id = t.account_id
  where t.tipo = 'pago_deuda'
  union all
  select
    a.id,
    a.user_id,
    a.deuda_id,
    'pago_sin_cuenta'::text as origen,
    null::uuid as account_id,
    null::text as account_nombre,
    a.monto_capital,
    a.monto_interes,
    -- Mismo signo que un pago normal (RN-214): sale dinero. Se construye aquí para que un consumidor
    -- que solo mire `monto` no tenga que saber de qué origen viene la fila.
    -(a.monto_capital + a.monto_interes) as monto,
    a.fecha,
    a.nota,
    a.created_at
  from public.debt_adjustments a;

-- ---------------------------------------------------------------------------
-- 3. create_debt_adjustment (CU-086)
-- ---------------------------------------------------------------------------

create or replace function public.create_debt_adjustment(
  p_deuda_id uuid,
  p_monto_capital numeric,
  p_monto_interes numeric,
  p_fecha date,
  p_nota text
)
returns public.debt_adjustments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deuda public.debts;
  v_saldo_actual numeric(14, 2);
  v_adjustment public.debt_adjustments;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_monto_capital is null or p_monto_interes is null or p_monto_capital < 0 or p_monto_interes < 0 then
    raise exception 'VALIDATION_006';
  end if;

  if p_monto_capital + p_monto_interes <= 0 then
    raise exception 'VALIDATION_012';
  end if;

  -- `for update`: sin el bloqueo, un pago concurrente cambiaría el saldo entre leerlo y validar,
  -- y el capital podría dejar la deuda sobrepagada.
  select * into v_deuda from public.debts
  where id = p_deuda_id and user_id = auth.uid() and status = 'active'
  for update;

  if not found then
    raise exception 'BIZ_031';
  end if;

  -- RN-202/RN-360: el saldo se lee de la vista, no de `transactions`, para que los pagos
  -- registrados sin cuenta cuenten igual que los demás. Si no, dos pagos sin cuenta podrían
  -- sobrepasar el saldo entre ambos sin que ninguna validación lo notara.
  select v_deuda.monto_original - coalesce(sum(m.monto_capital), 0) into v_saldo_actual
  from public.debt_movements m
  where m.deuda_id = p_deuda_id;

  -- RN-221: el capital no puede dejar el saldo calculado en negativo.
  if p_monto_capital > v_saldo_actual then
    raise exception 'BIZ_033';
  end if;

  insert into public.debt_adjustments (user_id, deuda_id, monto_capital, monto_interes, fecha, nota)
  values (
    auth.uid(), p_deuda_id, p_monto_capital, p_monto_interes,
    coalesce(p_fecha, public.today_local()), p_nota
  )
  returning * into v_adjustment;

  return v_adjustment;
end;
$$;

revoke all on function public.create_debt_adjustment(uuid, numeric, numeric, date, text) from public;
grant execute on function public.create_debt_adjustment(uuid, numeric, numeric, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. create_debt_payment — mismo cuerpo vigente, saldo desde la vista
-- ---------------------------------------------------------------------------

create or replace function public.create_debt_payment(
  p_deuda_id uuid,
  p_account_id uuid,
  p_monto_capital numeric,
  p_monto_interes numeric,
  p_fecha date,
  p_nota text
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.accounts;
  v_deuda public.debts;
  v_saldo_actual numeric(14, 2);
  v_signed_monto numeric(14, 2);
  v_transaction public.transactions;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_monto_capital is null or p_monto_interes is null or p_monto_capital < 0 or p_monto_interes < 0 then
    raise exception 'VALIDATION_006';
  end if;

  if p_monto_capital + p_monto_interes <= 0 then
    raise exception 'VALIDATION_012';
  end if;

  select * into v_account from public.accounts
  where id = p_account_id and user_id = auth.uid()
  for update;

  -- RN-218: la cuenta de origen debe ser débito o efectivo, activa, propia.
  if not found or v_account.status <> 'active' or v_account.tipo not in ('debito', 'efectivo') then
    raise exception 'BIZ_010';
  end if;

  select * into v_deuda from public.debts
  where id = p_deuda_id and user_id = auth.uid() and status = 'active'
  for update;

  if not found then
    raise exception 'BIZ_031';
  end if;

  -- RN-202/RN-360: desde la vista, para que los pagos sin cuenta cuenten igual que al registrar.
  select v_deuda.monto_original - coalesce(sum(m.monto_capital), 0) into v_saldo_actual
  from public.debt_movements m
  where m.deuda_id = p_deuda_id;

  -- RN-221: el capital no puede dejar el saldo calculado en negativo.
  if p_monto_capital > v_saldo_actual then
    raise exception 'BIZ_033';
  end if;

  -- RN-214: mismo signo que un gasto — sale de la cuenta.
  v_signed_monto := -(p_monto_capital + p_monto_interes);

  insert into public.transactions (
    user_id, account_id, tipo, deuda_id, monto_capital, monto_interes, concepto, monto, nota, fecha
  )
  values (
    auth.uid(), p_account_id, 'pago_deuda', p_deuda_id, p_monto_capital, p_monto_interes,
    'Pago a deuda: ' || v_deuda.nombre, v_signed_monto, p_nota, coalesce(p_fecha, public.today_local())
  )
  returning * into v_transaction;

  update public.accounts set saldo_actual = saldo_actual + v_signed_monto where id = p_account_id;

  return v_transaction;
end;
$$;

revoke all on function public.create_debt_payment(uuid, uuid, numeric, numeric, date, text) from public;
grant execute on function public.create_debt_payment(uuid, uuid, numeric, numeric, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. update_transaction — corrige `monto_total` -> `monto_original` y lee el saldo de la vista
-- ---------------------------------------------------------------------------
-- Mismo cuerpo vigente (20261001120000) salvo la consulta de saldo de la rama `pago_deuda`.

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

    -- RN-221/RN-224: recalcula el saldo excluyendo la propia transacción que se edita.
    -- RN-360: desde la vista, para que los pagos sin cuenta cuenten igual que los demás.
    --
    -- `monto_original` y no `monto_total`: `debts` nunca tuvo una columna con ese nombre. La
    -- reescritura del 2026-10-01 (20261001120000) introdujo la errata, y como plpgsql resuelve el
    -- acceso a un campo de registro en tiempo de ejecución, no falló al crearse la función: fallaba
    -- al editar un pago a deuda, con `record "v_deuda" has no field "monto_total"` traducido a
    -- SYS_001 en pantalla. Ninguna otra rama de la función toca esa variable, así que el resto de
    -- las ediciones nunca se vieron afectadas.
    select v_deuda.monto_original - coalesce(sum(m.monto_capital), 0) into v_saldo_actual
    from public.debt_movements m
    where m.deuda_id = v_deuda.id and m.id <> p_transaction_id;

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

revoke all on function public.update_transaction(uuid, numeric, uuid, date, text, uuid, uuid, numeric, numeric) from public;
grant execute on function public.update_transaction(uuid, numeric, uuid, date, text, uuid, uuid, numeric, numeric) to authenticated;
