-- Meses Sin Intereses (MSI) — módulo completo.
--
-- Consolida en un solo paso el diseño final de MSI. Parte del estado que dejaron las dos migraciones
-- previas (20260903100000 y 20260903110000, ya aplicadas), que modelaban una compra a meses como un
-- `gasto` con metadata encima. Ese modelo se descartó al usarlo: obligaba a excluir esas compras de
-- cada agregación de gasto para que no inflaran los reportes —son diez los hooks que suman
-- gasto/ingreso— y bastaba olvidarlo en uno para tener dos pantallas contradiciéndose.
--
-- Modelo definitivo:
--
--   * Una compra a meses es `tipo = 'compra_msi'`, **sin categoría**. La exclusión de los reportes
--     deja de ser una regla que recordar y pasa a ser estructural: toda agregación filtra por
--     `tipo in ('gasto','ingreso')`, así que ninguna la ve, ni las que se escriban después.
--   * El monto completo se carga a `saldo_actual` de la tarjeta el día de la compra. No es una
--     elección de modelado: es lo que se le debe al banco, y de ahí dependen el crédito disponible
--     y el patrimonio neto.
--   * `msi_mes_inicio` fija el mes de la primera parcialidad, que no siempre es el de la compra
--     (comprar después de la fecha de corte empuja el plan al mes siguiente).
--   * `msi_liquidado_mes` marca una liquidación anticipada: ese mes concentra todo lo que faltaba y
--     los posteriores quedan en cero. Liquidar adelanta la deuda, no la perdona.
--   * `msi_payments` guarda cuánto se pagó de cada parcialidad. Es el único dato de MSI que la
--     aplicación no puede derivar: un abono a la tarjeta es un monto único que no dice a qué plan
--     corresponde. Vive en tabla propia y no en `budgets.monto`, donde ese campo significa "lo que
--     planeo asignar" y alimenta el cálculo de "To assign".
--   * Se retira `budgets.msi_transaction_id`, que la primera versión había agregado: la mensualidad
--     se deriva del calendario y ya no se asigna, así que `budgets` vuelve a su forma anterior.

-- ---------------------------------------------------------------------------
-- 1. transactions — tipo compra_msi, mes de inicio y mes de liquidación
-- ---------------------------------------------------------------------------

alter table public.transactions drop constraint transactions_tipo_check;
alter table public.transactions add constraint transactions_tipo_check
  check (tipo in (
    'ajuste', 'gasto', 'ingreso', 'transferencia', 'pago_tarjeta',
    'aportacion_meta', 'retiro_meta', 'pago_deuda', 'compra_msi'
  ));

alter table public.transactions
  add column msi_mes_inicio text,
  add column msi_liquidado_mes text;

-- Los campos de MSI son obligatorios en `compra_msi` y prohibidos en cualquier otro tipo. La
-- categoría queda explícitamente nula: es lo que mantiene a estas compras fuera de todo reporte por
-- categoría sin depender de que cada consulta lo recuerde.
alter table public.transactions drop constraint transactions_msi_meses_valid;
alter table public.transactions
  add constraint transactions_msi_fields_valid check (
    (
      tipo = 'compra_msi'
      and msi_meses is not null and msi_meses between 2 and 60
      and msi_mes_inicio is not null and msi_mes_inicio ~ '^\d{4}-(0[1-9]|1[0-2])$'
      and category_id is null
    ) or (
      tipo <> 'compra_msi' and msi_meses is null and msi_mes_inicio is null
    )
  );

alter table public.transactions
  add constraint transactions_msi_liquidado_valid check (
    msi_liquidado_mes is null
    or (tipo = 'compra_msi' and msi_liquidado_mes ~ '^\d{4}-(0[1-9]|1[0-2])$')
  );

create index transactions_msi_idx on public.transactions (account_id, msi_mes_inicio)
  where tipo = 'compra_msi';

-- Conversión de los planes capturados con el modelo anterior. El mes de inicio se toma del mes de la
-- compra (que es lo que ese modelo asumía) y la descripción se rescata de la nota, que era donde
-- caía: `concepto` traía el nombre de la categoría, inservible como nombre de plan.
update public.transactions
set tipo = 'compra_msi',
    msi_mes_inicio = to_char(fecha, 'YYYY-MM'),
    concepto = coalesce(nullif(nota, ''), concepto),
    category_id = null
