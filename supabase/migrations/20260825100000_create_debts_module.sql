-- Módulo Créditos y Deudas (CU-055 a CU-060) — docs/pdr/creditos-deudas.md, docs/pdr/data-model-registry.md
--
-- Retoma la nota dejada en transacciones.md al cerrarse ese módulo: el pago a deudas externas
-- (auto, hipoteca, préstamos personales) se excluyó a propósito de ahí para resolverse aquí como
-- entidad propia, no como cuenta. A diferencia de `investments.balance_actual` (capturado a mano),
-- el saldo de una deuda SÍ se deriva de `transactions` — pero solo de la porción de capital de cada
-- pago, nunca del interés (RN-202, RN-216). Cada deuda activa gana además su propio renglón
-- presupuestable en `budgets`, igual que cada meta de ahorro.

-- ---------------------------------------------------------------------------
-- 1. debts
-- ---------------------------------------------------------------------------

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  nombre text not null,
  tipo text not null,
  monto_original numeric(14,2) not null,
  tasa_interes numeric(5,2) not null default 0,
  pago_mensual_esperado numeric(14,2),
  dia_pago smallint,
  fecha_liquidacion_estimada date,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint debts_nombre_length check (char_length(nombre) between 2 and 50),
  -- RN-196: catálogo cerrado, no administrable por el usuario.
  constraint debts_tipo_valid check (tipo in ('auto', 'hipoteca', 'personal', 'otro')),
  -- RN-197: a diferencia de accounts.saldo_inicial, sí es editable después de creada (CU-058).
  constraint debts_monto_original_positive check (monto_original > 0),
  constraint debts_tasa_interes_non_negative check (tasa_interes >= 0),
  constraint debts_pago_mensual_esperado_positive check (pago_mensual_esperado is null or pago_mensual_esperado > 0),
  constraint debts_dia_pago_range check (dia_pago is null or dia_pago between 1 and 31)
);

-- RN-195: nombre único solo entre deudas activas — una deuda archivada libera su nombre.
create unique index debts_user_nombre_active_key on public.debts (user_id, nombre)
  where status = 'active';
create index debts_user_status_idx on public.debts (user_id, status);

create trigger debts_set_updated_at
before update on public.debts
for each row execute function public.set_updated_at();

alter table public.debts enable row level security;

create policy "debts_select_own" on public.debts for select to authenticated
  using (auth.uid() = user_id);
create policy "debts_insert_own" on public.debts for insert to authenticated
  with check (auth.uid() = user_id);
create policy "debts_update_own" on public.debts for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Sin política de delete — baja lógica únicamente (status=archived), mismo patrón que savings_goals
-- (este módulo no tiene un CU de eliminación física, a diferencia de investments).

-- ---------------------------------------------------------------------------
-- 2. transactions — pago_deuda, deuda_id, monto_capital, monto_interes
-- ---------------------------------------------------------------------------

alter table public.transactions drop constraint transactions_tipo_check;
alter table public.transactions add constraint transactions_tipo_check
  check (tipo in ('ajuste', 'gasto', 'ingreso', 'transferencia', 'pago_tarjeta', 'aportacion_meta', 'retiro_meta', 'pago_deuda'));

alter table public.transactions
  add column deuda_id uuid references public.debts (id),
  add column monto_capital numeric(14,2),
  add column monto_interes numeric(14,2);

-- RN-215/RN-217: capital e interés obligatorios solo para pago_deuda, ambos no negativos, y su
-- suma debe igualar el monto total del movimiento (con signo, de ahí el abs()).
alter table public.transactions
  add constraint transactions_pago_deuda_fields check (
    (
      tipo = 'pago_deuda' and deuda_id is not null and monto_capital is not null and monto_interes is not null
      and monto_capital >= 0 and monto_interes >= 0 and monto_capital + monto_interes = abs(monto)
    ) or (
      tipo <> 'pago_deuda' and deuda_id is null and monto_capital is null and monto_interes is null
    )
  );

-- CU-057/CU-060: listar pagos de una deuda en orden cronológico descendente.
create index transactions_deuda_fecha_idx on public.transactions (deuda_id, fecha desc)
  where deuda_id is not null;

-- ---------------------------------------------------------------------------
-- 3. budgets — deuda_id, tercera opción mutuamente excluyente
-- ---------------------------------------------------------------------------

alter table public.budgets drop constraint budgets_category_xor_meta;

alter table public.budgets
  add column deuda_id uuid references public.debts (id);

-- RN-222: category_id, meta_id y deuda_id son mutuamente excluyentes — exactamente uno no nulo.
alter table public.budgets
  add constraint budgets_category_xor_meta_xor_deuda check (
    (case when category_id is not null then 1 else 0 end
     + case when meta_id is not null then 1 else 0 end
     + case when deuda_id is not null then 1 else 0 end) = 1
  );

create unique index budgets_user_deuda_mes_key on public.budgets (user_id, deuda_id, mes)
  where deuda_id is not null;

-- ---------------------------------------------------------------------------
-- 4. save_budgets — mismo cuerpo vigente (20260822100000), + rama deuda_id (RN-222)
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
        -- Mismo criterio que una categoría archivada/ajena — se omite el ítem, no aborta el lote.
        continue;
      end if;
    end if;

    if v_deuda_id is not null then
      select * into v_deuda from public.debts
      where id = v_deuda_id and user_id = auth.uid() and status = 'active';

      if not found then
        -- RN-222: mismo criterio que meta_id — se omite el ítem, no aborta el lote.
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

-- ---------------------------------------------------------------------------
-- 5. copy_budget_month — mismo cuerpo vigente, + deuda_id (RN-222)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 6. create_debt_payment (CU-060)
-- ---------------------------------------------------------------------------

create or replace function public.create_debt_payment(
  p_deuda_id uuid,
  p_account_id uuid,
  p_monto_capital numeric,
  p_monto_interes numeric,
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
    'Pago a deuda: ' || v_deuda.nombre, v_signed_monto, p_nota, coalesce(p_fecha, now())
  )
  returning * into v_transaction;

  update public.accounts set saldo_actual = saldo_actual + v_signed_monto where id = p_account_id;

  return v_transaction;
end;
$$;

revoke all on function public.create_debt_payment(uuid, uuid, numeric, numeric, timestamptz, text) from public;
grant execute on function public.create_debt_payment(uuid, uuid, numeric, numeric, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. update_transaction — mismo cuerpo vigente (20260822100000), + rama pago_deuda (RN-224)
-- ---------------------------------------------------------------------------
-- Agrega tres parámetros nuevos al final de la firma — mismo motivo que la extensión de Ahorros:
-- `create or replace` solo sustituye una función cuando la firma coincide exactamente.
drop function if exists public.update_transaction(uuid, numeric, uuid, timestamptz, text, uuid);

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

    if v_tx.tipo = 'gasto' and v_group.flujo <> 'outflow' then
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

revoke all on function public.update_transaction(uuid, numeric, uuid, timestamptz, text, uuid, uuid, numeric, numeric) from public;
grant execute on function public.update_transaction(uuid, numeric, uuid, timestamptz, text, uuid, uuid, numeric, numeric) to authenticated;
