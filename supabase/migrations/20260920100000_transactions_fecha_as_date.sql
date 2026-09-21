-- La fecha de una transacción es un día, no un instante (CU-016) — docs/pdr/transacciones.md
--
-- `transactions.fecha` era `timestamptz`, pero lo que se guarda ahí es el día que el usuario elige
-- en el calendario. El cliente mandaba "2026-09-19" y Postgres lo leía como medianoche UTC; la
-- pantalla lo volvía a convertir a hora de México (UTC-6) y mostraba el 18. El mismo desfase movía
-- transacciones del día 1 al mes anterior en las gráficas, y al editar una transacción el calendario
-- se precargaba un día antes, así que cada edición la recorría otro día más.
--
-- La columna pasa a `date`: un día es un día y no hay zona horaria que aplicarle. El instante real
-- del registro ya vive en `created_at`, que no se toca.

-- ---------------------------------------------------------------------------
-- 1. today_local — el "hoy" del usuario, no el del servidor
-- ---------------------------------------------------------------------------

-- El servidor corre en UTC: después de las 18:00 en México, `current_date` ya es mañana, y un
-- movimiento registrado a las 22:00 quedaría fechado al día siguiente. La zona horaria vive aquí y
-- solo aquí, en vez de repetirse en cada función.
create or replace function public.today_local()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Mexico_City')::date
$$;

revoke all on function public.today_local() from public;
grant execute on function public.today_local() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. transactions.fecha y savings_goal_adjustments.fecha → date
-- ---------------------------------------------------------------------------

-- La vista depende de ambas columnas y Postgres no deja alterar el tipo mientras exista.
drop view public.savings_goal_movements;

-- CONVERSIÓN DEL HISTORIAL — decisión del usuario (2026-09-20): **no** se corrigen las filas ya
-- guardadas. Cada fila se convierte al día que la pantalla muestra hoy, así que el historial se ve
-- igual antes y después de esta migración, y lo capturado antes del arreglo conserva su desfase de
-- un día. Es irreversible: en cuanto la columna es `date` se pierde la hora, que era lo único que
-- distinguía una fecha capturada con el calendario (medianoche UTC exacta) de un instante real.
--
-- Alternativa, si en vez de eso se quisiera recuperar el día que el usuario tecleó, sustituir el
-- `using` de la línea de `transactions` por:
--
--   using case
--     when (fecha at time zone 'UTC')::time = '00:00:00'
--       then (fecha at time zone 'UTC')::date                 -- capturada con el calendario
--     else (fecha at time zone 'America/Mexico_City')::date    -- instante real (now())
--   end
alter table public.transactions alter column fecha drop default;
alter table public.transactions
  alter column fecha type date using (fecha at time zone 'America/Mexico_City')::date;
alter table public.transactions alter column fecha set default public.today_local();

alter table public.savings_goal_adjustments alter column fecha drop default;
alter table public.savings_goal_adjustments
  alter column fecha type date using (fecha at time zone 'America/Mexico_City')::date;
alter table public.savings_goal_adjustments alter column fecha set default public.today_local();

-- ---------------------------------------------------------------------------
-- 3. savings_goal_movements — misma vista, con `fecha` como date en ambas ramas
-- ---------------------------------------------------------------------------

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
-- 4. Funciones — mismo cuerpo vigente, con `p_fecha` como date y `now()` como today_local()
-- ---------------------------------------------------------------------------
-- Cada bloque se copió de su última definición y solo se le cambió eso; el resto es idéntico.

-- adjust_account_balance
create or replace function public.adjust_account_balance(p_account_id uuid, p_nuevo_saldo numeric)
returns public.accounts
language plpgsql
security definer
set search_path = ''
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
  insert into public.transactions (user_id, account_id, tipo, concepto, monto, fecha)
  values (auth.uid(), p_account_id, 'ajuste', 'Ajuste manual', v_diff, public.today_local());

  return v_account;
end;
$$;