where tipo = 'gasto' and msi_meses is not null;

-- ---------------------------------------------------------------------------
-- 2. create_transaction / update_transaction — se les retira el parámetro de MSI
--    (un gasto ya no puede ser a meses; para eso está create_msi_purchase)
-- ---------------------------------------------------------------------------

drop function if exists public.create_transaction(uuid, text, numeric, uuid, timestamptz, text, smallint);

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

  -- RN-040 (corregida en 20260901100000): en cuentas de crédito `saldo_actual` es la deuda en
  -- positivo, así que el impacto va invertido respecto al signo de `monto`.
  update public.accounts
  set saldo_actual = saldo_actual + (case when v_account.tipo = 'credito' then -v_signed_monto else v_signed_monto end)
  where id = p_account_id;

  return v_transaction;
end;
$$;

revoke all on function public.create_transaction(uuid, text, numeric, uuid, timestamptz, text) from public;
grant execute on function public.create_transaction(uuid, text, numeric, uuid, timestamptz, text) to authenticated;

drop function if exists public.update_transaction(uuid, numeric, uuid, timestamptz, text, uuid, uuid, numeric, numeric, smallint);

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

-- ---------------------------------------------------------------------------
-- 3. create_msi_purchase / update_msi_purchase / set_msi_settlement
-- ---------------------------------------------------------------------------

create or replace function public.create_msi_purchase(
  p_account_id uuid,
  p_concepto text,
  p_monto numeric,
  p_meses smallint,
  p_mes_inicio text,
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
    coalesce(p_fecha, now()), p_meses, p_mes_inicio
  )
  returning * into v_transaction;

  -- La deuda de la tarjeta sube por el monto completo desde el día de la compra.
  update public.accounts
  set saldo_actual = saldo_actual + abs(p_monto)
  where id = p_account_id;

  return v_transaction;
end;
$$;

revoke all on function public.create_msi_purchase(uuid, text, numeric, smallint, text, timestamptz, text) from public;
grant execute on function public.create_msi_purchase(uuid, text, numeric, smallint, text, timestamptz, text) to authenticated;