revoke all on function public.adjust_account_balance(uuid, numeric) from public;
grant execute on function public.adjust_account_balance(uuid, numeric) to authenticated;

-- batch_update_transactions
drop function if exists public.batch_update_transactions(uuid[], uuid, timestamptz, text);

create or replace function public.batch_update_transactions(
  p_ids uuid[],
  p_account_id uuid default null,
  p_fecha date default null,
  p_nota text default null
)
returns setof public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selected_count int;
  v_found_count int;
  v_ajuste_count int;
  v_linked_count int;
  v_tx record;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_ids is null or array_length(p_ids, 1) is null then
    raise exception 'VALIDATION_023';
  end if;
  v_selected_count := array_length(p_ids, 1);

  select count(*) into v_found_count from public.transactions where id = any(p_ids) and user_id = auth.uid();
  if v_found_count <> v_selected_count then
    raise exception 'BIZ_014';
  end if;

  -- RN-107
  select count(*) into v_ajuste_count
  from public.transactions
  where id = any(p_ids) and user_id = auth.uid() and tipo = 'ajuste';
  if v_ajuste_count > 0 then
    raise exception 'BIZ_015';
  end if;

  if p_account_id is not null then
    -- RN-108/BIZ_022
    select count(*) into v_linked_count
    from public.transactions
    where id = any(p_ids) and user_id = auth.uid() and transaccion_relacionada_id is not null;
    if v_linked_count > 0 then
      raise exception 'BIZ_022';
    end if;

    if not exists (
      select 1 from public.accounts where id = p_account_id and user_id = auth.uid() and status = 'active'
    ) then
      raise exception 'BIZ_010';
    end if;

    -- Revierte cada transacción de su cuenta original y la aplica a la cuenta destino — `saldo_actual`
    -- se ajusta con una resta/suma relativa por fila (segura sin lock explícito de `accounts`: cada
    -- UPDATE es atómico por sí mismo), ya que el destino es común pero el origen varía por fila.
    for v_tx in select * from public.transactions where id = any(p_ids) and user_id = auth.uid() for update loop
      update public.accounts set saldo_actual = saldo_actual - v_tx.monto where id = v_tx.account_id;
      update public.accounts set saldo_actual = saldo_actual + v_tx.monto where id = p_account_id;
    end loop;

    update public.transactions set account_id = p_account_id where id = any(p_ids) and user_id = auth.uid();
  end if;

  -- RN-109: sobrescribe con el mismo valor en todas, no es un corrimiento relativo.
  if p_fecha is not null then
    update public.transactions set fecha = p_fecha where id = any(p_ids) and user_id = auth.uid();
  end if;

  -- RN-110: sobrescribe con el mismo texto en todas, no concatena con la nota existente.
  if p_nota is not null then
    update public.transactions set nota = p_nota where id = any(p_ids) and user_id = auth.uid();
  end if;

  return query select * from public.transactions where id = any(p_ids) and user_id = auth.uid();
end;
$$;

revoke all on function public.batch_update_transactions(uuid[], uuid, date, text) from public;
grant execute on function public.batch_update_transactions(uuid[], uuid, date, text) to authenticated;

-- create_credit_card_payment
drop function if exists public.create_credit_card_payment(uuid, uuid, numeric, timestamptz, text);

create or replace function public.create_credit_card_payment(
  p_cuenta_origen_id uuid,
  p_cuenta_destino_id uuid,
  p_monto numeric,
  p_fecha date,
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
  values (auth.uid(), p_cuenta_origen_id, 'pago_tarjeta', 'Card payment', -abs(p_monto), p_nota, coalesce(p_fecha, public.today_local()))
  returning * into v_tx_origen;

  insert into public.transactions (
    user_id, account_id, tipo, concepto, monto, nota, fecha, transaccion_relacionada_id
  )
  values (
    auth.uid(), p_cuenta_destino_id, 'pago_tarjeta', 'Card payment', abs(p_monto), p_nota,
    coalesce(p_fecha, public.today_local()), v_tx_origen.id
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

revoke all on function public.create_credit_card_payment(uuid, uuid, numeric, date, text) from public;
grant execute on function public.create_credit_card_payment(uuid, uuid, numeric, date, text) to authenticated;

-- create_debt_payment
drop function if exists public.create_debt_payment(uuid, uuid, numeric, numeric, timestamptz, text);

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

  -- RN-202: saldo_actual = monto_original - suma de monto_capital de sus pagos existentes.
  select v_deuda.monto_original - coalesce(sum(t.monto_capital), 0) into v_saldo_actual
  from public.transactions t
  where t.deuda_id = p_deuda_id and t.tipo = 'pago_deuda';

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

-- create_goal_contribution
drop function if exists public.create_goal_contribution(uuid, uuid, numeric, timestamptz, text);

create or replace function public.create_goal_contribution(
  p_meta_id uuid,
  p_account_id uuid,
  p_monto numeric,
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
  v_meta public.savings_goals;
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

  -- RN-141: la cuenta de origen debe ser débito o efectivo, activa, propia.
  if not found or v_account.status <> 'active' or v_account.tipo not in ('debito', 'efectivo') then
    raise exception 'BIZ_010';
  end if;

  select * into v_meta from public.savings_goals
  where id = p_meta_id and user_id = auth.uid() and status = 'active';

  if not found then
    raise exception 'BIZ_023';
  end if;

  -- RN-139: mismo signo que un gasto — sale de la cuenta.
  v_signed_monto := -abs(p_monto);

  insert into public.transactions (user_id, account_id, tipo, meta_id, concepto, monto, nota, fecha)
  values (
    auth.uid(), p_account_id, 'aportacion_meta', p_meta_id,
    'Aportación a meta: ' || v_meta.nombre, v_signed_monto, p_nota, coalesce(p_fecha, public.today_local())
  )
  returning * into v_transaction;

  update public.accounts set saldo_actual = saldo_actual + v_signed_monto where id = p_account_id;

  return v_transaction;
end;
$$;

revoke all on function public.create_goal_contribution(uuid, uuid, numeric, date, text) from public;
grant execute on function public.create_goal_contribution(uuid, uuid, numeric, date, text) to authenticated;

-- create_goal_withdrawal
drop function if exists public.create_goal_withdrawal(uuid, uuid, numeric, timestamptz, text);

create or replace function public.create_goal_withdrawal(
  p_meta_id uuid,
  p_account_id uuid,
  p_monto numeric,
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
    'Retiro de meta: ' || v_meta.nombre, v_signed_monto, p_nota, coalesce(p_fecha, public.today_local())
  )
  returning * into v_transaction;

  update public.accounts set saldo_actual = saldo_actual + v_signed_monto where id = p_account_id;

  return v_transaction;
end;
$$;

revoke all on function public.create_goal_withdrawal(uuid, uuid, numeric, date, text) from public;
grant execute on function public.create_goal_withdrawal(uuid, uuid, numeric, date, text) to authenticated;

-- create_msi_purchase
drop function if exists public.create_msi_purchase(uuid, text, numeric, smallint, text, timestamptz, text);

create or replace function public.create_msi_purchase(
  p_account_id uuid,
  p_concepto text,
  p_monto numeric,
  p_meses smallint,
  p_mes_inicio text,
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
  v_transaction public.transactions;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_concepto is null or char_length(trim(p_concepto)) < 2 or char_length(trim(p_concepto)) > 50 then
    raise exception 'VALIDATION_001';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'VALIDATION_012';
  end if;

  if p_meses is null or p_meses < 2 or p_meses > 60 then
    raise exception 'VALIDATION_038';
  end if;

  if p_mes_inicio is null or p_mes_inicio !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'VALIDATION_017';
  end if;

  select * into v_account from public.accounts
  where id = p_account_id and user_id = auth.uid()
  for update;

  -- Un plan a meses sin intereses solo existe sobre una tarjeta de crédito propia y activa.
  if not found or v_account.status <> 'active' or v_account.tipo <> 'credito' then
    raise exception 'BIZ_034';
  end if;

  insert into public.transactions (
    user_id, account_id, tipo, concepto, monto, nota, fecha, msi_meses, msi_mes_inicio
  )
  values (
    auth.uid(), p_account_id, 'compra_msi', trim(p_concepto), -abs(p_monto), p_nota,
    coalesce(p_fecha, public.today_local()), p_meses, p_mes_inicio
  )
  returning * into v_transaction;

  -- La deuda de la tarjeta sube por el monto completo desde el día de la compra.
  update public.accounts
  set saldo_actual = saldo_actual + abs(p_monto)
  where id = p_account_id;

  return v_transaction;
end;
$$;

revoke all on function public.create_msi_purchase(uuid, text, numeric, smallint, text, date, text) from public;
grant execute on function public.create_msi_purchase(uuid, text, numeric, smallint, text, date, text) to authenticated;

-- create_transaction
drop function if exists public.create_transaction(uuid, text, numeric, uuid, timestamptz, text);

create or replace function public.create_transaction(
  p_account_id uuid,
  p_tipo text,
  p_monto numeric,
  p_category_id uuid,
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
  values (auth.uid(), p_account_id, p_tipo, p_category_id, v_category.nombre, v_signed_monto, p_nota, coalesce(p_fecha, public.today_local()))
  returning * into v_transaction;

  -- RN-040 (corregida en 20260901100000): en cuentas de crédito `saldo_actual` es la deuda en
  -- positivo, así que el impacto va invertido respecto al signo de `monto`.
  update public.accounts
  set saldo_actual = saldo_actual + (case when v_account.tipo = 'credito' then -v_signed_monto else v_signed_monto end)
  where id = p_account_id;

  return v_transaction;
end;
$$;

revoke all on function public.create_transaction(uuid, text, numeric, uuid, date, text) from public;
grant execute on function public.create_transaction(uuid, text, numeric, uuid, date, text) to authenticated;

-- create_transfer
drop function if exists public.create_transfer(uuid, uuid, numeric, timestamptz, text);

create or replace function public.create_transfer(
  p_cuenta_origen_id uuid,
  p_cuenta_destino_id uuid,
  p_monto numeric,
  p_fecha date,
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
  values (auth.uid(), p_cuenta_origen_id, 'transferencia', 'Transfer', -abs(p_monto), p_nota, coalesce(p_fecha, public.today_local()))
  returning * into v_tx_origen;

  insert into public.transactions (
    user_id, account_id, tipo, concepto, monto, nota, fecha, transaccion_relacionada_id
  )
  values (
    auth.uid(), p_cuenta_destino_id, 'transferencia', 'Transfer', abs(p_monto), p_nota,
    coalesce(p_fecha, public.today_local()), v_tx_origen.id
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

revoke all on function public.create_transfer(uuid, uuid, numeric, date, text) from public;
grant execute on function public.create_transfer(uuid, uuid, numeric, date, text) to authenticated;

-- update_transaction
drop function if exists public.update_transaction(uuid, numeric, uuid, timestamptz, text, uuid, uuid, numeric, numeric);

create or replace function public.update_transaction(
  p_transaction_id uuid,
  p_monto numeric,
  p_category_id uuid,
  p_fecha date,
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

revoke all on function public.update_transaction(uuid, numeric, uuid, date, text, uuid, uuid, numeric, numeric) from public;
grant execute on function public.update_transaction(uuid, numeric, uuid, date, text, uuid, uuid, numeric, numeric) to authenticated;

-- adjust_goal_balance
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
  values (auth.uid(), p_meta_id, v_diff, public.today_local())
  returning * into v_adjustment;

  return v_adjustment;
end;
$$;

revoke all on function public.adjust_goal_balance(uuid, numeric) from public;
grant execute on function public.adjust_goal_balance(uuid, numeric) to authenticated;