create or replace function public.update_msi_purchase(
  p_transaction_id uuid,
  p_concepto text,
  p_monto numeric,
  p_meses smallint,
  p_mes_inicio text,
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

  select * into v_tx from public.transactions
  where id = p_transaction_id and user_id = auth.uid() and tipo = 'compra_msi'
  for update;

  if not found then
    raise exception 'BIZ_035';
  end if;

  v_old_monto := v_tx.monto;
  v_new_monto := -abs(p_monto);

  update public.transactions
  set concepto = trim(p_concepto),
      monto = v_new_monto,
      msi_meses = p_meses,
      msi_mes_inicio = p_mes_inicio,
      nota = p_nota
  where id = p_transaction_id
  returning * into v_tx;

  -- La cuenta siempre es de crédito (lo garantiza create_msi_purchase), así que el impacto sobre
  -- `saldo_actual` va invertido respecto al signo de `monto`: si la compra sube, la deuda sube.
  update public.accounts
  set saldo_actual = saldo_actual - (v_new_monto - v_old_monto)
  where id = v_tx.account_id;

  return v_tx;
end;
$$;

revoke all on function public.update_msi_purchase(uuid, text, numeric, smallint, text, text) from public;
grant execute on function public.update_msi_purchase(uuid, text, numeric, smallint, text, text) to authenticated;

create or replace function public.set_msi_settlement(
  p_transaction_id uuid,
  p_mes text
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
  v_ultimo_mes text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  select * into v_tx from public.transactions
  where id = p_transaction_id and user_id = auth.uid() and tipo = 'compra_msi'
  for update;

  if not found then
    raise exception 'BIZ_035';
  end if;

  if p_mes is not null then
    if p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' then
      raise exception 'VALIDATION_017';
    end if;

    -- Último mes con parcialidad del plan: inicio + (meses - 1).
    v_ultimo_mes := to_char(
      to_date(v_tx.msi_mes_inicio || '-01', 'YYYY-MM-DD') + ((v_tx.msi_meses - 1) || ' months')::interval,
      'YYYY-MM'
    );

    -- Liquidar fuera del rango del plan no significa nada: antes de que empiece no hay qué
    -- adelantar, y después de que termina ya no queda saldo.
    if p_mes < v_tx.msi_mes_inicio or p_mes > v_ultimo_mes then
      raise exception 'VALIDATION_039';
    end if;
  end if;

  update public.transactions
  set msi_liquidado_mes = p_mes
  where id = p_transaction_id
  returning * into v_tx;

  return v_tx;
end;
$$;

revoke all on function public.set_msi_settlement(uuid, text) from public;
grant execute on function public.set_msi_settlement(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. msi_payments — cuánto se pagó de cada parcialidad
-- ---------------------------------------------------------------------------

create table public.msi_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- Si se borra la compra, sus pagos se van con ella: sin plan no significan nada.
  msi_transaction_id uuid not null references public.transactions (id) on delete cascade,
  mes text not null,
  monto numeric(14,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint msi_payments_mes_format check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  constraint msi_payments_monto_non_negative check (monto >= 0)
);

create unique index msi_payments_user_plan_mes_key
  on public.msi_payments (user_id, msi_transaction_id, mes);

create trigger msi_payments_set_updated_at
before update on public.msi_payments
for each row execute function public.set_updated_at();

alter table public.msi_payments enable row level security;

create policy "msi_payments_select_own" on public.msi_payments for select to authenticated
  using (auth.uid() = user_id);
create policy "msi_payments_insert_own" on public.msi_payments for insert to authenticated
  with check (auth.uid() = user_id);
create policy "msi_payments_update_own" on public.msi_payments for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "msi_payments_delete_own" on public.msi_payments for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.save_msi_payment(
  p_msi_transaction_id uuid,
  p_mes text,
  p_monto numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_mes is null or p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'VALIDATION_017';
  end if;

  select * into v_tx from public.transactions
  where id = p_msi_transaction_id and user_id = auth.uid() and tipo = 'compra_msi';

  if not found then
    raise exception 'BIZ_035';
  end if;

  -- Vaciar el campo borra el registro, mismo criterio que save_budgets con un monto nulo.
  if p_monto is null then
    delete from public.msi_payments
    where user_id = auth.uid() and msi_transaction_id = p_msi_transaction_id and mes = p_mes;
    return;
  end if;

  if p_monto < 0 then
    raise exception 'VALIDATION_016';
  end if;

  insert into public.msi_payments (user_id, msi_transaction_id, mes, monto)
  values (auth.uid(), p_msi_transaction_id, p_mes, p_monto)
  on conflict (user_id, msi_transaction_id, mes)
  do update set monto = excluded.monto;
end;
$$;

revoke all on function public.save_msi_payment(uuid, text, numeric) from public;
grant execute on function public.save_msi_payment(uuid, text, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. budgets — se retira msi_transaction_id y la tabla vuelve a su forma anterior
--    (la mensualidad se deriva del calendario: ya no hay nada que asignarle)
-- ---------------------------------------------------------------------------

drop index if exists public.budgets_user_msi_transaction_mes_key;
alter table public.budgets drop constraint budgets_category_xor_meta_xor_deuda_xor_msi;

-- Un renglón cuya única referencia era el plan ya no tiene sentido, y violaría el constraint de tres
-- vías que se restablece abajo. En producción no debería haber ninguno (la funcionalidad nunca llegó
-- a usarse allá), pero se limpia por si acaso.
delete from public.budgets where msi_transaction_id is not null;

alter table public.budgets drop column msi_transaction_id;

-- RN-222: category_id, meta_id y deuda_id son mutuamente excluyentes — exactamente uno no nulo.
alter table public.budgets
  add constraint budgets_category_xor_meta_xor_deuda check (
    (case when category_id is not null then 1 else 0 end
     + case when meta_id is not null then 1 else 0 end
     + case when deuda_id is not null then 1 else 0 end) = 1
  );

-- ---------------------------------------------------------------------------
-- 6. save_budgets / copy_budget_month — vuelven a su versión previa a MSI
-- ---------------------------------------------------------------------------

create or replace function public.save_budgets(p_mes text, p_items jsonb)
returns setof public.budgets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_category_id uuid;
  v_meta_id uuid;
  v_deuda_id uuid;
  v_monto numeric(14,2);
  v_category public.categories;
  v_meta public.savings_goals;
  v_deuda public.debts;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'VALIDATION_017';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_category_id := nullif(v_item->>'category_id', '')::uuid;
    v_meta_id := nullif(v_item->>'meta_id', '')::uuid;
    v_deuda_id := nullif(v_item->>'deuda_id', '')::uuid;
    v_monto := nullif(v_item->>'monto', '')::numeric(14,2);

    if v_category_id is not null then
      select * into v_category from public.categories
      where id = v_category_id and user_id = auth.uid() and tipo = 'categoria' and status = 'active';

      if not found then
        -- RN-058 alt.: categoría archivada/ajena/inexistente — se omite este ítem, no aborta el lote.
        continue;
      end if;
    end if;

    if v_meta_id is not null then
      select * into v_meta from public.savings_goals
      where id = v_meta_id and user_id = auth.uid() and status = 'active';

      if not found then
        continue;
      end if;
    end if;

    if v_deuda_id is not null then
      select * into v_deuda from public.debts
      where id = v_deuda_id and user_id = auth.uid() and status = 'active';

      if not found then
        continue;
      end if;
    end if;

    if v_monto is null then
      delete from public.budgets
      where user_id = auth.uid() and mes = p_mes
        and (
          (v_category_id is not null and category_id = v_category_id)
          or (v_meta_id is not null and meta_id = v_meta_id)
          or (v_deuda_id is not null and deuda_id = v_deuda_id)
        );
      continue;
    end if;

    if v_monto < 0 then
      raise exception 'VALIDATION_016';
    end if;

    if v_category_id is not null then
      insert into public.budgets (user_id, category_id, mes, monto)
      values (auth.uid(), v_category_id, p_mes, v_monto)
      on conflict (user_id, category_id, mes) where category_id is not null
      do update set monto = excluded.monto;
    elsif v_meta_id is not null then
      insert into public.budgets (user_id, meta_id, mes, monto)
      values (auth.uid(), v_meta_id, p_mes, v_monto)
      on conflict (user_id, meta_id, mes) where meta_id is not null
      do update set monto = excluded.monto;
    else
      insert into public.budgets (user_id, deuda_id, mes, monto)
      values (auth.uid(), v_deuda_id, p_mes, v_monto)
      on conflict (user_id, deuda_id, mes) where deuda_id is not null
      do update set monto = excluded.monto;
    end if;
  end loop;

  return query select * from public.budgets where user_id = auth.uid() and mes = p_mes;
end;
$$;

revoke all on function public.save_budgets(text, jsonb) from public;
grant execute on function public.save_budgets(text, jsonb) to authenticated;

create or replace function public.copy_budget_month(
  p_mes_origen text,
  p_mes_destino text,
  p_confirmar_sobrescritura boolean default false
)
returns setof public.budgets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origen_count int;
  v_destino_count int;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_mes_origen !~ '^\d{4}-(0[1-9]|1[0-2])$' or p_mes_destino !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'VALIDATION_017';
  end if;

  select count(*) into v_origen_count from public.budgets
  where user_id = auth.uid() and mes = p_mes_origen;

  if v_origen_count = 0 then
    raise exception 'BIZ_018';
  end if;

  select count(*) into v_destino_count from public.budgets
  where user_id = auth.uid() and mes = p_mes_destino;

  if v_destino_count > 0 and not p_confirmar_sobrescritura then
    raise exception 'BIZ_017';
  end if;

  if v_destino_count > 0 then
    delete from public.budgets where user_id = auth.uid() and mes = p_mes_destino;
  end if;

  -- Las categorías/metas/deudas archivadas al momento de la copia no se incluyen, aunque hayan
  -- tenido presupuesto en el mes de origen (alt. flujo de CU-020).
  insert into public.budgets (user_id, category_id, meta_id, deuda_id, mes, monto)
  select auth.uid(), b.category_id, b.meta_id, b.deuda_id, p_mes_destino, b.monto
  from public.budgets b
  left join public.categories c on c.id = b.category_id
  left join public.savings_goals g on g.id = b.meta_id
  left join public.debts d on d.id = b.deuda_id
  where b.user_id = auth.uid() and b.mes = p_mes_origen
    and (b.category_id is null or c.status = 'active')
    and (b.meta_id is null or g.status = 'active')
    and (b.deuda_id is null or d.status = 'active');

  return query select * from public.budgets where user_id = auth.uid() and mes = p_mes_destino;
end;
$$;

revoke all on function public.copy_budget_month(text, text, boolean) from public;
grant execute on function public.copy_budget_month(text, text, boolean) to authenticated;
